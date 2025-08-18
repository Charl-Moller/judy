from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional, Any, Union
from uuid import UUID

class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class ChatRequest(BaseSchema):
    session_id: Optional[str] = None
    message: Optional[str] = None
    files: Optional[List[UUID]] = None
    agent_id: Optional[Union[UUID, str]] = None
    
    @field_validator('agent_id')
    @classmethod
    def validate_agent_id(cls, v):
        if v is None:
            return v
        if isinstance(v, str) and v == "orchestrator":
            return v
        if isinstance(v, UUID):
            return v
        try:
            return UUID(v)
        except ValueError:
            raise ValueError('agent_id must be a valid UUID or "orchestrator"')

class Attachment(BaseSchema):
    type: str  # e.g., "chart", "image", "document", "text"
    url: Optional[str] = None
    content: Optional[str] = None

class ToolCall(BaseSchema):
    tool_name: str
    parameters: dict

class ChatResponse(BaseSchema):
    response: str
    attachments: Optional[List[Attachment]]
    tool_calls: Optional[List[ToolCall]]  # For OpenAI Agent SDK execution details