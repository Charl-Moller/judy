from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models

router = APIRouter(prefix="/capabilities", tags=["Capabilities"])

@router.get("")
def list_capabilities(db: Session = Depends(get_db)):
    return db.query(models.Capability).all()

@router.get("/{capability_id}")
def get_capability(capability_id: str, db: Session = Depends(get_db)):
    capability = db.query(models.Capability).filter(models.Capability.id == capability_id).first()
    if not capability:
        raise HTTPException(status_code=404, detail="Capability not found")
    return capability

@router.post("")
def create_capability(payload: dict, db: Session = Depends(get_db)):
    required = ["name", "description"]
    for r in required:
        if r not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")
    
    capability = models.Capability(
        name=payload["name"],
        description=payload["description"],
        tool_config=payload.get("tool_config", {})
    )
    db.add(capability)
    db.commit()
    db.refresh(capability)
    return capability

@router.put("/{capability_id}")
def update_capability(capability_id: str, payload: dict, db: Session = Depends(get_db)):
    capability = db.query(models.Capability).filter(models.Capability.id == capability_id).first()
    if not capability:
        raise HTTPException(status_code=404, detail="Capability not found")
    
    # Update fields
    if "name" in payload:
        capability.name = payload["name"]
    if "description" in payload:
        capability.description = payload["description"]
    if "tool_config" in payload:
        capability.tool_config = payload["tool_config"]
    
    db.commit()
    db.refresh(capability)
    return capability

@router.delete("/{capability_id}")
def delete_capability(capability_id: str, db: Session = Depends(get_db)):
    capability = db.query(models.Capability).filter(models.Capability.id == capability_id).first()
    if not capability:
        raise HTTPException(status_code=404, detail="Capability not found")
    
    db.delete(capability)
    db.commit()
    return {"message": "Capability deleted successfully"}

@router.post("/{capability_id}/duplicate")
def duplicate_capability(capability_id: str, payload: dict, db: Session = Depends(get_db)):
    """Duplicate an existing capability with a new name"""
    # Get the original capability
    original = db.query(models.Capability).filter(models.Capability.id == capability_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Capability not found")
    
    # Check if new name is provided
    if "name" not in payload:
        raise HTTPException(status_code=400, detail="New name is required for duplication")
    
    # Create a copy with new name
    duplicate = models.Capability(
        name=payload["name"],
        description=original.description,
        tool_config=original.tool_config
    )
    
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    
    return duplicate