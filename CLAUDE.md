# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Backend
- **Install dependencies**: `npm install` or `pip install -r requirements.txt` (depending on service language)
- **Run backend locally** (example if Node.js): `npm run dev` or with FastAPI: `uvicorn app:app --reload`
- **Run lint**: `npm run lint` or `ruff check .`
- **Run tests**: `npm test` or `pytest`
- **Run a single test** (Jest): `npm test -- <test-name>` or (pytest): `pytest -k <test-name>`

### Frontend
- **Install dependencies**: `npm install`
- **Run development server**: `npm run dev`
- **Build for production**: `npm run build`
- **Run lint**: `npm run lint`
- **Run tests**: `npm test`

## Architecture Overview

This project will implement a **multi-agent AI assistant** with:
- **Frontend**: Minimal chat interface with file upload support (React/Next.js) and an **Admin UI** for managing agents.
- **Backend**: Orchestrator-driven architecture using **OpenAI Agent SDK** with Azure OpenAI models.
- **Database**: Azure-hosted PostgreSQL for storing agent configurations, conversation history, and file metadata.
- **Vector Store**: Azure Cognitive Search for RAG operations, storing embeddings from Azure OpenAI.
- **Storage**: Azure Blob Storage for uploaded and generated files.

### Core Backend Components
1. **API Gateway** – Authentication, request routing between frontend and orchestrator.
2. **Orchestrator** – Determines intent, selects relevant agent(s), executes in sequence or parallel.
3. **Agent Manager Service** – Stores and serves definitions/configurations for agents (LLM settings, capabilities, RAG indexes, etc.).
4. **Specialized Agents** – Implemented via OpenAI Agent SDK:
   - RAG Agent (Azure Cognitive Search)
   - Multimodal LLM Agent (Azure GPT‑4o / GPT‑5‑chat) for images & docs
   - Spreadsheet Analysis Agent
   - Data Visualization Agents (Charts, Graphs)
   - Document Generation Agents (Word, Excel)
   - Web Search Agent

### Admin Interface Features
- Create, edit, delete agents
- Assign LLM settings from Azure OpenAI
- Attach capabilities
- Link Azure Cognitive Search RAG indexes
- All persisted to Azure Postgres

### Typical Flow (Example: "Analyze this spreadsheet and make a chart")
1. User uploads `.xlsx` → API Gateway → Orchestrator.
2. File type = spreadsheet → Intent = Data Analysis Visualization.
3. Orchestrator selects Spreadsheet Agent + Chart Agent.
4. Spreadsheet Agent parses file, summarizes with LLM.
5. Chart Agent generates visualization.
6. Aggregated result returned to frontend.

### Key Tech Stack
- **Frontend**: Next.js, TailwindCSS
- **Backend**: FastAPI or NestJS
- **LLM**: Azure OpenAI GPT‑4o / GPT‑5‑chat
- **RAG**: Azure Cognitive Search
- **DB**: Azure PostgreSQL
- **Storage**: Azure Blob Storage