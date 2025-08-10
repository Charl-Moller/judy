# DESIGN.md

## **Multi‑Agent AI Assistant – System Design**

### **1. High‑Level Vision**
A powerful, multi‑agent AI assistant with a minimal user‑facing chat interface but a robust backend capable of orchestrating multiple specialized agents. Supports:
- RAG (Retrieval Augmented Generation) via Azure Cognitive Search
- Image interpretation (multimodal LLM, e.g., GPT‑5‑chat)
- Document understanding (Word, PDF)
- Spreadsheet analysis (Excel, CSV)
- Chart & graph generation
- Word & Excel file creation
- Web search
- Seamless orchestration between agents

Admin interface for managing:
- Agents
- LLM settings
- Capabilities
- RAG indexes

---

### **2. Architecture Overview**
**Frontend**
- Chat UI (React/Next.js, TailwindCSS)
- File upload support (images, docs, spreadsheets)
- Admin UI for agent management

**Backend**
- **API Gateway** (FastAPI or NestJS) – Auth + routing
- **Agent Orchestrator** – Intent detection, task planning, capability mapping, parallel/sequential execution
- **Agent Manager Service** – CRUD for agents, store in Azure Postgres
- **Specialized Agents** (OpenAI Agent SDK):
  - RAG Agent → Azure Cognitive Search
  - Multimodal LLM Agent → Azure GPT‑4o / GPT‑5‑chat
  - Doc Understanding Agent
  - Spreadsheet Agent
  - Chart/Graph Agent
  - Doc/Excel Generation Agents
  - Web Search Agent

**Storage & Infra**
- Azure Cognitive Search (RAG)
- Azure Blob Storage (files)
- Azure PostgreSQL (agent configs, conversation history, file metadata)
- Azure OpenAI Models (chat, vision)

---

### **3. Orchestrator Flow**
```
[ User Frontend ]
   | (text / file upload)
   v
[ API Gateway ]
   - Auth check
   - Session retrieval
   |
   v
[ Orchestrator ]
   1. Detect Input Type (text / image / doc / spreadsheet)
   2. Run Intent Classification
   3. Select Agent(s) from Agent Manager (Postgres)
   4. Execute Agent(s) via OpenAI Agent SDK
   5. Aggregate & format results
   v
[ Frontend UI ]
   - Render text, charts, tables, images
```

---

### **4. Database Schema (Azure Postgres)**
**Tables**:
- `agents` – name, description, status, timestamps
- `llm_configs` – provider, model_name, temperature, tokens, API base, secret ref
- `capabilities` – name, description, tool_config JSONB
- `rag_indexes` – name, description, embedding model, service URL, secret ref
- `agent_llm_map` – agent ↔ LLM config
- `agent_capabilities_map` – agent ↔ capabilities
- `agent_rag_map` – agent ↔ rag indexes

---

### **5. Example Agent Config JSON**
```json
{
  "id": "a3e2a4cb-7e22-4f52-9ad1-a3c77bae9200",
  "name": "Research & Image Analysis Agent",
  "description": "Handles KB queries with RAG + interprets images.",
  "status": "active",
  "llm_config": {
    "provider": "azure_openai",
    "model_name": "gpt-5-chat",
    "temperature": 0.2,
    "max_tokens": 3000,
    "api_base": "https://my-aoai-resource.openai.azure.com/",
    "api_key_secret_ref": "secret://azure/keyvault/openai-api-key"
  },
  "capabilities": [
    { "name": "rag", "tool_config": {"top_k": 5} },
    { "name": "vision", "tool_config": {"enable_ocr": true} }
  ],
  "rag_indexes": [
    { "name": "company-knowledge-base", "embedding_model": "text-embedding-ada-002" }
  ]
}
```

---

### **6. Engineering Backlog (Week‑by‑Week)**
- **Week 1‑2**: Backend + frontend setup, Azure Postgres, minimal LLM chat
- **Week 3‑4**: Orchestrator + Agent Manager (Admin UI)
- **Week 5‑6**: RAG Agent (Azure Cognitive Search integration)
- **Week 7‑8**: Multimodal file/image/doc understanding
- **Week 9‑10**: Chart, graph, and document generation
- **Week 11**: Web search agent
- **Week 12+**: Enhancements, scaling, RBAC

---

### **7. Tech Stack**
- **Frontend**: Next.js, TailwindCSS
- **Backend**: FastAPI or NestJS
- **LLM**: Azure OpenAI GPT‑4o / GPT‑5‑chat
- **Vector DB**: Azure Cognitive Search
- **DB**: Azure PostgreSQL
- **Storage**: Azure Blob Storage