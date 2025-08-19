from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db.database import get_db
from ..db import models
from ..services.tools import TOOL_CATEGORIES, TOOL_METADATA

router = APIRouter(prefix="/tools", tags=["Tools"])

@router.get("/categories")
def list_tool_categories(db: Session = Depends(get_db)):
    """Get all tool categories."""
    categories = db.query(models.ToolCategory).all()
    return {
        "categories": [
            {
                "id": str(cat.id),
                "name": cat.name,
                "description": cat.description,
                "icon": cat.icon,
                "color": cat.color,
                "tool_count": len(cat.tools)
            }
            for cat in categories
        ]
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
def list_tools(
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Search in tool names and descriptions"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    db: Session = Depends(get_db)
):
    """Get all tools with optional filtering."""
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
    
    tools = query.all()
    
    return {
        "tools": [
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
                "avg_execution_time_ms": tool.avg_execution_time_ms
            }
            for tool in tools
        ],
        "total": len(tools)
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