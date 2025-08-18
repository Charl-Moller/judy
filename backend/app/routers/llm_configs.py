from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models

router = APIRouter(prefix="/llm-configs", tags=["LLM Configs"])

@router.get("")
def list_llm_configs(db: Session = Depends(get_db)):
    return db.query(models.LLMConfig).all()

@router.get("/{config_id}")
def get_llm_config(config_id: str, db: Session = Depends(get_db)):
    config = db.query(models.LLMConfig).filter(models.LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")
    return config

@router.post("")
def create_llm_config(payload: dict, db: Session = Depends(get_db)):
    required = ["provider", "model_name"]
    for r in required:
        if r not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")
    llm = models.LLMConfig(
        provider=payload.get("provider"),
        model_name=payload.get("model_name"),
        temperature=str(payload.get("temperature")) if payload.get("temperature") is not None else None,
        max_tokens=str(payload.get("max_tokens")) if payload.get("max_tokens") is not None else None,
        api_base=payload.get("api_base"),
        api_key_secret_ref=payload.get("api_key_secret_ref"),
    )
    db.add(llm)
    db.commit()
    db.refresh(llm)
    return llm

@router.put("/{config_id}")
def update_llm_config(config_id: str, payload: dict, db: Session = Depends(get_db)):
    config = db.query(models.LLMConfig).filter(models.LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")
    
    # Update fields
    if "provider" in payload:
        config.provider = payload["provider"]
    if "model_name" in payload:
        config.model_name = payload["model_name"]
    if "temperature" in payload:
        config.temperature = str(payload["temperature"]) if payload["temperature"] is not None else None
    if "max_tokens" in payload:
        config.max_tokens = str(payload["max_tokens"]) if payload["max_tokens"] is not None else None
    if "api_base" in payload:
        config.api_base = payload["api_base"]
    if "api_key_secret_ref" in payload:
        config.api_key_secret_ref = payload["api_key_secret_ref"]
    
    db.commit()
    db.refresh(config)
    return config

@router.delete("/{config_id}")
def delete_llm_config(config_id: str, db: Session = Depends(get_db)):
    config = db.query(models.LLMConfig).filter(models.LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")
    
    db.delete(config)
    db.commit()
    return {"message": "LLM config deleted successfully"}

@router.post("/{llm_config_id}/duplicate")
def duplicate_llm_config(llm_config_id: str, payload: dict, db: Session = Depends(get_db)):
    """Duplicate an existing LLM config"""
    # Get the original LLM config
    original = db.query(models.LLMConfig).filter(models.LLMConfig.id == llm_config_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="LLM config not found")
    
    # Create a copy (LLM configs don't have names, so we just copy all fields)
    duplicate = models.LLMConfig(
        provider=original.provider,
        model_name=original.model_name,
        temperature=original.temperature,
        max_tokens=original.max_tokens,
        api_base=original.api_base,
        api_key_secret_ref=original.api_key_secret_ref
    )
    
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    
    return duplicate