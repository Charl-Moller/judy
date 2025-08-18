from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

# ============================================================================
# BASE WORKFLOW SCHEMAS
# ============================================================================

class WorkflowNode(BaseModel):
    """Workflow node schema"""
    id: str
    type: str
    position: Dict[str, float]
    data: Dict[str, Any]

class WorkflowConnection(BaseModel):
    """Workflow connection schema"""
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    type: str = "data"
    dataType: Optional[str] = None

# ============================================================================
# WORKFLOW CRUD SCHEMAS
# ============================================================================

class WorkflowCreate(BaseModel):
    """Schema for creating a new workflow"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    version: str = "1.0.0"
    nodes: List[WorkflowNode]
    connections: List[WorkflowConnection]
    workflow_metadata: Optional[Dict[str, Any]] = {}
    tags: Optional[List[str]] = []
    owner_id: Optional[str] = None
    is_public: bool = False
    status: str = "draft"
    is_template: bool = False

class WorkflowUpdate(BaseModel):
    """Schema for updating a workflow"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    version: Optional[str] = None
    nodes: Optional[List[WorkflowNode]] = None
    connections: Optional[List[WorkflowConnection]] = None
    workflow_metadata: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    status: Optional[str] = None
    is_template: Optional[bool] = None

class WorkflowResponse(BaseModel):
    """Schema for workflow response"""
    id: uuid.UUID
    name: str
    description: Optional[str]
    version: str
    nodes: List[WorkflowNode]
    connections: List[WorkflowConnection]
    workflow_metadata: Dict[str, Any]
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

    class Config:
        from_attributes = True

class WorkflowListResponse(BaseModel):
    """Schema for workflow list response"""
    workflows: List[WorkflowResponse]
    total: int
    skip: int
    limit: int

# ============================================================================
# WORKFLOW EXECUTION SCHEMAS
# ============================================================================

class WorkflowExecutionCreate(BaseModel):
    """Schema for creating a workflow execution"""
    session_id: str
    input_data: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, Any]]] = None
    memory_context: Optional[Dict[str, Any]] = None

class WorkflowExecutionResponse(BaseModel):
    """Schema for workflow execution response"""
    id: uuid.UUID
    workflow_id: uuid.UUID
    session_id: str
    input_data: Optional[Dict[str, Any]]
    output_data: Optional[Dict[str, Any]]
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    execution_time_ms: Optional[int]
    memory_usage_mb: Optional[int]
    conversation_history: Optional[List[Dict[str, Any]]]
    memory_context: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True

# ============================================================================
# WORKFLOW TEMPLATE SCHEMAS
# ============================================================================

class WorkflowTemplateResponse(BaseModel):
    """Schema for workflow template response"""
    id: uuid.UUID
    name: str
    description: Optional[str]
    category: str
    nodes: List[WorkflowNode]
    connections: List[WorkflowConnection]
    template_metadata: Dict[str, Any]
    usage_count: int
    rating: int
    rating_count: int
    is_public: bool
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============================================================================
# WORKFLOW STATISTICS SCHEMAS
# ============================================================================

class WorkflowStats(BaseModel):
    """Schema for workflow statistics"""
    total_workflows: int
    active_workflows: int
    total_executions: int
    successful_executions: int
    failed_executions: int
    avg_execution_time_ms: Optional[float]
    total_memory_usage_mb: Optional[float]

class WorkflowCategoryStats(BaseModel):
    """Schema for workflow category statistics"""
    category: str
    count: int
    avg_rating: float
    total_usage: int

# ============================================================================
# WORKFLOW IMPORT/EXPORT SCHEMAS
# ============================================================================

class WorkflowExport(BaseModel):
    """Schema for exporting a workflow"""
    name: str
    description: Optional[str]
    version: str
    nodes: List[WorkflowNode]
    connections: List[WorkflowConnection]
    workflow_metadata: Dict[str, Any]
    tags: List[str]
    export_date: datetime
    export_version: str = "1.0"

class WorkflowImport(BaseModel):
    """Schema for importing a workflow"""
    workflow: WorkflowExport
    import_options: Optional[Dict[str, Any]] = {}
