from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db.database import get_db
from ..db import models
from ..services.tools import TOOL_CATEGORIES, TOOL_METADATA
from ..services.mcp_manager import MCPManager

router = APIRouter(prefix="/tools", tags=["Tools"])

@router.get("/categories")
async def list_tool_categories(db: Session = Depends(get_db)):
    """Get all tool categories."""
    categories = db.query(models.ToolCategory).all()
    
    # Get MCP tool counts
    mcp_tool_count = 0
    mcp_category_id = None
    try:
        mcp_manager = MCPManager(db)
        active_servers = db.query(models.MCPServer).filter(
            models.MCPServer.status == models.MCPServerStatus.active
        ).all()
        
        mcp_category = db.query(models.ToolCategory).filter(
            models.ToolCategory.name == "MCP Tools"
        ).first()
        
        if mcp_category:
            mcp_category_id = str(mcp_category.id)
        
        for server in active_servers:
            try:
                mcp_tools = await mcp_manager.get_server_tools(server.id)
                mcp_tool_count += len(mcp_tools)
            except Exception:
                continue
                
    except Exception:
        pass
    
    result_categories = []
    for cat in categories:
        tool_count = len(cat.tools)
        # Add MCP tools to the MCP category count
        if str(cat.id) == mcp_category_id:
            tool_count += mcp_tool_count
            
        result_categories.append({
            "id": str(cat.id),
            "name": cat.name,
            "description": cat.description,
            "icon": cat.icon,
            "color": cat.color,
            "tool_count": tool_count
        })
    
    return {
        "categories": result_categories
    }

@router.get("/categories/{category_id}")
def get_tool_category(category_id: str, db: Session = Depends(get_db)):
    """Get a specific tool category with its tools."""
    category = db.query(models.ToolCategory).filter(models.ToolCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Tool category not found")
    
    return {
        "id": str(category.id),
        "name": category.name,
        "description": category.description,
        "icon": category.icon,
        "color": category.color,
        "tools": [
            {
                "id": str(tool.id),
                "name": tool.name,
                "display_name": tool.display_name,
                "description": tool.description,
                "parameters": tool.parameters,
                "examples": tool.examples,
                "is_active": tool.is_active,
                "is_builtin": tool.is_builtin,
                "usage_count": tool.usage_count,
                "success_rate": (tool.success_count / max(tool.usage_count, 1)) * 100 if tool.usage_count > 0 else 0
            }
            for tool in category.tools if tool.is_active
        ]
    }

@router.get("")
async def list_tools(
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Search in tool names and descriptions"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    include_mcp: Optional[bool] = Query(True, description="Include MCP server tools"),
    db: Session = Depends(get_db)
):
    """Get all tools with optional filtering, including MCP server tools."""
    # Get native tools from database
    query = db.query(models.Tool)
    
    if is_active is not None:
        query = query.filter(models.Tool.is_active == is_active)
    
    if category_id:
        query = query.filter(models.Tool.category_id == category_id)
    
    if search:
        search_filter = f"%{search.lower()}%"
        query = query.filter(
            (models.Tool.name.ilike(search_filter)) |
            (models.Tool.display_name.ilike(search_filter)) |
            (models.Tool.description.ilike(search_filter))
        )
    
    native_tools = query.all()
    
    # Convert native tools to response format
    tools_list = [
        {
            "id": str(tool.id),
            "name": tool.name,
            "display_name": tool.display_name,
            "description": tool.description,
            "category": {
                "id": str(tool.category.id),
                "name": tool.category.name,
                "icon": tool.category.icon,
                "color": tool.category.color
            },
            "parameters": tool.parameters,
            "examples": tool.examples,
            "is_active": tool.is_active,
            "is_builtin": tool.is_builtin,
            "version": tool.version,
            "usage_count": tool.usage_count,
            "success_rate": (tool.success_count / max(tool.usage_count, 1)) * 100 if tool.usage_count > 0 else 0,
            "avg_execution_time_ms": tool.avg_execution_time_ms,
            "source": "native"
        }
        for tool in native_tools
    ]
    
    # Add MCP tools if requested and available
    if include_mcp:
        try:
            mcp_manager = MCPManager(db)
            
            # Get active MCP servers
            active_servers = db.query(models.MCPServer).filter(
                models.MCPServer.status == models.MCPServerStatus.active
            ).all()
            
            # Get MCP category (create if doesn't exist)
            mcp_category = db.query(models.ToolCategory).filter(
                models.ToolCategory.name == "MCP Tools"
            ).first()
            
            if not mcp_category:
                mcp_category = models.ToolCategory(
                    name="MCP Tools",
                    description="Tools provided by Model Context Protocol servers",
                    icon="🔗",
                    color="#3f51b5"
                )
                db.add(mcp_category)
                db.commit()
                db.refresh(mcp_category)
            
            for server in active_servers:
                try:
                    # Get tools from this MCP server
                    mcp_tools = await mcp_manager.get_server_tools(server.id)
                    
                    for tool_name, tool_info in mcp_tools.items():
                        # Apply search filter to MCP tools if specified
                        if search:
                            search_lower = search.lower()
                            if not (search_lower in tool_name.lower() or 
                                   search_lower in tool_info.get('description', '').lower()):
                                continue
                        
                        # Apply category filter
                        if category_id and str(mcp_category.id) != category_id:
                            continue
                        
                        # Convert MCP tool to standard format
                        mcp_tool = {
                            "id": f"mcp_{server.id}_{tool_name}",
                            "name": tool_name,
                            "display_name": tool_info.get('displayName', tool_name),
                            "description": tool_info.get('description', f'Tool from {server.name} MCP server'),
                            "category": {
                                "id": str(mcp_category.id),
                                "name": mcp_category.name,
                                "icon": mcp_category.icon,
                                "color": mcp_category.color
                            },
                            "parameters": tool_info.get('inputSchema', {}).get('properties', []),
                            "examples": [],
                            "is_active": True,
                            "is_builtin": False,
                            "version": "1.0.0",
                            "usage_count": 0,
                            "success_rate": 0,
                            "avg_execution_time_ms": None,
                            "source": "mcp",
                            "mcp_server_id": server.id,
                            "mcp_server_name": server.name
                        }
                        
                        tools_list.append(mcp_tool)
                        
                except Exception as e:
                    print(f"Error getting tools from MCP server {server.name}: {e}")
                    continue
                    
        except Exception as e:
            print(f"Error loading MCP tools: {e}")
    
    return {
        "tools": tools_list,
        "total": len(tools_list)
    }

@router.get("/{tool_id}")
def get_tool(tool_id: str, db: Session = Depends(get_db)):
    """Get a specific tool by ID."""
    tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    return {
        "id": str(tool.id),
        "name": tool.name,
        "display_name": tool.display_name,
        "description": tool.description,
        "category": {
            "id": str(tool.category.id),
            "name": tool.category.name,
            "icon": tool.category.icon,
            "color": tool.category.color
        },
        "parameters": tool.parameters,
        "parameter_schema": tool.parameter_schema,
        "examples": tool.examples,
        "is_active": tool.is_active,
        "is_builtin": tool.is_builtin,
        "version": tool.version,
        "usage_count": tool.usage_count,
        "success_count": tool.success_count,
        "failure_count": tool.failure_count,
        "success_rate": (tool.success_count / max(tool.usage_count, 1)) * 100 if tool.usage_count > 0 else 0,
        "avg_execution_time_ms": tool.avg_execution_time_ms,
        "created_at": tool.created_at.isoformat(),
        "updated_at": tool.updated_at.isoformat()
    }

@router.put("/{tool_id}")
def update_tool(tool_id: str, payload: dict, db: Session = Depends(get_db)):
    """Update a tool configuration."""
    tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    # Only allow updating certain fields
    updatable_fields = ["display_name", "description", "is_active", "parameters", "parameter_schema", "examples"]
    
    for field, value in payload.items():
        if field in updatable_fields:
            setattr(tool, field, value)
    
    db.commit()
    db.refresh(tool)
    
    return {
        "id": str(tool.id),
        "name": tool.name,
        "display_name": tool.display_name,
        "description": tool.description,
        "is_active": tool.is_active,
        "updated_at": tool.updated_at.isoformat()
    }

@router.post("/{tool_id}/usage")
def record_tool_usage(tool_id: str, payload: dict, db: Session = Depends(get_db)):
    """Record tool usage statistics."""
    tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    # Update usage statistics
    tool.usage_count += 1
    
    if payload.get("success", True):
        tool.success_count += 1
    else:
        tool.failure_count += 1
    
    execution_time = payload.get("execution_time_ms")
    if execution_time:
        if tool.avg_execution_time_ms:
            # Calculate rolling average
            tool.avg_execution_time_ms = int(
                (tool.avg_execution_time_ms * (tool.usage_count - 1) + execution_time) / tool.usage_count
            )
        else:
            tool.avg_execution_time_ms = execution_time
    
    db.commit()
    
    return {
        "success": True,
        "usage_count": tool.usage_count,
        "success_rate": (tool.success_count / tool.usage_count) * 100
    }

@router.get("/search/suggestions")
def get_tool_suggestions(
    query: str = Query(..., description="Search query"),
    limit: int = Query(5, description="Maximum number of suggestions"),
    db: Session = Depends(get_db)
):
    """Get tool suggestions based on search query."""
    search_filter = f"%{query.lower()}%"
    
    tools = db.query(models.Tool).filter(
        models.Tool.is_active == True,
        (models.Tool.name.ilike(search_filter)) |
        (models.Tool.display_name.ilike(search_filter)) |
        (models.Tool.description.ilike(search_filter))
    ).limit(limit).all()
    
    return {
        "suggestions": [
            {
                "id": str(tool.id),
                "name": tool.name,
                "display_name": tool.display_name,
                "description": tool.description,
                "category": tool.category.name,
                "icon": tool.category.icon,
                "usage_count": tool.usage_count
            }
            for tool in tools
        ]
    }

@router.get("/popular")
def get_popular_tools(
    limit: int = Query(10, description="Number of popular tools to return"),
    db: Session = Depends(get_db)
):
    """Get most popular tools by usage count."""
    tools = db.query(models.Tool).filter(
        models.Tool.is_active == True
    ).order_by(models.Tool.usage_count.desc()).limit(limit).all()
    
    return {
        "popular_tools": [
            {
                "id": str(tool.id),
                "name": tool.name,
                "display_name": tool.display_name,
                "description": tool.description,
                "category": {
                    "name": tool.category.name,
                    "icon": tool.category.icon,
                    "color": tool.category.color
                },
                "usage_count": tool.usage_count,
                "success_rate": (tool.success_count / max(tool.usage_count, 1)) * 100 if tool.usage_count > 0 else 0
            }
            for tool in tools
        ]
    }

@router.get("/by-category/{category_name}")
def get_tools_by_category_name(category_name: str, db: Session = Depends(get_db)):
    """Get tools by category name (convenience endpoint)."""
    category = db.query(models.ToolCategory).filter(models.ToolCategory.name == category_name).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{category_name}' not found")
    
    return get_tool_category(str(category.id), db)