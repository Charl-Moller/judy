#!/usr/bin/env python3
"""
Database migration script to add orchestrator_llm_id column to orchestrator_configs table.
This fixes the issue where the relationship dashboard can't load orchestrator data.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import get_db
from sqlalchemy import text

def add_orchestrator_llm_column():
    """Add the missing orchestrator_llm_id column to orchestrator_configs table"""
    db = next(get_db())
    
    try:
        # Check if column already exists
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orchestrator_configs' 
            AND column_name = 'orchestrator_llm_id'
        """))
        
        if result.fetchone():
            print("Column 'orchestrator_llm_id' already exists. Skipping migration.")
            return
        
        # Add the column
        db.execute(text("""
            ALTER TABLE orchestrator_configs 
            ADD COLUMN orchestrator_llm_id UUID REFERENCES llm_configs(id)
        """))
        
        db.commit()
        print("Successfully added 'orchestrator_llm_id' column to orchestrator_configs table.")
        
    except Exception as e:
        db.rollback()
        print(f"Error adding column: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting database migration...")
    add_orchestrator_llm_column()
    print("Migration completed.")
