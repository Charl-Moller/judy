from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models
from ..schemas.agent import AgentCreate, AgentUpdate, AgentOut
from uuid import UUID

router = APIRouter(prefix="/agents", tags=["Agents"])

@router.get("", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(models.Agent).all()
    return agents

@router.post("", response_model=AgentOut)
def create_agent(payload: AgentCreate, db: Session = Depends(get_db)):
    try:
        llm_config_uuid = UUID(payload.llm_config_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid llm_config_id format")
    
    llm = db.query(models.LLMConfig).filter(models.LLMConfig.id == llm_config_uuid).first()
    if not llm:
        raise HTTPException(status_code=400, detail="Invalid llm_config_id")
    
    agent = models.Agent(name=payload.name, description=payload.description, llm_config_id=llm.id)
    
    if payload.capabilities:
        try:
            capability_uuids = [UUID(cap_id) for cap_id in payload.capabilities]
            caps = db.query(models.Capability).filter(models.Capability.id.in_(capability_uuids)).all()
            agent.capabilities = caps
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid capability ID format")
    
    if payload.rag_indexes:
        try:
            rag_uuids = [UUID(rag_id) for rag_id in payload.rag_indexes]
            rags = db.query(models.RAGIndex).filter(models.RAGIndex.id.in_(rag_uuids)).all()
            agent.rag_indexes = rags
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid RAG index ID format")
    
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent

@router.get("/{id}", response_model=AgentOut)
def get_agent(id: str, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.put("/{id}", response_model=AgentOut)
def update_agent(id: str, payload: AgentUpdate, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if payload.name is not None:
        agent.name = payload.name
    if payload.description is not None:
        agent.description = payload.description
    if payload.llm_config_id is not None:
        try:
            llm_config_uuid = UUID(payload.llm_config_id)
            llm = db.query(models.LLMConfig).filter(models.LLMConfig.id == llm_config_uuid).first()
            if not llm:
                raise HTTPException(status_code=400, detail="Invalid llm_config_id")
            agent.llm_config_id = llm.id
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid llm_config_id format")
    
    if payload.capabilities is not None:
        try:
            capability_uuids = [UUID(cap_id) for cap_id in payload.capabilities]
            caps = db.query(models.Capability).filter(models.Capability.id.in_(capability_uuids)).all()
            agent.capabilities = caps
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid capability ID format")
    
    if payload.rag_indexes is not None:
        try:
            rag_uuids = [UUID(rag_id) for rag_id in payload.rag_indexes]
            rags = db.query(models.RAGIndex).filter(models.RAGIndex.id.in_(rag_uuids)).all()
            agent.rag_indexes = rags
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid RAG index ID format")
    db.commit()
    db.refresh(agent)
    return agent

@router.delete("/{id}")
def delete_agent(id: str, db: Session = Depends(get_db)):
    agent = db.query(models.Agent).filter(models.Agent.id == id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()
    return {"message": f"Agent {id} deleted"}