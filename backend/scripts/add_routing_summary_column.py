#!/usr/bin/env python3
"""
Add routing_summary column to agents table for persona router capability discovery
"""

import sys
sys.path.append('../')

from app.db.database import engine
from sqlalchemy import text

def add_routing_summary_column():
    """Add routing_summary column to agents table"""
    try:
        with engine.begin() as conn:
            # Check if column already exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='agents' AND column_name='routing_summary'
            """))
            
            if result.fetchone():
                print("Column 'routing_summary' already exists in agents table")
                return
            
            # Add the column
            conn.execute(text("""
                ALTER TABLE agents 
                ADD COLUMN routing_summary TEXT
            """))
            
            print("✅ Successfully added routing_summary column to agents table")
            
    except Exception as e:
        print(f"❌ Error adding routing_summary column: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("Adding routing_summary column to agents table...")
    success = add_routing_summary_column()
    if success:
        print("Database migration completed successfully!")
    else:
        print("Database migration failed!")
        sys.exit(1)