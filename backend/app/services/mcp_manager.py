"""
MCP (Model Context Protocol) Manager Service
Handles connections to external MCP servers and manages MCP tool discovery
"""

import asyncio
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from fastmcp import FastMCP, Client
import httpx
import json
import logging
from datetime import datetime
from ..db import models
from .data_processor import create_data_processor

logger = logging.getLogger(__name__)


class MCPManager:
    """Service for managing MCP server connections and tool discovery"""
    
    def __init__(self, db: Session):
        self.db = db
        self.connected_clients = {}  # server_id -> Client
        self.available_tools = {}    # server_id -> {tool_name: tool_info}
        self._fastmcp_server = None  # Our own MCP server instance
        self.data_processor = create_data_processor()  # Data processing service
    
    async def initialize(self):
        """Initialize the MCP manager and load configured servers"""
        logger.info("🔗 Initializing MCP Manager...")
        
        # Load all active MCP servers from database
        mcp_servers = self.db.query(models.MCPServer).filter(
            models.MCPServer.status == models.MCPServerStatus.active
        ).all()
        
        logger.info(f"📡 Found {len(mcp_servers)} configured MCP servers")
        
        # Connect to each server
        for server in mcp_servers:
            try:
                logger.info(f"🔗 Attempting to connect to {server.name} ({server.transport})")
                result = await self.connect_to_server(server)
                if result:
                    logger.info(f"✅ Successfully connected to {server.name}")
                    tools_count = len(self.available_tools.get(str(server.id), {}))
                    logger.info(f"📋 Loaded {tools_count} tools from {server.name}")
                else:
                    logger.warning(f"⚠️ Failed to connect to {server.name}")
            except Exception as e:
                logger.error(f"❌ Failed to connect to MCP server {server.name}: {e}")
        
        total_tools = sum(len(tools) for tools in self.available_tools.values())
        logger.info(f"✅ MCP Manager initialized successfully with {total_tools} total tools")
    
    async def connect_to_server(self, server: models.MCPServer) -> bool:
        """Connect to an MCP server and discover its tools"""
        try:
            logger.info(f"🔗 Connecting to MCP server: {server.name} ({server.transport})")
            
            if server.transport == models.MCPTransportType.http:
                # HTTP-based MCP server (like ServiceNow)
                await self._connect_http_server(server)
            elif server.transport == models.MCPTransportType.sse:
                # SSE-based MCP server
                await self._connect_fastmcp_server(server, "sse")
            elif server.transport == models.MCPTransportType.stdio:
                # stdio-based MCP server
                await self._connect_fastmcp_server(server, "stdio")
            else:
                raise ValueError(f"Unsupported transport: {server.transport}")
            
            # Update server status
            server.status = models.MCPServerStatus.active
            server.last_connected_at = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"✅ Successfully connected to MCP server: {server.name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to MCP server {server.name}: {e}")
            server.status = models.MCPServerStatus.error
            server.error_message = str(e)
            self.db.commit()
            return False
    
    async def _connect_http_server(self, server: models.MCPServer):
        """Connect to HTTP-based MCP server (like ServiceNow)"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test connection with health check
            health_url = f"{server.url}/health"
            logger.info(f"🏥 Testing health endpoint: {health_url}")
            
            headers = {'Content-Type': 'application/json'}
            if server.auth_token:
                headers['Authorization'] = f"Bearer {server.auth_token}"
            
            try:
                response = await client.get(health_url, headers=headers)
                response.raise_for_status()
                health_data = response.json()
                logger.info(f"✅ Health check passed: {health_data}")
            except Exception as e:
                raise Exception(f"Health check failed: {e}")
            
            # Discover tools
            await self._discover_http_tools(server, client, headers)
            
            # Store HTTP client info (we'll create new clients for actual calls)
            self.connected_clients[str(server.id)] = {
                'type': 'http',
                'url': server.url,
                'headers': headers
            }
    
    async def _connect_fastmcp_server(self, server: models.MCPServer, transport_type: str):
        """Connect to FastMCP-based server (SSE/stdio)"""
        # Create client based on transport type
        if transport_type == "sse":
            client = Client(server.url)
        elif transport_type == "stdio":
            client = Client(server.command)
        else:
            raise ValueError(f"Unsupported FastMCP transport: {transport_type}")
        
        # Connect using async context manager
        await client.__aenter__()
        
        if server.auth_token:
            # Authentication method may vary - this is a placeholder
            pass
        
        # Store the connected client
        self.connected_clients[str(server.id)] = client
        
        # Discover available tools using FastMCP method
        await self._discover_fastmcp_tools(server, client)
    
    async def _discover_http_tools(self, server: models.MCPServer, client: httpx.AsyncClient, headers: Dict[str, str]):
        """Discover tools from HTTP-based MCP server"""
        try:
            logger.info(f"🔍 Discovering tools from HTTP MCP server: {server.name}")
            
            # Get list of available tools from the server
            tools_url = f"{server.url}/tools"
            response = await client.get(tools_url, headers=headers)
            response.raise_for_status()
            
            tools_data = response.json()
            tools = tools_data.get('tools', []) if isinstance(tools_data, dict) else tools_data
            
            server_tools = {}
            
            for tool in tools:
                tool_name = tool.get('name', '')
                tool_description = tool.get('description', '')
                tool_parameters = tool.get('inputSchema', {}).get('properties', {})
                
                server_tools[tool_name] = {
                    'name': tool_name,
                    'description': tool_description,
                    'parameters': list(tool_parameters.keys()),
                    'schema': tool.get('inputSchema', {}),
                    'server_id': str(server.id),
                    'server_name': server.name,
                    'category': 'MCP External'
                }
                
                logger.info(f"  📋 Found tool: {tool_name}")
            
            # Store discovered tools
            self.available_tools[str(server.id)] = server_tools
            
            # Update server metadata
            server.tools_count = len(server_tools)
            server.tools_discovered_at = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"✅ Discovered {len(server_tools)} tools from {server.name}")
            
        except Exception as e:
            logger.error(f"❌ Failed to discover HTTP tools from {server.name}: {e}")
            raise
    
    async def _discover_fastmcp_tools(self, server: models.MCPServer, client: Client):
        """Discover and catalog tools available from a FastMCP server"""
        try:
            logger.info(f"🔍 Discovering tools from FastMCP server: {server.name}")
            
            # Get list of available tools from the server
            tools = await client.list_tools()
            
            server_tools = {}
            
            for tool in tools:
                tool_name = tool.name
                tool_description = tool.description or ''
                tool_parameters = tool.inputSchema.get('properties', {}) if tool.inputSchema else {}
                
                server_tools[tool_name] = {
                    'name': tool_name,
                    'description': tool_description,
                    'parameters': list(tool_parameters.keys()),
                    'schema': tool.inputSchema or {},
                    'server_id': str(server.id),
                    'server_name': server.name,
                    'category': 'MCP External'
                }
                
                logger.info(f"  📋 Found tool: {tool_name}")
            
            # Store discovered tools
            self.available_tools[str(server.id)] = server_tools
            
            # Update server metadata
            server.tools_count = len(server_tools)
            server.tools_discovered_at = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"✅ Discovered {len(server_tools)} tools from {server.name}")
            
        except Exception as e:
            logger.error(f"❌ Failed to discover FastMCP tools from {server.name}: {e}")
            raise
    
    async def disconnect_from_server(self, server_id: str):
        """Disconnect from an MCP server"""
        try:
            if server_id in self.connected_clients:
                client_info = self.connected_clients[server_id]
                
                # Only call __aexit__ for FastMCP clients, not HTTP clients
                if not isinstance(client_info, dict):
                    await client_info.__aexit__(None, None, None)
                
                del self.connected_clients[server_id]
                
                if server_id in self.available_tools:
                    del self.available_tools[server_id]
                
                # Update server status in database
                server = self.db.query(models.MCPServer).filter(
                    models.MCPServer.id == server_id
                ).first()
                if server:
                    server.status = models.MCPServerStatus.inactive
                    self.db.commit()
                
                logger.info(f"🔌 Disconnected from MCP server: {server_id}")
                
        except Exception as e:
            logger.error(f"❌ Error disconnecting from MCP server {server_id}: {e}")
    
    def get_all_mcp_tools(self) -> Dict[str, Any]:
        """Get all tools available from connected MCP servers"""
        all_tools = {}
        
        for server_id, server_tools in self.available_tools.items():
            for tool_name, tool_info in server_tools.items():
                # Prefix tool name with server to avoid conflicts
                prefixed_name = f"mcp_{server_id[:8]}_{tool_name}"
                all_tools[prefixed_name] = tool_info
        
        return all_tools
    
    def get_tools_for_server(self, server_id: str) -> Dict[str, Any]:
        """Get tools available from a specific MCP server"""
        return self.available_tools.get(server_id, {})
    
    async def get_server_tools(self, server_id: str) -> Dict[str, Any]:
        """Get tools available from a specific MCP server (async version for router compatibility)"""
        return self.available_tools.get(str(server_id), {})
    
    async def execute_mcp_tool(self, tool_name: str, server_id: str, **kwargs) -> Any:
        """Execute a tool on a connected MCP server"""
        try:
            client_info = self.connected_clients.get(server_id)
            if not client_info:
                return {"error": f"Not connected to MCP server: {server_id}"}
            
            logger.info(f"🔧 Executing MCP tool: {tool_name} on server: {server_id}")
            
            # Check if this is an HTTP-based or FastMCP-based client
            if isinstance(client_info, dict) and client_info.get('type') == 'http':
                # HTTP-based MCP server (like ServiceNow)
                result = await self._execute_http_tool(tool_name, client_info, kwargs)
            else:
                # FastMCP-based server
                result = await client_info.call_tool(tool_name, kwargs)
            
            logger.info(f"✅ MCP tool {tool_name} executed successfully")
            return result
            
        except Exception as e:
            logger.error(f"❌ MCP tool {tool_name} execution failed: {e}")
            return {"error": f"Tool execution failed: {str(e)}"}
    
    async def _execute_http_tool(self, tool_name: str, client_info: Dict[str, str], arguments: Dict[str, Any]) -> Any:
        """Execute a tool on an HTTP-based MCP server"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            tool_url = f"{client_info['url']}/tools/{tool_name}"
            payload = {"arguments": arguments}
            
            # 🔍 DEBUG: Log the actual API call details
            logger.info(f"🔍 [ServiceNow API DEBUG] Tool: {tool_name}")
            logger.info(f"🔍 [ServiceNow API DEBUG] URL: {tool_url}")
            logger.info(f"🔍 [ServiceNow API DEBUG] Arguments: {json.dumps(arguments)}")
            logger.info(f"🔍 [ServiceNow API DEBUG] Headers: {dict(client_info['headers'])}")
            logger.info(f"🔍 [ServiceNow API DEBUG] Full Payload: {json.dumps(payload)}")
            
            # 🔍 DEBUG: Extract key query details for easier analysis
            if 'query' in arguments:
                logger.info(f"🔍 [ServiceNow API DEBUG] QUERY STRING: '{arguments['query']}'")
            if 'limit' in arguments:
                logger.info(f"🔍 [ServiceNow API DEBUG] LIMIT: {arguments['limit']}")
                
            logger.info(f"🔍 [ServiceNow API DEBUG] === API CALL START ===")
            
            response = await client.post(tool_url, json=payload, headers=client_info['headers'])
            
            # 🔍 DEBUG: Log the response details
            logger.info(f"🔍 [ServiceNow API DEBUG] === API CALL END ===")
            logger.info(f"🔍 [ServiceNow API DEBUG] Response Status: {response.status_code}")
            logger.info(f"🔍 [ServiceNow API DEBUG] Response Headers: {dict(response.headers)}")
            
            response.raise_for_status()
            
            result = response.json()
            
            # 🔍 DEBUG: Log the raw response
            logger.info(f"🔍 [ServiceNow API DEBUG] Raw Response: {json.dumps(result, indent=2)}")
            
            # Handle ServiceNow-style error responses
            if result.get('isError'):
                error_msg = f"Tool error: {result['content'][0]['text']}"
                logger.error(f"❌ [ServiceNow API DEBUG] Error Response: {error_msg}")
                raise Exception(error_msg)
            
            # Parse the text content as JSON if possible
            if 'content' in result and len(result['content']) > 0:
                content_text = result['content'][0]['text']
                logger.info(f"🔍 [ServiceNow API DEBUG] Content Text: {content_text[:500]}..." if len(content_text) > 500 else f"🔍 [ServiceNow API DEBUG] Content Text: {content_text}")
                try:
                    parsed_content = json.loads(content_text)
                    logger.info(f"🔍 [ServiceNow API DEBUG] Parsed JSON Content Length: {len(parsed_content) if isinstance(parsed_content, list) else 'Not a list'}")
                    
                    # 🚀 INTELLIGENT DATA PROCESSING
                    if isinstance(parsed_content, list) and len(parsed_content) > 50:
                        logger.info(f"📊 Large dataset detected ({len(parsed_content)} items). Processing with pandas...")
                        
                        # Detect query type from tool name and arguments
                        query_type = self._detect_query_type(tool_name, arguments)
                        
                        # Process large dataset
                        processed_result = self.data_processor.process_servicenow_incidents(
                            parsed_content, 
                            query_type
                        )
                        
                        logger.info(f"✅ Data processing complete. Returning summarized data instead of raw {len(parsed_content)} items")
                        return processed_result
                    
                    logger.info(f"🔍 [ServiceNow API DEBUG] Returning raw JSON (small dataset)")
                    return parsed_content
                except json.JSONDecodeError:
                    logger.info(f"🔍 [ServiceNow API DEBUG] Content is not JSON, returning as text")
                    return content_text
            
            logger.info(f"🔍 [ServiceNow API DEBUG] Returning raw result: {json.dumps(result, indent=2)}")
            return result
    
    def _detect_query_type(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Detect the type of query based on tool name and arguments for intelligent processing"""
        
        # Check query content for grouping keywords
        query = arguments.get('query', '').lower()
        
        if tool_name == 'list_incidents':
            # Check for company-related patterns
            if any(term in query for term in ['company', 'customer', 'client']):
                return 'top_companies'
            
            # Check for assignment group patterns  
            if 'assignment_group' in query:
                return 'top_teams'
            
            # Check for status patterns
            if any(term in query for term in ['state', 'status', 'closed', 'resolved']):
                return 'status_analysis'
            
            # Check for priority patterns
            if 'priority' in query:
                return 'priority_analysis'
            
            # Default for large incident lists
            if arguments.get('limit', 0) > 100:
                return 'top_companies'  # Assume company grouping for large datasets
        
        return 'general'
    
    def create_fastmcp_server(self) -> FastMCP:
        """Create and configure our own FastMCP server for exposing internal tools"""
        if self._fastmcp_server is None:
            self._fastmcp_server = FastMCP()
            
            # We'll add tools to this server later when integrating with ToolLoader
            logger.info("🚀 Created FastMCP server for exposing internal tools")
        
        return self._fastmcp_server
    
    async def refresh_server_tools(self, server_id: str) -> bool:
        """Refresh tool discovery for a specific server"""
        try:
            server = self.db.query(models.MCPServer).filter(
                models.MCPServer.id == server_id
            ).first()
            
            if not server:
                return False
            
            client = self.connected_clients.get(server_id)
            if client:
                await self.discover_tools(server, client)
                return True
            else:
                # Try to reconnect
                return await self.connect_to_server(server)
                
        except Exception as e:
            logger.error(f"❌ Failed to refresh tools for server {server_id}: {e}")
            return False
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on all connected MCP servers"""
        health_status = {
            "total_servers": len(self.connected_clients),
            "healthy_servers": 0,
            "servers": {}
        }
        
        for server_id, client_info in self.connected_clients.items():
            try:
                if isinstance(client_info, dict) and client_info.get('type') == 'http':
                    # HTTP-based MCP server - test with health endpoint
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        health_url = f"{client_info['url']}/health"
                        response = await client.get(health_url, headers=client_info['headers'])
                        response.raise_for_status()
                        health_status["servers"][server_id] = {"status": "healthy"}
                        health_status["healthy_servers"] += 1
                else:
                    # FastMCP-based server
                    if hasattr(client_info, 'is_connected') and client_info.is_connected():
                        await client_info.ping()
                        health_status["servers"][server_id] = {"status": "healthy"}
                        health_status["healthy_servers"] += 1
                    else:
                        health_status["servers"][server_id] = {"status": "disconnected"}
            except Exception as e:
                health_status["servers"][server_id] = {
                    "status": "unhealthy", 
                    "error": str(e)
                }
        
        return health_status
    
    async def shutdown(self):
        """Shutdown the MCP manager and disconnect from all servers"""
        logger.info("🔌 Shutting down MCP Manager...")
        
        # Disconnect from all servers
        for server_id in list(self.connected_clients.keys()):
            await self.disconnect_from_server(server_id)
        
        logger.info("✅ MCP Manager shutdown complete")


def create_mcp_manager(db: Session) -> MCPManager:
    """Factory function to create MCP manager"""
    return MCPManager(db)