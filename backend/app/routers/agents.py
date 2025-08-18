from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..db.database import get_db
from ..db import models
import uuid

router = APIRouter(prefix="/agents", tags=["Agents"])

@router.get("")
def list_agents(db: Session = Depends(get_db)):
    return db.query(models.Agent).options(
        joinedload(models.Agent.llm_config),
        joinedload(models.Agent.capabilities),
        joinedload(models.Agent.rag_indexes)
    ).all()

@router.get("/{agent_id}")
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).options(
        joinedload(models.Agent.llm_config),
        joinedload(models.Agent.capabilities),
        joinedload(models.Agent.rag_indexes)
    ).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.post("")
def create_agent(payload: dict, db: Session = Depends(get_db)):
    required = ["name", "llm_config_id"]
    for r in required:
        if r not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")
    
    # Validate LLM config exists
    llm_config = db.query(models.LLMConfig).filter(models.LLMConfig.id == payload["llm_config_id"]).first()
    if not llm_config:
        raise HTTPException(status_code=400, detail="LLM config not found")
    
    agent = models.Agent(
        name=payload["name"],
        description=payload.get("description"),
        system_prompt=payload.get("system_prompt"),
        llm_config_id=payload["llm_config_id"],
        status=payload.get("status", "active")
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    # Add capabilities if provided
    if payload.get("capabilities"):
        for cap_id in payload["capabilities"]:
            capability = db.query(models.Capability).filter(models.Capability.id == cap_id).first()
            if capability:
                agent.capabilities.append(capability)
    
    # Add RAG indexes if provided
    if payload.get("rag_indexes"):
        for rag_id in payload["rag_indexes"]:
            rag_index = db.query(models.RAGIndex).filter(models.RAGIndex.id == rag_id).first()
            if rag_index:
                agent.rag_indexes.append(rag_index)
    
    db.commit()
    db.refresh(agent)
    
    # Reload agent with relationships
    agent = db.query(models.Agent).options(
        joinedload(models.Agent.llm_config),
        joinedload(models.Agent.capabilities),
        joinedload(models.Agent.rag_indexes)
    ).filter(models.Agent.id == agent.id).first()
    
    return agent

@router.put("/{agent_id}")
def update_agent(agent_id: str, payload: dict, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Update basic fields
    if "name" in payload:
        agent.name = payload["name"]
    if "description" in payload:
        agent.description = payload["description"]
    if "system_prompt" in payload:
        agent.system_prompt = payload["system_prompt"]
    if "status" in payload:
        agent.status = payload["status"]
    
    # Update LLM config if provided
    if "llm_config_id" in payload:
        llm_config = db.query(models.LLMConfig).filter(models.LLMConfig.id == payload["llm_config_id"]).first()
        if not llm_config:
            raise HTTPException(status_code=400, detail="LLM config not found")
        agent.llm_config_id = payload["llm_config_id"]
    
    # Update capabilities if provided
    if "capabilities" in payload:
        agent.capabilities.clear()
        for cap_id in payload["capabilities"]:
            capability = db.query(models.Capability).filter(models.Capability.id == cap_id).first()
            if capability:
                agent.capabilities.append(capability)
    
    # Update RAG indexes if provided
    if "rag_indexes" in payload:
        agent.rag_indexes.clear()
        for rag_id in payload["rag_indexes"]:
            rag_index = db.query(models.RAGIndex).filter(models.RAGIndex.id == rag_id).first()
            if rag_index:
                agent.rag_indexes.append(rag_index)
    
    db.commit()
    db.refresh(agent)
    return agent

@router.delete("/{agent_id}")
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    db.delete(agent)
    db.commit()
    return {"message": "Agent deleted successfully"}

@router.post("/{agent_id}/duplicate")
def duplicate_agent(agent_id: str, payload: dict, db: Session = Depends(get_db)):
    """Duplicate an existing agent with a new name"""
    # Get the original agent with relationships loaded
    original = db.query(models.Agent).options(
        joinedload(models.Agent.llm_config),
        joinedload(models.Agent.capabilities),
        joinedload(models.Agent.rag_indexes)
    ).filter(models.Agent.id == agent_id).first()
    
    if not original:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check if new name is provided
    if "name" not in payload:
        raise HTTPException(status_code=400, detail="New name is required for duplication")
    
    # Create a copy with new name
    duplicate = models.Agent(
        name=payload["name"],
        description=payload.get("description", f"Copy of {original.name}"),
        system_prompt=original.system_prompt,  # Copy the system prompt
        status=payload.get("status", "active"),
        llm_config_id=original.llm_config_id
    )
    
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    
    # Copy capabilities
    if original.capabilities:
        for capability in original.capabilities:
            duplicate.capabilities.append(capability)
    
    # Copy RAG indexes
    if original.rag_indexes:
        for rag_index in original.rag_indexes:
            duplicate.rag_indexes.append(rag_index)
    
    db.commit()
    
    # Reload agent with relationships
    duplicate = db.query(models.Agent).options(
        joinedload(models.Agent.llm_config),
        joinedload(models.Agent.capabilities),
        joinedload(models.Agent.rag_indexes)
    ).filter(models.Agent.id == duplicate.id).first()
    
    return duplicate