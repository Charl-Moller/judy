from openai import AzureOpenAI
from sqlalchemy.orm import Session
from ..db.database import SessionLocal
from ..db import models
from ..config import settings
import uuid
from datetime import datetime
import re
import json
from pathlib import Path

print("=== ORCHESTRATOR MODULE LOADED ===")

# Force reload trigger - backend should pick up changes now

# Another reload trigger - fixing diagram generator tool

# Try to import Azure Key Vault client
try:
    from azure.keyvault.secrets import SecretClient
    from azure.identity import DefaultAzureCredential
    AZURE_KEYVAULT_AVAILABLE = True
except ImportError:
    AZURE_KEYVAULT_AVAILABLE = False
    print("Warning: azure-keyvault-secrets not installed. Key Vault integration disabled.")

def resolve_azure_keyvault_secret(secret_url: str) -> str:
    """Resolve Azure Key Vault secret reference"""
    if not AZURE_KEYVAULT_AVAILABLE:
        raise Exception("Azure Key Vault integration not available")
    
    try:
        print(f"=== AZURE KEY VAULT DEBUG ===")
        print(f"Attempting to resolve secret: {secret_url}")
        
        # Parse the secret URL: https://vault-name.vault.azure.net/secrets/secret-name/version
        # Extract vault name and secret name
        match = re.match(r'https://([^.]+)\.vault\.azure\.net/secrets/([^/]+)(?:/([^/]+))?', secret_url)
        if not match:
            raise Exception(f"Invalid Key Vault secret URL format: {secret_url}")
        
        vault_name = match.group(1)
        secret_name = match.group(2)
        secret_version = match.group(3)  # Optional
        
        print(f"Parsed vault_name: {vault_name}")
        print(f"Parsed secret_name: {secret_name}")
        print(f"Parsed secret_version: {secret_version}")
        
        # Create Key Vault client
        print(f"Creating Azure credential...")
        credential = DefaultAzureCredential()
        print(f"Credential created: {type(credential)}")
        
        vault_url = f"https://{vault_name}.vault.azure.net/"
        print(f"Vault URL: {vault_url}")
        
        print(f"Creating SecretClient...")
        client = SecretClient(vault_url=vault_url, credential=credential)
        print(f"SecretClient created successfully")
        
        # Get the secret
        print(f"Retrieving secret '{secret_name}'...")
        if secret_version:
            secret = client.get_secret(secret_name, version=secret_version)
        else:
            secret = client.get_secret(secret_name)
        
        print(f"Secret retrieved successfully")
        return secret.value
        
    except Exception as e:
        print(f"=== AZURE KEY VAULT ERROR ===")
        print(f"Error type: {type(e)}")
        print(f"Error message: {str(e)}")
        raise Exception(f"Failed to resolve Key Vault secret {secret_url}: {str(e)}")

from .tools.azure_rag import azure_rag
from .tools.web_search import web_search
from .tools.generate_chart import generate_chart
from .tools.doc_understanding import doc_understanding
from .tools.spreadsheet_analysis import spreadsheet_analysis
from .tools.generate_document import generate_document
from .tools.generate_spreadsheet import generate_spreadsheet

capability_map = {
    "rag": azure_rag,
    "chart_generation": generate_chart,
    "web_search": web_search,
    "doc_understanding": doc_understanding,
    "spreadsheet_analysis": spreadsheet_analysis,
    "document_generation": generate_document,
    "spreadsheet_generation": generate_spreadsheet
}

def hybrid_rag_web_search(agent, query):
    rag_att = azure_rag(query, agent.rag_indexes[0].name) if agent.rag_indexes else {"attachments": []}
    web_att = web_search(query)
    attachments = rag_att.get("attachments", []) + web_att.get("attachments", [])
    prompt = f"Internal results: {rag_att}\nExternal results: {web_att}\nUsing these, answer: {query}"
    return {"attachments": attachments, "prompt": prompt}

def execute_single_agent(agent, message, files, prev_output):
    print("\n" + "="*60)
    print("🤖 AGENT EXECUTION START")
    print("="*60)
    print(f"🔥 Agent: '{agent.name}' (ID: {agent.id})")
    print(f"🧠 LLM Model: {agent.llm_config.model_name if agent.llm_config else 'None'}")
    print(f"⚡ Capabilities: {[c.name for c in agent.capabilities] if agent.capabilities else 'None'}")
    print(f"💬 Message: {message[:100]}{'...' if len(message) > 100 else ''}")
    print(f"📁 Files: {files if files else 'None'}")
    print(f"📝 Context: {list(prev_output.keys()) if isinstance(prev_output, dict) else 'Not a dict'}")
    print("="*60)
    
    tools = []
    caps = [c.name for c in agent.capabilities]
    
    # Use dynamic tools from workflow if available
    if "available_tools" in prev_output and prev_output["available_tools"]:
        workflow_tools = prev_output["available_tools"]
        tools.extend(workflow_tools.values())
        print(f"🔧 [{agent.name}] Loaded {len(workflow_tools)} workflow tools: {list(workflow_tools.keys())}")
    else:
        # Fallback to legacy capability-based tool loading
        if "image_analysis" in caps:
            from .tools.image_analysis import image_analysis
            tools.append(image_analysis)
            print(f"🔧 [{agent.name}] Added legacy image_analysis tool")
        
        if "diagram_generation" in caps:
            from .tools.diagram_generator import diagram_generator
            tools.append(diagram_generator)
            print(f"🔧 [{agent.name}] Added legacy diagram_generator tool")
    
    print(f"🛠️ [{agent.name}] Available tools: {[tool.__name__ if hasattr(tool, '__name__') else str(tool) for tool in tools]}")
    print(f"✅ [{agent.name}] Tools prepared")
    
    if "rag" in caps and "web_search" in caps:
        print(f"🔍 [{agent.name}] Processing RAG and web search...")
        hybrid = hybrid_rag_web_search(agent, message)
        message = hybrid["prompt"]
        prev_output["attachments"].extend(hybrid["attachments"])
        print(f"✅ [{agent.name}] RAG and web search completed")
    
    # Process files with appropriate tools
    if files and "image_analysis" in caps:
        print(f"📷 [{agent.name}] Processing {len(files)} files with image analysis capability")
        
        # Check if the agent's LLM config supports vision
        supports_vision = False
        if agent.llm_config and agent.llm_config.model_name:
            model_name = agent.llm_config.model_name.lower()
            # Only these specific models support vision (exclude gpt-5-mini)
            supports_vision = any(vision_model in model_name for vision_model in [
                "gpt-4v", "gpt-4-vision", "gpt-4o", "gpt-4.1", "gpt-5-chat"
            ])
        
        if supports_vision:
            print(f"👁️ [{agent.name}] Using vision-capable model: {agent.llm_config.model_name}")
            # For vision-capable models, we'll include image data in the message
            # The model will analyze the images directly
            file_context = f"\n\nYou have been provided with {len(files)} image file(s) to analyze. Please examine each image carefully and provide a detailed description of what you see, including any text, objects, scenes, or other visual elements."
            message += file_context
            
            # Note: In a full implementation, you would:
            # 1. Load the actual image files
            # 2. Convert them to base64 or use the file URLs
            # 3. Include them in the messages array for the vision model
            # 4. The model would then analyze the visual content directly
        else:
            print(f"🔄 [{agent.name}] Using non-vision model: {agent.llm_config.model_name if agent.llm_config else 'None'} - using tool-based image analysis")
            # For non-vision models, use the tool-based approach
            from .tools.image_analysis import image_analysis
            
            # Process each file and collect analysis results
            file_analyses = []
            for file_id in files:
                try:
                    print(f"📁 [{agent.name}] Processing file ID: {file_id}")
                    # Get file information from database
                    from ..db import models
                    from ..db.database import SessionLocal
                    
                    db = SessionLocal()
                    try:
                        file_record = db.query(models.File).filter(models.File.id == file_id).first()
                        if file_record:
                            print(f"📄 [{agent.name}] Found file record: {file_record.filename}, URL: {file_record.url}")
                            # Call the image analysis tool
                            analysis_result = image_analysis(str(file_id), file_record.url)
                            print(f"🔍 [{agent.name}] Image analysis result: {analysis_result}")
                            if analysis_result.get("success"):
                                file_analyses.append(f"File {file_record.filename}: {analysis_result['analysis']}")
                            else:
                                file_analyses.append(f"File {file_record.filename}: Analysis failed - {analysis_result.get('error', 'Unknown error')}")
                        else:
                            print(f"❌ [{agent.name}] File record not found for ID: {file_id}")
                            file_analyses.append(f"File ID {file_id}: File not found in database")
                    finally:
                        db.close()
                        
                except Exception as e:
                    print(f"❌ [{agent.name}] Error processing file {file_id}: {e}")
                    file_analyses.append(f"File ID {file_id}: Error processing - {str(e)}")
            
            # Add file analysis results to the message
            if file_analyses:
                file_context = f"\n\nFile Analysis Results:\n" + "\n".join(file_analyses)
                message += file_context
                print(f"✅ [{agent.name}] Added file analysis results to message")
            else:
                print(f"ℹ️ [{agent.name}] No file analysis results to add")
    
    # Check if the agent's LLM config supports vision for image processing
    supports_vision = False
    if agent.llm_config and agent.llm_config.model_name:
        model_name = agent.llm_config.model_name.lower()
        # Only these specific models support vision (exclude gpt-5-mini)
        supports_vision = any(vision_model in model_name for vision_model in [
            "gpt-4v", "gpt-4-vision", "gpt-4o", "gpt-4.1", "gpt-5-chat"
        ])
    
    # Tools will be handled by the LLM through proper tool calling
    print(f"🔧 [{agent.name}] {len(tools)} tools available for LLM to call autonomously")
    
    # Check if agent has LLM config
    if not agent.llm_config:
        print(f"❌ [{agent.name}] No LLM config found")
        return {"response": f"[No LLM config found for agent {agent.name}] Please configure an LLM for this agent.", "attachments": prev_output.get("attachments", []), "tool_calls": []}
    
    # Check if we have the required LLM config fields
    if not agent.llm_config.api_base:
        print(f"❌ [{agent.name}] LLM config incomplete - missing API base URL")
        return {"response": f"[LLM config incomplete] Agent {agent.name} is missing API base URL. Please configure the LLM config properly.", "attachments": prev_output.get("attachments", []), "tool_calls": []}

    try:
        # Handle API key - check if it's a secret reference or actual key
        api_key = None
        secret_ref = agent.llm_config.api_key_secret_ref
        
        if secret_ref:
            # Check if it's an Azure Key Vault reference
            if secret_ref.startswith("https://") and ".vault.azure.net/" in secret_ref:
                if not AZURE_KEYVAULT_AVAILABLE:
                    # Key Vault client not available
                    api_key = settings.AZURE_OPENAI_API_KEY
                    if not api_key:
                        return {"response": f"[Key Vault integration not available] Your LLM configuration uses Azure Key Vault to store the API key ({secret_ref}), but the required libraries are not installed.\n\nTo fix this, choose one of these options:\n\n1. **Install Azure Key Vault libraries:**\n   ```\n   pip install azure-keyvault-secrets azure-identity\n   ```\n\n2. **Set environment variable:**\n   Add your Azure OpenAI API key to the .env file:\n   ```\n   AZURE_OPENAI_API_KEY=your_actual_api_key_here\n   ```\n\n3. **Update LLM config:**\n   Edit your LLM configuration to store the API key directly instead of using Key Vault.", "attachments": prev_output.get("attachments", []), "tool_calls": []}
                else:
                    try:
                        api_key = resolve_azure_keyvault_secret(secret_ref)
                        print(f"🔑 [{agent.name}] Successfully resolved Key Vault secret")
                    except Exception as e:
                        print(f"Failed to resolve Key Vault secret: {e}")
                        # Fall back to environment variable
                        api_key = settings.AZURE_OPENAI_API_KEY
                        if not api_key:
                            return {"response": f"[Key Vault resolution failed] {str(e)}. Please check Key Vault configuration or set AZURE_OPENAI_API_KEY environment variable.", "attachments": prev_output.get("attachments", []), "tool_calls": []}
            # Check if it looks like a secret reference (starts with "secret://")
            elif secret_ref.startswith("secret://"):
                # This is a proper secret reference - would need Azure Key Vault resolution
                # For now, fall back to environment variable
                api_key = settings.AZURE_OPENAI_API_KEY
                if not api_key:
                    return {"response": f"[Secret resolution not implemented] Please set AZURE_OPENAI_API_KEY environment variable or implement Azure Key Vault integration for {secret_ref}", "attachments": prev_output.get("attachments", []), "tool_calls": []}
            else:
                # This looks like an actual API key stored in the database
                api_key = secret_ref
        
        # If no API key found, try environment variable as fallback
        if not api_key:
            api_key = settings.AZURE_OPENAI_API_KEY
            if not api_key:
                return {"response": f"[API key not configured] Please set AZURE_OPENAI_API_KEY environment variable or store the API key in the LLM config.", "attachments": prev_output.get("attachments", []), "tool_calls": []}
        
        client = AzureOpenAI(
            api_key=api_key,
            azure_endpoint=agent.llm_config.api_base,
            api_version="2024-02-01"
        )
        
        # Build system message
        if agent.system_prompt:
            system_content = agent.system_prompt
        else:
            system_content = f"You are agent {agent.name} with capabilities: {', '.join(caps)}. "
        
        # Add tool descriptions if available
        if "tools_description" in prev_output:
            system_content += f"\n\nTOOLS AVAILABLE:\n{prev_output['tools_description']}"
            print(f"🔧 [{agent.name}] Added tools description to system prompt")
        
        # Add specific instructions for image analysis
        if "image_analysis" in caps:
            system_content += "\n\nIMPORTANT: You have the ability to analyze images. When users upload images, you should describe what you see in the image. If you receive file IDs or URLs, acknowledge them and provide helpful analysis based on the image content."
        
        # Prepare messages for chat completion
        messages = [
            {"role": "system", "content": system_content}
        ]
        
        # Handle conversation history for memory
        print(f"\n💾 [{agent.name}] MEMORY PROCESSING")
        print(f"📝 [{agent.name}] Context keys: {list(prev_output.keys())}")
        print(f"💬 [{agent.name}] Conversation history: {len(prev_output.get('conversation_history', []))} messages" if prev_output.get('conversation_history') else f"💬 [{agent.name}] No conversation history")
        
        if prev_output.get("conversation_history"):
            # Add conversation history to messages
            conversation_history = prev_output["conversation_history"]
            include_system = prev_output.get("include_system_messages", True)
            
            print(f"📚 [{agent.name}] Adding {len(conversation_history)} conversation turns to context")
            print(f"⚙️ [{agent.name}] Include system messages: {include_system}")
            
            # Add previous conversation turns
            for i, turn in enumerate(conversation_history):
                print(f"📄 [{agent.name}] Adding turn {i+1}: {turn.get('role')} - {turn.get('content', '')[:50]}...")
                if turn.get("role") == "user":
                    messages.append({"role": "user", "content": turn.get("content", "")})
                elif turn.get("role") == "assistant":
                    messages.append({"role": "assistant", "content": turn.get("content", "")})
                elif turn.get("role") == "system" and include_system:
                    # Add system message from previous conversation
                    messages.append({"role": "system", "content": turn.get("content", "")})
        elif prev_output.get("response"):
            # Fallback to old behavior
            system_content += f"Previous context: {prev_output['response']} "
        
        print(f"✅ [{agent.name}] Final messages array length: {len(messages)}")
        print(f"💾 [{agent.name}] Memory processing complete")
        
        # For vision models, include image data in the user message
        if files and "image_analysis" in caps and supports_vision:
            # Load and encode the image files
            image_contents = []
            for file_id in files:
                try:
                    from ..db import models
                    from ..db.database import SessionLocal
                    import base64
                    
                    db = SessionLocal()
                    try:
                        file_record = db.query(models.File).filter(models.File.id == file_id).first()
                        if file_record and file_record.url.startswith('/uploads/'):
                            file_path = Path(f"uploads/{file_record.url.split('/')[-1]}")
                            if file_path.exists():
                                # Read and encode the image
                                with open(file_path, "rb") as img_file:
                                    img_data = img_file.read()
                                    img_base64 = base64.b64encode(img_data).decode('utf-8')
                                    
                                    # Determine MIME type from file extension
                                    mime_type = "image/png"  # default
                                    if file_path.suffix.lower() in ['.jpg', '.jpeg']:
                                        mime_type = "image/jpeg"
                                    elif file_path.suffix.lower() == '.png':
                                        mime_type = "image/png"
                                    elif file_path.suffix.lower() == '.gif':
                                        mime_type = "image/gif"
                                    
                                    image_contents.append({
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:{mime_type};base64,{img_base64}"
                                        }
                                    })
                    finally:
                        db.close()
                except Exception as e:
                    print(f"Error processing image file {file_id}: {e}")
            
            # Create user message with text and images
            user_message = {
                "role": "user",
                "content": [
                    {"type": "text", "text": message or ""}
                ] + image_contents
            }
            messages.append(user_message)
        else:
            # Regular text-only message
            messages.append({"role": "user", "content": message or ""})
        
        # Get model name and other config from agent's LLM config
        model_name = agent.llm_config.model_name
        temperature = float(agent.llm_config.temperature) if agent.llm_config.temperature else 0.7
        max_tokens = int(agent.llm_config.max_tokens) if agent.llm_config.max_tokens else 1000
        
        # Prepare API call parameters
        api_params = {
            "model": model_name,
            "messages": messages,
            "timeout": 30,  # 30 second timeout
            "stream": False  # Non-streaming for this function
        }
        
        # Add tools to API parameters if available
        if tools:
            # Convert tools to OpenAI format
            openai_tools = []
            for tool in tools:
                if hasattr(tool, '__name__') and hasattr(tool, '__doc__'):
                    # Convert function tool to OpenAI tool format
                    openai_tools.append({
                        "type": "function",
                        "function": {
                            "name": tool.__name__,
                            "description": tool.__doc__ or f"Execute {tool.__name__}",
                            # Add parameters schema if available
                            "parameters": {
                                "type": "object",
                                "properties": {},
                                "required": []
                            }
                        }
                    })
            
            if openai_tools:
                api_params["tools"] = openai_tools
                api_params["tool_choice"] = "auto"  # Let LLM decide when to use tools
                print(f"🔧 [{agent.name}] Added {len(openai_tools)} tools to API call")
        
        # Handle different token parameter names for different models
        if "gpt-5-mini" in model_name.lower():
            api_params["max_completion_tokens"] = max_tokens
            # gpt-5-mini only supports default temperature (1.0)
        else:
            api_params["max_tokens"] = max_tokens
            api_params["temperature"] = temperature
        
        # Make the API call
        print(f"🚀 [{agent.name}] Calling {model_name} with {len(messages)} messages...")
        response = client.chat.completions.create(**api_params)
        
        # Get the response message
        message_response = response.choices[0].message
        full_response = message_response.content
        tool_calls = message_response.tool_calls if hasattr(message_response, 'tool_calls') else None
        
        print(f"✅ [{agent.name}] LLM call completed - response length: {len(full_response) if full_response else 0} characters")
        if tool_calls:
            print(f"🔧 [{agent.name}] LLM requested {len(tool_calls)} tool calls")
        
        # Execute tool calls if any
        tool_results = []
        if tool_calls:
            for tool_call in tool_calls:
                try:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                    
                    print(f"🛠️ [{agent.name}] Executing tool: {function_name} with args: {function_args}")
                    
                    # Find the tool function
                    tool_func = None
                    for tool in tools:
                        if hasattr(tool, '__name__') and tool.__name__ == function_name:
                            tool_func = tool
                            break
                    
                    if tool_func:
                        # Execute the tool
                        result = tool_func(**function_args)
                        tool_results.append({
                            "tool_call_id": tool_call.id,
                            "result": result
                        })
                        print(f"✅ [{agent.name}] Tool {function_name} executed successfully")
                    else:
                        print(f"❌ [{agent.name}] Tool {function_name} not found")
                        tool_results.append({
                            "tool_call_id": tool_call.id,
                            "result": {"error": f"Tool {function_name} not found"}
                        })
                        
                except Exception as e:
                    print(f"❌ [{agent.name}] Error executing tool {tool_call.function.name}: {e}")
                    tool_results.append({
                        "tool_call_id": tool_call.id,
                        "result": {"error": str(e)}
                    })
            
            # If tools were called, we need to continue the conversation with tool results
            if tool_results:
                # Add the assistant's message with tool calls
                messages.append({
                    "role": "assistant",
                    "content": full_response,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                            }
                        } for tc in tool_calls
                    ]
                })
                
                # Add tool results
                for tool_result in tool_results:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_result["tool_call_id"],
                        "content": json.dumps(tool_result["result"])
                    })
                
                # Make another API call to get the final response
                api_params["messages"] = messages
                print(f"🔄 [{agent.name}] Making follow-up call with tool results...")
                
                final_response = client.chat.completions.create(**api_params)
                final_content = final_response.choices[0].message.content
                
                print(f"✅ [{agent.name}] Final response after tool execution: {len(final_content) if final_content else 0} characters")
                full_response = final_content
        
        print(f"🎯 [{agent.name}] Response preview: {full_response[:100] if full_response else 'None'}{'...' if full_response and len(full_response) > 100 else ''}")
        print("\n" + "="*60)
        print("🎉 AGENT EXECUTION COMPLETE")
        print("="*60)
        
        return {
            "response": full_response, 
            "attachments": prev_output.get("attachments", []), 
            "tool_calls": tool_calls if tool_calls else []
        }
        
    except Exception as e:
        print(f"❌ [{agent.name}] Error during execution: {str(e)}")
        print("\n" + "="*60)
        print("💥 AGENT EXECUTION FAILED")
        print("="*60)
        return {"response": f"[Error calling LLM: {str(e)}] {message}", "attachments": prev_output.get("attachments", []), "tool_calls": []}

async def execute_single_agent_stream(agent, message, files, prev_output):
    """Streaming version of execute_single_agent that yields response chunks"""
    tools = []
    caps = [c.name for c in agent.capabilities]
    
    # Use dynamic tools from workflow if available
    if "available_tools" in prev_output and prev_output["available_tools"]:
        workflow_tools = prev_output["available_tools"]
        tools.extend(workflow_tools.values())
        print(f"🔧 [{agent.name}] STREAMING: Loaded {len(workflow_tools)} workflow tools: {list(workflow_tools.keys())}")
    else:
        # Fallback to legacy capability-based tool loading
        if "image_analysis" in caps:
            from .tools.image_analysis import image_analysis
            tools.append(image_analysis)
        
        if "diagram_generation" in caps:
            from .tools.diagram_generator import diagram_generator
            tools.append(diagram_generator)
    
    if "rag" in caps and "web_search" in caps:
        hybrid = hybrid_rag_web_search(agent, message)
        message = hybrid["prompt"]
        prev_output["attachments"].extend(hybrid["attachments"])
    
    # Process files with appropriate tools
    if files and "image_analysis" in caps:
        print(f"Processing {len(files)} files with image analysis capability (streaming)")
        
        # Check if the agent's LLM config supports vision
        supports_vision = False
        if agent.llm_config and agent.llm_config.model_name:
            model_name = agent.llm_config.model_name.lower()
            # Only these specific models support vision (exclude gpt-5-mini)
            supports_vision = any(vision_model in model_name for vision_model in [
                "gpt-4v", "gpt-4-vision", "gpt-4o", "gpt-4.1", "gpt-5-chat"
            ])
        
        if supports_vision:
            # For vision-capable models, we'll include image data in the message
            # The model will analyze the images directly
            file_context = f"\n\nYou have been provided with {len(files)} image file(s) to analyze. Please examine each image carefully and provide a detailed description of what you see, including any text, objects, scenes, or other visual elements."
            message += file_context
            
            # Note: In a full implementation, you would:
            # 1. Load the actual image files
            # 2. Convert them to base64 or use the file URLs
            # 3. Include them in the messages array for the vision model
            # 4. The model would then analyze the visual content directly
        else:
            # For non-vision models, use the tool-based approach
            from .tools.image_analysis import image_analysis
            
            # Process each file and collect analysis results
            file_analyses = []
            for file_id in files:
                try:
                    print(f"📁 [{agent.name}] Processing file ID: {file_id}")
                    # Get file information from database
                    from ..db import models
                    from ..db.database import SessionLocal
                    
                    db = SessionLocal()
                    try:
                        file_record = db.query(models.File).filter(models.File.id == file_id).first()
                        if file_record:
                            print(f"📄 [{agent.name}] Found file record: {file_record.filename}, URL: {file_record.url}")
                            # Call the image analysis tool
                            analysis_result = image_analysis(str(file_id), file_record.url)
                            print(f"🔍 [{agent.name}] Image analysis result: {analysis_result}")
                            if analysis_result.get("success"):
                                file_analyses.append(f"File {file_record.filename}: {analysis_result['analysis']}")
                            else:
                                file_analyses.append(f"File {file_record.filename}: Analysis failed - {analysis_result.get('error', 'Unknown error')}")
                        else:
                            print(f"❌ [{agent.name}] File record not found for ID: {file_id}")
                            file_analyses.append(f"File ID {file_id}: File not found in database")
                    finally:
                        db.close()
                        
                except Exception as e:
                    print(f"❌ [{agent.name}] Error processing file {file_id}: {e}")
                    file_analyses.append(f"File ID {file_id}: Error processing - {str(e)}")
            
            # Add file analysis results to the message
            if file_analyses:
                file_context = f"\n\nFile Analysis Results:\n" + "\n".join(file_analyses)
                message += file_context
                print(f"✅ [{agent.name}] Added file analysis results to message")
            else:
                print(f"ℹ️ [{agent.name}] No file analysis results to add")
    
    # Tools will be handled by the LLM through proper tool calling
    print(f"🔧 [streaming] {len(tools)} tools available for LLM to call autonomously")
    
    # Check if the agent's LLM config supports vision for image processing
    supports_vision = False
    if agent.llm_config and agent.llm_config.model_name:
        model_name = agent.llm_config.model_name.lower()
        supports_vision = any(vision_model in model_name for vision_model in [
            "gpt-4v", "gpt-4-vision", "gpt-4o", "gpt-4.1", "gpt-5-chat"
        ])
    
    # Check if agent has LLM config
    if not agent.llm_config:
        yield "No LLM config found for this agent. Please configure an LLM for this agent."
        return
    
    # Check if we have the required LLM config fields
    if not agent.llm_config.api_base:
        yield f"LLM config incomplete for agent {agent.name}. Please configure the LLM config properly."
        return

    try:
        # Handle API key - check if it's a secret reference or actual key
        api_key = None
        secret_ref = agent.llm_config.api_key_secret_ref
        
        if secret_ref:
            # Check if it's an Azure Key Vault reference
            if secret_ref.startswith("https://") and ".vault.azure.net/" in secret_ref:
                if not AZURE_KEYVAULT_AVAILABLE:
                    # Key Vault client not available
                    api_key = settings.AZURE_OPENAI_API_KEY
                    if not api_key:
                        yield f"[Key Vault integration not available] Your LLM configuration uses Azure Key Vault to store the API key ({secret_ref}), but the required libraries are not installed.\n\nTo fix this, choose one of these options:\n\n1. Install Azure Key Vault libraries: pip install azure-keyvault-secrets azure-identity\n\n2. Set environment variable: Add AZURE_OPENAI_API_KEY=your_actual_api_key to .env file\n\n3. Update LLM config to store the API key directly instead of using Key Vault."
                        return
                else:
                    try:
                        api_key = resolve_azure_keyvault_secret(secret_ref)
                        print(f"🔑 [{agent.name}] Successfully resolved Key Vault secret")
                    except Exception as e:
                        print(f"Failed to resolve Key Vault secret: {e}")
                        # Fall back to environment variable
                        api_key = settings.AZURE_OPENAI_API_KEY
                        if not api_key:
                            yield f"[Key Vault resolution failed] {str(e)}. Please check Key Vault configuration or set AZURE_OPENAI_API_KEY environment variable."
                            return
            # Check if it looks like a secret reference (starts with "secret://")
            elif secret_ref.startswith("secret://"):
                # This is a proper secret reference - would need Azure Key Vault resolution
                # For now, fall back to environment variable
                api_key = settings.AZURE_OPENAI_API_KEY
                if not api_key:
                    yield f"Secret resolution not implemented. Please set AZURE_OPENAI_API_KEY environment variable or implement Azure Key Vault integration for {secret_ref}"
                    return
            else:
                # This looks like an actual API key stored in the database
                api_key = secret_ref
        
        # If no API key found, try environment variable as fallback
        if not api_key:
            api_key = settings.AZURE_OPENAI_API_KEY
            if not api_key:
                yield f"API key not configured. Please set AZURE_OPENAI_API_KEY environment variable or store the API key in the LLM config."
                return
        
        client = AzureOpenAI(
            api_key=api_key,
            azure_endpoint=agent.llm_config.api_base,
            api_version="2024-02-01"
        )
        
        # Build system message
        if agent.system_prompt:
            system_content = agent.system_prompt
        else:
            system_content = f"You are agent {agent.name} with capabilities: {', '.join(caps)}. "
        
        # Add tool descriptions if available
        if "tools_description" in prev_output:
            system_content += f"\n\nTOOLS AVAILABLE:\n{prev_output['tools_description']}"
            print(f"🔧 [{agent.name}] Added tools description to system prompt")
        
        # Add specific instructions for image analysis
        if "image_analysis" in caps:
            system_content += "\n\nIMPORTANT: You have the ability to analyze images. When users upload images, you should describe what you see in the image. If you receive file IDs or URLs, acknowledge them and provide helpful analysis based on the image content."
        
        if prev_output.get("response"):
            system_content += f"Previous context: {prev_output['response']} "
        
        # Prepare messages for chat completion
        messages = [
            {"role": "system", "content": system_content}
        ]
        
        # For vision models, include image data in the user message
        if files and "image_analysis" in caps and supports_vision:
            # Load and encode the image files
            image_contents = []
            for file_id in files:
                try:
                    from ..db import models
                    from ..db.database import SessionLocal
                    import base64
                    
                    db = SessionLocal()
                    try:
                        file_record = db.query(models.File).filter(models.File.id == file_id).first()
                        if file_record and file_record.url.startswith('/uploads/'):
                            file_path = Path(f"uploads/{file_record.url.split('/')[-1]}")
                            if file_path.exists():
                                # Read and encode the image
                                with open(file_path, "rb") as img_file:
                                    img_data = img_file.read()
                                    img_base64 = base64.b64encode(img_data).decode('utf-8')
                                    
                                    # Determine MIME type from file extension
                                    mime_type = "image/png"  # default
                                    if file_path.suffix.lower() in ['.jpg', '.jpeg']:
                                        mime_type = "image/jpeg"
                                    elif file_path.suffix.lower() == '.png':
                                        mime_type = "image/png"
                                    elif file_path.suffix.lower() == '.gif':
                                        mime_type = "image/gif"
                                    
                                    image_contents.append({
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:{mime_type};base64,{img_base64}"
                                        }
                                    })
                    finally:
                        db.close()
                except Exception as e:
                    print(f"Error processing image file {file_id}: {e}")
            
            # Create user message with text and images
            user_message = {
                "role": "user",
                "content": [
                    {"type": "text", "text": message or ""}
                ] + image_contents
            }
            messages.append(user_message)
        else:
            # Regular text-only message
            messages.append({"role": "user", "content": message or ""})
        
        # Get model name and other config from agent's LLM config
        model_name = agent.llm_config.model_name
        temperature = float(agent.llm_config.temperature) if agent.llm_config.temperature else 0.7
        max_tokens = int(agent.llm_config.max_tokens) if agent.llm_config.max_tokens else 1000
        
        # Prepare API call parameters
        api_params = {
            "model": model_name,
            "messages": messages,
            "timeout": 30,  # 30 second timeout
            "stream": True  # Enable streaming for real-time responses
        }
        
        # Add tools to API parameters if available
        if tools:
            # Convert tools to OpenAI format
            openai_tools = []
            for tool in tools:
                if hasattr(tool, '__name__') and hasattr(tool, '__doc__'):
                    # Convert function tool to OpenAI tool format
                    openai_tools.append({
                        "type": "function",
                        "function": {
                            "name": tool.__name__,
                            "description": tool.__doc__ or f"Execute {tool.__name__}",
                            # Add parameters schema if available
                            "parameters": {
                                "type": "object",
                                "properties": {},
                                "required": []
                            }
                        }
                    })
            
            if openai_tools:
                api_params["tools"] = openai_tools
                api_params["tool_choice"] = "auto"  # Let LLM decide when to use tools
                print(f"🔧 [streaming] Added {len(openai_tools)} tools to API call")
        
        # Handle different token parameter names for different models
        if "gpt-5-mini" in model_name.lower():
            api_params["max_completion_tokens"] = max_tokens
            # gpt-5-mini only supports default temperature (1.0)
        else:
            api_params["max_tokens"] = max_tokens
            api_params["temperature"] = temperature
        
        # Make the streaming API call
        response = client.chat.completions.create(**api_params)
        
        # Stream the response chunks
        for chunk in response:
            try:
                if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                    choice = chunk.choices[0]
                    if hasattr(choice, 'delta') and hasattr(choice.delta, 'content') and choice.delta.content is not None:
                        content = choice.delta.content
                        yield content
            except Exception as chunk_error:
                # Log chunk error but continue streaming
                print(f"Error processing chunk: {chunk_error}")
                continue
        
    except Exception as e:
        yield f"Error calling LLM: {str(e)}"

async def _execute_tools_based_on_request(message: str, tools: list, capabilities: list) -> str:
    """Execute tools based on user request and available capabilities"""
    try:
        results = []
        
        # Check for diagram generation requests
        if "diagram_generation" in capabilities:
            diagram_keywords = [
                "create a flowchart", "draw a flowchart", "make a flowchart",
                "create a diagram", "draw a diagram", "make a diagram",
                "create a sequence diagram", "draw a sequence diagram",
                "create a class diagram", "draw a class diagram",
                "create an er diagram", "draw an er diagram", "create an erd", "draw an erd",
                "create a gantt chart", "draw a gantt chart",
                "create a pie chart", "draw a pie chart"
            ]
            
            if any(keyword in message.lower() for keyword in diagram_keywords):
                # Determine diagram type from message
                diagram_type = "flowchart"  # default
                if "sequence" in message.lower():
                    diagram_type = "sequence"
                elif "class" in message.lower():
                    diagram_type = "class"
                elif "er" in message.lower() or "entity" in message.lower():
                    diagram_type = "er"
                elif "gantt" in message.lower():
                    diagram_type = "gantt"
                elif "pie" in message.lower():
                    diagram_type = "pie"
                
                # Extract description from message
                description = message.replace("create", "").replace("draw", "").replace("make", "").strip()
                
                # Find and call the diagram generator tool
                for tool in tools:
                    if hasattr(tool, '__name__') and tool.__name__ == 'diagram_generator':
                        try:
                            result = tool(diagram_type, description)
                            if result.get("success"):
                                results.append(f"Generated {diagram_type} diagram:\n```mermaid\n{result['mermaid_syntax']}\n```")
                            else:
                                results.append(f"Failed to generate diagram: {result.get('error', 'Unknown error')}")
                        except Exception as e:
                            results.append(f"Error calling diagram generator: {str(e)}")
                        break
        
        # Check for image analysis requests
        if "image_analysis" in capabilities:
            image_keywords = [
                "analyze this image", "what's in this image", "describe this image",
                "explain this image", "what do you see", "analyze the image"
            ]
            
            if any(keyword in message.lower() for keyword in image_keywords):
                print(f"Image analysis keyword detected in message: {message}")
                # Find and call the image analysis tool
                for tool in tools:
                    if hasattr(tool, '__name__') and tool.__name__ == 'image_analysis':
                        print("Found image analysis tool, calling it...")
                        try:
                            # For now, we'll call it with placeholder data since we don't have file context here
                            # The actual file processing should happen in the main execution flow
                            result = tool("placeholder_id", "/uploads/placeholder.png")
                            print(f"Image analysis tool result: {result}")
                            if result.get("success"):
                                results.append(f"Image analysis completed: {result['analysis']}")
                            else:
                                results.append(f"Image analysis failed: {result.get('error', 'Unknown error')}")
                        except Exception as e:
                            print(f"Error calling image analysis tool: {e}")
                            results.append(f"Error calling image analysis tool: {str(e)}")
                        break
                else:
                    print("Image analysis tool not found in tools list")
                    results.append("Image analysis capability is available. Upload an image to analyze it.")
        
        # Handle dynamic tools from workflow configuration (async)
        for tool in tools:
            if hasattr(tool, '__name__'):
                tool_name = tool.__name__
                print(f"🔧 Checking dynamic tool (async): {tool_name}")
                
                # Time-related requests
                if tool_name == 'get_current_time':
                    time_keywords = ['time', 'current time', 'what time', 'time is it', 'clock', 'now']
                    if any(keyword in message.lower() for keyword in time_keywords):
                        print(f"🕒 Executing time tool (async): {tool_name}")
                        try:
                            result = tool()
                            print(f"🕒 Time tool result (async): {result}")
                            if isinstance(result, dict) and 'human_readable' in result:
                                results.append(f"⏰ **Current Time:** `{result['human_readable']}`\n📅 **Full Timestamp:** `{result['iso_format']}`")
                            else:
                                results.append(f"⏰ **Current Time:** `{result}`")
                        except Exception as e:
                            print(f"❌ Error executing time tool (async): {e}")
                            results.append(f"Error getting current time: {str(e)}")
                
                # Web search requests
                elif tool_name == 'web_search':
                    search_keywords = ['search', 'find', 'look up', 'google', 'search for', 'find information']
                    if any(keyword in message.lower() for keyword in search_keywords):
                        print(f"🔍 Executing search tool (async): {tool_name}")
                        try:
                            query = message  # Simple approach - use full message as query
                            result = tool(query=query, max_results=5)
                            print(f"🔍 Search tool result (async): {result}")
                            results.append(f"Search results: {result}")
                        except Exception as e:
                            print(f"❌ Error executing search tool (async): {e}")
                            results.append(f"Error performing web search: {str(e)}")
                
                # CSV file creation (async)
                elif tool_name == 'create_csv':
                    csv_keywords = ['csv', 'create csv', 'csv file', 'comma separated', 'save as csv']
                    if any(keyword in message.lower() for keyword in csv_keywords) and not any(excel_kw in message.lower() for excel_kw in ['excel', 'xlsx', 'spreadsheet']):
                        print(f"📊 Executing CSV creation tool (async): {tool_name}")
                        try:
                            # For the time zone example, create CSV with city time data
                            if any(city in message.lower() for city in ['cape town', 'new york', 'london', 'time']):
                                import datetime
                                import pytz
                                
                                # Get current UTC time
                                utc_now = datetime.datetime.now(pytz.UTC)
                                
                                # Define time zones
                                cities_tz = {
                                    'Cape Town': 'Africa/Johannesburg',  # SAST (UTC+2)
                                    'New York': 'America/New_York',      # EDT/EST
                                    'London': 'Europe/London'            # BST/GMT
                                }
                                
                                # Calculate local times
                                city_times = []
                                for city, tz_name in cities_tz.items():
                                    tz = pytz.timezone(tz_name)
                                    local_time = utc_now.astimezone(tz)
                                    city_times.append({
                                        'City': city,
                                        'Local_Time': local_time.strftime('%Y-%m-%d %H:%M:%S'),
                                        'Timezone': local_time.strftime('%Z'),
                                        'UTC_Offset': local_time.strftime('%z')
                                    })
                                
                                # Create CSV content
                                file_path = f"uploads/city_times_{utc_now.strftime('%Y%m%d_%H%M%S')}.csv"
                                result = tool(file_path=file_path, data=city_times)
                                print(f"📊 CSV creation result (async): {result}")
                                
                                # Create proper download URL
                                filename = file_path.split('/')[-1]  # Extract filename
                                download_url = f"http://localhost:8000/uploads/{filename}"
                                
                                results.append(f"✅ **CSV File Created Successfully!**\n\n📁 **File:** `{filename}`\n📊 **Contains:** City timezone data for Cape Town, New York, and London\n🔗 **Download:** [{filename}]({download_url})\n\n*Click the link above to download your CSV file.*")
                            else:
                                # Generic CSV creation
                                results.append(f"CSV creation capability available. Please specify the data to include in the CSV file.")
                        except Exception as e:
                            print(f"❌ Error executing CSV creation tool (async): {e}")
                            results.append(f"Error creating CSV file: {str(e)}")
                
                # Excel file creation (async)
                elif tool_name == 'create_excel':
                    excel_keywords = ['excel', 'xlsx', 'spreadsheet', 'create excel', 'excel file', 'workbook']
                    if any(keyword in message.lower() for keyword in excel_keywords):
                        print(f"📊 Executing Excel creation tool (async): {tool_name}")
                        try:
                            # For the time zone example, create Excel with city time data
                            if any(city in message.lower() for city in ['cape town', 'new york', 'london', 'time']):
                                import datetime
                                import pytz
                                
                                # Get current UTC time
                                utc_now = datetime.datetime.now(pytz.UTC)
                                
                                # Define time zones
                                cities_tz = {
                                    'Cape Town': 'Africa/Johannesburg',  # SAST (UTC+2)
                                    'New York': 'America/New_York',      # EDT/EST
                                    'London': 'Europe/London'            # BST/GMT
                                }
                                
                                # Calculate local times
                                city_times = []
                                for city, tz_name in cities_tz.items():
                                    tz = pytz.timezone(tz_name)
                                    local_time = utc_now.astimezone(tz)
                                    city_times.append({
                                        'City': city,
                                        'Local_Time': local_time.strftime('%Y-%m-%d %H:%M:%S'),
                                        'Timezone': local_time.strftime('%Z'),
                                        'UTC_Offset': local_time.strftime('%z')
                                    })
                                
                                # Create Excel content
                                file_path = f"uploads/city_times_{utc_now.strftime('%Y%m%d_%H%M%S')}.xlsx"
                                result = tool(file_path=file_path, data=city_times, sheet_name="City Times")
                                print(f"📊 Excel creation result (async): {result}")
                                
                                # Create proper download URL
                                filename = file_path.split('/')[-1]  # Extract filename
                                download_url = f"http://localhost:8000/uploads/{filename}"
                                
                                results.append(f"✅ **Excel File Created Successfully!**\n\n📁 **File:** `{filename}`\n📊 **Contains:** City timezone data for Cape Town, New York, and London\n📋 **Sheet:** `City Times` with professional formatting\n🔗 **Download:** [{filename}]({download_url})\n\n*Click the link above to download your Excel file.*")
                            else:
                                # Generic Excel creation
                                results.append(f"Excel creation capability available. Please specify the data to include in the Excel file.")
                        except Exception as e:
                            print(f"❌ Error executing Excel creation tool (async): {e}")
                            results.append(f"Error creating Excel file: {str(e)}")
        
        return "\n\n".join(results) if results else ""
        
    except Exception as e:
        return f"Error executing tools: {str(e)}"

def _execute_tools_based_on_request_sync(message: str, tools: list, capabilities: list) -> str:
    """Synchronous version of tool execution for non-streaming functions"""
    try:
        print(f"Tool execution called with message: {message}")
        print(f"Available tools: {[tool.__name__ if hasattr(tool, '__name__') else str(tool) for tool in tools]}")
        print(f"Available capabilities: {capabilities}")
        
        results = []
        
        # Check for diagram generation requests
        if "diagram_generation" in capabilities:
            print("Diagram generation capability found")
            
            # Intelligent intent detection - understand what users want, not just match keywords
            def should_generate_diagram(message: str) -> tuple[bool, str]:
                """
                Analyze the user's intent to determine if they want a diagram
                Returns (should_generate, diagram_type)
                """
                message_lower = message.lower()
                
                # Explicit diagram requests
                if any(phrase in message_lower for phrase in [
                    "create a", "draw a", "make a", "generate a", "show me a",
                    "create an", "draw an", "make an", "generate an", "show me an"
                ]) and any(word in message_lower for word in [
                    "diagram", "chart", "flowchart", "flow chart", "visual", "visualization"
                ]):
                    return True, "explicit"
                
                # Network and infrastructure requests (benefit from visual diagrams)
                if any(word in message_lower for word in [
                    "network", "topology", "infrastructure", "architecture", "system design",
                    "connect", "connection", "routing", "switching", "sdwan", "vpn"
                ]):
                    return True, "network"
                
                # Process and workflow requests (benefit from flowcharts)
                if any(word in message_lower for word in [
                    "process", "workflow", "procedure", "steps", "sequence", "flow",
                    "decision", "branch", "loop", "iteration"
                ]):
                    return True, "process"
                
                # Data and relationship requests (benefit from ER diagrams)
                if any(word in message_lower for word in [
                    "data model", "database", "entity", "relationship", "schema",
                    "table", "field", "attribute", "foreign key"
                ]):
                    return True, "data"
                
                # Timeline and scheduling requests (benefit from Gantt charts)
                if any(word in message_lower for word in [
                    "timeline", "schedule", "milestone", "deadline", "duration",
                    "project plan", "roadmap"
                ]):
                    return True, "timeline"
                
                # Component and structure requests (benefit from class diagrams)
                if any(word in message_lower for word in [
                    "component", "class", "object", "interface", "module",
                    "structure", "hierarchy", "inheritance"
                ]):
                    return True, "component"
                
                # If the request is complex and would benefit from visualization
                if len(message.split()) > 10 and any(word in message_lower for word in [
                    "show", "illustrate", "demonstrate", "explain", "describe"
                ]):
                    return True, "general"
                
                return False, "none"
            
            # Check if we should generate a diagram based on intent
            should_generate, intent_type = should_generate_diagram(message)
            
            if should_generate:
                print(f"Intent analysis: User wants a diagram (intent: {intent_type})")
                
                # Determine diagram type based on intent
                diagram_type = "flowchart"  # default
                if intent_type == "network":
                    diagram_type = "flowchart"  # Use flowchart for network diagrams
                elif intent_type == "data":
                    diagram_type = "er"
                elif intent_type == "timeline":
                    diagram_type = "gantt"
                elif intent_type == "component":
                    diagram_type = "class"
                elif intent_type == "process":
                    diagram_type = "flowchart"
                
                print(f"Selected diagram type: {diagram_type} based on intent: {intent_type}")
                
                # Extract description from message
                description = message
                print(f"Using full message as description: {description[:100]}...")
                
                # Find and call the diagram generator tool
                for tool in tools:
                    print(f"Checking tool: {tool}")
                    if hasattr(tool, '__name__') and tool.__name__ == 'diagram_generator':
                        print("Found diagram generator tool, calling it...")
                        try:
                            result = tool(diagram_type, description)
                            print(f"Tool result: {result}")
                            if result.get("success"):
                                results.append(f"Generated {diagram_type} diagram:\n```mermaid\n{result['mermaid_syntax']}\n```")
                            else:
                                results.append(f"Failed to generate diagram: {result.get('error', 'Unknown error')}")
                        except Exception as e:
                            print(f"Error calling diagram generator: {e}")
                            results.append(f"Error calling diagram generator: {str(e)}")
                        break
                else:
                    print("Diagram generator tool not found in tools list")
            else:
                print(f"Intent analysis: User doesn't need a diagram (intent: {intent_type})")
        
        # Check for image analysis requests
        if "image_analysis" in capabilities:
            print("Image analysis capability found")
            image_keywords = [
                "analyze this image", "what's in this image", "describe this image",
                "explain this image", "what do you see", "analyze the image",
                "analyse this image", "analyse the image"  # Add British spelling
            ]
            
            if any(keyword in message.lower() for keyword in image_keywords):
                # This will be handled by the file processing above
                # Just add a note that image analysis capability is available
                results.append("Image analysis capability is available. Upload an image to analyze it.")
        
        # Handle dynamic tools from workflow configuration
        for tool in tools:
            if hasattr(tool, '__name__'):
                tool_name = tool.__name__
                print(f"🔧 Checking dynamic tool: {tool_name}")
                
                # Time-related requests
                if tool_name == 'get_current_time':
                    time_keywords = ['time', 'current time', 'what time', 'time is it', 'clock', 'now']
                    if any(keyword in message.lower() for keyword in time_keywords):
                        print(f"🕒 Executing time tool: {tool_name}")
                        try:
                            result = tool()
                            print(f"🕒 Time tool result: {result}")
                            if isinstance(result, dict) and 'human_readable' in result:
                                results.append(f"⏰ **Current Time:** `{result['human_readable']}`\n📅 **Full Timestamp:** `{result['iso_format']}`")
                            else:
                                results.append(f"⏰ **Current Time:** `{result}`")
                        except Exception as e:
                            print(f"❌ Error executing time tool: {e}")
                            results.append(f"Error getting current time: {str(e)}")
                
                # Web search requests
                elif tool_name == 'web_search':
                    search_keywords = ['search', 'find', 'look up', 'google', 'search for', 'find information']
                    if any(keyword in message.lower() for keyword in search_keywords):
                        print(f"🔍 Executing search tool: {tool_name}")
                        try:
                            # Extract search query from message
                            query = message  # Simple approach - use full message as query
                            result = tool(query=query, max_results=5)
                            print(f"🔍 Search tool result: {result}")
                            results.append(f"Search results: {result}")
                        except Exception as e:
                            print(f"❌ Error executing search tool: {e}")
                            results.append(f"Error performing web search: {str(e)}")
                
                # File operations
                elif tool_name in ['read_file', 'write_file', 'list_directory']:
                    file_keywords = ['file', 'read', 'write', 'directory', 'folder', 'save', 'create file']
                    if any(keyword in message.lower() for keyword in file_keywords):
                        print(f"📁 File operation tool detected: {tool_name}")
                        # Note: File operations need specific parameters, so just notify availability
                        results.append(f"File operation capability available: {tool_name}")
                
                # CSV file creation
                elif tool_name == 'create_csv':
                    csv_keywords = ['csv', 'create csv', 'csv file', 'comma separated', 'save as csv']
                    if any(keyword in message.lower() for keyword in csv_keywords) and not any(excel_kw in message.lower() for excel_kw in ['excel', 'xlsx', 'spreadsheet']):
                        print(f"📊 Executing CSV creation tool: {tool_name}")
                        try:
                            # For the time zone example, create CSV with city time data
                            if any(city in message.lower() for city in ['cape town', 'new york', 'london', 'time']):
                                import datetime
                                import pytz
                                
                                # Get current UTC time
                                utc_now = datetime.datetime.now(pytz.UTC)
                                
                                # Define time zones
                                cities_tz = {
                                    'Cape Town': 'Africa/Johannesburg',  # SAST (UTC+2)
                                    'New York': 'America/New_York',      # EDT/EST
                                    'London': 'Europe/London'            # BST/GMT
                                }
                                
                                # Calculate local times
                                city_times = []
                                for city, tz_name in cities_tz.items():
                                    tz = pytz.timezone(tz_name)
                                    local_time = utc_now.astimezone(tz)
                                    city_times.append({
                                        'City': city,
                                        'Local_Time': local_time.strftime('%Y-%m-%d %H:%M:%S'),
                                        'Timezone': local_time.strftime('%Z'),
                                        'UTC_Offset': local_time.strftime('%z')
                                    })
                                
                                # Create CSV content
                                file_path = f"uploads/city_times_{utc_now.strftime('%Y%m%d_%H%M%S')}.csv"
                                result = tool(file_path=file_path, data=city_times)
                                print(f"📊 CSV creation result: {result}")
                                
                                # Create proper download URL
                                filename = file_path.split('/')[-1]  # Extract filename
                                download_url = f"http://localhost:8000/uploads/{filename}"
                                
                                results.append(f"✅ **CSV File Created Successfully!**\n\n📁 **File:** `{filename}`\n📊 **Contains:** City timezone data for Cape Town, New York, and London\n🔗 **Download:** [{filename}]({download_url})\n\n*Click the link above to download your CSV file.*")
                            else:
                                # Generic CSV creation
                                results.append(f"CSV creation capability available. Please specify the data to include in the CSV file.")
                        except Exception as e:
                            print(f"❌ Error executing CSV creation tool: {e}")
                            results.append(f"Error creating CSV file: {str(e)}")
                
                # Excel file creation
                elif tool_name == 'create_excel':
                    excel_keywords = ['excel', 'xlsx', 'spreadsheet', 'create excel', 'excel file', 'workbook']
                    if any(keyword in message.lower() for keyword in excel_keywords):
                        print(f"📊 Executing Excel creation tool: {tool_name}")
                        try:
                            # For the time zone example, create Excel with city time data
                            if any(city in message.lower() for city in ['cape town', 'new york', 'london', 'time']):
                                import datetime
                                import pytz
                                
                                # Get current UTC time
                                utc_now = datetime.datetime.now(pytz.UTC)
                                
                                # Define time zones
                                cities_tz = {
                                    'Cape Town': 'Africa/Johannesburg',  # SAST (UTC+2)
                                    'New York': 'America/New_York',      # EDT/EST
                                    'London': 'Europe/London'            # BST/GMT
                                }
                                
                                # Calculate local times
                                city_times = []
                                for city, tz_name in cities_tz.items():
                                    tz = pytz.timezone(tz_name)
                                    local_time = utc_now.astimezone(tz)
                                    city_times.append({
                                        'City': city,
                                        'Local_Time': local_time.strftime('%Y-%m-%d %H:%M:%S'),
                                        'Timezone': local_time.strftime('%Z'),
                                        'UTC_Offset': local_time.strftime('%z')
                                    })
                                
                                # Create Excel content
                                file_path = f"uploads/city_times_{utc_now.strftime('%Y%m%d_%H%M%S')}.xlsx"
                                result = tool(file_path=file_path, data=city_times, sheet_name="City Times")
                                print(f"📊 Excel creation result: {result}")
                                
                                # Create proper download URL
                                filename = file_path.split('/')[-1]  # Extract filename
                                download_url = f"http://localhost:8000/uploads/{filename}"
                                
                                results.append(f"✅ **Excel File Created Successfully!**\n\n📁 **File:** `{filename}`\n📊 **Contains:** City timezone data for Cape Town, New York, and London\n📋 **Sheet:** `City Times` with professional formatting\n🔗 **Download:** [{filename}]({download_url})\n\n*Click the link above to download your Excel file.*")
                            else:
                                # Generic Excel creation
                                results.append(f"Excel creation capability available. Please specify the data to include in the Excel file.")
                        except Exception as e:
                            print(f"❌ Error executing Excel creation tool: {e}")
                            results.append(f"Error creating Excel file: {str(e)}")
                
                # File operations
                elif tool_name in ['read_file', 'write_file', 'list_directory']:
                    file_keywords = ['file', 'read', 'write', 'directory', 'folder', 'save', 'create file']
                    if any(keyword in message.lower() for keyword in file_keywords):
                        print(f"📁 File operation tool detected: {tool_name}")
                        # Note: File operations need specific parameters, so just notify availability
                        results.append(f"File operation capability available: {tool_name}")
                
                # Data processing tools
                elif tool_name in ['parse_csv', 'filter_data', 'aggregate_data', 'transform_data']:
                    data_keywords = ['data', 'analyze', 'filter', 'process', 'transform', 'aggregate']
                    if any(keyword in message.lower() for keyword in data_keywords):
                        print(f"📊 Data processing tool detected: {tool_name}")
                        results.append(f"Data processing capability available: {tool_name}")
        
        print(f"Tool execution results: {results}")
        return "\n\n".join(results) if results else ""
        
    except Exception as e:
        print(f"Error in tool execution: {e}")
        return f"Error executing tools: {str(e)}"

def run_agent(agent_id: str, message: str = None, files: list[str] = None, session_id: str = None):
    print(f"=== RUN_AGENT START ===")
    print(f"Agent ID: {agent_id}")
    print(f"Message: {message}")
    print(f"Files: {files}")
    
    db = SessionLocal()
    try:
        agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
        if not agent:
            print("Agent not found")
            return {"error": "Agent not found"}
        
        print(f"Agent found: {agent.name}")
        print(f"Agent capabilities: {[c.name for c in agent.capabilities]}")
        
        # Conversation handling
        if session_id:
            convo = db.query(models.Conversation).filter(models.Conversation.id == session_id).first()
            if not convo:
                convo = models.Conversation(id=session_id)
                db.add(convo)
        else:
            convo = models.Conversation(id=uuid.uuid4())
            db.add(convo)
            session_id = str(convo.id)
        db.commit()
        past_msgs = db.query(models.Message).filter(models.Message.conversation_id == convo.id).order_by(models.Message.created_at).all()
        hist = [{"role": m.role, "content": m.content} for m in past_msgs]
        # Pipeline execution
        steps = [agent] + [db.query(models.Agent).filter(models.Agent.id == p.child_agent_id).first()
                           for p in db.query(models.AgentPipeline).filter(models.AgentPipeline.parent_agent_id == agent.id).order_by(models.AgentPipeline.order)]
        output = {"response": message, "attachments": []}
        run_id = uuid.uuid4()
        for step in steps:
            print(f"Executing step with agent: {step.name}")
            prun = models.PipelineRun(id=uuid.uuid4(), agent_id=step.id, started_at=datetime.utcnow(), status="running")
            db.add(prun)
            try:
                output = execute_single_agent(step, output["response"], files, output)
                print(f"Step output: {output}")
                prun.status = "success"
            except Exception as e:
                print(f"Step failed: {e}")
                prun.status = "failed"
                prun.error_message = str(e)
            prun.completed_at = datetime.utcnow()
            db.commit()
        # Save conversation
        db.add(models.Message(conversation_id=convo.id, role="user", content=message))
        db.add(models.Message(conversation_id=convo.id, role="assistant", content=output["response"], attachments=output["attachments"]))
        db.commit()
        print(f"=== RUN_AGENT END - Returning: {output} ===")
        return {"session_id": session_id, **output}
    finally:
        db.close()

def run_orchestrator_agent(message: str, files: list[str] = None, session_id: str = None):
    """
    New orchestrator agent that manages all interactions and tool execution.
    This provides a centralized approach to handling user requests.
    """
    print(f"=== ORCHESTRATOR AGENT START ===")
    print(f"Message: {message}")
    print(f"Files: {files}")
    
    db = SessionLocal()
    try:
        # Get all available agents and their capabilities
        agents = db.query(models.Agent).filter(models.Agent.status == "active").all()
        print(f"Available agents: {[a.name for a in agents]}")
        
        # Analyze the message to determine what tools/capabilities are needed
        message_lower = message.lower()
        
        # Check for diagram generation requests
        if any(keyword in message_lower for keyword in [
            # Flowcharts
            "create a flowchart", "draw a flowchart", "make a flowchart",
            "create a flow chart", "draw a flow chart", "make a flow chart",
            "flowchart", "flow chart",
            
            # General diagrams
            "create a diagram", "draw a diagram", "make a diagram",
            "create diagram", "draw diagram", "make diagram",
            "diagram",
            
            # Specific diagram types
            "create a sequence diagram", "draw a sequence diagram",
            "create a class diagram", "draw a class diagram",
            "create an er diagram", "draw an er diagram",
            "create a gantt chart", "draw a gantt chart",
            "create a pie chart", "draw a pie chart",
            
            # Network and architecture diagrams
            "create a network diagram", "draw a network diagram", "make a network diagram",
            "create network diagram", "draw network diagram", "make network diagram",
            "network diagram", "network topology",
            
            "create an architecture diagram", "draw an architecture diagram", "make an architecture diagram",
            "create architecture diagram", "draw architecture diagram", "make architecture diagram",
            "architecture diagram", "system architecture",
            
            # Infrastructure diagrams
            "create an infrastructure diagram", "draw an infrastructure diagram",
            "create infrastructure diagram", "draw infrastructure diagram",
            "infrastructure diagram", "infrastructure",
            
            # Any request containing "diagram" or "chart"
            "diagram", "chart"
        ]):
            print("Diagram generation request detected")
            
            # Find agents with diagram generation capability
            diagram_agents = [a for a in agents if any(c.name == "diagram_generation" for c in a.capabilities)]
            
            if diagram_agents:
                print(f"Found {len(diagram_agents)} agents with diagram generation capability")
                # Use the first available diagram agent
                selected_agent = diagram_agents[0]
                print(f"Selected agent: {selected_agent.name}")
                
                # Execute the diagram generation
                result = execute_single_agent(selected_agent, message, files, {})
                return {
                    "session_id": session_id,
                    "response": result.get("response", "Diagram generation completed"),
                    "attachments": result.get("attachments", []),
                    "tool_calls": result.get("tool_calls", [])
                }
            else:
                return {
                    "session_id": session_id,
                    "response": "I can help you create diagrams! However, no agents with diagram generation capability are currently available. Please configure an agent with the 'diagram_generation' capability.",
                    "attachments": [],
                    "tool_calls": []
                }
        
        # Check for image analysis requests
        elif any(keyword in message_lower for keyword in [
            "analyze this image", "what's in this image", "describe this image",
            "explain this image", "what do you see", "analyze the image",
            "analyse this image", "analyse the image"  # Add British spelling
        ]):
            print("Image analysis request detected")
            
            # Find agents with image analysis capability
            image_agents = [a for a in agents if any(c.name == "image_analysis" for c in a.capabilities)]
            
            if image_agents:
                print(f"Found {len(image_agents)} agents with image analysis capability")
                # Use the first available image analysis agent
                selected_agent = image_agents[0]
                print(f"Selected agent: {selected_agent.name}")
                
                # Execute the image analysis
                result = execute_single_agent(selected_agent, message, files, {})
                return {
                    "session_id": session_id,
                    "response": result.get("response", "Image analysis completed"),
                    "attachments": result.get("attachments", []),
                    "tool_calls": result.get("tool_calls", [])
                }
            else:
                return {
                    "session_id": session_id,
                    "response": "I can help you analyze images! However, no agents with image analysis capability are currently available. Please configure an agent with the 'image_analysis' capability.",
                    "attachments": [],
                    "tool_calls": []
                }
        
        # Default: use smarter agent selection
        else:
            print("General request - using smart agent selection")
            
            # Try to find the best agent for the request
            selected_agent = None
            
            # First, try to find an agent with general capabilities
            general_agents = [a for a in agents if a.name.lower() == "assistant"]
            if general_agents:
                selected_agent = general_agents[0]
                print(f"Using Assistant agent: {selected_agent.name}")
            else:
                # Fall back to first available agent
                if agents:
                    selected_agent = agents[0]
                    print(f"Using fallback agent: {selected_agent.name}")
                else:
                    return {
                        "session_id": session_id,
                        "response": "No agents are currently available. Please configure at least one agent.",
                        "attachments": [],
                        "tool_calls": []
                    }
            
            result = execute_single_agent(selected_agent, message, files, {})
            return {
                "session_id": session_id,
                "response": result.get("response", "Request processed"),
                "attachments": result.get("attachments", []),
                "tool_calls": result.get("tool_calls", [])
            }
    
    except Exception as e:
        print(f"Error in orchestrator agent: {e}")
        return {
            "session_id": session_id,
            "response": f"An error occurred while processing your request: {str(e)}",
            "attachments": [],
            "tool_calls": []
        }
    finally:
        db.close()