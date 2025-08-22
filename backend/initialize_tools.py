#!/usr/bin/env python3
"""
Initialize tools and categories in the database
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import get_db
from app.db import models
from app.services.tools import TOOL_CATEGORIES, TOOL_METADATA
import uuid
from sqlalchemy.orm import Session

def create_categories(db: Session):
    """Create tool categories in database"""
    category_mapping = {
        "File Operations": {"icon": "📁", "color": "#4CAF50", "description": "Tools for reading, writing, and managing files"},
        "Data Processing": {"icon": "📊", "color": "#2196F3", "description": "Tools for filtering, sorting, and transforming data"},
        "Text Processing": {"icon": "📝", "color": "#FF9800", "description": "Tools for manipulating and analyzing text"},
        "Web & API": {"icon": "🌐", "color": "#9C27B0", "description": "Tools for web requests and API interactions"},
        "Date & Time": {"icon": "⏰", "color": "#607D8B", "description": "Tools for working with dates and times"},
        "Media & Analysis": {"icon": "🔍", "color": "#E91E63", "description": "Tools for analyzing images and media files"}
    }
    
    created_categories = {}
    
    for category_name, tools_list in TOOL_CATEGORIES.items():
        # Check if category already exists
        existing = db.query(models.ToolCategory).filter(
            models.ToolCategory.name == category_name
        ).first()
        
        if existing:
            print(f"Category '{category_name}' already exists")
            created_categories[category_name] = existing
            continue
            
        category_info = category_mapping.get(category_name, {
            "icon": "🔧", 
            "color": "#795548", 
            "description": f"Tools in {category_name} category"
        })
        
        category = models.ToolCategory(
            name=category_name,
            description=category_info["description"],
            icon=category_info["icon"],
            color=category_info["color"]
        )
        
        db.add(category)
        db.commit()
        db.refresh(category)
        
        created_categories[category_name] = category
        print(f"✅ Created category: {category_name}")
    
    return created_categories

def create_tools(db: Session, categories: dict):
    """Create tools in database"""
    
    for category_name, tools_list in TOOL_CATEGORIES.items():
        category = categories[category_name]
        
        for tool_name in tools_list:
            # Check if tool already exists
            existing = db.query(models.Tool).filter(
                models.Tool.name == tool_name
            ).first()
            
            if existing:
                print(f"Tool '{tool_name}' already exists")
                continue
                
            metadata = TOOL_METADATA.get(tool_name, {})
            
            # Create parameter schema
            parameters = []
            for param in metadata.get("parameters", []):
                parameters.append({
                    "name": param,
                    "type": "string",  # Default type, could be more specific
                    "required": True,
                    "description": f"Parameter {param}"
                })
            
            tool = models.Tool(
                name=tool_name,
                display_name=tool_name.replace("_", " ").title(),
                description=metadata.get("description", f"{tool_name} tool"),
                category_id=category.id,
                parameters=parameters,
                parameter_schema={
                    "type": "object",
                    "properties": {param: {"type": "string"} for param in metadata.get("parameters", [])},
                    "required": metadata.get("parameters", [])
                },
                examples=[],
                is_active=True,
                is_builtin=True,
                version="1.0.0",
                usage_count=0,
                success_count=0,
                failure_count=0
            )
            
            db.add(tool)
            db.commit()
            db.refresh(tool)
            
            print(f"✅ Created tool: {tool_name} in {category_name}")

def main():
    """Initialize tools and categories"""
    print("🔧 Initializing tools and categories...")
    
    # Get database session
    db = next(get_db())
    
    try:
        # Create categories first
        print("\n📁 Creating categories...")
        categories = create_categories(db)
        
        # Create tools
        print("\n🛠️  Creating tools...")
        create_tools(db, categories)
        
        # Count totals
        total_categories = db.query(models.ToolCategory).count()
        total_tools = db.query(models.Tool).count()
        
        print(f"\n✅ Initialization complete!")
        print(f"📊 Total categories: {total_categories}")
        print(f"🛠️  Total tools: {total_tools}")
        
    except Exception as e:
        print(f"❌ Error during initialization: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()