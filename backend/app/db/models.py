from sqlalchemy import Column, String, Text, Enum, ForeignKey, Table, JSON, DateTime, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
import uuid
from datetime import datetime

from .database import Base

class AgentStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"

# Association tables
agent_capabilities_map = Table(
    "agent_capabilities_map", Base.metadata,
    Column("agent_id", UUID(as_uuid=True), ForeignKey("agents.id")),
    Column("capability_id", UUID(as_uuid=True), ForeignKey("capabilities.id"))
)

agent_rag_map = Table(
    "agent_rag_map", Base.metadata,
    Column("agent_id", UUID(as_uuid=True), ForeignKey("agents.id")),
    Column("rag_index_id", UUID(as_uuid=True), ForeignKey("rag_indexes.id"))
)

class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    system_prompt = Column(Text)  # Custom system prompt for the agent
    status = Column(Enum(AgentStatus), default=AgentStatus.active)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    llm_config_id = Column(UUID(as_uuid=True), ForeignKey("llm_configs.id"))
    llm_config = relationship("LLMConfig")

    capabilities = relationship("Capability", secondary=agent_capabilities_map)
    rag_indexes = relationship("RAGIndex", secondary=agent_rag_map)

class LLMConfig(Base):
    __tablename__ = "llm_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    temperature = Column(String)
    max_tokens = Column(String)
    api_base = Column(String)
    api_key_secret_ref = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Capability(Base):
    __tablename__ = "capabilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    tool_config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

class RAGIndex(Base):
    __tablename__ = "rag_indexes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    embedding_model = Column(String)
    search_service_url = Column(String)
    api_key_secret_ref = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class File(Base):
    __tablename__ = "files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    content_type = Column(String)
    size = Column(Integer)
    url = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class MCPServerStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive" 
    error = "error"
    connecting = "connecting"

class MCPTransportType(str, enum.Enum):
    sse = "sse"
    stdio = "stdio"
    http = "http"

class MCPServer(Base):
    __tablename__ = "mcp_servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    transport = Column(Enum(MCPTransportType), nullable=False)
    url = Column(String)  # For SSE and HTTP transports
    command = Column(String)  # For stdio transport
    auth_token = Column(String)  # Optional authentication token
    status = Column(Enum(MCPServerStatus), default=MCPServerStatus.inactive)
    tools_count = Column(Integer, default=0)
    error_message = Column(Text)
    last_connected_at = Column(DateTime)
    tools_discovered_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow)


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" | "assistant" | "system"
    content = Column(Text, nullable=False)
    attachments = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class AgentPipeline(Base):
    __tablename__ = "agent_pipelines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    child_agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    order = Column(Integer, default=0)


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    status = Column(String, default="running")  # running | success | failed
    error_message = Column(Text)


class OrchestratorConfig(Base):
    __tablename__ = "orchestrator_configs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, default="Default Orchestrator")
    description = Column(Text)
    
    # Routing configuration
    routing_rules = Column(JSON, default=list)  # List of routing rules
    default_agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    orchestrator_llm_id = Column(UUID(as_uuid=True), ForeignKey("llm_configs.id"), nullable=True)  # LLM for orchestrator
    
    # Tool coordination
    tool_coordination = Column(JSON, default=dict)  # How tools work together
    response_templates = Column(JSON, default=dict)  # Response formatting templates
    
    # Execution settings
    max_agent_calls = Column(Integer, default=3)  # Max agents to call in sequence
    enable_tool_chaining = Column(Boolean, default=True)  # Allow tools to call other tools
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    default_agent = relationship("Agent", foreign_keys=[default_agent_id])
    orchestrator_llm = relationship("LLMConfig", foreign_keys=[orchestrator_llm_id])


# ============================================================================
# WORKFLOW STORAGE MODELS
# ============================================================================

class Workflow(Base):
    __tablename__ = "workflows"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    version = Column(String, default="1.0.0")
    
    # Workflow graph data (JSONB for PostgreSQL performance)
    nodes = Column(JSON, nullable=False)  # Array of workflow nodes
    connections = Column(JSON, nullable=False)  # Array of workflow connections
    
    # Metadata
    workflow_metadata = Column(JSON, default=dict)  # Additional workflow metadata
    tags = Column(JSON, default=list)  # Workflow tags for organization
    
    # Ownership and access control
    owner_id = Column(String, nullable=True)  # Azure AD user ID or email
    is_public = Column(Boolean, default=False)  # Public workflows can be viewed by others
    
    # Status and lifecycle
    status = Column(String, default="draft")  # draft, active, archived, deleted
    is_template = Column(Boolean, default=False)  # Can be used as template for new workflows
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_executed_at = Column(DateTime, nullable=True)
    
    # Execution statistics
    execution_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    avg_execution_time = Column(Integer, nullable=True)  # in milliseconds


class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    
    # Execution details
    session_id = Column(String, nullable=False)  # Unique execution session
    input_data = Column(JSON, nullable=True)  # Input data for the workflow
    output_data = Column(JSON, nullable=True)  # Output data from the workflow
    
    # Execution status
    status = Column(String, default="running")  # running, completed, failed, cancelled
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Performance metrics
    execution_time_ms = Column(Integer, nullable=True)  # Total execution time
    memory_usage_mb = Column(Integer, nullable=True)  # Memory usage during execution
    
    # Memory context
    conversation_history = Column(JSON, nullable=True)  # Conversation history for memory
    memory_context = Column(JSON, nullable=True)  # Additional memory context
    
    # Relationships
    workflow = relationship("Workflow", back_populates="executions")


class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, default="general")  # ai_chat, data_processing, image_analysis, etc.
    
    # Template data
    nodes = Column(JSON, nullable=False)  # Template node structure
    connections = Column(JSON, nullable=False)  # Template connection structure
    template_metadata = Column(JSON, default=dict)  # Template metadata
    
    # Usage statistics
    usage_count = Column(Integer, default=0)
    rating = Column(Integer, default=0)  # 1-5 rating
    rating_count = Column(Integer, default=0)
    
    # Access control
    is_public = Column(Boolean, default=True)
    created_by = Column(String, nullable=True)  # Creator's user ID
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Add back-reference relationships
Workflow.executions = relationship("WorkflowExecution", back_populates="workflow")


# ============================================================================
# AGENT BUILDER STORAGE MODELS
# ============================================================================

class AgentBuilder(Base):
    __tablename__ = "agent_builders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    version = Column(String, default="1.0.0")
    
    # Agent graph data (JSONB for PostgreSQL performance)
    nodes = Column(JSON, nullable=False)  # Array of agent nodes
    connections = Column(JSON, nullable=False)  # Array of agent connections
    
    # Metadata
    agent_metadata = Column(JSON, default=dict)  # Additional agent metadata
    tags = Column(JSON, default=list)  # Agent tags for organization
    
    # Ownership and access control
    owner_id = Column(String, nullable=True)  # Azure AD user ID or email
    is_public = Column(Boolean, default=False)  # Public agents can be viewed by others
    
    # Status and lifecycle
    status = Column(String, default="draft")  # draft, active, archived, deleted
    is_template = Column(Boolean, default=False)  # Can be used as template for new agents
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_executed_at = Column(DateTime, nullable=True)
    
    # Execution statistics
    execution_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    avg_execution_time = Column(Integer, nullable=True)  # in milliseconds


class AgentExecution(Base):
    __tablename__ = "agent_executions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agent_builders.id"), nullable=False)
    
    # Execution details
    session_id = Column(String, nullable=False)  # Unique execution session
    input_data = Column(JSON, nullable=True)  # Input data for the agent
    output_data = Column(JSON, nullable=True)  # Output data from the agent
    
    # Execution status
    status = Column(String, default="running")  # running, completed, failed, cancelled
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Performance metrics
    execution_time_ms = Column(Integer, nullable=True)  # Total execution time
    memory_usage_mb = Column(Integer, nullable=True)  # Memory usage during execution
    
    # Memory context
    conversation_history = Column(JSON, nullable=True)  # Conversation history for memory
    memory_context = Column(JSON, nullable=True)  # Additional memory context
    
    # Relationships
    agent = relationship("AgentBuilder", back_populates="executions")


class AgentTemplate(Base):
    __tablename__ = "agent_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, default="general")  # ai_chat, data_processing, image_analysis, etc.
    
    # Template data
    nodes = Column(JSON, nullable=False)  # Template node structure
    connections = Column(JSON, nullable=False)  # Template connection structure
    template_metadata = Column(JSON, default=dict)  # Template metadata
    
    # Usage statistics
    usage_count = Column(Integer, default=0)
    rating = Column(Integer, default=0)  # 1-5 rating
    rating_count = Column(Integer, default=0)
    
    # Access control
    is_public = Column(Boolean, default=True)
    created_by = Column(String, nullable=True)  # Creator's user ID
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Add back-reference relationships for agent builder
AgentBuilder.executions = relationship("AgentExecution", back_populates="agent")


# ============================================================================
# TOOL MANAGEMENT MODELS
# ============================================================================

class ToolCategory(Base):
    __tablename__ = "tool_categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text)
    icon = Column(String)  # Icon name or emoji for UI
    color = Column(String)  # Hex color code for UI theming
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Tool(Base):
    __tablename__ = "tools"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)  # Function name
    display_name = Column(String, nullable=False)  # Human-readable name
    description = Column(Text, nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("tool_categories.id"), nullable=False)
    
    # Tool configuration
    parameters = Column(JSON, nullable=False)  # Parameter definitions
    parameter_schema = Column(JSON)  # JSON schema for validation
    examples = Column(JSON, default=list)  # Usage examples
    
    # Tool metadata
    is_active = Column(Boolean, default=True)
    is_builtin = Column(Boolean, default=True)  # Built-in vs custom tools
    version = Column(String, default="1.0.0")
    
    # Usage statistics
    usage_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    avg_execution_time_ms = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    category = relationship("ToolCategory", backref="tools")


class CustomTool(Base):
    __tablename__ = "custom_tools"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("tool_categories.id"), nullable=False)
    
    # Custom tool code
    source_code = Column(Text, nullable=False)  # Python function source code
    requirements = Column(JSON, default=list)  # Python dependencies
    
    # Configuration
    parameters = Column(JSON, nullable=False)  # Parameter definitions
    parameter_schema = Column(JSON)  # JSON schema for validation
    examples = Column(JSON, default=list)  # Usage examples
    
    # Tool metadata
    is_active = Column(Boolean, default=True)
    version = Column(String, default="1.0.0")
    created_by = Column(String, nullable=True)  # Creator's user ID
    
    # Usage statistics
    usage_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    avg_execution_time_ms = Column(Integer, nullable=True)
    
    # Security and validation
    is_validated = Column(Boolean, default=False)
    validation_errors = Column(JSON, default=list)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    category = relationship("ToolCategory")


# Association table for capability-tools relationship
capability_tools_map = Table(
    "capability_tools_map", Base.metadata,
    Column("capability_id", UUID(as_uuid=True), ForeignKey("capabilities.id")),
    Column("tool_id", UUID(as_uuid=True), ForeignKey("tools.id"))
)

# Update Capability model to include tools relationship
Capability.tools = relationship("Tool", secondary=capability_tools_map, backref="capabilities")