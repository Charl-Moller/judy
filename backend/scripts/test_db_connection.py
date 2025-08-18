#!/usr/bin/env python3
"""
Test script to verify PostgreSQL database connection
Run this to check if your Azure PostgreSQL is accessible
"""

import sys
import os
from pathlib import Path

# Add the backend app directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.database import engine
from sqlalchemy import text

def test_connection():
    """Test the database connection"""
    try:
        print("🔄 Testing PostgreSQL connection...")
        
        with engine.connect() as conn:
            # Test basic connection
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"✅ Connected to PostgreSQL: {version}")
            
            # Test if we can query existing tables
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            """))
            
            existing_tables = [row[0] for row in result]
            print(f"📋 Existing tables: {', '.join(existing_tables)}")
            
            # Test if we can create a simple table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS test_connection (
                    id SERIAL PRIMARY KEY,
                    test_field TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            # Insert test data
            conn.execute(text("""
                INSERT INTO test_connection (test_field) 
                VALUES ('Connection test successful')
            """))
            
            # Query test data
            result = conn.execute(text("SELECT * FROM test_connection ORDER BY created_at DESC LIMIT 1"))
            test_row = result.fetchone()
            print(f"✅ Test data inserted and queried: {test_row}")
            
            # Clean up test table
            conn.execute(text("DROP TABLE test_connection"))
            
            conn.commit()
            print("✅ Database connection test completed successfully!")
            
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print(f"❌ Error type: {type(e)}")
        return False

def main():
    """Main test function"""
    print("🚀 Testing PostgreSQL Database Connection")
    print("=" * 50)
    
    success = test_connection()
    
    if success:
        print("\n🎉 Database connection is working!")
        print("✅ You can now run the workflow tables migration")
        print("✅ Run: python scripts/add_workflow_tables.py")
    else:
        print("\n❌ Database connection failed!")
        print("🔧 Check your .env file and ensure:")
        print("  • DATABASE_URL is uncommented")
        print("  • Azure PostgreSQL is accessible")
        print("  • Network security rules allow your IP")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
