#!/usr/bin/env python3
"""
Simple test script to trigger ServiceNow API calls and observe debug logging
"""

import asyncio
import requests
import json
from app.services.mcp_manager import create_mcp_manager
from app.db.database import get_db

async def test_servicenow_direct():
    """Test ServiceNow API calls directly through MCP manager"""
    
    # Get database session
    db = next(get_db())
    
    # Create MCP manager
    mcp_manager = create_mcp_manager(db)
    
    # Initialize MCP manager
    await mcp_manager.initialize()
    
    print("🔧 Testing ServiceNow API calls...")
    
    # Test list_incidents
    result = await mcp_manager.execute_mcp_tool(
        tool_name="list_incidents",
        server_id="55060e4f-fc96-46a5-b20b-5906e4f0cfcf",  # Use the server ID from logs
        query="assignment_groupLIKEData Science^ORDERBYDESCopened_at^active=true",
        limit=5
    )
    
    print(f"🔍 Result: {json.dumps(result, indent=2)}")
    
    # Cleanup
    await mcp_manager.shutdown()

def test_via_api():
    """Test ServiceNow via REST API"""
    
    # Create a simple workflow payload
    payload = {
        "message": "show top 5 companies by incidents raised in the last week",
        "nodes": [
            {
                "id": "persona_router_1755597306384",
                "type": "persona_router",
                "data": {
                    "label": "Persona Router",
                    "name": "Persona Router"
                }
            }
        ],
        "connections": [],
        "input": "show top 5 companies by incidents raised in the last week"
    }
    
    try:
        response = requests.post(
            "http://localhost:8000/chat/workflow",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📡 API Response Status: {response.status_code}")
        print(f"📡 API Response: {response.text}")
        
    except Exception as e:
        print(f"❌ API Error: {e}")

if __name__ == "__main__":
    print("🚀 Starting ServiceNow API tests...")
    
    # Test via API first (simpler)
    print("\n1. Testing via REST API...")
    test_via_api()
    
    # Test direct MCP calls
    print("\n2. Testing direct MCP calls...")
    try:
        asyncio.run(test_servicenow_direct())
    except Exception as e:
        print(f"❌ Direct test error: {e}")