from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any
from uuid import UUID

class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class ChatRequest(BaseSchema):
    session_id: Optional[str] = None
    message: Optional[str] = None
    files: Optional[List[UUID]] = None
    agent_id: Optional[UUID] = None

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