"""
Database seeding script for tools and tool categories
"""

from sqlalchemy.orm import Session
from .database import get_db
from .models import ToolCategory, Tool
from ..services.tools import TOOL_CATEGORIES, TOOL_METADATA


def seed_tool_categories(db: Session):
    """Seed tool categories in the database."""
    
    # Define category metadata with colors and icons
    category_metadata = {
        "Math & Calculations": {"icon": "🧮", "color": "#3B82F6"},
        "File Operations": {"icon": "📁", "color": "#10B981"},
        "Data Processing": {"icon": "📊", "color": "#8B5CF6"},
        "Text Processing": {"icon": "📝", "color": "#F59E0B"},
        "Web & API": {"icon": "🌐", "color": "#EF4444"},
        "Date & Time": {"icon": "🕒", "color": "#06B6D4"},
        "System & Code": {"icon": "⚙️", "color": "#6B7280"},
        "Communication": {"icon": "💬", "color": "#EC4899"},
        "Media & Analysis": {"icon": "🎨", "color": "#84CC16"}
    }
    
    for category_name in TOOL_CATEGORIES.keys():
        # Check if category already exists
        existing = db.query(ToolCategory).filter(ToolCategory.name == category_name).first()
        if existing:
            continue
        
        metadata = category_metadata.get(category_name, {"icon": "🔧", "color": "#6B7280"})
        
        category = ToolCategory(
            name=category_name,
            description=f"Tools for {category_name.lower()} operations",
            icon=metadata["icon"],
            color=metadata["color"]
        )
        
        db.add(category)
        print(f"✅ Added category: {category_name}")
    
    db.commit()
    return True


def seed_tools(db: Session):
    """Seed built-in tools in the database."""
    
    # Get category mappings
    categories = {cat.name: cat.id for cat in db.query(ToolCategory).all()}
    
    for tool_name, metadata in TOOL_METADATA.items():
        # Check if tool already exists
        existing = db.query(Tool).filter(Tool.name == tool_name).first()
        if existing:
            continue
        
        category_name = metadata["category"]
        if category_name not in categories:
            print(f"❌ Category not found for tool {tool_name}: {category_name}")
            continue
        
        # Create parameter schema
        parameters = metadata.get("parameters", [])
        parameter_definitions = []
        
        for param in parameters:
            parameter_definitions.append({
                "name": param,
                "type": "string",  # Default type, can be customized
                "required": True,  # Default to required, can be customized
                "description": f"Parameter for {param}"
            })
        
        # Create examples
        examples = []
        if tool_name == "add":
            examples = [
                {"input": {"a": 5, "b": 3}, "output": 8},
                {"input": {"a": 10.5, "b": 2.3}, "output": 12.8}
            ]
        elif tool_name == "read_file":
            examples = [
                {"input": {"file_path": "/path/to/file.txt"}, "description": "Read a text file"},
                {"input": {"file_path": "/data/report.csv", "encoding": "utf-8"}, "description": "Read a CSV file with UTF-8 encoding"}
            ]
        elif tool_name == "http_get":
            examples = [
                {"input": {"url": "https://api.example.com/data"}, "description": "Simple GET request"},
                {"input": {"url": "https://api.example.com/search", "params": {"q": "query"}}, "description": "GET with query parameters"}
            ]
        
        tool = Tool(
            name=tool_name,
            display_name=tool_name.replace("_", " ").title(),
            description=metadata["description"],
            category_id=categories[category_name],
            parameters=parameter_definitions,
            examples=examples,
            is_builtin=True,
            is_active=True
        )
        
        db.add(tool)
        print(f"✅ Added tool: {tool_name}")
    
    db.commit()
    return True


def seed_all_tools(db: Session = None):
    """Seed all tool data."""
    if db is None:
        db = next(get_db())
    
    try:
        print("🌱 Seeding tool categories...")
        seed_tool_categories(db)
        
        print("🌱 Seeding tools...")
        seed_tools(db)
        
        print("✅ Tool seeding completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error seeding tools: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    # Run seeding directly
    seed_all_tools()