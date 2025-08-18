from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime

class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class RoutingRule(BaseSchema):
    """Defines how to route requests to specific agents"""
    name: str
    description: str
    keywords: List[str] = Field(description="Keywords that trigger this rule")
    agent_capabilities: List[str] = Field(description="Required capabilities for the agent")
    priority: int = Field(default=1, description="Higher priority rules are checked first")
    fallback_agent_id: Optional[str] = Field(default=None, description="Fallback agent if no suitable agent found")
    response_template: Optional[str] = Field(default=None, description="Template for response formatting")

class ToolCoordination(BaseSchema):
    """Defines how tools work together"""
    enable_chaining: bool = Field(default=True, description="Allow tools to call other tools")
    max_chain_length: int = Field(default=3, description="Maximum number of tool calls in a chain")
    tool_dependencies: Dict[str, List[str]] = Field(default_factory=dict, description="Tool dependencies")
    execution_order: List[str] = Field(default_factory=list, description="Preferred execution order")

class ResponseTemplate(BaseSchema):
    """Template for formatting responses"""
    name: str
    description: str
    template: str = Field(description="Template string with placeholders")
    placeholders: List[str] = Field(default_factory=list, description="Available placeholders")
    format_type: str = Field(default="text", description="text, markdown, html, json")

class OrchestratorConfigCreate(BaseSchema):
    name: str
    description: Optional[str] = None
    routing_rules: List[RoutingRule] = Field(default_factory=list)
    default_agent_id: Optional[UUID] = None
    orchestrator_llm_id: Optional[UUID] = None  # Add LLM configuration for orchestrator
    tool_coordination: ToolCoordination = Field(default_factory=ToolCoordination)
    response_templates: List[ResponseTemplate] = Field(default_factory=list)
    max_agent_calls: int = Field(default=3, ge=1, le=10)
    enable_tool_chaining: bool = True

class OrchestratorConfigUpdate(BaseSchema):
    name: Optional[str] = None
    description: Optional[str] = None
    routing_rules: Optional[List[RoutingRule]] = None
    default_agent_id: Optional[UUID] = None
    orchestrator_llm_id: Optional[UUID] = None  # Add LLM configuration for orchestrator
    tool_coordination: Optional[ToolCoordination] = None
    response_templates: Optional[List[ResponseTemplate]] = None
    max_agent_calls: Optional[int] = Field(None, ge=1, le=10)
    enable_tool_chaining: Optional[bool] = None

class OrchestratorConfigResponse(BaseSchema):
    id: str
    name: str
    description: Optional[str] = None
    routing_rules: List[RoutingRule]
    default_agent_id: Optional[UUID] = None
    orchestrator_llm_id: Optional[UUID] = None  # Add LLM configuration for orchestrator
    tool_coordination: ToolCoordination
    response_templates: List[ResponseTemplate]
    max_agent_calls: int
    enable_tool_chaining: bool
    created_at: datetime
    updated_at: datetime
