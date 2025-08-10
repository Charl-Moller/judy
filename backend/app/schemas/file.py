from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class FileUploadResponse(BaseSchema):
    file_id: UUID
    url: str
    message: Optional[str] = None

class FileMetadata(BaseSchema):
    file_id: UUID
    filename: str
    content_type: Optional[str]
    size: Optional[int]
    url: str
    uploaded_at: datetime