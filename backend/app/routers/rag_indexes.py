from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models

router = APIRouter(prefix="/rag-indexes", tags=["RAG Indexes"])

@router.get("")
def list_rag_indexes(db: Session = Depends(get_db)):
    return db.query(models.RAGIndex).all()

@router.get("/{index_id}")
def get_rag_index(index_id: str, db: Session = Depends(get_db)):
    rag_index = db.query(models.RAGIndex).filter(models.RAGIndex.id == index_id).first()
    if not rag_index:
        raise HTTPException(status_code=404, detail="RAG index not found")
    return rag_index

@router.post("")
def create_rag_index(payload: dict, db: Session = Depends(get_db)):
    required = ["name", "description", "embedding_model", "search_service_url"]
    for r in required:
        if r not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")
    
    rag_index = models.RAGIndex(
        name=payload["name"],
        description=payload["description"],
        embedding_model=payload["embedding_model"],
        search_service_url=payload["search_service_url"],
        api_key_secret_ref=payload.get("api_key_secret_ref")
    )
    db.add(rag_index)
    db.commit()
    db.refresh(rag_index)
    return rag_index

@router.put("/{index_id}")
def update_rag_index(index_id: str, payload: dict, db: Session = Depends(get_db)):
    rag_index = db.query(models.RAGIndex).filter(models.RAGIndex.id == index_id).first()
    if not rag_index:
        raise HTTPException(status_code=404, detail="RAG index not found")
    
    # Update fields
    if "name" in payload:
        rag_index.name = payload["name"]
    if "description" in payload:
        rag_index.description = payload["description"]
    if "embedding_model" in payload:
        rag_index.embedding_model = payload["embedding_model"]
    if "search_service_url" in payload:
        rag_index.search_service_url = payload["search_service_url"]
    if "api_key_secret_ref" in payload:
        rag_index.api_key_secret_ref = payload["api_key_secret_ref"]
    
    db.commit()
    db.refresh(rag_index)
    return rag_index

@router.delete("/{index_id}")
def delete_rag_index(index_id: str, db: Session = Depends(get_db)):
    rag_index = db.query(models.RAGIndex).filter(models.RAGIndex.id == index_id).first()
    if not rag_index:
        raise HTTPException(status_code=404, detail="RAG index not found")
    
    db.delete(rag_index)
    db.commit()
    return {"message": "RAG index deleted successfully"}

@router.post("/{rag_index_id}/duplicate")
def duplicate_rag_index(rag_index_id: str, payload: dict, db: Session = Depends(get_db)):
    """Duplicate an existing RAG index with a new name"""
    # Get the original RAG index
    original = db.query(models.RAGIndex).filter(models.RAGIndex.id == rag_index_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="RAG index not found")
    
    # Check if new name is provided
    if "name" not in payload:
        raise HTTPException(status_code=400, detail="New name is required for duplication")
    
    # Create a copy with new name
    duplicate = models.RAGIndex(
        name=payload["name"],
        description=original.description,
        embedding_model=original.embedding_model,
        search_service_url=original.search_service_url,
        api_key_secret_ref=original.api_key_secret_ref
    )
    
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    
    return duplicate