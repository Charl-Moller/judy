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