from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models

router = APIRouter(prefix="/rag-indexes", tags=["RAG Indexes"])

@router.get("")
def list_rag_indexes(db: Session = Depends(get_db)):
    return db.query(models.RAGIndex).all()

@router.post("")
def create_rag_index(payload: dict, db: Session = Depends(get_db)):
    rag = models.RAGIndex(
        name=payload.get("name"),
        description=payload.get("description"),
        embedding_model=payload.get("embedding_model"),
        search_service_url=payload.get("search_service_url"),
        api_key_secret_ref=payload.get("api_key_secret_ref"),
    )
    db.add(rag)
    db.commit()
    db.refresh(rag)
    return rag