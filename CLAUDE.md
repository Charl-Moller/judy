# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Backend (FastAPI)
- **Install dependencies**: `pip install -r requirements.txt`
- **Run backend locally**: `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- **Run lint**: `ruff check .` (if ruff is installed)
- **Run tests**: `pytest` (when test suite is added)
- **Database migrations**: Run scripts in `backend/scripts/` directory

### Frontend (Next.js)
- **Install dependencies**: `npm install`
- **Run development server**: `npm run dev` (starts on port 3000)
- **Build for production**: `npm run build`
- **Run lint**: `npm run lint`
- **Run tests**: `npm test` (when test suite is added)

## Architecture Overview

This is a **multi-agent AI assistant platform** with visual workflow builder and conversational interface:

### High-Level Architecture
- **Frontend**: Next.js + React + TailwindCSS with visual canvas builder using ReactFlow
- **Backend**: FastAPI with SQLAlchemy ORM and PostgreSQL database
- **LLM Integration**: Azure OpenAI with multiple model support (GPT-4, GPT-4o, GPT-5)
- **Tool System**: Extensible tool framework with built-in and custom tools
- **Workflow Engine**: Visual drag-and-drop workflow builder with node-based execution
- **Memory System**: Shared memory service for cross-agent context retention

### Core Backend Architecture

#### Database Models (`backend/app/db/models.py`)
- **Agents**: Configurable AI agents with LLM configs and capabilities
- **Capabilities**: Modular tool attachments for agents
- **LLMConfig**: Model configurations with Azure Key Vault secret management
- **Workflows**: Visual workflow definitions with nodes and connections
- **Tools**: Built-in and custom tool management system
- **SharedMemory**: Cross-agent memory and context management

#### Services Architecture
- **Orchestrator** (`backend/app/services/orchestrator.py`): Main execution engine with tool calling
- **PersonaRouter** (`backend/app/services/persona_router.py`): Intelligent agent selection with caching
- **ToolLoader** (`backend/app/services/tool_loader.py`): Dynamic tool loading and management
- **SharedMemory** (`backend/app/services/shared_memory.py`): Cross-agent context sharing
- **CacheService** (`backend/app/services/cache_service.py`): Performance optimization layer

#### Tool System (`backend/app/services/tools/`)
Extensible tool framework supporting:
- Azure RAG search, web search, image analysis
- Chart/diagram generation, spreadsheet operations
- File operations, document generation
- HTTP requests, data processing tools

### Frontend Architecture

#### Visual Canvas Builder (`frontend/components/canvas/`)
- **AgentCanvas**: Main ReactFlow canvas with drag-and-drop interface
- **AgentNode**: Configurable node components for different agent types
- **NodeConfigPanel**: Dynamic configuration forms for each node type
- **TestPanel**: Workflow execution testing interface

#### Admin Interface (`frontend/pages/admin/`)
Comprehensive management interface:
- Agent Builder: Visual agent/workflow designer
- Agent Management: Traditional form-based agent configuration
- LLM Configs: Model settings and Azure Key Vault integration
- Tool Management: Built-in and custom tool configuration
- MCP Servers: Model Context Protocol server connections

#### Context Management (`frontend/context/`)
- **FlowContext**: ReactFlow state management
- **NodeConfigContext**: Node configuration state
- **ExecutionContext**: Workflow execution state

### Key Execution Flows

#### Visual Workflow Execution
1. User creates workflow on visual canvas
2. Workflow nodes are validated and connected
3. Execution engine processes workflow graph
4. Tools are dynamically loaded based on node configurations
5. Results flow through connected nodes with memory preservation

#### Agent-to-Agent Handoffs
1. PersonaRouter analyzes user input using LLM or keywords
2. Selected agent executes with configured tools and memory context
3. Shared memory service maintains context across agent switches
4. Results are aggregated and returned to user

#### Tool Integration
1. Tools are dynamically loaded based on agent capabilities
2. LLM can autonomously call tools during execution
3. Multi-strategy execution: agents retry with different approaches if first attempt fails
4. Self-correction mechanism prevents agents from making promises without execution

### Performance Optimizations

#### Caching Strategy
- Routing decisions cached for 10 minutes
- Azure Key Vault secrets cached with TTL
- LLM client instances cached per configuration
- Database query results cached where appropriate

#### Memory Management
- Conversation history with configurable context length
- Session-based memory isolation
- Cross-agent context sharing with cleanup

### Development Patterns

#### Agent Configuration
Agents support multiple configuration methods:
- Traditional database-stored agents
- Visual canvas-based workflow agents
- Hybrid approaches with shared components

#### Tool Development
Custom tools follow standard patterns:
- Function-based tools with docstring descriptions
- JSON schema parameter validation
- Async/sync execution support
- Error handling and result formatting

#### Database Operations
- Use SessionLocal() for database sessions
- Models use UUID primary keys
- Relationship management through SQLAlchemy ORM
- Migration scripts in `backend/scripts/` directory