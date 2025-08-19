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
from ..db import models

logger = logging.getLogger(__name__)


class MCPManager:
    """Service for managing MCP server connections and tool discovery"""
    
    def __init__(self, db: Session):
        self.db = db
        self.connected_clients = {}  # server_id -> Client
        self.available_tools = {}    # server_id -> {tool_name: tool_info}
        self._fastmcp_server = None  # Our own MCP server instance
    
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
                await self.connect_to_server(server)
            except Exception as e:
                logger.error(f"❌ Failed to connect to MCP server {server.name}: {e}")
        
        logger.info("✅ MCP Manager initialized successfully")
    
    async def connect_to_server(self, server: models.MCPServer) -> bool:
        """Connect to an MCP server and discover its tools"""
        try:
            logger.info(f"🔗 Connecting to MCP server: {server.name} ({server.transport})")
            
            # Create client based on transport type
            if server.transport == models.MCPTransportType.sse:
                client = Client(server.url)
            elif server.transport == models.MCPTransportType.stdio:
                client = Client(server.command)  
            elif server.transport == models.MCPTransportType.http:
                client = Client(server.url)
            else:
                raise ValueError(f"Unsupported transport: {server.transport}")
            
            # Connect using async context manager
            await client.__aenter__()
            
            if server.auth_token:
                # Authentication method may vary - this is a placeholder
                pass
            
            # Store the connected client
            self.connected_clients[str(server.id)] = client
            
            # Discover available tools
            await self.discover_tools(server, client)
            
            # Update server status
            server.status = models.MCPServerStatus.active
            server.last_connected_at = models.datetime.utcnow()
            self.db.commit()
            
            logger.info(f"✅ Successfully connected to MCP server: {server.name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to MCP server {server.name}: {e}")
            server.status = models.MCPServerStatus.error
            server.error_message = str(e)
            self.db.commit()
            return False
    
    async def discover_tools(self, server: models.MCPServer, client: Client):
        """Discover and catalog tools available from an MCP server"""
        try:
            logger.info(f"🔍 Discovering tools from MCP server: {server.name}")
            
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
            server.tools_discovered_at = models.datetime.utcnow()
            self.db.commit()
            
            logger.info(f"✅ Discovered {len(server_tools)} tools from {server.name}")
            
        except Exception as e:
            logger.error(f"❌ Failed to discover tools from {server.name}: {e}")
            raise
    
    async def disconnect_from_server(self, server_id: str):
        """Disconnect from an MCP server"""
        try:
            if server_id in self.connected_clients:
                client = self.connected_clients[server_id]
                await client.__aexit__(None, None, None)
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
    
    async def execute_mcp_tool(self, tool_name: str, server_id: str, **kwargs) -> Any:
        """Execute a tool on a connected MCP server"""
        try:
            client = self.connected_clients.get(server_id)
            if not client:
                return {"error": f"Not connected to MCP server: {server_id}"}
            
            logger.info(f"🔧 Executing MCP tool: {tool_name} on server: {server_id}")
            
            # Execute the tool
            result = await client.call_tool(tool_name, kwargs)
            
            logger.info(f"✅ MCP tool {tool_name} executed successfully")
            return result
            
        except Exception as e:
            logger.error(f"❌ MCP tool {tool_name} execution failed: {e}")
            return {"error": f"Tool execution failed: {str(e)}"}
    
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
        
        for server_id, client in self.connected_clients.items():
            try:
                # Check if client is connected and ping
                if client.is_connected():
                    await client.ping()
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