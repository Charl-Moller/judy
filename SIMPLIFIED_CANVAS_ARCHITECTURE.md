# Simplified Canvas Architecture with Multi-Persona Support

## Overview
This document outlines the simplified agent builder architecture that consolidates memory management and introduces multi-persona agents for intelligent intent-based routing.

## Core Principles
1. **Clarity over Complexity** - Each component has a single, clear purpose
2. **Visual Intuition** - The canvas flow should be self-explanatory
3. **Smart Defaults** - Common patterns should work out-of-the-box
4. **Progressive Disclosure** - Advanced features available but not overwhelming

## Node Types (Simplified)

### 1. Agent Node
The core processing unit that defines agent behavior.

**Removed Features:**
- ❌ Memory checkbox (moved to Memory node)
- ❌ RAG index dropdown (moved to Memory node)
- ❌ Context window settings (moved to Memory node)

**Retained Features:**
- ✅ Name and description
- ✅ System prompt (single default prompt)
- ✅ Capabilities selection
- ✅ Response settings (temperature, max tokens)

### 2. Memory Node (Redesigned)
Unified memory management with three clear types.

**Memory Types:**
- **💬 Conversation** - Maintains chat history
  - Window size (last N messages)
  - Include system messages (yes/no)
  
- **📚 Knowledge** - Searches external documents (RAG)
  - Select RAG indexes
  - Similarity threshold
  - Top K results
  
- **🧠 Smart** - Intelligently combines both
  - Conversation settings
  - Knowledge settings
  - Combination strategy (parallel/sequential)

### 3. Persona Router Node (New)
Enables multi-persona agents with intent-based routing.

**Configuration:**
```yaml
Intent Detection:
  - Method: LLM-based / Keywords / Hybrid
  - Confidence Threshold: 0.7

Personas:
  - Technical Expert:
      Triggers: ["API", "integration", "technical", "code"]
      System Prompt: "You are a technical expert..."
      RAG Indexes: ["technical_docs", "api_reference"]
      
  - Sales Assistant:
      Triggers: ["pricing", "cost", "purchase", "buy"]
      System Prompt: "You are a friendly sales assistant..."
      RAG Indexes: ["product_catalog", "pricing_info"]
      
  - Support Agent:
      Triggers: ["help", "issue", "problem", "broken"]
      System Prompt: "You are a helpful support agent..."
      RAG Indexes: ["faq", "troubleshooting"]

Default Persona: General Assistant
```

### 4. LLM Node (Unchanged)
Configures the language model for response generation.

### 5. Tool Node (Unchanged)
Adds capabilities like web search, calculations, etc.

## Visual Flow Patterns

### Pattern 1: Simple Chatbot
```
[User Input] → [Agent] → [LLM] → [Response]
```

### Pattern 2: Chatbot with Memory
```
[User Input] → [Agent] → [Memory (Conversation)] → [LLM] → [Response]
```

### Pattern 3: Knowledge-Based Assistant
```
[User Input] → [Agent] → [Memory (Knowledge)] → [LLM] → [Response]
```

### Pattern 4: Multi-Persona Assistant
```
[User Input] → [Persona Router] → [Memory (Smart)] → [LLM] → [Response]
                     ├── Technical Expert
                     ├── Sales Assistant
                     └── Support Agent
```

### Pattern 5: Advanced Multi-Modal
```
[User Input] → [Persona Router] → [Memory] → [Tools] → [LLM] → [Response]
                                      ↓
                                 [Knowledge Base]
```

## Implementation Details

### Frontend Changes

#### 1. Remove Confusion Points
- Remove memory checkbox from AgentConfigForm
- Remove RAG dropdown from AgentConfigForm
- Remove context window from AgentConfigForm

#### 2. Simplify Memory Node
```typescript
interface MemoryNodeData {
  type: 'conversation' | 'knowledge' | 'smart';
  
  // Conversation settings
  conversation?: {
    windowSize: number;        // 5, 10, 20, 50
    includeSystem: boolean;
  };
  
  // Knowledge settings
  knowledge?: {
    ragIndexes: string[];
    topK: number;             // 3, 5, 10
    minSimilarity: number;    // 0.5 - 1.0
  };
  
  // Smart settings (combines both)
  smart?: {
    conversation: ConversationConfig;
    knowledge: KnowledgeConfig;
    strategy: 'parallel' | 'sequential';
  };
}
```

#### 3. Add Persona Router Node
```typescript
interface PersonaRouterNodeData {
  intents: {
    method: 'llm' | 'keywords' | 'hybrid';
    confidenceThreshold: number;
  };
  
  personas: Array<{
    id: string;
    name: string;
    icon?: string;
    triggers: string[];
    systemPrompt: string;
    ragIndexes: string[];
    llmOverrides?: {
      temperature?: number;
      maxTokens?: number;
    };
  }>;
  
  defaultPersona: string;
}
```

### Backend Changes

#### 1. Enhanced Memory Service
```python
class MemoryService:
    def get_context(self, memory_config, user_input, session_id):
        if memory_config.type == "conversation":
            return self.get_conversation_context(session_id, memory_config)
        elif memory_config.type == "knowledge":
            return self.get_knowledge_context(user_input, memory_config)
        elif memory_config.type == "smart":
            return self.get_smart_context(user_input, session_id, memory_config)
```

#### 2. Persona Router Service
```python
class PersonaRouter:
    def detect_intent(self, user_input, personas, method="llm"):
        if method == "keywords":
            return self.keyword_matching(user_input, personas)
        elif method == "llm":
            return self.llm_intent_detection(user_input, personas)
        elif method == "hybrid":
            return self.hybrid_detection(user_input, personas)
    
    def select_persona(self, intent, personas, default):
        # Returns the best matching persona or default
        pass
```

#### 3. Workflow Execution with Personas
```python
@router.post("/chat/workflow")
async def execute_workflow(payload: dict):
    # 1. Check for Persona Router node
    persona_router = find_node(nodes, type="persona_router")
    
    if persona_router:
        # 2. Detect intent and select persona
        intent = detect_intent(user_input, persona_router.personas)
        persona = select_persona(intent, persona_router.personas)
        
        # 3. Apply persona configuration
        system_prompt = persona.system_prompt
        rag_indexes = persona.rag_indexes
        
        # 4. Process through memory with persona context
        memory_context = get_memory_context(persona.memory_config)
    else:
        # Standard flow without personas
        pass
```

## User Experience Improvements

### 1. Node Palette Organization
```
Core Components:
├── 🤖 Agent - Define agent behavior
├── 🧠 Memory - Add conversation or knowledge
├── 🎭 Personas - Multi-mode agent
└── 💭 LLM - Configure AI model

Advanced:
├── 🔧 Tools - Add capabilities
├── 🔄 Orchestrator - Multi-agent coordination
└── 📤 Output - Format responses
```

### 2. Quick Start Templates
- **Simple Chatbot** - Agent → LLM
- **Chatbot with Memory** - Agent → Memory → LLM
- **Knowledge Assistant** - Agent → Knowledge Memory → LLM
- **Customer Service Bot** - Personas → Smart Memory → LLM
- **Research Assistant** - Agent → Knowledge → Tools → LLM

### 3. Visual Indicators
- Memory nodes show icons: 💬 📚 🧠
- Persona nodes show active persona: 🎭 Technical Expert
- Connections show data flow type
- Execution shows which persona is active

## Migration Path

### For Existing Agents
1. Memory checkbox in Agent → Create Memory node (Conversation type)
2. RAG index in Agent → Create Memory node (Knowledge type)
3. Both enabled → Create Memory node (Smart type)

### Backward Compatibility
- Old configurations continue to work
- Automatic migration on first edit
- Warning messages guide users to new patterns

## Benefits

1. **Clearer Mental Model** - Each node has one purpose
2. **More Flexible** - Can combine memory types easily
3. **Scalable** - Add personas without complexity
4. **Intuitive** - Visual flow matches conceptual flow
5. **Powerful** - Multi-persona enables sophisticated agents

## Next Steps
1. Implement UI components
2. Add backend routing logic
3. Create migration utilities
4. Add documentation and tutorials
5. Build example templates