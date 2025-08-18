from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models
from ..schemas.chat import ChatRequest, ChatResponse
from ..services.orchestrator import run_agent, run_orchestrator_agent
import json
import asyncio
import uuid

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/workflow")
async def execute_workflow(payload: dict, db: Session = Depends(get_db)):
    """
    Execute a workflow defined in the visual editor
    Payload should contain:
    - nodes: list of workflow nodes
    - connections: list of connections between nodes
    - input: user input message
    - session_id: optional session identifier
    - conversation_history: optional list of previous messages
    """
    try:
        nodes = payload.get("nodes", [])
        connections = payload.get("connections", [])
        user_input = payload.get("input", "")
        session_id = payload.get("session_id", str(uuid.uuid4()))
        conversation_history = payload.get("conversation_history", [])
        
        if not nodes:
            raise HTTPException(status_code=400, detail="No nodes provided in workflow")
        
        if not user_input:
            raise HTTPException(status_code=400, detail="No input provided")
        
        # Find the starting point (agent node)
        agent_node = None
        for node in nodes:
            if node.get("type") == "agent":
                agent_node = node
                break
        
        if not agent_node:
            raise HTTPException(status_code=400, detail="No agent node found in workflow")
        
        # Find connected LLM node
        llm_node = None
        for connection in connections:
            if (connection.get("source") == agent_node.get("id") and 
                any(n.get("id") == connection.get("target") and n.get("type") == "llm" for n in nodes)):
                llm_node = next(n for n in nodes if n.get("id") == connection.get("target"))
                break
        
        if not llm_node:
            raise HTTPException(status_code=400, detail="No LLM node connected to agent")
        
        # Find connected memory node
        memory_node = None
        for connection in connections:
            if (connection.get("source") == agent_node.get("id") and 
                any(n.get("id") == connection.get("target") and n.get("type") == "memory" for n in nodes)):
                memory_node = next(n for n in nodes if n.get("id") == connection.get("target"))
                break
        
        # Create a temporary agent record for execution
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
        
        print(f"=== WORKFLOW DEBUG ===")
        print(f"Agent node: {agent_node.get('id')} - {agent_node.get('data', {}).get('name', 'Unknown')}")
        print(f"LLM node: {llm_node.get('id')} - {llm_node.get('data', {}).get('model', 'Unknown')}")
        print(f"Memory node: {memory_node.get('id') if memory_node else 'None'} - {memory_node.get('data', {}).get('type', 'None') if memory_node else 'None'}")
        if memory_node:
            print(f"Memory node data: {memory_node.get('data', {})}")
        print(f"Conversation history length: {len(conversation_history)}")
        connection_strs = [f"{c.get('source')}->{c.get('target')}" for c in connections]
        print(f"Connections: {connection_strs}")
        
        # Always provide conversation context (agent-level memory)
        if conversation_history:
            # Get agent's conversation memory settings (defaults if not configured)
            max_conversations = agent_node.get("data", {}).get("maxConversations", 10)
            include_system = agent_node.get("data", {}).get("includeSystemMessages", True)
            
            print(f"Agent conversation memory settings:")
            print(f"  - Max conversations: {max_conversations}")
            print(f"  - Include system messages: {include_system}")
            print(f"  - Available history: {len(conversation_history)}")
            
            # Limit conversation history based on agent configuration
            limited_history = conversation_history[-max_conversations:] if conversation_history else []
            
            if limited_history:
                prev_output["conversation_history"] = limited_history
                prev_output["include_system_messages"] = include_system
                prev_output["memory_strategy"] = "sliding_window"
                print(f"  - Limited history: {len(limited_history)} turns")
                print(f"  - prev_output keys: {list(prev_output.keys())}")
            else:
                print(f"  - No conversation history available")
        else:
            print(f"No conversation history available")
        
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
        
        # Execute the agent using existing infrastructure
        from ..services.orchestrator import execute_single_agent
        
        print(f"=== CALLING ORCHESTRATOR ===")
        print(f"prev_output being passed: {prev_output}")
        print(f"prev_output type: {type(prev_output)}")
        print(f"prev_output keys: {list(prev_output.keys())}")
        
        result = execute_single_agent(
            agent=temp_agent,
            message=user_input,
            files=[],
            prev_output=prev_output
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "response": result.get("response", ""),
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
        
        if not nodes:
            raise HTTPException(status_code=400, detail="No nodes provided in workflow")
        
        if not user_input:
            raise HTTPException(status_code=400, detail="No input provided")
        
        # Find the starting point (agent node)
        agent_node = None
        for node in nodes:
            if node.get("type") == "agent":
                agent_node = node
                break
        
        if not agent_node:
            raise HTTPException(status_code=400, detail="No agent node found in workflow")
        
        # Find connected LLM node
        llm_node = None
        for connection in connections:
            if (connection.get("source") == agent_node.get("id") and 
                any(n.get("id") == connection.get("target") and n.get("type") == "llm" for n in nodes)):
                llm_node = next(n for n in nodes if n.get("id") == connection.get("target"))
                break
        
        if not llm_node:
            raise HTTPException(status_code=400, detail="No LLM node connected to agent")
        
        # Find connected memory node
        memory_node = None
        for connection in connections:
            if (connection.get("source") == agent_node.get("id") and 
                any(n.get("id") == connection.get("target") and n.get("type") == "memory" for n in nodes)):
                memory_node = next(n for n in nodes if n.get("id") == connection.get("target"))
                break
        
        # Create a temporary agent record for execution
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
        
        # Always provide conversation context (agent-level memory)
        prev_output = {"attachments": [], "response": ""}
        if conversation_history:
            # Get agent's conversation memory settings (defaults if not configured)
            max_conversations = agent_node.get("data", {}).get("maxConversations", 10)
            include_system = agent_node.get("data", {}).get("includeSystemMessages", True)
            
            # Limit conversation history based on agent configuration
            limited_history = conversation_history[-max_conversations:] if conversation_history else []
            
            if limited_history:
                prev_output["conversation_history"] = limited_history
                prev_output["include_system_messages"] = include_system
                prev_output["memory_strategy"] = "sliding_window"
        
        async def generate_stream():
            try:
                # Execute the agent using existing streaming infrastructure
                from ..services.orchestrator import execute_single_agent_stream
                
                async for chunk in execute_single_agent_stream(
                    agent=temp_agent,
                    message=user_input,
                    files=[],
                    prev_output=prev_output
                ):
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