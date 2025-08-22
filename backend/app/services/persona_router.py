"""
Persona Router Service

Handles intent detection and persona selection for multi-persona agents.
Enhanced with shared memory for better context-aware routing decisions.
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from ..db import models
from ..db.database import SessionLocal
from ..config import settings
from openai import AzureOpenAI
from .shared_memory import shared_memory_service
from .cache_service import cache_service


class PersonaRouter:
    """Service for routing user inputs to appropriate personas based on intent detection."""
    
    def __init__(self):
        # Cache for Azure Key Vault secrets to avoid repeated expensive calls
        self._keyvault_cache = {}
        self._llm_client_cache = {}
        self._routing_decision_cache = {}  # Cache routing decisions
        self.client = None
        print(f"🎭 PERSONA ROUTER: Initializing PersonaRouter...")
        print(f"🔑 PERSONA ROUTER: API Key available: {bool(settings.AZURE_OPENAI_API_KEY)}")
        print(f"🏢 PERSONA ROUTER: API Base available: {bool(settings.AZURE_OPENAI_API_BASE)}")
        
        if settings.AZURE_OPENAI_API_KEY and settings.AZURE_OPENAI_API_BASE:
            try:
                self.client = AzureOpenAI(
                    api_key=settings.AZURE_OPENAI_API_KEY,
                    azure_endpoint=settings.AZURE_OPENAI_API_BASE,
                    api_version="2024-02-01"
                )
                print(f"✅ PERSONA ROUTER: LLM client initialized successfully")
            except Exception as e:
                print(f"❌ PERSONA ROUTER: Failed to initialize Azure OpenAI client for intent detection: {e}")
        else:
            print(f"⚠️ PERSONA ROUTER: Missing environment variables - system prompt routing will not be available")
            print(f"   To enable intelligent routing, set AZURE_OPENAI_API_KEY and AZURE_OPENAI_API_BASE")
    
    def detect_intent(
        self, 
        user_input: str, 
        personas: List[Dict[str, Any]], 
        method: str = "hybrid",
        confidence_threshold: float = 0.7,
        session_id: str = None
    ) -> Tuple[Optional[str], float]:
        """
        Detect user intent and return the best matching persona ID with confidence.
        Lightweight version optimized for performance.
        
        Args:
            user_input: The user's message
            personas: List of persona configurations
            method: Detection method ('keywords', 'llm', 'hybrid')
            confidence_threshold: Minimum confidence for persona selection
            session_id: Session ID for context-aware routing (DISABLED for performance)
            
        Returns:
            Tuple of (persona_id, confidence_score) or (None, 0.0) if no match
        """
        # PERFORMANCE OPTIMIZATION: Skip session context lookup to avoid DB overhead  
        session_context = None
        
        # Quick cache check for recent similar inputs
        input_hash = hash(user_input.lower())
        persona_ids = sorted([p.get('id') for p in personas if p.get('id')])
        quick_cache_key = f"intent:{input_hash}:{hash(str(persona_ids))}"
        
        cached_intent = cache_service.get(quick_cache_key)
        if cached_intent:
            print(f"⚡ PERSONA ROUTER: Using cached intent detection result")
            return cached_intent.get('persona_id'), cached_intent.get('confidence', 0.0)
        
        if method == "keywords":
            return self._keyword_intent_detection(user_input, personas, confidence_threshold, session_context)
        elif method == "llm":
            return self._llm_intent_detection(user_input, personas, confidence_threshold, session_context)
        elif method == "hybrid":
            return self._hybrid_intent_detection(user_input, personas, confidence_threshold, session_context)
        else:
            raise ValueError(f"Unknown intent detection method: {method}")
    
    def _keyword_intent_detection(
        self, 
        user_input: str, 
        personas: List[Dict[str, Any]], 
        confidence_threshold: float,
        session_context: Dict = None
    ) -> Tuple[Optional[str], float]:
        """Fast keyword-based intent detection with session context awareness."""
        user_input_lower = user_input.lower()
        persona_scores = []
        
        # Check if this looks like a continuation (e.g., "and a cat", "what about X", "also Y")
        is_continuation = any(user_input_lower.startswith(prefix) for prefix in ['and ', 'also ', 'what about ', 'how about ', 'or '])
        
        # If it's a continuation and we have session context, try to match based on recent agent
        if is_continuation and session_context and session_context.get('conversation_history'):
            recent_history = session_context.get('conversation_history', [])
            if recent_history:
                # Find the last assistant message to see which agent was recently active
                last_assistant_msg = None
                for msg in reversed(recent_history):
                    if msg['role'] == 'assistant' and msg.get('agent_name'):
                        last_assistant_msg = msg
                        break
                
                if last_assistant_msg:
                    last_agent_name = last_assistant_msg.get('agent_name')
                    # Try to match this agent name to one of our personas
                    for persona in personas:
                        persona_name = persona.get('name', '').lower()
                        if persona_name and last_agent_name and persona_name in last_agent_name.lower():
                            print(f"🔗 PERSONA ROUTER: Continuation detected, preferring recent agent '{last_agent_name}'")
                            return persona['id'], 0.8  # High confidence for continuations
        
        for persona in personas:
            triggers = persona.get('triggers', [])
            if not triggers:
                continue
                
            # Count keyword matches
            matches = sum(1 for trigger in triggers if trigger.lower() in user_input_lower)
            
            # Also check conversation context for trigger words if available
            context_matches = 0
            if session_context and session_context.get('conversation_history'):
                recent_text = ' '.join([msg['content'] for msg in session_context.get('conversation_history', [])[-2:]])
                context_matches = sum(1 for trigger in triggers if trigger.lower() in recent_text.lower())
            
            total_matches = matches + (context_matches * 0.3)  # Weight context matches less
            
            if total_matches > 0:
                # Calculate confidence based on match ratio and specificity
                confidence = min(total_matches / len(triggers), 1.0)
                # Boost confidence for exact matches
                exact_matches = sum(1 for trigger in triggers if trigger.lower() == user_input_lower)
                if exact_matches > 0:
                    confidence = min(confidence + 0.3, 1.0)
                
                persona_scores.append((persona['id'], confidence))
        
        if not persona_scores:
            return None, 0.0
            
        # Return the persona with highest confidence
        best_persona, best_confidence = max(persona_scores, key=lambda x: x[1])
        
        # Cache the intent detection result for future similar inputs (5 minutes TTL)
        result = (best_persona if best_confidence >= confidence_threshold else None, best_confidence)
        try:
            cache_service.set(quick_cache_key, {
                'persona_id': result[0],
                'confidence': result[1]
            }, ttl_seconds=300)
        except Exception as e:
            print(f"⚠️ Failed to cache intent detection: {e}")
        
        return result
    
    def _llm_intent_detection(
        self, 
        user_input: str, 
        personas: List[Dict[str, Any]], 
        confidence_threshold: float,
        session_context: Dict = None
    ) -> Tuple[Optional[str], float]:
        """LLM-based intent detection for more accurate results with session context."""
        if not self.client:
            print("Azure OpenAI client not available, falling back to keyword detection")
            return self._keyword_intent_detection(user_input, personas, confidence_threshold, session_context)
        
        # Build persona descriptions for LLM
        persona_descriptions = []
        for persona in personas:
            triggers_str = ', '.join(persona.get('triggers', []))
            description = f"- {persona['name']} (ID: {persona['id']}): Handles {triggers_str}"
            persona_descriptions.append(description)
        
        personas_text = '\n'.join(persona_descriptions)
        
        # Include conversation context if available
        context_section = ""
        if session_context and session_context.get('conversation_history'):
            recent_history = session_context.get('conversation_history', [])[-3:]  # Last 3 messages
            if recent_history:
                context_lines = []
                for msg in recent_history:
                    role_prefix = "User" if msg['role'] == 'user' else "Assistant"
                    content = msg['content'][:100] + ("..." if len(msg['content']) > 100 else "")
                    context_lines.append(f"{role_prefix}: {content}")
                
                context_section = f"""
Previous conversation context:
{chr(10).join(context_lines)}

"""
        
        system_prompt = f"""You are an intent classifier. Given a user message, determine which persona should handle it.

Available personas:
{personas_text}

{context_section}Analyze the user message considering the conversation context to understand if this is a continuation or new topic.

Respond with ONLY the persona ID and confidence score (0.0-1.0) in this format:
persona_id:confidence_score

If no persona is clearly appropriate, respond with:
none:0.0"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4",  # Use a fast model for intent detection
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input}
                ],
                max_tokens=50,
                temperature=0.1
            )
            
            result = response.choices[0].message.content.strip()
            
            # Parse result
            if ':' in result:
                persona_id, confidence_str = result.split(':', 1)
                persona_id = persona_id.strip()
                confidence = float(confidence_str.strip())
                
                if persona_id == 'none' or confidence < confidence_threshold:
                    return None, confidence
                else:
                    return persona_id, confidence
            else:
                return None, 0.0
                
        except Exception as e:
            print(f"LLM intent detection failed: {e}")
            # Fall back to keyword detection
            return self._keyword_intent_detection(user_input, personas, confidence_threshold, session_context)
    
    def _hybrid_intent_detection(
        self, 
        user_input: str, 
        personas: List[Dict[str, Any]], 
        confidence_threshold: float,
        session_context: Dict = None
    ) -> Tuple[Optional[str], float]:
        """Combines keyword and LLM detection for balanced accuracy and speed with session context."""
        # First try keyword detection (fast)
        keyword_persona, keyword_confidence = self._keyword_intent_detection(
            user_input, personas, confidence_threshold, session_context
        )
        
        # If keyword detection is highly confident, use it
        if keyword_confidence >= 0.8:
            return keyword_persona, keyword_confidence
        
        # If keyword detection found something but not confident, use LLM to verify
        if keyword_persona and keyword_confidence >= 0.3:
            llm_persona, llm_confidence = self._llm_intent_detection(
                user_input, personas, confidence_threshold, session_context
            )
            
            # If LLM agrees with keyword detection, boost confidence
            if llm_persona == keyword_persona:
                final_confidence = min((keyword_confidence + llm_confidence) / 2 + 0.1, 1.0)
                return keyword_persona, final_confidence
            # If LLM disagrees but is confident, use LLM result
            elif llm_confidence >= confidence_threshold:
                return llm_persona, llm_confidence
        
        # If no keyword match or low confidence, try LLM detection
        llm_persona, llm_confidence = self._llm_intent_detection(
            user_input, personas, confidence_threshold, session_context
        )
        
        return llm_persona, llm_confidence
    
    def select_agent(
        self, 
        user_input: str, 
        persona_router_config: Dict[str, Any],
        connected_agents: List[Dict[str, Any]],
        workflow_nodes: List[Dict[str, Any]] = None,
        workflow_connections: List[Dict[str, Any]] = None,
        session_id: str = None
    ) -> Dict[str, Any]:
        """
        Select the best connected agent for handling user input using system prompt analysis.
        Optimized with caching to reduce LLM calls for similar inputs.
        
        Args:
            user_input: User's message
            persona_router_config: Persona router node configuration
            connected_agents: List of connected agent nodes from the canvas
            
        Returns:
            Dictionary with selected agent and metadata
        """
        print("\n" + "="*60)
        print("🎭 PERSONA ROUTER AGENT SELECTION")
        print("="*60)
        
        # Create cache key for routing decisions
        agent_ids = sorted([agent['id'] for agent in connected_agents])
        cache_key = f"routing:{hash(user_input.lower())}:{hash(str(agent_ids))}"
        
        # Check cache first for similar routing decisions (10 minute TTL)
        cached_result = cache_service.get(cache_key)
        if cached_result:
            print(f"⚡ PERSONA ROUTER: Using cached routing decision")
            # Verify the cached agent still exists in connected_agents
            cached_agent_id = cached_result.get('agent_id')
            cached_agent = next((a for a in connected_agents if a['id'] == cached_agent_id), None)
            if cached_agent:
                cached_result['agent'] = cached_agent  # Update agent reference
                print(f"✅ PERSONA ROUTER: Cached result valid - {cached_result.get('reasoning', 'No reason')}")
                return cached_result
        
        if not connected_agents:
            print("❌ PERSONA ROUTER: No connected agents available")
            raise ValueError("No connected agents available")
        
        intents = persona_router_config.get('intents', {})
        method = intents.get('method', 'hybrid')
        confidence_threshold = intents.get('confidenceThreshold', 0.7)
        
        print(f"⚙️ PERSONA ROUTER: Method: {method}, Threshold: {confidence_threshold}")
        print(f"🤖 PERSONA ROUTER: Connected agents: {len(connected_agents)}")
        
        # Check if we should use system prompt-based routing
        # Try to use workflow LLM if available, fallback to instance LLM client
        has_llm_access = self.client or persona_router_config.get("_llm_node")
        use_system_prompt_routing = method in ['llm', 'hybrid'] and has_llm_access
        
        if use_system_prompt_routing:
            print(f"🧠 PERSONA ROUTER: Using system prompt-based routing")
            result = self._system_prompt_based_routing(
                user_input, connected_agents, persona_router_config, confidence_threshold, workflow_nodes, workflow_connections, session_id
            )
        else:
            print(f"🔑 PERSONA ROUTER: Using trigger-based routing (LLM not available: method={method}, has_llm={has_llm_access})")
            result = self._trigger_based_routing(
                user_input, persona_router_config, connected_agents, method, confidence_threshold, session_id
            )
        
        # Cache the routing decision for future similar inputs (10 minutes TTL)
        try:
            cache_service.set(cache_key, result, ttl_seconds=600)
            print(f"💾 PERSONA ROUTER: Cached routing decision for similar future inputs")
        except Exception as e:
            print(f"⚠️ PERSONA ROUTER: Failed to cache routing decision: {e}")
        
        print("\n" + "="*60)
        print("🎭 PERSONA ROUTER SELECTION COMPLETE")
        print("="*60)
        
        return result

    def _system_prompt_based_routing(
        self, 
        user_input: str, 
        connected_agents: List[Dict[str, Any]], 
        persona_router_config: Dict[str, Any],
        confidence_threshold: float,
        workflow_nodes: List[Dict[str, Any]] = None,
        workflow_connections: List[Dict[str, Any]] = None,
        session_id: str = None
    ) -> Dict[str, Any]:
        """
        Route to agents based on their system prompts using LLM analysis.
        Enhanced with session context for better routing decisions.
        """
        print(f"\n🧠 PERSONA ROUTER: System prompt-based routing")
        print(f"💬 User Input: {user_input[:100]}{'...' if len(user_input) > 100 else ''}")
        print(f"🤖 Available Agents: {len(connected_agents)}")
        
        # PERFORMANCE OPTIMIZATION: Skip context lookup to avoid DB overhead and improve response time
        context_for_routing = ""
        
        # Quick check: if we only have one agent, skip LLM call entirely
        if len(connected_agents) == 1:
            single_agent = connected_agents[0]
            agent_name = single_agent['data'].get('name', 'Unnamed Agent')
            print(f"⚡ PERSONA ROUTER: Only one agent available - skipping LLM call, using '{agent_name}'")
            return {
                'agent': single_agent,
                'agent_id': single_agent['id'],
                'confidence': 1.0,
                'method': 'single_agent_optimization',
                'fallback_used': False,
                'reasoning': f"Only one agent available: '{agent_name}'"
            }
        print(f"⚡ PERSONA ROUTER: Fast routing mode - context lookup disabled for performance")
        # Build agent descriptions from routing summaries AND configured tools
        agent_descriptions = []
        for i, agent in enumerate(connected_agents):
            name = agent['data'].get('name', 'Unnamed Agent')
            agent_db_id = agent['data'].get('databaseId')  # Get the database ID for routing summary lookup
            
            # Get configured tools by finding tool nodes connected to this agent
            configured_tools = self._get_agent_connected_tools(
                agent.get('id'), workflow_nodes or [], workflow_connections or []
            )
            tool_descriptions = []
            if configured_tools:
                # Import tool metadata for descriptions
                try:
                    from ..services.tools import TOOL_METADATA
                except ImportError:
                    TOOL_METADATA = {}
                
                # Extract tool descriptions using tool names
                for tool_name in configured_tools:
                    if tool_name and tool_name in TOOL_METADATA:
                        desc = TOOL_METADATA[tool_name].get('description', 'No description')
                        tool_descriptions.append(f"{tool_name} ({desc})")
                    elif tool_name:
                        tool_descriptions.append(f"{tool_name} (No description)")
            
            tools_text = f"Tools: {'; '.join(tool_descriptions)}" if tool_descriptions else "Tools: None"
            
            # PERFORMANCE OPTIMIZATION: Skip routing summary lookup to avoid multiple DB calls
            routing_summary = None
            print(f"⚡ [{i+1}] Agent: '{name}' - Using system prompt (routing summary disabled for performance)")
            
            # Build description using routing summary if available, otherwise fall back to system prompt
            if routing_summary:
                description = f"- {name} (ID: {agent['id']}): {routing_summary}\n  {tools_text}"
            else:
                # Fallback to system prompt (old behavior)
                system_prompt = agent['data'].get('systemPrompt', '')
                print(f"🔍 [{i+1}] Agent: '{name}' - Using system prompt fallback ({len(system_prompt)} chars), {tools_text}")
                
                if system_prompt:
                    # Use more of the system prompt for better context, but keep reasonable
                    prompt_excerpt = system_prompt[:300] + ("..." if len(system_prompt) > 300 else "")
                    description = f"- {name} (ID: {agent['id']}): {prompt_excerpt}\n  {tools_text}"
                else:
                    description = f"- {name} (ID: {agent['id']}): General purpose agent\n  {tools_text}"
            
            agent_descriptions.append(description)
        
        agents_text = '\n'.join(agent_descriptions)
        
        # Build system prompt with optional conversation context
        context_section = ""
        if context_for_routing:
            context_section = f"""
Previous conversation context:
{context_for_routing}

"""
        
        # Use a very safe, neutral routing prompt to avoid content policy issues
        system_prompt = f"""You are a routing assistant that matches user requests to appropriate specialist agents.

Available agents:
{agents_text}

{context_section}Task: Analyze the user request and select the most suitable agent based on their capabilities and available tools.
Consider the conversation context to understand if this is a continuation of a previous topic or a new request.

Response format: agent_id:confidence_score

For example:
- If the request matches an agent's expertise: agent_1234:0.9
- If no clear match exists: none:0.0

Choose the agent whose capabilities best align with the user's needs."""

        print(f"🚀 PERSONA ROUTER: Calling LLM for agent selection...")
        
        # DEBUG: Print the entire system prompt being sent to LLM
        print(f"\n{'='*80}")
        print(f"🔍 DEBUG: FULL SYSTEM PROMPT BEING SENT TO LLM")
        print(f"{'='*80}")
        print(system_prompt)
        print(f"{'='*80}")
        print(f"🔍 DEBUG: USER INPUT: '{user_input}'")
        print(f"{'='*80}\n")
        
        # Try to get LLM client - prefer workflow LLM, fallback to instance client
        client_to_use = self.client
        model_to_use = "gpt-4"
        
        # Check if workflow provided an LLM node configuration
        llm_node = persona_router_config.get("_llm_node")
        if llm_node and not self.client:
            print(f"🔧 PERSONA ROUTER: Using workflow LLM configuration")
            try:
                # Create a temporary LLM client using workflow's LLM configuration
                from openai import AzureOpenAI
                from ..config import settings
                
                # Get LLM config data - use the same logic as workflow execution
                llm_data = llm_node.get("data", {})
                print(f"🔍 PERSONA ROUTER: LLM Node Data: {llm_data}")
                
                # Check for saved config first (same as workflow execution)
                saved_config_id = llm_data.get("savedConfigId")
                temp_llm_config = None
                
                if saved_config_id:
                    print(f"🗄️ PERSONA ROUTER: Loading saved LLM config: {saved_config_id}")
                    # Use cached or fetch saved LLM config from database
                    cache_key = f"llm_config_{saved_config_id}"
                    if cache_key in self._llm_client_cache:
                        temp_llm_config = self._llm_client_cache[cache_key]
                        print(f"⚡ PERSONA ROUTER: Using cached LLM config")
                    else:
                        db = SessionLocal()
                        try:
                            temp_llm_config = db.query(models.LLMConfig).filter(models.LLMConfig.id == saved_config_id).first()
                            if temp_llm_config:
                                self._llm_client_cache[cache_key] = temp_llm_config
                                print(f"✅ PERSONA ROUTER: Found and cached LLM config")
                            else:
                                print(f"❌ PERSONA ROUTER: Saved LLM config {saved_config_id} not found")
                        finally:
                            db.close()
                else:
                    print(f"📝 PERSONA ROUTER: No saved config ID, creating temporary config")
                    # Create a temporary LLM config from the workflow node data
                    temp_llm_config = models.LLMConfig(
                        provider=llm_data.get("provider", "Azure OpenAI"),
                        model_name=llm_data.get("model", "gpt-4"),
                        temperature=str(llm_data.get("temperature", 0.7)),
                        max_tokens=str(llm_data.get("maxTokens", 4000)),
                        api_base=llm_data.get("apiBase", ""),
                        api_key_secret_ref=llm_data.get("apiKeySecretRef", "")
                    )
                
                if temp_llm_config:
                    model_to_use = temp_llm_config.model_name
                    api_base = temp_llm_config.api_base
                    api_key_ref = temp_llm_config.api_key_secret_ref
                    
                    print(f"🧠 PERSONA ROUTER: Using LLM Config - Model: {model_to_use}, API Base: {api_base}")
                    print(f"🔑 PERSONA ROUTER: API Key Ref: '{api_key_ref}'")
                    
                    # Handle API key resolution with caching for performance
                    api_key = None
                    if api_key_ref and api_key_ref.startswith("https://") and ".vault.azure.net/" in api_key_ref:
                        # Try cached Key Vault resolution first
                        # Use global cache service for Key Vault secrets
                        keyvault_cache_key = f"keyvault_sync:{api_key_ref}"
                        api_key = cache_service.get(keyvault_cache_key)
                        
                        if api_key:
                            print(f"⚡ PERSONA ROUTER: Using cached Key Vault secret")
                        else:
                            print(f"🔑 PERSONA ROUTER: Resolving Key Vault secret (caching for future use)")
                            try:
                                from .cache_service import keyvault_cache
                                api_key = keyvault_cache.get_secret_sync(api_key_ref)
                                print(f"✅ PERSONA ROUTER: Successfully resolved and cached Key Vault secret")
                            except Exception as kv_error:
                                print(f"⚠️ PERSONA ROUTER: Key Vault failed, trying environment fallback: {kv_error}")
                                api_key = settings.AZURE_OPENAI_API_KEY
                                # Cache the fallback to avoid retrying Key Vault (shorter TTL)
                                cache_service.set(keyvault_cache_key, api_key, ttl_seconds=1800)
                    elif api_key_ref:
                        api_key = api_key_ref
                    else:
                        api_key = settings.AZURE_OPENAI_API_KEY
                    
                    if api_key and api_base:
                        print(f"🔧 PERSONA ROUTER: Creating AzureOpenAI client with:")
                        print(f"   api_key: {api_key[:10]}...")
                        print(f"   azure_endpoint: {api_base}")
                        print(f"   api_version: 2024-02-01")
                        # Check if we already have a cached client for this configuration
                        client_cache_key = f"{api_base}_{model_to_use}_{api_key[:10] if api_key else 'none'}"
                        if client_cache_key in self._llm_client_cache:
                            client_to_use = self._llm_client_cache[client_cache_key]
                            print(f"⚡ PERSONA ROUTER: Using cached LLM client")
                        else:
                            try:
                                import httpx
                                # Create HTTP client without proxy configuration
                                http_client = httpx.Client()
                                client_to_use = AzureOpenAI(
                                    api_key=api_key,
                                    azure_endpoint=api_base,
                                    api_version="2024-02-01",
                                    http_client=http_client
                                )
                                # Cache the client for future use
                                self._llm_client_cache[client_cache_key] = client_to_use
                                print(f"✅ PERSONA ROUTER: Workflow LLM client created and cached successfully")
                            except Exception as client_error:
                                print(f"❌ PERSONA ROUTER: AzureOpenAI client creation failed: {client_error}")
                                print(f"   Error type: {type(client_error)}")
                                import traceback
                                traceback.print_exc()
                                raise
                    else:
                        print(f"❌ PERSONA ROUTER: Missing API key ({bool(api_key)}) or base URL ({bool(api_base)})")
                else:
                    print(f"❌ PERSONA ROUTER: No LLM config available")
                    
            except Exception as e:
                print(f"❌ PERSONA ROUTER: Failed to create workflow LLM client: {e}")
        
        if not client_to_use:
            print(f"❌ PERSONA ROUTER: No LLM client available")
            raise Exception("No LLM client available for system prompt analysis")
        
        try:
            print(f"🚀 PERSONA ROUTER: Calling {model_to_use} for intelligent agent selection...")
            # Build API parameters with model-specific token parameter
            api_params = {
                "model": model_to_use,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input}
                ],
                "temperature": 1.0 if model_to_use and "gpt-5" in model_to_use else 0.1
            }
            
            # Use appropriate token parameter based on model
            if model_to_use and ("gpt-4o" in model_to_use or "gpt-5" in model_to_use):
                api_params["max_completion_tokens"] = 50
            else:
                api_params["max_tokens"] = 50
            
            response = client_to_use.chat.completions.create(**api_params)
            
            result = response.choices[0].message.content.strip()
            print(f"📝 PERSONA ROUTER: LLM response: {result}")
            
            # Parse result
            if ':' in result:
                agent_id, confidence_str = result.split(':', 1)
                agent_id = agent_id.strip()
                confidence = float(confidence_str.strip())
                print(f"🎯 PERSONA ROUTER: Parsed - Agent ID: {agent_id}, Confidence: {confidence}")
                
                # Find the selected agent
                selected_agent = next(
                    (a for a in connected_agents if a['id'] == agent_id), None
                )
                
                if selected_agent:
                    agent_name = selected_agent['data'].get('name', 'Unnamed Agent')
                    print(f"✅ PERSONA ROUTER: Found agent '{agent_name}' for ID {agent_id}")
                else:
                    print(f"❌ PERSONA ROUTER: No agent found for ID {agent_id}")
                
                if selected_agent and confidence >= confidence_threshold:
                    agent_name = selected_agent['data'].get('name', 'Unnamed Agent')
                    print(f"🎆 PERSONA ROUTER: SUCCESS - Selected '{agent_name}' with confidence {confidence}")
                    return {
                        'agent': selected_agent,
                        'agent_id': agent_id,
                        'confidence': confidence,
                        'method': 'system_prompt_llm',
                        'fallback_used': False,
                        'reasoning': f"Selected '{agent_name}' based on system prompt analysis (confidence: {confidence})"
                    }
                else:
                    print(f"⚠️ PERSONA ROUTER: Agent selection failed - confidence {confidence} below threshold {confidence_threshold}")
            
            # Fallback to first agent if no good match
            fallback_agent = connected_agents[0]
            fallback_name = fallback_agent['data'].get('name', 'Unnamed Agent')
            print(f"🔄 PERSONA ROUTER: FALLBACK - Using '{fallback_name}' (no clear match)")
            return {
                'agent': fallback_agent,
                'agent_id': fallback_agent['id'],
                'confidence': 0.3,
                'method': 'system_prompt_fallback',
                'fallback_used': True,
                'reasoning': f"No agent clearly matched, using fallback agent '{fallback_name}'"
            }
                
        except Exception as e:
            print(f"❌ PERSONA ROUTER: System prompt-based routing failed: {e}")
            # Fallback to first agent
            fallback_agent = connected_agents[0]
            fallback_name = fallback_agent['data'].get('name', 'Unnamed Agent')
            print(f"🔄 PERSONA ROUTER: ERROR FALLBACK - Using '{fallback_name}' due to error")
            return {
                'agent': fallback_agent,
                'agent_id': fallback_agent['id'],
                'confidence': 0.1,
                'method': 'error_fallback',
                'fallback_used': True,
                'reasoning': f"Routing error ({str(e)}), using fallback agent '{fallback_name}'"
            }

    def _trigger_based_routing(
        self, 
        user_input: str, 
        persona_router_config: Dict[str, Any],
        connected_agents: List[Dict[str, Any]],
        method: str,
        confidence_threshold: float,
        session_id: str = None
    ) -> Dict[str, Any]:
        """
        Route to agents based on manual keyword triggers (legacy method).
        Enhanced with session context awareness.
        """
        print(f"\n🔑 PERSONA ROUTER: Trigger-based routing (method: {method})")
        print(f"💬 User Input: {user_input[:100]}{'...' if len(user_input) > 100 else ''}")
        
        # PERFORMANCE OPTIMIZATION: Skip session context for trigger-based routing
        session_context = None
        
        # Quick optimization: if only one agent, skip all processing
        if len(connected_agents) == 1:
            single_agent = connected_agents[0]
            agent_name = single_agent['data'].get('name', 'Unnamed Agent')
            print(f"⚡ PERSONA ROUTER: Only one agent available - skipping trigger analysis, using '{agent_name}'")
            return {
                'agent': single_agent,
                'agent_id': single_agent['id'],
                'confidence': 1.0,
                'method': 'single_agent_optimization',
                'fallback_used': False,
                'reasoning': f"Only one agent available: '{agent_name}'"
            }
        print(f"⚡ PERSONA ROUTER: Fast trigger routing - session context disabled for performance")
        
        agent_intent_mappings = persona_router_config.get('agentIntentMappings', {})
        
        # Build agent list for intent detection
        agent_personas = []
        print(f"🔍 PERSONA ROUTER: Analyzing trigger configurations...")
        
        for i, agent in enumerate(connected_agents):
            agent_id = agent['id']
            mapping = agent_intent_mappings.get(agent_id, {})
            triggers = mapping.get('triggers', [])
            priority = mapping.get('priority', 1)
            agent_name = agent['data'].get('name', 'Unnamed Agent')
            
            print(f"🤖 [{i+1}] Agent: '{agent_name}' - Triggers: {triggers} (Priority: {priority})")
            
            if triggers:  # Only consider agents with configured triggers
                agent_personas.append({
                    'id': agent_id,
                    'name': agent_name,
                    'triggers': triggers,
                    'priority': priority,
                    'agent_node': agent
                })
        
        if not agent_personas:
            # No agents have configured triggers, fallback to first agent
            fallback_agent = connected_agents[0]
            fallback_name = fallback_agent['data'].get('name', 'Unnamed Agent')
            print(f"⚠️ PERSONA ROUTER: No trigger keywords configured - using fallback '{fallback_name}'")
            return {
                'agent': fallback_agent,
                'agent_id': fallback_agent['id'],
                'confidence': 0.1,
                'method': 'no_triggers_fallback',
                'fallback_used': True,
                'reasoning': f"No trigger keywords configured, using fallback agent '{fallback_name}'"
            }
        
        # Detect intent using the existing detection methods
        print(f"🔍 PERSONA ROUTER: Running {method} intent detection...")
        selected_agent_id, confidence = self.detect_intent(
            user_input, agent_personas, method, confidence_threshold, session_id
        )
        print(f"🎯 PERSONA ROUTER: Intent detection result - Agent ID: {selected_agent_id}, Confidence: {confidence}")
        
        # Find the selected agent
        selected_agent = None
        if selected_agent_id:
            selected_agent = next(
                (a['agent_node'] for a in agent_personas if a['id'] == selected_agent_id), None
            )
        
        # Fallback logic
        if not selected_agent or confidence < confidence_threshold:
            # Use highest priority agent as fallback
            fallback_persona = max(agent_personas, key=lambda a: a['priority'])
            fallback_agent = fallback_persona['agent_node']
            print(f"🔄 PERSONA ROUTER: FALLBACK - Using '{fallback_persona['name']}' (highest priority, confidence: {confidence})")
            return {
                'agent': fallback_agent,
                'agent_id': fallback_agent['id'],
                'confidence': confidence,
                'method': f'trigger_{method}_fallback',
                'fallback_used': True,
                'reasoning': f"Low confidence trigger match ({confidence}), using highest priority agent '{fallback_persona['name']}'"
            }
        
        selected_agent_name = selected_agent['data'].get('name', 'Unnamed Agent')
        print(f"🎆 PERSONA ROUTER: SUCCESS - Selected '{selected_agent_name}' via trigger matching (confidence: {confidence})")
        
        return {
            'agent': selected_agent,
            'agent_id': selected_agent_id,
            'confidence': confidence,
            'method': f'trigger_{method}',
            'fallback_used': False,
            'reasoning': f"Matched trigger keywords for '{selected_agent_name}' (confidence: {confidence})"
        }
    
    def _get_agent_connected_tools(
        self, 
        agent_id: str, 
        workflow_nodes: List[Dict[str, Any]], 
        workflow_connections: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Find all tools connected to a specific agent by examining workflow connections.
        
        Args:
            agent_id: The ID of the agent node
            workflow_nodes: All nodes in the workflow
            workflow_connections: All connections in the workflow
            
        Returns:
            List of tool names configured for this agent
        """
        tool_names = []
        
        try:
            # Find all tool nodes connected to this agent
            for connection in workflow_connections:
                # Check if this connection goes TO the agent (agent as target)
                # or FROM the agent (agent as source)
                connected_tool_node_id = None
                
                if connection.get("target") == agent_id:
                    # Something connects TO this agent
                    connected_tool_node_id = connection.get("source")
                elif connection.get("source") == agent_id:
                    # This agent connects TO something
                    connected_tool_node_id = connection.get("target")
                
                if connected_tool_node_id:
                    # Find the node with this ID and check if it's a tool node
                    for node in workflow_nodes:
                        if node.get("id") == connected_tool_node_id and node.get("type") == "tool":
                            # This is a tool node connected to our agent
                            tool_data = node.get("data", {})
                            selected_tools = tool_data.get("selectedTools", [])
                            
                            # Extract tool names from the tool node configuration
                            for tool_config in selected_tools:
                                if isinstance(tool_config, dict):
                                    tool_name = tool_config.get("name")
                                    if tool_name:
                                        tool_names.append(tool_name)
                            
                            print(f"🔗 Found tool node connected to agent {agent_id}: {len(selected_tools)} tools")
                            break
        
        except Exception as e:
            print(f"❌ Error finding connected tools for agent {agent_id}: {e}")
        
        return tool_names


# Global instance
persona_router = PersonaRouter()


def route_to_agent(
    user_input: str, 
    persona_router_config: Dict[str, Any], 
    connected_agents: List[Dict[str, Any]],
    workflow_nodes: List[Dict[str, Any]] = None,
    workflow_connections: List[Dict[str, Any]] = None,
    session_id: str = None
) -> Dict[str, Any]:
    """
    Convenience function for routing user input to appropriate connected agent.
    
    Args:
        user_input: User's message
        persona_router_config: Persona router configuration
        connected_agents: List of connected agent nodes
        
    Returns:
        Routing result with selected agent and metadata
    """
    return persona_router.select_agent(user_input, persona_router_config, connected_agents, workflow_nodes, workflow_connections, session_id)


# Legacy function for backward compatibility
def route_to_persona(user_input: str, persona_router_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Legacy function for routing to embedded personas (deprecated).
    Use route_to_agent() for the new orchestrator pattern.
    """
    # This is kept for backward compatibility but should not be used
    # in the new orchestrator pattern
    personas = persona_router_config.get('personas', [])
    if personas:
        # Convert old persona format to agent format for compatibility
        fake_agents = []
        for persona in personas:
            fake_agents.append({
                'id': persona.get('id', 'default'),
                'data': {
                    'name': persona.get('name', 'Unknown'),
                    'systemPrompt': persona.get('systemPrompt', '')
                }
            })
        return route_to_agent(user_input, persona_router_config, fake_agents)
    else:
        raise ValueError("No personas or agents configured")


def create_persona_agent(persona_config: Dict[str, Any], base_agent: models.Agent) -> models.Agent:
    """
    Create a temporary agent instance configured for a specific persona.
    
    Args:
        persona_config: Selected persona configuration
        base_agent: Base agent to copy settings from
        
    Returns:
        Configured agent instance for the persona
    """
    import uuid
    from datetime import datetime
    
    # Create a temporary agent with persona-specific configuration
    persona_agent = models.Agent(
        id=uuid.uuid4(),
        name=f"{base_agent.name} ({persona_config['name']})",
        description=f"Persona: {persona_config['name']}",
        system_prompt=persona_config.get('systemPrompt', base_agent.system_prompt),
        status=models.AgentStatus.active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    # Copy LLM configuration from base agent
    if base_agent.llm_config:
        persona_agent.llm_config = base_agent.llm_config
        
        # Apply persona-specific LLM overrides if any
        llm_overrides = persona_config.get('llmOverrides', {})
        if llm_overrides:
            # Create a modified LLM config for this persona
            modified_config = models.LLMConfig(
                id=uuid.uuid4(),
                provider=base_agent.llm_config.provider,
                model_name=base_agent.llm_config.model_name,
                temperature=str(llm_overrides.get('temperature', float(base_agent.llm_config.temperature))),
                max_tokens=str(llm_overrides.get('maxTokens', int(base_agent.llm_config.max_tokens))),
                api_base=base_agent.llm_config.api_base,
                api_key_secret_ref=base_agent.llm_config.api_key_secret_ref
            )
            persona_agent.llm_config = modified_config
    
    # Copy capabilities from base agent
    if base_agent.capabilities:
        persona_agent.capabilities = base_agent.capabilities
    
    return persona_agent