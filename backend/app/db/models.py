from sqlalchemy import Column, String, Text, Enum, ForeignKey, Table, JSON, DateTime, Integer
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