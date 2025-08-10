from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models

router = APIRouter(prefix="/llm-configs", tags=["LLM Configs"])

@router.get("")
def list_llm_configs(db: Session = Depends(get_db)):
    return db.query(models.LLMConfig).all()

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