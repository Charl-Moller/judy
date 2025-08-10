from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models

router = APIRouter(prefix="/capabilities", tags=["Capabilities"])

@router.get("")
def list_capabilities(db: Session = Depends(get_db)):
    return db.query(models.Capability).all()

@router.post("")
def create_capability(payload: dict, db: Session = Depends(get_db)):
    cap = models.Capability(
        name=payload.get("name"),
        description=payload.get("description"),
        tool_config=payload.get("tool_config"),
    )
    db.add(cap)
    db.commit()
    db.refresh(cap)
    return cap