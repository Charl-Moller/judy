#!/usr/bin/env python3

"""
Add Agent Builder tables to the database.

This script creates the new agent_builders, agent_executions, and agent_templates tables
that store visual agent configurations separately from the basic agents table.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.db.database import engine, get_db
from app.db.models import Base, AgentBuilder, AgentExecution, AgentTemplate

def create_agent_builder_tables():
    """Create agent builder tables"""
    print("🏗️  Creating Agent Builder tables...")
    
    try:
        # Create all tables defined in models
        Base.metadata.create_all(bind=engine)
        print("✅ Agent Builder tables created successfully!")
        
        # Verify tables were created
        with engine.connect() as conn:
            # Check if agent_builders table exists and has the expected columns
            result = conn.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'agent_builders' 
                ORDER BY ordinal_position;
            """))
            
            columns = result.fetchall()
            if columns:
                print(f"📊 agent_builders table has {len(columns)} columns:")
                for col_name, col_type in columns:
                    print(f"   - {col_name}: {col_type}")
            else:
                print("❌ agent_builders table not found!")
                return False
            
            # Check agent_executions table
            result = conn.execute(text("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_name = 'agent_executions';
            """))
            
            if result.fetchone()[0] > 0:
                print("✅ agent_executions table created")
            else:
                print("❌ agent_executions table not found!")
                return False
            
            # Check agent_templates table
            result = conn.execute(text("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_name = 'agent_templates';
            """))
            
            if result.fetchone()[0] > 0:
                print("✅ agent_templates table created")
            else:
                print("❌ agent_templates table not found!")
                return False
                
        return True
        
    except Exception as e:
        print(f"❌ Error creating Agent Builder tables: {e}")
        return False

def add_sample_agent_template():
    """Add a sample agent template"""
    print("\n📝 Adding sample agent template...")
    
    try:
        from app.db.database import SessionLocal
        db = SessionLocal()
        
        # Check if template already exists
        existing = db.query(AgentTemplate).filter(AgentTemplate.name == "Simple Chat Agent Template").first()
        if existing:
            print("ℹ️  Sample template already exists, skipping...")
            db.close()
            return True
        
        sample_template = AgentTemplate(
            name="Simple Chat Agent Template",
            description="A basic template for creating chat agents with LLM integration",
            category="ai_chat",
            nodes=[
                {
                    "id": "trigger_1",
                    "type": "trigger", 
                    "position": {"x": 100, "y": 100},
                    "data": {
                        "type": "webhook",
                        "method": "POST", 
                        "path": "/chat",
                        "authentication": False
                    }
                },
                {
                    "id": "agent_1",
                    "type": "agent",
                    "position": {"x": 300, "y": 100},
                    "data": {
                        "name": "Chat Assistant",
                        "description": "Friendly AI chat assistant",
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
                        "provider": "OpenAI",
                        "model": "gpt-4",
                        "temperature": 0.7,
                        "maxTokens": 1000
                    }
                },
                {
                    "id": "output_1",
                    "type": "output",
                    "position": {"x": 700, "y": 100},
                    "data": {
                        "format": "json",
                        "destination": "api",
                        "template": "{{response}}"
                    }
                }
            ],
            connections=[
                {
                    "id": "conn_1",
                    "source": "trigger_1",
                    "target": "agent_1", 
                    "sourceHandle": "trigger_1_output_bottom",
                    "targetHandle": "agent_1_input_top",
                    "type": "data",
                    "dataType": "any"
                },
                {
                    "id": "conn_2",
                    "source": "agent_1",
                    "target": "llm_1",
                    "sourceHandle": "agent_1_output_bottom", 
                    "targetHandle": "llm_1_input_top",
                    "type": "data",
                    "dataType": "any"
                },
                {
                    "id": "conn_3",
                    "source": "llm_1",
                    "target": "output_1",
                    "sourceHandle": "llm_1_output_bottom",
                    "targetHandle": "output_1_input_top", 
                    "type": "data",
                    "dataType": "any"
                }
            ],
            template_metadata={
                "tags": ["chat", "basic", "template"],
                "difficulty": "beginner",
                "estimated_setup_time": "5 minutes"
            },
            usage_count=0,
            is_public=True,
            created_by="system"
        )
        
        db.add(sample_template)
        db.commit()
        db.refresh(sample_template)
        
        print(f"✅ Sample template created with ID: {sample_template.id}")
        db.close()
        return True
        
    except Exception as e:
        print(f"❌ Error adding sample template: {e}")
        return False

def main():
    """Main migration function"""
    print("🚀 Starting Agent Builder table migration...")
    
    # Create tables
    if not create_agent_builder_tables():
        print("❌ Failed to create tables. Exiting.")
        sys.exit(1)
    
    # Add sample data
    if not add_sample_agent_template():
        print("⚠️  Failed to add sample template, but tables were created successfully.")
    
    print("\n✅ Agent Builder migration completed successfully!")
    print("\n📊 Summary:")
    print("   - ✅ agent_builders table created")
    print("   - ✅ agent_executions table created") 
    print("   - ✅ agent_templates table created")
    print("   - ✅ Sample chat template added")
    print("\n🎯 Next steps:")
    print("   1. Update frontend to use /agent-builder endpoints")
    print("   2. Test agent creation and storage")
    print("   3. Verify agent execution tracking")

if __name__ == "__main__":
    main()