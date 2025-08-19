"""
Dynamic tool loading service for agents
"""

import importlib
import inspect
import asyncio
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from ..db import models
from ..services.tools import ALL_TOOLS, TOOL_METADATA
from .mcp_manager import MCPManager


class ToolLoader:
    """Service for dynamically loading and managing tools for agent execution"""
    
    def __init__(self, db: Session):
        self.db = db
        self._tool_registry = {}
        self._mcp_manager = None
        self._load_available_tools()
    
    def _load_available_tools(self):
        """Load all available tool functions into registry"""
        print("🔧 Loading available tools...")
        
        # Import tool modules and extract functions
        tool_modules = [
            'app.services.tools.file_operations',
            'app.services.tools.data_processing', 
            'app.services.tools.http_requests',
            'app.services.tools.text_processing',
            'app.services.tools.datetime_utils',
            'app.services.tools.web_search',
            'app.services.tools.image_analysis'
        ]
        
        for module_name in tool_modules:
            try:
                module = importlib.import_module(module_name)
                
                # Get all functions decorated with @tool
                for name, obj in inspect.getmembers(module, inspect.isfunction):
                    if hasattr(obj, '__name__') and name in ALL_TOOLS:
                        self._tool_registry[name] = obj
                        print(f"✅ Loaded tool: {name}")
                        
            except Exception as e:
                print(f"❌ Failed to load module {module_name}: {e}")
        
        print(f"🔧 Loaded {len(self._tool_registry)} native tools total")
    
    async def initialize_mcp_manager(self):
        """Initialize MCP manager for external tool support"""
        if self._mcp_manager is None:
            self._mcp_manager = MCPManager(self.db)
            await self._mcp_manager.initialize()
            print("🔗 MCP Manager initialized and connected to external servers")
    
    async def get_tools_for_agent_node(self, agent_node: Dict[str, Any]) -> Dict[str, Any]:
        """Get tools configured for a specific agent node"""
        tools = {}
        
        try:
            # Check if agent has selectedTools in its data
            agent_data = agent_node.get('data', {})
            selected_tools = agent_data.get('selectedTools', [])
            
            if selected_tools:
                print(f"🔧 Loading {len(selected_tools)} configured tools for agent")
                
                for tool_config in selected_tools:
                    tool_name = tool_config.get('name')
                    
                    # Check native tools first
                    if tool_name and tool_name in self._tool_registry:
                        tools[tool_name] = self._tool_registry[tool_name]
                        print(f"✅ Added native tool: {tool_name}")
                    
                    # Check MCP tools if tool not found in native registry
                    elif tool_name and self._mcp_manager:
                        mcp_tools = self._mcp_manager.get_all_mcp_tools()
                        if tool_name in mcp_tools:
                            tools[tool_name] = self._create_mcp_tool_wrapper(tool_name, mcp_tools[tool_name])
                            print(f"✅ Added MCP tool: {tool_name}")
                        else:
                            print(f"⚠️ Tool not found in any registry: {tool_name}")
                    else:
                        print(f"⚠️ Tool not found in registry: {tool_name}")
            
            # Also check legacy tool configuration
            legacy_tool_name = agent_data.get('type')
            if legacy_tool_name and legacy_tool_name in self._tool_registry:
                tools[legacy_tool_name] = self._tool_registry[legacy_tool_name]
                print(f"✅ Added legacy tool: {legacy_tool_name}")
            
        except Exception as e:
            print(f"❌ Error loading tools for agent: {e}")
        
        return tools
    
    async def get_tools_for_workflow(self, nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get all tools available in a workflow from tool nodes and agent configurations"""
        all_tools = {}
        
        try:
            for node in nodes:
                node_type = node.get('type')
                
                # Load tools from tool nodes
                if node_type == 'tool':
                    node_tools = await self.get_tools_for_agent_node(node)
                    all_tools.update(node_tools)
                
                # Load tools from agent nodes that have tool configurations
                elif node_type in ['agent', 'persona_router']:
                    node_tools = await self.get_tools_for_agent_node(node)
                    all_tools.update(node_tools)
            
            print(f"🔧 Workflow has access to {len(all_tools)} tools: {list(all_tools.keys())}")
            
        except Exception as e:
            print(f"❌ Error loading workflow tools: {e}")
        
        return all_tools
    
    def get_tool_function(self, tool_name: str) -> Optional[Any]:
        """Get a specific tool function by name"""
        return self._tool_registry.get(tool_name)
    
    def get_available_tools(self) -> List[str]:
        """Get list of all available tool names (native + MCP)"""
        available_tools = list(self._tool_registry.keys())
        
        # Add MCP tools if manager is available
        if self._mcp_manager:
            mcp_tools = self._mcp_manager.get_all_mcp_tools()
            available_tools.extend(list(mcp_tools.keys()))
        
        return available_tools
    
    def get_tool_metadata(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific tool (native or MCP)"""
        # Check native tools first
        metadata = TOOL_METADATA.get(tool_name)
        if metadata:
            return metadata
        
        # Check MCP tools
        if self._mcp_manager:
            mcp_tools = self._mcp_manager.get_all_mcp_tools()
            if tool_name in mcp_tools:
                return mcp_tools[tool_name]
        
        return None
    
    async def execute_tool(self, tool_name: str, **kwargs) -> Any:
        """Execute a tool with given parameters (native or MCP)"""
        try:
            # Try native tools first
            tool_func = self._tool_registry.get(tool_name)
            if tool_func:
                print(f"🔧 Executing native tool: {tool_name} with params: {kwargs}")
                result = tool_func(**kwargs)
                print(f"✅ Native tool {tool_name} executed successfully")
                
                # Record usage statistics in database
                self._record_tool_usage(tool_name, success=True)
                return result
            
            # Try MCP tools
            if self._mcp_manager:
                mcp_tools = self._mcp_manager.get_all_mcp_tools()
                if tool_name in mcp_tools:
                    tool_info = mcp_tools[tool_name]
                    server_id = tool_info['server_id']
                    # Remove the prefixed server info to get original tool name
                    original_tool_name = tool_name.replace(f"mcp_{server_id[:8]}_", "")
                    
                    print(f"🔧 Executing MCP tool: {original_tool_name} on server {server_id}")
                    result = await self._mcp_manager.execute_mcp_tool(
                        original_tool_name, server_id, **kwargs
                    )
                    print(f"✅ MCP tool {tool_name} executed successfully")
                    
                    # Record usage statistics in database
                    self._record_tool_usage(tool_name, success=True)
                    return result
            
            return {"error": f"Tool '{tool_name}' not found in any registry"}
            
        except Exception as e:
            print(f"❌ Tool {tool_name} execution failed: {e}")
            self._record_tool_usage(tool_name, success=False)
            return {"error": f"Tool execution failed: {str(e)}"}
    
    def _record_tool_usage(self, tool_name: str, success: bool):
        """Record tool usage statistics in database"""
        try:
            tool = self.db.query(models.Tool).filter(models.Tool.name == tool_name).first()
            if tool:
                tool.usage_count += 1
                if success:
                    tool.success_count += 1
                else:
                    tool.failure_count += 1
                self.db.commit()
        except Exception as e:
            print(f"⚠️ Failed to record tool usage: {e}")
    
    def _create_mcp_tool_wrapper(self, tool_name: str, tool_info: Dict[str, Any]):
        """Create a wrapper function for MCP tools to match native tool interface"""
        async def mcp_tool_wrapper(**kwargs):
            server_id = tool_info['server_id']
            original_tool_name = tool_name.replace(f"mcp_{server_id[:8]}_", "")
            return await self._mcp_manager.execute_mcp_tool(
                original_tool_name, server_id, **kwargs
            )
        
        # Add metadata to the wrapper function
        mcp_tool_wrapper.__name__ = tool_name
        mcp_tool_wrapper.__doc__ = tool_info.get('description', 'MCP tool')
        
        return mcp_tool_wrapper
    
    @property
    def mcp_manager(self) -> Optional[MCPManager]:
        """Get the MCP manager instance"""
        return self._mcp_manager


def create_tool_loader(db: Session) -> ToolLoader:
    """Factory function to create tool loader"""
    return ToolLoader(db)


def get_tools_description_for_llm(tools: Dict[str, Any]) -> str:
    """Generate a description of available tools for LLM context"""
    if not tools:
        return "No tools are currently available."
    
    descriptions = []
    descriptions.append(f"You have access to {len(tools)} tools:")
    
    for tool_name, tool_func in tools.items():
        metadata = TOOL_METADATA.get(tool_name, {})
        description = metadata.get('description', 'No description available')
        parameters = metadata.get('parameters', [])
        category = metadata.get('category', 'Unknown')
        
        param_desc = f"Parameters: {', '.join(parameters)}" if parameters else "No parameters"
        descriptions.append(f"- {tool_name} ({category}): {description}. {param_desc}")
    
    descriptions.append("\nTo use a tool, mention it in your response and I'll execute it with the appropriate parameters.")
    return "\n".join(descriptions)


def extract_tool_calls_from_response(response: str, available_tools: List[str]) -> List[Dict[str, Any]]:
    """Extract tool calls from LLM response"""
    tool_calls = []
    
    # Simple pattern matching for tool mentions
    # In a production system, this would be more sophisticated
    for tool_name in available_tools:
        if tool_name.lower() in response.lower():
            # Extract context around tool mention to determine parameters
            # This is a simplified approach - real implementation would need better parsing
            tool_calls.append({
                'tool': tool_name,
                'parameters': {},  # Would need smart parameter extraction
                'context': response
            })
    
    return tool_calls