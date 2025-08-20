#!/usr/bin/env python3
"""
Generate routing summaries for existing agents
"""

import sys
sys.path.append('../')

from app.db.database import SessionLocal, engine
from app.db.models import Agent
from app.services.prompt_processor import generate_agent_routing_summary

def generate_routing_summaries_for_existing_agents():
    """Generate routing summaries for all existing agents that don't have them"""
    db = SessionLocal()
    try:
        # Find all agents without routing summaries but with system prompts
        agents_without_summaries = db.query(Agent).filter(
            Agent.routing_summary.is_(None),
            Agent.system_prompt.isnot(None)
        ).all()
        
        print(f"Found {len(agents_without_summaries)} agents without routing summaries")
        
        processed = 0
        failed = 0
        
        for agent in agents_without_summaries:
            if agent.system_prompt and agent.system_prompt.strip():
                try:
                    print(f"\nProcessing agent '{agent.name}'...")
                    routing_summary = generate_agent_routing_summary(agent.system_prompt, agent.name)
                    
                    if routing_summary:
                        agent.routing_summary = routing_summary
                        print(f"✅ Generated routing summary ({len(routing_summary)} chars)")
                        processed += 1
                    else:
                        print(f"⚠️ No routing summary generated")
                        failed += 1
                        
                except Exception as e:
                    print(f"❌ Failed to generate routing summary: {e}")
                    failed += 1
        
        if processed > 0:
            db.commit()
            print(f"\n✅ Successfully generated routing summaries for {processed} agents")
        
        if failed > 0:
            print(f"⚠️ Failed to generate summaries for {failed} agents")
            
        return processed, failed
        
    except Exception as e:
        print(f"❌ Error processing agents: {e}")
        db.rollback()
        return 0, 0
    finally:
        db.close()

if __name__ == "__main__":
    print("Generating routing summaries for existing agents...")
    processed, failed = generate_routing_summaries_for_existing_agents()
    
    if processed > 0:
        print(f"\n🎯 Summary: {processed} routing summaries generated successfully")
    if failed > 0:
        print(f"❌ Summary: {failed} agents failed to process")
    
    if processed == 0 and failed == 0:
        print("No agents found that need routing summaries")