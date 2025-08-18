#!/usr/bin/env python3
"""
Database migration script to add workflow storage tables
Run this script to add the new workflow tables to your existing PostgreSQL database
"""

import sys
import os
from pathlib import Path

# Add the backend app directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.database import engine, SessionLocal
from app.db.models import Base, Workflow, WorkflowExecution, WorkflowTemplate
from sqlalchemy import text

def create_workflow_tables():
    """Create the new workflow tables in the database"""
    try:
        print("🔄 Creating workflow tables...")
        
        # Create all tables that don't exist yet
        Base.metadata.create_all(bind=engine, tables=[
            Workflow.__table__,
            WorkflowExecution.__table__,
            WorkflowTemplate.__table__
        ])
        
        print("✅ Workflow tables created successfully!")
        
        # Verify tables were created
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('workflows', 'workflow_executions', 'workflow_templates')
                ORDER BY table_name
            """))
            
            tables = [row[0] for row in result]
            print(f"📋 Created tables: {', '.join(tables)}")
            
        return True
        
    except Exception as e:
        print(f"❌ Error creating workflow tables: {e}")
        return False

def create_indexes():
    """Create performance indexes for the workflow tables"""
    try:
        print("🔄 Creating performance indexes...")
        
        with engine.connect() as conn:
            # Indexes for workflows table
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_workflows_owner_id 
                ON workflows(owner_id)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_workflows_status 
                ON workflows(status)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_workflows_created_at 
                ON workflows(created_at)
            """))
            
            # Note: JSON type doesn't support regular indexes in PostgreSQL
            # We'll skip the tags index for now - can be added later if needed
            
            # Indexes for workflow_executions table
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id 
                ON workflow_executions(workflow_id)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_workflow_executions_session_id 
                ON workflow_executions(session_id)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_workflow_executions_status 
                ON workflow_executions(status)
            """))
            
            # Indexes for workflow_templates table
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_workflow_templates_category 
                ON workflow_templates(category)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_public 
                ON workflow_templates(is_public)
            """))
            
            conn.commit()
            print("✅ Performance indexes created successfully!")
            
        return True
        
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")
        return False

def insert_sample_templates():
    """Insert some sample workflow templates"""
    try:
        print("🔄 Inserting sample workflow templates...")
        
        with SessionLocal() as db:
            # Check if templates already exist
            existing = db.query(WorkflowTemplate).count()
            if existing > 0:
                print("ℹ️  Sample templates already exist, skipping...")
                return True
            
            # Sample AI Chat workflow template
            chat_template = WorkflowTemplate(
                name="AI Chat Assistant",
                description="Basic AI chat workflow with memory and LLM integration",
                category="ai_chat",
                nodes=[
                    {
                        "id": "agent_1",
                        "type": "agent",
                        "position": {"x": 300, "y": 100},
                        "data": {
                            "name": "AI Chat Assistant",
                            "description": "Friendly AI chat assistant with memory",
                            "systemPrompt": "You are a helpful AI assistant. Be friendly and concise.",
                            "capabilities": ["chat", "general_knowledge"],
                            "memory": True,
                            "contextWindow": 4000
                        }
                    },
                    {
                        "id": "llm_1",
                        "type": "llm",
                        "position": {"x": 500, "y": 100},
                        "data": {
                            "provider": "Azure OpenAI",
                            "model": "gpt-4",
                            "temperature": 0.7,
                            "maxTokens": 1000
                        }
                    },
                    {
                        "id": "memory_1",
                        "type": "memory",
                        "position": {"x": 300, "y": 300},
                        "data": {
                            "type": "conversation",
                            "maxConversations": 10,
                            "includeSystemMessages": True,
                            "memoryStrategy": "sliding_window"
                        }
                    }
                ],
                connections=[
                    {
                        "id": "conn_1",
                        "source": "agent_1",
                        "target": "llm_1",
                        "type": "data"
                    },
                    {
                        "id": "conn_2",
                        "source": "agent_1",
                        "target": "memory_1",
                        "type": "memory"
                    }
                ],
                template_metadata={
                    "version": "1.0.0",
                    "author": "System",
                    "tags": ["chat", "ai", "memory", "llm"]
                },
                is_public=True
            )
            
            # Sample Data Processing workflow template
            data_template = WorkflowTemplate(
                name="Data Processing Pipeline",
                description="Workflow for processing and analyzing data with multiple tools",
                category="data_processing",
                nodes=[
                    {
                        "id": "trigger_1",
                        "type": "trigger",
                        "position": {"x": 100, "y": 100},
                        "data": {
                            "type": "file_upload",
                            "supportedFormats": ["csv", "json", "xlsx"]
                        }
                    },
                    {
                        "id": "agent_1",
                        "type": "agent",
                        "position": {"x": 300, "y": 100},
                        "data": {
                            "name": "Data Processor",
                            "description": "AI agent for data processing and analysis",
                            "systemPrompt": "You are a data processing specialist. Analyze data and provide insights.",
                            "capabilities": ["data_analysis", "spreadsheet_analysis"]
                        }
                    },
                    {
                        "id": "tool_1",
                        "type": "tool",
                        "position": {"x": 500, "y": 100},
                        "data": {
                            "type": "spreadsheet_analysis",
                            "description": "Analyze spreadsheet data and extract insights"
                        }
                    }
                ],
                connections=[
                    {
                        "id": "conn_1",
                        "source": "trigger_1",
                        "target": "agent_1",
                        "type": "data"
                    },
                    {
                        "id": "conn_2",
                        "source": "agent_1",
                        "target": "tool_1",
                        "type": "data"
                    }
                ],
                template_metadata={
                    "version": "1.0.0",
                    "author": "System",
                    "tags": ["data", "analysis", "spreadsheet", "pipeline"]
                },
                is_public=True
            )
            
            db.add(chat_template)
            db.add(data_template)
            db.commit()
            
            print("✅ Sample workflow templates inserted successfully!")
            
        return True
        
    except Exception as e:
        print(f"❌ Error inserting sample templates: {e}")
        return False

def main():
    """Main migration function"""
    print("🚀 Starting workflow tables migration...")
    print("=" * 50)
    
    # Step 1: Create tables
    if not create_workflow_tables():
        print("❌ Migration failed at table creation step")
        return False
    
    # Step 2: Create indexes
    if not create_indexes():
        print("❌ Migration failed at index creation step")
        return False
    
    # Step 3: Insert sample templates
    if not insert_sample_templates():
        print("❌ Migration failed at template insertion step")
        return False
    
    print("=" * 50)
    print("🎉 Workflow tables migration completed successfully!")
    print("\n📋 What was created:")
    print("  • workflows table - Store workflow definitions")
    print("  • workflow_executions table - Track workflow runs")
    print("  • workflow_templates table - Pre-built workflow templates")
    print("  • Performance indexes for optimal query performance")
    print("  • Sample templates for AI Chat and Data Processing")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
