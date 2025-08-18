from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any
from datetime import datetime
from uuid import UUID

class BaseSchema(BaseModel):
    # Allow attribute-based construction from ORM and permit fields like "model_name"
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class CapabilityRef(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    tool_config: Optional[Any]

class RAGIndexRef(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    embedding_model: Optional[str]

class LLMConfigRef(BaseSchema):
    id: UUID
    provider: str
    model_name: str
    temperature: Optional[float]
    max_tokens: Optional[int]
    api_base: Optional[str]

class AgentBase(BaseSchema):
    name: str
    description: Optional[str]
    status: Optional[str] = "active"

class AgentCreate(AgentBase):
    llm_config_id: str  # Accept string from frontend, convert to UUID in router
    capabilities: Optional[List[str]]  # Accept strings from frontend, convert to UUIDs in router
    rag_indexes: Optional[List[str]]  # Accept strings from frontend, convert to UUIDs in router

class AgentUpdate(AgentBase):
    llm_config_id: Optional[str]  # Accept string from frontend, convert to UUID in router
    capabilities: Optional[List[str]]  # Accept strings from frontend, convert to UUIDs in router
    rag_indexes: Optional[List[str]]  # Accept strings from frontend, convert to UUIDs in router

class AgentOut(AgentBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    llm_config: Optional[LLMConfigRef]
    capabilities: Optional[List[CapabilityRef]]
    rag_indexes: Optional[List[RAGIndexRef]]


# ============================================================================
# AGENT BUILDER SCHEMAS (for visual agent builder)
# ============================================================================

class AgentNode(BaseModel):
    """Agent node schema for visual builder"""
    id: str
    type: str
    position: dict
    data: dict

class AgentConnection(BaseModel):
    """Agent connection schema for visual builder"""
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    type: str = "data"
    dataType: Optional[str] = None

class AgentBuilderCreate(BaseModel):
    """Schema for creating a new visual agent"""
    name: str
    description: Optional[str] = None
    version: str = "1.0.0"
    nodes: List[AgentNode]
    connections: List[AgentConnection]
    agent_metadata: Optional[dict] = {}
    tags: Optional[List[str]] = []
    owner_id: Optional[str] = None
    is_public: bool = False
    status: str = "draft"
    is_template: bool = False

class AgentBuilderUpdate(BaseModel):
    """Schema for updating a visual agent"""
    name: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    nodes: Optional[List[AgentNode]] = None
    connections: Optional[List[AgentConnection]] = None
    agent_metadata: Optional[dict] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    status: Optional[str] = None
    is_template: Optional[bool] = None

class AgentBuilderResponse(BaseSchema):
    """Schema for visual agent response"""
    id: UUID
    name: str
    description: Optional[str]
    version: str
    nodes: List[AgentNode]
    connections: List[AgentConnection]
    agent_metadata: dict
    tags: List[str]
    owner_id: Optional[str]
    is_public: bool
    status: str
    is_template: bool
    created_at: datetime
    updated_at: datetime
    last_executed_at: Optional[datetime]
    execution_count: int
    success_count: int
    failure_count: int
    avg_execution_time: Optional[int]

class AgentBuilderListResponse(BaseModel):
    """Schema for visual agent list response"""
    agents: List[AgentBuilderResponse]
    total: int
    skip: int
    limit: int

class AgentExecutionCreate(BaseModel):
    """Schema for creating an agent execution"""
    session_id: str
    input_data: Optional[dict] = None
    conversation_history: Optional[List[dict]] = None
    memory_context: Optional[dict] = None

class AgentExecutionResponse(BaseSchema):
    """Schema for agent execution response"""
    id: UUID
    agent_id: UUID
    session_id: str
    input_data: Optional[dict]
    output_data: Optional[dict]
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    execution_time_ms: Optional[int]
    memory_usage_mb: Optional[int]
    conversation_history: Optional[List[dict]]
    memory_context: Optional[dict]

class AgentTemplateResponse(BaseSchema):
    """Schema for agent template response"""
    id: UUID
    name: str
    description: Optional[str]
    category: str
    nodes: List[AgentNode]
    connections: List[AgentConnection]
    template_metadata: dict
    usage_count: int
    rating: int
    rating_count: int
    is_public: bool
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime