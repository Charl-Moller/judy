#!/usr/bin/env python3
"""
Test persona router routing summaries
"""

import sys
sys.path.append('.')

from app.db.database import SessionLocal
from app.db.models import Agent
from app.services.persona_router import PersonaRouter

def test_persona_router():
    """Test persona router with mock agents"""
    
    # Get real agents from database
    db = SessionLocal()
    try:
        agents = db.query(Agent).all()
        print(f"Found {len(agents)} agents in database:")
        for agent in agents:
            print(f"  - {agent.name}: routing_summary = {'✅' if agent.routing_summary else '❌'}")
    finally:
        db.close()
    
    # Create mock connected agents like the workflow would
    mock_connected_agents = [
        {
            'id': 'agent_general',
            'data': {
                'name': 'General Agent',
                'systemPrompt': 'You are a general-purpose AI assistant that can help with various tasks including data analysis and file processing.',
            }
        },
        {
            'id': 'agent_servicenow',
            'data': {
                'name': 'ServiceNow Agent',
                'systemPrompt': 'You are a specialized ServiceNow ITSM assistant. You help users interact with ServiceNow systems to manage incidents, service requests, and other ITSM operations.',
            }
        }
    ]
    
    # Mock persona router config
    mock_router_config = {
        'intents': {
            'method': 'hybrid',
            'confidenceThreshold': 0.7
        }
    }
    
    # Test routing
    router = PersonaRouter()
    
    test_queries = [
        "show data science recent incidents",
        "list ServiceNow incidents",
        "create an excel file",
        "help with ServiceNow tickets"
    ]
    
    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"Testing query: '{query}'")
        print('='*60)
        
        try:
            result = router.select_agent(
                user_input=query,
                persona_router_config=mock_router_config,
                connected_agents=mock_connected_agents
            )
            
            print(f"✅ Result: {result['agent']['data']['name']} (confidence: {result['confidence']:.2f})")
            print(f"   Method: {result['method']}")
            print(f"   Fallback used: {result.get('fallback_used', False)}")
            if 'reasoning' in result:
                print(f"   Reasoning: {result['reasoning']}")
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_persona_router()