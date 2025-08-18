from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models
from ..schemas.orchestrator import OrchestratorConfigCreate, OrchestratorConfigUpdate, OrchestratorConfigResponse
import json
from typing import List

router = APIRouter(prefix="/orchestrator", tags=["Orchestrator"])

@router.get("", response_model=List[OrchestratorConfigResponse])
def list_orchestrator_configs(db: Session = Depends(get_db)):
    """List all orchestrator configurations"""
    configs = db.query(models.OrchestratorConfig).all()
    return configs

@router.get("/{config_id}", response_model=OrchestratorConfigResponse)
def get_orchestrator_config(config_id: str, db: Session = Depends(get_db)):
    """Get a specific orchestrator configuration"""
    config = db.query(models.OrchestratorConfig).filter(models.OrchestratorConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Orchestrator config not found")
    return config

@router.post("", response_model=OrchestratorConfigResponse)
def create_orchestrator_config(payload: OrchestratorConfigCreate, db: Session = Depends(get_db)):
    """Create a new orchestrator configuration"""
    config = models.OrchestratorConfig(
        name=payload.name,
        description=payload.description,
        routing_rules=payload.routing_rules,
        default_agent_id=payload.default_agent_id,
        orchestrator_llm_id=payload.orchestrator_llm_id,  # Add LLM configuration
        tool_coordination=payload.tool_coordination.model_dump(),
        response_templates=payload.response_templates,
        max_agent_calls=payload.max_agent_calls,
        enable_tool_chaining=payload.enable_tool_chaining
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config

@router.put("/{config_id}", response_model=OrchestratorConfigResponse)
def update_orchestrator_config(config_id: str, payload: OrchestratorConfigUpdate, db: Session = Depends(get_db)):
    """Update an existing orchestrator configuration"""
    config = db.query(models.OrchestratorConfig).filter(models.OrchestratorConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Orchestrator config not found")
    
    if payload.name is not None:
        config.name = payload.name
    if payload.description is not None:
        config.description = payload.description
    if payload.routing_rules is not None:
        config.routing_rules = payload.routing_rules
    if payload.default_agent_id is not None:
        config.default_agent_id = payload.default_agent_id
    if payload.orchestrator_llm_id is not None:
        config.orchestrator_llm_id = payload.orchestrator_llm_id  # Add LLM configuration
    if payload.tool_coordination is not None:
        config.tool_coordination = payload.tool_coordination.model_dump()
    if payload.response_templates is not None:
        config.response_templates = payload.response_templates
    if payload.max_agent_calls is not None:
        config.max_agent_calls = payload.max_agent_calls
    if payload.enable_tool_chaining is not None:
        config.enable_tool_chaining = payload.enable_tool_chaining
    
    db.commit()
    db.refresh(config)
    return config

@router.delete("/{config_id}")
def delete_orchestrator_config(config_id: str, db: Session = Depends(get_db)):
    """Delete an orchestrator configuration"""
    config = db.query(models.OrchestratorConfig).filter(models.OrchestratorConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Orchestrator config not found")
    
    db.delete(config)
    db.commit()
    return {"message": "Orchestrator config deleted successfully"}

@router.post("/{config_id}/duplicate")
def duplicate_orchestrator_config(config_id: str, payload: dict, db: Session = Depends(get_db)):
    """Duplicate an existing orchestrator configuration"""
    original = db.query(models.OrchestratorConfig).filter(models.OrchestratorConfig.id == config_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Orchestrator config not found")
    
    if "name" not in payload:
        raise HTTPException(status_code=400, detail="New name is required for duplication")
    
    duplicate = models.OrchestratorConfig(
        name=payload["name"],
        description=f"Copy of {original.name}",
        routing_rules=original.routing_rules,
        default_agent_id=original.default_agent_id,
        orchestrator_llm_id=original.orchestrator_llm_id,  # Copy LLM configuration
        tool_coordination=original.tool_coordination,
        response_templates=original.response_templates,
        max_agent_calls=original.max_agent_calls,
        enable_tool_chaining=original.enable_tool_chaining
    )
    
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    
    return duplicate

@router.post("/{config_id}/test")
def test_orchestrator_config(config_id: str, payload: dict, db: Session = Depends(get_db)):
    """Test an orchestrator configuration with a sample message"""
    config = db.query(models.OrchestratorConfig).filter(models.OrchestratorConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Orchestrator config not found")
    
    message = payload.get("message", "test message")
    
    # Simulate routing logic
    selected_agent = None
    routing_result = None
    
    # Check routing rules - handle both dict and Pydantic model formats
    if config.routing_rules:
        # Sort rules by priority (higher priority first)
        sorted_rules = sorted(
            config.routing_rules, 
            key=lambda x: x.get('priority', 1) if isinstance(x, dict) else getattr(x, 'priority', 1), 
            reverse=True
        )
        
        for rule in sorted_rules:
            # Extract keywords and capabilities based on data type
            if isinstance(rule, dict):
                keywords = rule.get('keywords', [])
                agent_capabilities = rule.get('agent_capabilities', [])
            else:
                keywords = getattr(rule, 'keywords', [])
                agent_capabilities = getattr(rule, 'agent_capabilities', [])
            
            if any(keyword.lower() in message.lower() for keyword in keywords):
                # Find suitable agent
                agents = db.query(models.Agent).filter(models.Agent.status == "active").all()
                suitable_agents = []
                
                for agent in agents:
                    agent_caps = [cap.name for cap in agent.capabilities]
                    if all(cap in agent_caps for cap in agent_capabilities):
                        suitable_agents.append(agent)
                
                if suitable_agents:
                    selected_agent = suitable_agents[0]
                    routing_result = {
                        "rule_matched": rule.get('name', 'Unknown') if isinstance(rule, dict) else getattr(rule, 'name', 'Unknown'),
                        "agent_selected": selected_agent.name,
                        "capabilities_required": agent_capabilities,
                        "capabilities_found": [cap.name for cap in selected_agent.capabilities]
                    }
                    break
    
    return {
        "config_id": config_id,
        "test_message": message,
        "routing_result": routing_result,
        "selected_agent": selected_agent.name if selected_agent else None,
        "routing_rules_checked": len(config.routing_rules) if config.routing_rules else 0,
        "tool_coordination_enabled": config.enable_tool_chaining
    }
