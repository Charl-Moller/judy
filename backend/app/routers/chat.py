from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models
from ..schemas.chat import ChatRequest, ChatResponse
from ..services.orchestrator import run_agent

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("", response_model=ChatResponse)
def chat_endpoint(payload: ChatRequest, db: Session = Depends(get_db)):
    if not payload.agent_id:
        # pick first active agent as default
        agent = db.query(models.Agent).first()
        if not agent:
            raise HTTPException(status_code=400, detail="No agents configured")
        agent_id = str(agent.id)
    else:
        agent_id = payload.agent_id
    result = run_agent(agent_id=agent_id, message=payload.message or "", files=payload.files or [], session_id=payload.session_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    # Normalize tool calls for schema
    serialized_calls = []
    for c in result.get("tool_calls", []) or []:
        serialized_calls.append({"tool_name": getattr(c, "name", "tool"), "parameters": getattr(c, "arguments", {})})
    return {
        "response": result.get("response", ""),
        "attachments": result.get("attachments", []),
        "tool_calls": serialized_calls,
    }