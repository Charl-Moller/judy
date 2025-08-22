from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models
from ..schemas.chat import ChatRequest, ChatResponse
from ..services.orchestrator import run_agent, run_orchestrator_agent
from ..services.tool_loader import create_tool_loader, get_tools_description_for_llm
from ..services.shared_memory import shared_memory_service
import json
import asyncio
import uuid

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/workflow")
async def execute_workflow(payload: dict, auto_stream: bool = False, db: Session = Depends(get_db)):
    """
    Execute a workflow defined in the visual editor
    Payload should contain:
    - nodes: list of workflow nodes
    - connections: list of connections between nodes
    - input: user input message
    - session_id: optional session identifier
    - conversation_history: optional list of previous messages
    - files: optional list of file IDs to process
    """
    try:
        nodes = payload.get("nodes", [])
        connections = payload.get("connections", [])
        user_input = payload.get("input", "")
        session_id = payload.get("session_id", str(uuid.uuid4()))
        conversation_history = payload.get("conversation_history", [])
        attached_files = payload.get("files", [])
        
        if not nodes:
            raise HTTPException(status_code=400, detail="No nodes provided in workflow")
        
        if not user_input:
            raise HTTPException(status_code=400, detail="No input provided")
        
        # Process attached files and make them universally available
        file_context = {}
        if attached_files:
            print(f"\n📎 WORKFLOW: Processing {len(attached_files)} attached file(s)")
            from ..services.file_processor import file_processor
            
            # Get file information from database
            files_data = []
            for file_id in attached_files:
                try:
                    file_record = db.query(models.File).filter(models.File.id == file_id).first()
                    if file_record:
                        files_data.append({
                            "id": str(file_record.id),
                            "filename": file_record.filename,
                            "url": file_record.url,
                            "path": file_record.url,  # For compatibility
                            "content_type": file_record.content_type,
                            "size": file_record.size
                        })
                        print(f"📄 Found file: {file_record.filename}")
                    else:
                        print(f"❌ File not found in database: {file_id}")
                except Exception as e:
                    print(f"❌ Error retrieving file {file_id}: {e}")
            
            # Process all files through universal file processor
            if files_data:
                file_context = file_processor.process_files_for_workflow(files_data)
                print(f"✅ WORKFLOW: File processing complete - {file_context['file_count']} files ready")
        
        # Find the starting point - prioritize persona_router over regular agents
        agent_node = None
        persona_router_node = None
        
        # First pass: look for persona_router specifically
        for node in nodes:
            if node.get("type") == "persona_router":
                persona_router_node = node
                break
        
        # Second pass: if no persona_router found, look for regular agent
        if not persona_router_node:
            for node in nodes:
                if node.get("type") == "agent":
                    agent_node = node
                    break
        
        if not agent_node and not persona_router_node:
            raise HTTPException(status_code=400, detail="No agent or persona router node found in workflow")
        
        # Use persona router if available, otherwise regular agent
        primary_node = persona_router_node if persona_router_node else agent_node
        
        # Log the workflow starting point for debugging
        if persona_router_node:
            print(f"\n🎭 WORKFLOW: Starting with Persona Router '{persona_router_node.get('data', {}).get('name', 'Unnamed Router')}'")
        elif agent_node:
            print(f"\n🤖 WORKFLOW: Starting with regular Agent '{agent_node.get('data', {}).get('name', 'Unnamed Agent')}'")
        else:
            print(f"\n⚠️ WORKFLOW: No valid starting point found")
        
        # Handle persona router orchestrator pattern
        if persona_router_node:
            from ..services.persona_router import route_to_agent
            
            try:
                # Find all connected agents (connections FROM persona router TO agents)
                connected_agents = []
                persona_router_id = persona_router_node.get("id")
                
                for connection in connections:
                    if (connection.get("source") == persona_router_id and 
                        any(n.get("id") == connection.get("target") and n.get("type") == "agent" for n in nodes)):
                        agent_node_connected = next(n for n in nodes if n.get("id") == connection.get("target"))
                        connected_agents.append(agent_node_connected)
                
                if not connected_agents:
                    raise HTTPException(status_code=400, detail="No agents connected to persona router")
                
                # Find LLM node for persona router to use for intelligent routing
                llm_node_for_router = None
                for connection in connections:
                    if (connection.get("source") == persona_router_id and 
                        any(n.get("id") == connection.get("target") and n.get("type") == "llm" for n in nodes)):
                        llm_node_for_router = next(n for n in nodes if n.get("id") == connection.get("target"))
                        break
                
                # Route user input to appropriate connected agent (pass LLM config for intelligent routing)
                router_config = persona_router_node.get("data", {})
                if llm_node_for_router:
                    router_config["_llm_node"] = llm_node_for_router  # Pass LLM node for intelligent routing
                
                routing_result = route_to_agent(user_input, router_config, connected_agents, nodes, connections, session_id)
                selected_agent = routing_result["agent"]
                
                print("\n" + "="*60)
                print("🎭 PERSONA ROUTER ORCHESTRATION")
                print("="*60)
                print(f"📋 Available agents: {[a.get('data', {}).get('name', 'Unnamed') for a in connected_agents]}")
                print(f"🎯 Selected agent: '{selected_agent['data'].get('name', 'Unnamed')}' (ID: {selected_agent['id']})")
                print(f"📊 Confidence: {routing_result['confidence']:.2f}")
                print(f"🔧 Method: {routing_result['method']}")
                print(f"🔄 Fallback used: {routing_result.get('fallback_used', False)}")
                if 'reasoning' in routing_result:
                    print(f"💭 Reasoning: {routing_result['reasoning']}")
                print("="*60)
                
                # Create a temporary agent using the selected agent's configuration
                temp_agent = models.Agent(
                    id=uuid.uuid4(),
                    name=selected_agent.get('data', {}).get('name', 'Selected Agent'),
                    description=selected_agent.get('data', {}).get('description', 'Agent selected by persona router'),
                    system_prompt=selected_agent.get('data', {}).get('systemPrompt', 'You are a helpful AI assistant.'),
                    status=models.AgentStatus.active
                )
                
                # Override agent_node for LLM connection search (search from persona router)
                agent_node = {
                    "id": persona_router_node.get("id"),
                    "type": "persona_router",
                    "data": {
                        "name": f"{persona_router_node.get('data', {}).get('name', 'Persona Router')} → {temp_agent.name}",
                        "systemPrompt": temp_agent.system_prompt,
                        "selectedAgent": selected_agent,
                        "routingResult": routing_result
                    }
                }
                
            except Exception as e:
                print(f"Persona router orchestration failed: {e}")
                raise HTTPException(status_code=400, detail=f"Persona router orchestration failed: {str(e)}")
        
        # Find connected LLM node 
        llm_node = None
        if persona_router_node:
            # For persona router: find LLM connected to the selected agent, not the router
            selected_agent_node = routing_result["agent"]
            search_node_id = selected_agent_node.get("id")
            print(f"🔧 WORKFLOW: Looking for LLM connected to selected agent: {selected_agent_node.get('data', {}).get('name')} (ID: {search_node_id})")
        else:
            # For direct agent: find LLM connected to the agent
            search_node_id = primary_node.get("id")
            print(f"🔧 WORKFLOW: Looking for LLM connected to agent: {primary_node.get('data', {}).get('name')} (ID: {search_node_id})")
        for connection in connections:
            if (connection.get("source") == search_node_id and 
                any(n.get("id") == connection.get("target") and n.get("type") == "llm" for n in nodes)):
                llm_node = next(n for n in nodes if n.get("id") == connection.get("target"))
                print(f"✅ WORKFLOW: Found LLM node: {llm_node.get('data', {}).get('name')} connected to agent")
                break
        
        if not llm_node:
            raise HTTPException(status_code=400, detail="No LLM node connected to agent")
        
        # Find connected memory node
        memory_node = None
        for connection in connections:
            if (connection.get("source") == search_node_id and 
                any(n.get("id") == connection.get("target") and n.get("type") == "memory" for n in nodes)):
                memory_node = next(n for n in nodes if n.get("id") == connection.get("target"))
                break
        
        # Create a temporary agent record for execution
        if persona_router_node:
            # Agent was already created during persona routing
            pass  # temp_agent already exists
        else:
            # Create regular agent
            temp_agent = models.Agent(
                id=uuid.uuid4(),
                name=agent_node.get("data", {}).get("name", "Workflow Agent"),
                description=agent_node.get("data", {}).get("description", "Temporary agent for workflow execution"),
                system_prompt=agent_node.get("data", {}).get("systemPrompt", ""),
                status=models.AgentStatus.active
            )
        
        # Create LLM config - check for saved config first
        saved_config_id = llm_node.get("data", {}).get("savedConfigId")
        if saved_config_id:
            # Use saved LLM config from database
            temp_llm_config = db.query(models.LLMConfig).filter(models.LLMConfig.id == saved_config_id).first()
            if not temp_llm_config:
                raise HTTPException(status_code=400, detail=f"Saved LLM config {saved_config_id} not found")
        else:
            # Create a temporary LLM config from the workflow node data
            temp_llm_config = models.LLMConfig(
                id=uuid.uuid4(),
                provider=llm_node.get("data", {}).get("provider", "Azure OpenAI"),
                model_name=llm_node.get("data", {}).get("model", "gpt-4"),
                temperature=str(llm_node.get("data", {}).get("temperature", 0.7)),
                max_tokens=str(llm_node.get("data", {}).get("maxTokens", 4000)),
                api_base=llm_node.get("data", {}).get("apiBase", ""),
                api_key_secret_ref=llm_node.get("data", {}).get("apiKeySecretRef", "")
            )
        
        # Link the agent to the LLM config
        temp_agent.llm_config = temp_llm_config
        
        # Always provide conversation context to the agent (built-in feature)
        prev_output = {"attachments": [], "response": ""}
        
        # Add file context to make attachments universally available to all agents/sub-agents/tools
        if file_context.get("files_available"):
            prev_output["file_context"] = file_context["file_context"]
            prev_output["attached_files"] = file_context["file_summaries"]
            prev_output["structured_file_data"] = file_context["structured_data"]
            print(f"📎 WORKFLOW: File context added to agent execution ({len(file_context['file_context'])} chars)")
        
        print("\n" + "="*50)
        print("🔧 WORKFLOW CONFIGURATION")
        print("="*50)
        print(f"🤖 Agent: '{agent_node.get('data', {}).get('name', 'Unknown')}' ({agent_node.get('id')})")
        print(f"🧠 LLM: {llm_node.get('data', {}).get('model', 'Unknown')} ({llm_node.get('id')})")
        print(f"💾 Memory: {memory_node.get('data', {}).get('type', 'None') if memory_node else 'None'} ({memory_node.get('id') if memory_node else 'None'})")
        print(f"📚 Conversation History: {len(conversation_history)} messages")
        connection_strs = [f"{c.get('source')}->{c.get('target')}" for c in connections]
        print(f"🔗 Connections: {len(connections)} total")
        print("="*50)
        
        # Always provide conversation context (agent-level memory)
        if conversation_history:
            # Get agent's conversation memory settings (defaults if not configured)
            max_conversations = agent_node.get("data", {}).get("maxConversations", 10)
            include_system = agent_node.get("data", {}).get("includeSystemMessages", True)
            
            print(f"📋 Agent Memory Settings:")
            print(f"   • Max conversations: {max_conversations}")
            print(f"   • Include system messages: {include_system}")
            print(f"   • Available history: {len(conversation_history)}")
            
            # Limit conversation history based on agent configuration
            limited_history = conversation_history[-max_conversations:] if conversation_history else []
            
            if limited_history:
                prev_output["conversation_history"] = limited_history
                prev_output["include_system_messages"] = include_system
                prev_output["memory_strategy"] = "sliding_window"
                print(f"   • Limited history: {len(limited_history)} turns loaded")
            else:
                print(f"   • No conversation history available")
        
        # Handle additional memory components (RAG, vector search, etc.)
        if memory_node and memory_node.get("data", {}).get("type") != "conversation":
            memory_type = memory_node.get("data", {}).get("type", "unknown")
            print(f"Additional memory component detected: {memory_type}")
            # TODO: Implement RAG, vector search, etc.
            # For now, just log that it's there
            prev_output["additional_memory"] = {
                "type": memory_type,
                "node_id": memory_node.get("id")
            }
        
        print(f"=== END WORKFLOW DEBUG ===")
        
        # Load tools for the workflow
        tool_loader = create_tool_loader(db)
        workflow_tools = await tool_loader.get_tools_for_workflow(nodes)
        
        # Add tool information to prev_output for agent execution
        if workflow_tools:
            tools_description = get_tools_description_for_llm(workflow_tools)
            prev_output["available_tools"] = workflow_tools
            prev_output["tools_description"] = tools_description
            print(f"\n🔧 TOOL LOADING")
            print(f"   • Available tools: {list(workflow_tools.keys())}")
            print(f"   • Tools description length: {len(tools_description)} chars")
        else:
            print(f"\n🔧 TOOL LOADING")
            print(f"   • No tools configured for this workflow")
        
        # Check if any agent in the workflow is configured for streaming
        should_stream = False
        streaming_agent_name = None
        
        if persona_router_node:
            # Check if the selected agent has streaming enabled
            selected_agent_node = routing_result["agent"]
            stream_enabled = selected_agent_node.get('data', {}).get('streamResponse', False)
            if stream_enabled:
                should_stream = True
                streaming_agent_name = selected_agent_node.get('data', {}).get('name', 'Unknown')
                print(f"⚡ WORKFLOW: Selected agent '{streaming_agent_name}' has streaming ENABLED")
            else:
                print(f"🔄 WORKFLOW: Selected agent '{selected_agent_node.get('data', {}).get('name', 'Unknown')}' has streaming disabled")
        else:
            # Check if the primary agent has streaming enabled
            stream_enabled = primary_node.get('data', {}).get('streamResponse', False)
            if stream_enabled:
                should_stream = True
                streaming_agent_name = primary_node.get('data', {}).get('name', 'Unknown')
                print(f"⚡ WORKFLOW: Agent '{streaming_agent_name}' has streaming ENABLED")
            else:
                print(f"🔄 WORKFLOW: Agent '{primary_node.get('data', {}).get('name', 'Unknown')}' has streaming disabled")
        
        if should_stream and auto_stream:
            print(f"🌊 WORKFLOW: Auto-streaming enabled - redirecting to streaming execution for agent '{streaming_agent_name}'")
            # Return a special response indicating that streaming should be used
            return {
                "stream_required": True,
                "agent_name": streaming_agent_name,
                "message": "This agent is configured for streaming. Please use the /chat/workflow/stream endpoint for real-time responses."
            }
        elif should_stream:
            print(f"⚡ WORKFLOW: Agent '{streaming_agent_name}' supports streaming, but auto_stream=False - executing normally")
        
        # Execute the agent using existing infrastructure (non-streaming)
        from ..services.orchestrator import execute_single_agent
        
        print("\n" + "="*50)
        print("🚀 EXECUTING AGENT (NON-STREAMING)")
        print("="*50)
        print(f"🤖 Agent: '{temp_agent.name}'")
        print(f"💬 User Input: {user_input[:100]}{'...' if len(user_input) > 100 else ''}")
        print(f"📝 Memory Context: {len(prev_output.get('conversation_history', []))} previous messages" if prev_output.get('conversation_history') else "📝 Memory Context: None")
        print("="*50)
        
        result = execute_single_agent(
            agent=temp_agent,
            message=user_input,
            files=[],
            prev_output=prev_output
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # Prepare response with clean text (no agent prefix in content)
        response_with_agent_info = {
            "response": result.get("response", ""),  # Clean response text without agent prefix
            "attachments": result.get("attachments", []),
            "tool_calls": result.get("tool_calls", []),
            "session_id": session_id,
            "workflow_execution": {
                "agent_name": temp_agent.name,
                "llm_model": temp_llm_config.model_name,
                "provider": temp_llm_config.provider,
                "memory_used": memory_node is not None
            }
        }
        
        # If persona router was used, include routing information
        if persona_router_node:
            response_with_agent_info["workflow_execution"]["router_used"] = True
            response_with_agent_info["workflow_execution"]["router_name"] = persona_router_node.get('data', {}).get('name', 'Persona Router')
            response_with_agent_info["workflow_execution"]["selected_agent"] = temp_agent.name
            response_with_agent_info["workflow_execution"]["routing_method"] = agent_node.get("data", {}).get("routingResult", {}).get("method", "unknown")
            response_with_agent_info["workflow_execution"]["routing_confidence"] = agent_node.get("data", {}).get("routingResult", {}).get("confidence", 0)
        
        return response_with_agent_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Workflow execution failed: {str(e)}")

@router.post("/workflow/stream")
async def execute_workflow_stream(payload: dict, db: Session = Depends(get_db)):
    """
    Execute a workflow with streaming response
    """
    try:
        nodes = payload.get("nodes", [])
        connections = payload.get("connections", [])
        user_input = payload.get("input", "")
        session_id = payload.get("session_id", str(uuid.uuid4()))
        conversation_history = payload.get("conversation_history", [])
        attached_files = payload.get("files", [])
        
        print(f"🔑 CHAT ROUTER STREAM: Received session_id: {session_id}")
        print(f"📚 CHAT ROUTER STREAM: Received conversation_history: {len(conversation_history)} messages")
        for i, msg in enumerate(conversation_history):
            print(f"  [{i}] {msg.get('role', 'unknown')}: {msg.get('content', '')[:50]}...")
        
        # Process attached files (same logic as non-streaming)
        file_context = {}
        if attached_files:
            print(f"\n📎 WORKFLOW STREAM: Processing {len(attached_files)} attached file(s)")
            from ..services.file_processor import file_processor
            
            files_data = []
            for file_id in attached_files:
                try:
                    file_record = db.query(models.File).filter(models.File.id == file_id).first()
                    if file_record:
                        files_data.append({
                            "id": str(file_record.id),
                            "filename": file_record.filename,
                            "url": file_record.url,
                            "path": file_record.url,
                            "content_type": file_record.content_type,
                            "size": file_record.size
                        })
                except Exception as e:
                    print(f"❌ Error retrieving file {file_id}: {e}")
            
            if files_data:
                file_context = file_processor.process_files_for_workflow(files_data)
                print(f"✅ WORKFLOW STREAM: File processing complete - {file_context['file_count']} files ready")
        
        if not nodes:
            raise HTTPException(status_code=400, detail="No nodes provided in workflow")
        
        if not user_input:
            raise HTTPException(status_code=400, detail="No input provided")
        
        # Find the starting point - prioritize persona_router over regular agents
        agent_node = None
        persona_router_node = None
        
        # First pass: look for persona_router specifically
        for node in nodes:
            if node.get("type") == "persona_router":
                persona_router_node = node
                break
        
        # Second pass: if no persona_router found, look for regular agent
        if not persona_router_node:
            for node in nodes:
                if node.get("type") == "agent":
                    agent_node = node
                    break
        
        if not agent_node and not persona_router_node:
            raise HTTPException(status_code=400, detail="No agent or persona router node found in workflow")
        
        # Use persona router if available, otherwise regular agent
        primary_node = persona_router_node if persona_router_node else agent_node
        
        # Log the workflow starting point for debugging
        if persona_router_node:
            print(f"\n🎭 WORKFLOW: Starting with Persona Router '{persona_router_node.get('data', {}).get('name', 'Unnamed Router')}'")
        elif agent_node:
            print(f"\n🤖 WORKFLOW: Starting with regular Agent '{agent_node.get('data', {}).get('name', 'Unnamed Agent')}'")
        else:
            print(f"\n⚠️ WORKFLOW: No valid starting point found")
        
        # Store routing info for status updates
        routing_info = None
        
        # Handle persona router orchestrator pattern
        if persona_router_node:
            from ..services.persona_router import route_to_agent
            
            try:
                # Find all connected agents (connections FROM persona router TO agents)
                connected_agents = []
                persona_router_id = persona_router_node.get("id")
                
                for connection in connections:
                    if (connection.get("source") == persona_router_id and 
                        any(n.get("id") == connection.get("target") and n.get("type") == "agent" for n in nodes)):
                        agent_node_connected = next(n for n in nodes if n.get("id") == connection.get("target"))
                        connected_agents.append(agent_node_connected)
                
                if not connected_agents:
                    raise HTTPException(status_code=400, detail="No agents connected to persona router")
                
                # Find LLM node for persona router to use for intelligent routing
                llm_node_for_router = None
                for connection in connections:
                    if (connection.get("source") == persona_router_id and 
                        any(n.get("id") == connection.get("target") and n.get("type") == "llm" for n in nodes)):
                        llm_node_for_router = next(n for n in nodes if n.get("id") == connection.get("target"))
                        break
                
                # Store routing info for status updates during streaming
                routing_info = {
                    "persona_router_name": persona_router_node.get('data', {}).get('name', 'Persona Router'),
                    "available_agents": [a.get('data', {}).get('name', 'Unnamed') for a in connected_agents],
                    "user_input": user_input
                }
                
                # Route user input to appropriate connected agent (pass LLM config for intelligent routing)
                router_config = persona_router_node.get("data", {})
                if llm_node_for_router:
                    router_config["_llm_node"] = llm_node_for_router  # Pass LLM node for intelligent routing
                
                routing_result = route_to_agent(user_input, router_config, connected_agents, nodes, connections, session_id)
                selected_agent = routing_result["agent"]
                
                # Create a temporary agent using the selected agent's configuration
                temp_agent = models.Agent(
                    id=uuid.uuid4(),
                    name=selected_agent.get('data', {}).get('name', 'Selected Agent'),
                    description=selected_agent.get('data', {}).get('description', 'Agent selected by persona router'),
                    system_prompt=selected_agent.get('data', {}).get('systemPrompt', 'You are a helpful AI assistant.'),
                    status=models.AgentStatus.active
                )
                
                # Override agent_node for LLM connection search (search from persona router)
                agent_node = {
                    "id": persona_router_node.get("id"),
                    "type": "persona_router",
                    "data": {
                        "name": f"{persona_router_node.get('data', {}).get('name', 'Persona Router')} → {temp_agent.name}",
                        "systemPrompt": temp_agent.system_prompt,
                        "selectedAgent": selected_agent,
                        "routingResult": routing_result
                    }
                }
                
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Persona router orchestration failed: {str(e)}")
        
        # Find connected LLM node 
        llm_node = None
        if persona_router_node:
            # For persona router: find LLM connected to the selected agent, not the router
            selected_agent_node = routing_result["agent"]
            search_node_id = selected_agent_node.get("id")
            print(f"🔧 WORKFLOW: Looking for LLM connected to selected agent: {selected_agent_node.get('data', {}).get('name')} (ID: {search_node_id})")
        else:
            # For direct agent: find LLM connected to the agent
            search_node_id = primary_node.get("id")
            print(f"🔧 WORKFLOW: Looking for LLM connected to agent: {primary_node.get('data', {}).get('name')} (ID: {search_node_id})")
        for connection in connections:
            if (connection.get("source") == search_node_id and 
                any(n.get("id") == connection.get("target") and n.get("type") == "llm" for n in nodes)):
                llm_node = next(n for n in nodes if n.get("id") == connection.get("target"))
                print(f"✅ WORKFLOW: Found LLM node: {llm_node.get('data', {}).get('name')} connected to agent")
                break
        
        if not llm_node:
            raise HTTPException(status_code=400, detail="No LLM node connected to agent")
        
        # Find connected memory node
        memory_node = None
        for connection in connections:
            if (connection.get("source") == search_node_id and 
                any(n.get("id") == connection.get("target") and n.get("type") == "memory" for n in nodes)):
                memory_node = next(n for n in nodes if n.get("id") == connection.get("target"))
                break
        
        # Create a temporary agent record for execution
        if persona_router_node:
            # Agent was already created during persona routing
            pass  # temp_agent already exists
        else:
            # Create regular agent
            temp_agent = models.Agent(
                id=uuid.uuid4(),
                name=agent_node.get("data", {}).get("name", "Workflow Agent"),
                description=agent_node.get("data", {}).get("description", "Temporary agent for workflow execution"),
                system_prompt=agent_node.get("data", {}).get("systemPrompt", ""),
                status=models.AgentStatus.active
            )
        
        # Create LLM config - check for saved config first (STREAMING VERSION)
        saved_config_id = llm_node.get("data", {}).get("savedConfigId")
        if saved_config_id:
            # Use saved LLM config from database
            db_llm_config = db.query(models.LLMConfig).filter(models.LLMConfig.id == saved_config_id).first()
            if not db_llm_config:
                raise HTTPException(status_code=400, detail=f"Saved LLM config {saved_config_id} not found")
            
            # Create a detached copy to avoid session issues in streaming
            temp_llm_config = models.LLMConfig(
                id=db_llm_config.id,
                provider=db_llm_config.provider,
                model_name=db_llm_config.model_name,
                temperature=db_llm_config.temperature,
                max_tokens=db_llm_config.max_tokens,
                api_base=db_llm_config.api_base,
                api_key_secret_ref=db_llm_config.api_key_secret_ref
            )
            print(f"🔧 STREAMING: Created detached LLM config copy: {temp_llm_config.model_name}")
        else:
            # Create a temporary LLM config from the workflow node data
            temp_llm_config = models.LLMConfig(
                id=uuid.uuid4(),
                provider=llm_node.get("data", {}).get("provider", "Azure OpenAI"),
                model_name=llm_node.get("data", {}).get("model", "gpt-4"),
                temperature=str(llm_node.get("data", {}).get("temperature", 0.7)),
                max_tokens=str(llm_node.get("data", {}).get("maxTokens", 4000)),
                api_base=llm_node.get("data", {}).get("apiBase", ""),
                api_key_secret_ref=llm_node.get("data", {}).get("apiKeySecretRef", "")
            )
        
        # Link the agent to the LLM config
        temp_agent.llm_config = temp_llm_config
        
        # Always provide conversation context (agent-level memory)
        prev_output = {"attachments": [], "response": ""}
        
        # Add file context to make attachments universally available (streaming)
        if file_context.get("files_available"):
            prev_output["file_context"] = file_context["file_context"]
            prev_output["attached_files"] = file_context["file_summaries"]
            prev_output["structured_file_data"] = file_context["structured_data"]
            print(f"📎 WORKFLOW STREAM: File context added to agent execution")
        
        # Use conversation history with priority to payload over shared session memory
        if session_id and conversation_history:
            # Frontend provides authoritative conversation history - use it first
            max_conversations = agent_node.get("data", {}).get("maxConversations", 50)
            include_system = agent_node.get("data", {}).get("includeSystemMessages", True)
            
            limited_history = conversation_history[-max_conversations:] if conversation_history else []
            
            if limited_history:
                prev_output["conversation_history"] = limited_history
                prev_output["include_system_messages"] = include_system
                prev_output["memory_strategy"] = "payload_priority"
                print(f"📚 Using payload conversation history (frontend priority): {len(limited_history)} messages")
            else:
                print(f"📝 No payload conversation history provided")
        elif session_id:
            # Fallback to shared session memory only if no payload conversation history
            max_conversations = agent_node.get("data", {}).get("maxConversations", 50)
            include_system = agent_node.get("data", {}).get("includeSystemMessages", True)
            
            # Get shared context from session
            shared_context = shared_memory_service.get_context_for_agent_handoff(db, session_id)
            shared_conversation_history = shared_context["conversation_history"]
            
            # Apply agent's memory limits to shared history
            limited_shared_history = shared_conversation_history[-max_conversations:] if shared_conversation_history else []
            
            if limited_shared_history:
                prev_output["conversation_history"] = limited_shared_history
                prev_output["include_system_messages"] = include_system
                prev_output["memory_strategy"] = "shared_session"
                prev_output["session_context"] = {
                    "current_task": shared_context["current_task"],
                    "session_facts": shared_context["session_facts"],
                    "global_context": shared_context["global_context"]
                }
                print(f"📚 Using shared session memory: {len(limited_shared_history)} messages from session")
            elif conversation_history:
                # Fallback to payload conversation history if shared session is empty
                max_conversations = agent_node.get("data", {}).get("maxConversations", 10)
                limited_history = conversation_history[-max_conversations:] if conversation_history else []
                
                if limited_history:
                    prev_output["conversation_history"] = limited_history
                    prev_output["include_system_messages"] = include_system
                    prev_output["memory_strategy"] = "payload_fallback"
                    print(f"📚 Using payload conversation history as fallback: {len(limited_history)} messages")
                else:
                    print(f"📝 No conversation history available (shared session empty and no payload history)")
            else:
                print(f"📝 No shared session history found for session: {session_id}")
        elif conversation_history:
            # Fallback to traditional conversation history if no session_id
            max_conversations = agent_node.get("data", {}).get("maxConversations", 10)
            include_system = agent_node.get("data", {}).get("includeSystemMessages", True)
            
            limited_history = conversation_history[-max_conversations:] if conversation_history else []
            
            if limited_history:
                prev_output["conversation_history"] = limited_history
                prev_output["include_system_messages"] = include_system
                prev_output["memory_strategy"] = "sliding_window"
                print(f"📚 Using traditional conversation history: {len(limited_history)} messages")
        
        # Load tools for the workflow (streaming)
        tool_loader = create_tool_loader(db)
        workflow_tools = await tool_loader.get_tools_for_workflow(nodes)
        
        # Add tool information to prev_output for agent execution
        if workflow_tools:
            tools_description = get_tools_description_for_llm(workflow_tools)
            prev_output["available_tools"] = workflow_tools
            prev_output["tools_description"] = tools_description
            print(f"\n🔧 TOOL LOADING (STREAMING)")
            print(f"   • Available tools: {list(workflow_tools.keys())}")
        else:
            print(f"\n🔧 TOOL LOADING (STREAMING)")
            print(f"   • No tools configured for this workflow")
        
        async def generate_stream():
            full_response = ""  # Collect full response for shared memory saving
            selected_agent_id = None
            selected_agent_name = None
            
            try:
                # Send initial status update
                if routing_info:
                    yield f"data: {json.dumps({'status': f'Persona router analyzing request...', 'type': 'status'})}\n\n"
                    await asyncio.sleep(0.1)  # Small delay for better UX
                    
                    available_agents_text = ', '.join(routing_info['available_agents'])
                    yield f"data: {json.dumps({'status': f'Considering best agent from: {available_agents_text}', 'type': 'status'})}\n\n"
                    await asyncio.sleep(0.1)
                
                # Record agent handoff if using persona router
                if persona_router_node and session_id:
                    selected_agent_id = str(temp_agent.id)
                    selected_agent_name = temp_agent.name
                    
                    # Send agent selection status
                    yield f"data: {json.dumps({'status': f'Selected {selected_agent_name} for this task', 'type': 'status'})}\n\n"
                    await asyncio.sleep(0.1)
                    
                    # Save user message to shared memory first
                    shared_memory_service.add_message_to_shared_context(
                        db=db,
                        session_id=session_id,
                        role="user",
                        content=user_input,
                        agent_id=selected_agent_id,
                        agent_name=selected_agent_name
                    )
                    
                    # Record agent handoff in shared memory
                    shared_memory_service.record_agent_handoff(
                        db=db,
                        session_id=session_id,
                        to_agent_id=selected_agent_id,
                        to_agent_name=selected_agent_name,
                        handoff_reason=f"Persona router selected for input: '{user_input[:50]}{'...' if len(user_input) > 50 else ''}'",
                        context_summary=f"User requesting: {user_input[:100]}{'...' if len(user_input) > 100 else ''}"
                    )
                
                # Send agent information at the start of the stream if persona router was used
                if persona_router_node:
                    agent_info = {
                        'agent_name': temp_agent.name,
                        'router_used': True,
                        'agent_header': True  # Signal to frontend to show agent header, no content prefix
                    }
                    yield f"data: {json.dumps(agent_info)}\n\n"
                
                # Send agent working status
                agent_display_name = temp_agent.name if persona_router_node else primary_node.get('data', {}).get('name', 'Agent')
                yield f"data: {json.dumps({'status': f'{agent_display_name} is processing your request...', 'type': 'status'})}\n\n"
                await asyncio.sleep(0.1)
                
                # Execute the agent using existing streaming infrastructure
                from ..services.orchestrator import execute_single_agent_stream
                
                async for chunk in execute_single_agent_stream(
                    agent=temp_agent,
                    message=user_input,
                    files=attached_files,
                    prev_output=prev_output
                ):
                    full_response += chunk  # Accumulate response
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                
                # Save assistant response to shared memory
                if session_id and full_response:
                    shared_memory_service.add_message_to_shared_context(
                        db=db,
                        session_id=session_id,
                        role="assistant",
                        content=full_response,
                        agent_id=selected_agent_id,
                        agent_name=selected_agent_name
                    )
                
                # Send completion signal with agent info
                completion_data = {'done': True}
                if persona_router_node:
                    completion_data['agent_name'] = temp_agent.name
                yield f"data: {json.dumps(completion_data)}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Workflow streaming execution failed: {str(e)}")

@router.post("", response_model=ChatResponse)
def chat_endpoint(payload: ChatRequest, db: Session = Depends(get_db)):
    if not payload.agent_id or payload.agent_id == "orchestrator":
        # Use orchestrator agent as default
        result = run_orchestrator_agent(message=payload.message or "", files=payload.files or [], session_id=payload.session_id)
    else:
        # Use specific agent if specified (for admin/testing purposes)
        result = run_agent(agent_id=payload.agent_id, message=payload.message or "", files=payload.files or [], session_id=payload.session_id)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Normalize tool calls for schema
    serialized_calls = []
    for c in result.get("tool_calls", []) or []:
        serialized_calls.append({"tool_name": getattr(c, "name", "tool"), "parameters": getattr(c, "arguments", {})})
    
    return {
        "response": result.get("response", ""),
        "attachments": result.get("attachments", []),
        "tool_calls": serialized_calls,
    }

@router.post("/stream")
async def chat_stream_endpoint(payload: ChatRequest, db: Session = Depends(get_db)):
    if not payload.agent_id or payload.agent_id == "orchestrator":
        # Use orchestrator agent for streaming
        async def generate_stream():
            try:
                # For now, use the non-streaming orchestrator and stream the response
                # In the future, we can implement true streaming for the orchestrator
                result = run_orchestrator_agent(message=payload.message or "", files=payload.files or [], session_id=payload.session_id)
                
                if "error" in result:
                    yield f"data: {json.dumps({'error': result['error']})}\n\n"
                    return
                
                # Stream the response character by character for now
                response = result.get("response", "")
                for char in response:
                    yield f"data: {json.dumps({'content': char})}\n\n"
                    await asyncio.sleep(0.01)  # Small delay for streaming effect
                
                # Send completion signal
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            }
        )
    else:
        # Use specific agent if specified (for admin/testing purposes)
        async def generate_stream():
            try:
                # Get the agent
                agent = db.query(models.Agent).filter(models.Agent.id == payload.agent_id).first()
                if not agent:
                    yield f"data: {json.dumps({'error': 'Agent not found'})}\n\n"
                    return
                
                # Get LLM config
                if not agent.llm_config:
                    yield f"data: {json.dumps({'error': f'No LLM config found for agent {agent.name}'})}\n\n"
                    return
                
                if not agent.llm_config.api_base:
                    yield f"data: {json.dumps({'error': f'LLM config incomplete for agent {agent.name}'})}\n\n"
                    return
                
                # Start streaming response
                from ..services.orchestrator import execute_single_agent_stream
                async for chunk in execute_single_agent_stream(agent, payload.message or "", payload.files or [], {}):
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                
                # Send completion signal
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            }
        )