#!/usr/bin/env python3
"""
Script to add the MCP Server table to the database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import engine, Base
from app.db.models import MCPServer, MCPServerStatus, MCPTransportType
from sqlalchemy import text

def main():
    print("🔧 Adding MCP Server table...")
    
    try:
        # Create the table
        Base.metadata.create_all(bind=engine, checkfirst=True)
        print("✅ MCP Server table created successfully")
        
        # Verify the table exists
        with engine.connect() as conn:
            result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name = 'mcp_servers'"))
            if result.fetchone():
                print("✅ Verified: mcp_servers table exists in database")
            else:
                print("❌ Warning: mcp_servers table not found")
        
    except Exception as e:
        print(f"❌ Error creating MCP Server table: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())