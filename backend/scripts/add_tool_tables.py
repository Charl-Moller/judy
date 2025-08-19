#!/usr/bin/env python3

"""
Script to add tool management tables to the database
"""

import os
import sys
import asyncio
from pathlib import Path

# Add the parent directory to sys.path to import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from app.config import settings
from app.db.models import Base, ToolCategory, Tool, CustomTool, capability_tools_map
from app.db.seed_tools import seed_all_tools


def create_tool_tables():
    """Create tool management tables in the database."""
    
    # Get database URL
    database_url = settings.DATABASE_URL
    print(f"🔗 Connecting to database: {database_url.replace('password', '***') if 'password' in database_url else database_url}")
    
    # Create engine
    engine = create_engine(database_url)
    
    try:
        # Create all tables (only new ones will be created)
        print("🏗️  Creating tool management tables...")
        Base.metadata.create_all(engine, checkfirst=True)
        print("✅ Tool tables created successfully!")
        
        # Seed the tool data
        print("🌱 Seeding tool data...")
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        
        try:
            seed_all_tools(db)
            print("✅ Tool data seeded successfully!")
        except Exception as e:
            print(f"❌ Error seeding tool data: {str(e)}")
            return False
        finally:
            db.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating tool tables: {str(e)}")
        return False
    finally:
        engine.dispose()


if __name__ == "__main__":
    print("🚀 Adding tool management tables to database...")
    
    success = create_tool_tables()
    
    if success:
        print("🎉 Tool tables and data added successfully!")
        sys.exit(0)
    else:
        print("💥 Failed to add tool tables!")
        sys.exit(1)