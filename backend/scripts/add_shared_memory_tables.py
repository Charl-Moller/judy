#!/usr/bin/env python3
"""
Add shared memory tables for multi-agent context sharing
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings

def add_shared_memory_tables():
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Add shared_sessions table for session-level memory management
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS shared_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id VARCHAR NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Session-level context
            current_task TEXT,
            session_facts JSONB DEFAULT '[]'::jsonb,
            global_context JSONB DEFAULT '{}'::jsonb,
            
            -- Agent routing history
            agent_routing_history JSONB DEFAULT '[]'::jsonb,
            current_agent_id UUID,
            
            -- Memory configuration
            memory_strategy VARCHAR DEFAULT 'shared',
            max_context_length INTEGER DEFAULT 50,
            preserve_context_on_agent_switch BOOLEAN DEFAULT true
        );
        """))
        
        # Add agent tracking to messages table
        try:
            conn.execute(text("""
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS agent_id UUID;
            """))
        except:
            print("Agent ID column already exists in messages table")
        
        try:
            conn.execute(text("""
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS agent_name VARCHAR;
            """))
        except:
            print("Agent name column already exists in messages table")
        
        try:
            conn.execute(text("""
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS shared_session_id UUID REFERENCES shared_sessions(id);
            """))
        except:
            print("Shared session ID column already exists in messages table")
        
        # Add context handoff tracking
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS agent_handoffs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            shared_session_id UUID NOT NULL REFERENCES shared_sessions(id),
            from_agent_id UUID,
            from_agent_name VARCHAR,
            to_agent_id UUID,
            to_agent_name VARCHAR,
            handoff_reason TEXT,
            context_summary TEXT,
            preserved_context JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """))
        
        # Add persona router memory table
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS persona_router_memory (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            shared_session_id UUID NOT NULL REFERENCES shared_sessions(id),
            routing_decisions JSONB DEFAULT '[]'::jsonb,
            user_preferences JSONB DEFAULT '{}'::jsonb,
            task_history JSONB DEFAULT '[]'::jsonb,
            agent_performance_tracking JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """))
        
        # Create indexes for performance
        conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_shared_sessions_session_id ON shared_sessions(session_id);
        CREATE INDEX IF NOT EXISTS idx_messages_shared_session_id ON messages(shared_session_id);
        CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_handoffs_session ON agent_handoffs(shared_session_id);
        CREATE INDEX IF NOT EXISTS idx_persona_router_memory_session ON persona_router_memory(shared_session_id);
        """))
        
        conn.commit()
        print("✅ Successfully added shared memory tables")

if __name__ == "__main__":
    add_shared_memory_tables()