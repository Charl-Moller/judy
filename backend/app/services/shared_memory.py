"""
Shared Memory Service for Multi-Agent Context Sharing

This service manages session-level memory that is shared across all agents
in a conversation, enabling seamless context handoffs and continuous learning.
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Dict, List, Optional, Any
import uuid
from datetime import datetime

from ..db import models


class SharedMemoryService:
    """
    Manages shared memory across agents in a conversation session.
    Provides context continuity, intelligent handoffs, and session-level learning.
    All methods require a database session to be passed.
    """
    
    def get_or_create_shared_session(self, db: Session, session_id: str) -> models.SharedSession:
        """Get existing shared session or create a new one"""
        shared_session = db.query(models.SharedSession).filter(
            models.SharedSession.session_id == session_id
        ).first()
        
        if not shared_session:
            shared_session = models.SharedSession(
                session_id=session_id,
                session_facts=[],
                global_context={},
                agent_routing_history=[],
                memory_strategy="shared",
                max_context_length=50,
                preserve_context_on_agent_switch=True
            )
            db.add(shared_session)
            db.commit()
            print(f"🆕 Created new shared session: {session_id}")
        
        return shared_session
    
    def get_shared_conversation_history(self, db: Session, session_id: str, limit: int = None) -> List[Dict]:
        """Get conversation history for the session across all agents"""
        shared_session = self.get_or_create_shared_session(db, session_id)
        
        # Apply session's max context length if no specific limit provided
        if limit is None:
            limit = shared_session.max_context_length
        
        # Get messages from this shared session
        messages = db.query(models.Message).filter(
            models.Message.shared_session_id == shared_session.id
        ).order_by(models.Message.created_at).limit(limit).all()
        
        conversation_history = []
        for msg in messages:
            conversation_history.append({
                "role": msg.role,
                "content": msg.content,
                "agent_id": str(msg.agent_id) if msg.agent_id else None,
                "agent_name": msg.agent_name,
                "timestamp": msg.created_at.isoformat(),
                "attachments": msg.attachments
            })
        
        return conversation_history
    
    def add_message_to_shared_context(self, 
                                     db: Session,
                                     session_id: str, 
                                     role: str, 
                                     content: str, 
                                     agent_id: str = None, 
                                     agent_name: str = None,
                                     attachments: List = None):
        """Add a new message to the shared conversation context"""
        shared_session = self.get_or_create_shared_session(db, session_id)
        
        # Create a conversation if one doesn't exist for this session
        conversation = db.query(models.Conversation).join(models.Message).filter(
            models.Message.shared_session_id == shared_session.id
        ).first()
        
        if not conversation:
            conversation = models.Conversation()
            db.add(conversation)
            db.commit()
        
        # Add the message
        message = models.Message(
            conversation_id=conversation.id,
            role=role,
            content=content,
            agent_id=uuid.UUID(agent_id) if agent_id else None,
            agent_name=agent_name,
            shared_session_id=shared_session.id,
            attachments=attachments or []
        )
        
        db.add(message)
        db.commit()
        
        # Update session timestamp
        shared_session.updated_at = datetime.utcnow()
        db.commit()
        
        print(f"💾 Added message to shared context: {role} from {agent_name or 'Unknown'}")
    
    def record_agent_handoff(self, 
                           db: Session,
                           session_id: str,
                           from_agent_id: str = None,
                           from_agent_name: str = None,
                           to_agent_id: str = None,
                           to_agent_name: str = None,
                           handoff_reason: str = None,
                           context_summary: str = None,
                           preserved_context: Dict = None):
        """Record when control is handed off from one agent to another"""
        shared_session = self.get_or_create_shared_session(db, session_id)
        
        handoff = models.AgentHandoff(
            shared_session_id=shared_session.id,
            from_agent_id=uuid.UUID(from_agent_id) if from_agent_id else None,
            from_agent_name=from_agent_name,
            to_agent_id=uuid.UUID(to_agent_id) if to_agent_id else None,
            to_agent_name=to_agent_name,
            handoff_reason=handoff_reason,
            context_summary=context_summary,
            preserved_context=preserved_context or {}
        )
        
        db.add(handoff)
        
        # Update session's current agent and routing history
        shared_session.current_agent_id = uuid.UUID(to_agent_id) if to_agent_id else None
        
        routing_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "from_agent": from_agent_name,
            "to_agent": to_agent_name,
            "reason": handoff_reason,
            "context_summary": context_summary
        }
        
        routing_history = shared_session.agent_routing_history or []
        routing_history.append(routing_entry)
        shared_session.agent_routing_history = routing_history
        
        db.commit()
        
        print(f"🔄 Recorded agent handoff: {from_agent_name or 'Unknown'} → {to_agent_name or 'Unknown'}")
        print(f"   Reason: {handoff_reason}")
    
    def update_session_context(self, 
                              db: Session,
                              session_id: str,
                              current_task: str = None,
                              session_facts: List[str] = None,
                              global_context: Dict = None):
        """Update session-level context information"""
        shared_session = self.get_or_create_shared_session(db, session_id)
        
        if current_task is not None:
            shared_session.current_task = current_task
        
        if session_facts is not None:
            # Merge new facts with existing ones, avoiding duplicates
            existing_facts = shared_session.session_facts or []
            all_facts = existing_facts + [fact for fact in session_facts if fact not in existing_facts]
            shared_session.session_facts = all_facts
        
        if global_context is not None:
            # Merge new context with existing context
            existing_context = shared_session.global_context or {}
            existing_context.update(global_context)
            shared_session.global_context = existing_context
        
        shared_session.updated_at = datetime.utcnow()
        db.commit()
    
    def get_persona_router_memory(self, db: Session, session_id: str) -> models.PersonaRouterMemory:
        """Get or create persona router memory for the session"""
        shared_session = self.get_or_create_shared_session(db, session_id)
        
        router_memory = db.query(models.PersonaRouterMemory).filter(
            models.PersonaRouterMemory.shared_session_id == shared_session.id
        ).first()
        
        if not router_memory:
            router_memory = models.PersonaRouterMemory(
                shared_session_id=shared_session.id,
                routing_decisions=[],
                user_preferences={},
                task_history=[],
                agent_performance_tracking={}
            )
            db.add(router_memory)
            db.commit()
        
        return router_memory
    
    def record_routing_decision(self, 
                               db: Session,
                               session_id: str,
                               user_input: str,
                               selected_agent_id: str,
                               selected_agent_name: str,
                               confidence: float,
                               available_agents: List[Dict],
                               routing_reason: str = None):
        """Record a persona router decision for learning"""
        router_memory = self.get_persona_router_memory(db, session_id)
        
        decision = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_input": user_input,
            "selected_agent_id": selected_agent_id,
            "selected_agent_name": selected_agent_name,
            "confidence": confidence,
            "available_agents": available_agents,
            "routing_reason": routing_reason
        }
        
        routing_decisions = router_memory.routing_decisions or []
        routing_decisions.append(decision)
        router_memory.routing_decisions = routing_decisions
        
        # Update task history
        task_history = router_memory.task_history or []
        task_history.append({
            "task": user_input,
            "agent": selected_agent_name,
            "timestamp": datetime.utcnow().isoformat()
        })
        router_memory.task_history = task_history
        
        router_memory.updated_at = datetime.utcnow()
        db.commit()
        
        print(f"📊 Recorded routing decision: '{user_input}' → {selected_agent_name} (confidence: {confidence})")
    
    def get_context_for_agent_handoff(self, db: Session, session_id: str) -> Dict:
        """
        Get comprehensive context for intelligent agent handoffs.
        This provides the receiving agent with full situational awareness.
        """
        shared_session = self.get_or_create_shared_session(db, session_id)
        
        # Get recent conversation history
        conversation_history = self.get_shared_conversation_history(db, session_id, limit=20)
        
        # Get recent handoffs for context
        recent_handoffs = db.query(models.AgentHandoff).filter(
            models.AgentHandoff.shared_session_id == shared_session.id
        ).order_by(desc(models.AgentHandoff.created_at)).limit(5).all()
        
        handoff_context = []
        for handoff in recent_handoffs:
            handoff_context.append({
                "from_agent": handoff.from_agent_name,
                "to_agent": handoff.to_agent_name,
                "reason": handoff.handoff_reason,
                "summary": handoff.context_summary,
                "timestamp": handoff.created_at.isoformat()
            })
        
        return {
            "session_id": session_id,
            "current_task": shared_session.current_task,
            "session_facts": shared_session.session_facts or [],
            "global_context": shared_session.global_context or {},
            "conversation_history": conversation_history,
            "recent_handoffs": handoff_context,
            "agent_routing_history": shared_session.agent_routing_history or [],
            "memory_strategy": shared_session.memory_strategy,
            "context_preservation": shared_session.preserve_context_on_agent_switch
        }
    
    def generate_context_summary(self, db: Session, session_id: str, agent_name: str) -> str:
        """Generate a natural language summary of what has happened in the session"""
        context = self.get_context_for_agent_handoff(db, session_id)
        
        summary_parts = []
        
        if context["current_task"]:
            summary_parts.append(f"Current task: {context['current_task']}")
        
        if context["session_facts"]:
            facts_str = "; ".join(context["session_facts"][-5:])  # Last 5 facts
            summary_parts.append(f"Key facts: {facts_str}")
        
        if context["recent_handoffs"]:
            last_handoff = context["recent_handoffs"][0]
            summary_parts.append(f"Previous agent: {last_handoff['from_agent']} ({last_handoff['reason']})")
        
        if context["conversation_history"]:
            last_exchange = context["conversation_history"][-1]
            summary_parts.append(f"Last message: {last_exchange['content'][:100]}...")
        
        if summary_parts:
            return f"[CONTEXT] {agent_name} is now handling the conversation. " + " | ".join(summary_parts)
        else:
            return f"[CONTEXT] {agent_name} is starting a new conversation."


# Singleton instance
shared_memory_service = SharedMemoryService()