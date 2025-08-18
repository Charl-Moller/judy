from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from ..db.database import get_db
from ..db.models import AgentBuilder, AgentExecution, AgentTemplate
from ..schemas.agent import (
    AgentBuilderCreate, 
    AgentBuilderUpdate, 
    AgentBuilderResponse, 
    AgentBuilderListResponse,
    AgentExecutionCreate,
    AgentExecutionResponse,
    AgentTemplateResponse
)

router = APIRouter(prefix="/agent-builder", tags=["agent-builder"])

# ============================================================================
# AGENT TEMPLATE OPERATIONS (MUST COME BEFORE PARAMETERIZED ROUTES)
# ============================================================================

@router.get("/templates", response_model=List[AgentTemplateResponse])
async def list_agent_templates(
    category: Optional[str] = None,
    is_public: bool = True,
    db: Session = Depends(get_db)
):
    """List available agent templates"""
    try:
        query = db.query(AgentTemplate)
        
        if category:
            query = query.filter(AgentTemplate.category == category)
        
        if is_public:
            query = query.filter(AgentTemplate.is_public == True)
        
        templates = query.order_by(AgentTemplate.usage_count.desc()).all()
        
        return [AgentTemplateResponse.from_orm(t) for t in templates]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list agent templates: {str(e)}"
        )

@router.post("/templates/{template_id}/use", response_model=AgentBuilderResponse)
async def use_agent_template(
    template_id: uuid.UUID,
    agent_name: str,
    db: Session = Depends(get_db)
):
    """Create a new agent from a template"""
    try:
        template = db.query(AgentTemplate).filter(AgentTemplate.id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent template not found"
            )
        
        # Create new agent from template
        new_agent = AgentBuilder(
            id=uuid.uuid4(),
            name=agent_name,
            description=f"Created from template: {template.name}",
            version="1.0.0",
            nodes=template.nodes,
            connections=template.connections,
            agent_metadata={
                "template_id": str(template.id),
                "template_name": template.name,
                "created_from_template": True,
                **template.template_metadata
            },
            tags=template.template_metadata.get("tags", []),
            status="draft",
            is_template=False
        )
        
        db.add(new_agent)
        
        # Update template usage count
        template.usage_count += 1
        
        db.commit()
        db.refresh(new_agent)
        
        return AgentBuilderResponse.from_orm(new_agent)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to use agent template: {str(e)}"
        )

# ============================================================================
# AGENT BUILDER CRUD OPERATIONS
# ============================================================================

@router.post("/", response_model=AgentBuilderResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent: AgentBuilderCreate,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)  # TODO: Add authentication
):
    """Create a new agent"""
    try:
        # Create agent instance
        db_agent = AgentBuilder(
            id=uuid.uuid4(),
            name=agent.name,
            description=agent.description,
            version=agent.version,
            nodes=[node.dict() for node in agent.nodes],
            connections=[conn.dict() for conn in agent.connections],
            agent_metadata=agent.agent_metadata,
            tags=agent.tags,
            owner_id=agent.owner_id,  # TODO: Get from current_user
            is_public=agent.is_public,
            status=agent.status,
            is_template=agent.is_template
        )
        
        db.add(db_agent)
        db.commit()
        db.refresh(db_agent)
        
        return AgentBuilderResponse.from_orm(db_agent)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create agent: {str(e)}"
        )

@router.get("/", response_model=AgentBuilderListResponse)
async def list_agents(
    skip: int = 0,
    limit: int = 100,
    owner_id: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List agents with optional filtering"""
    try:
        query = db.query(AgentBuilder)
        
        # Always exclude deleted agents unless specifically requested
        if status and status == "deleted":
            query = query.filter(AgentBuilder.status == status)
        else:
            query = query.filter(AgentBuilder.status != "deleted")
        
        # Apply additional filters
        if owner_id:
            query = query.filter(AgentBuilder.owner_id == owner_id)
        if status and status != "deleted":
            query = query.filter(AgentBuilder.status == status)
        if category:
            query = query.filter(AgentBuilder.agent_metadata['category'].astext == category)
        
        # Get total count
        total = query.count()
        
        # Apply pagination and ordering
        agents = query.order_by(AgentBuilder.updated_at.desc()).offset(skip).limit(limit).all()
        
        return AgentBuilderListResponse(
            agents=[AgentBuilderResponse.from_orm(a) for a in agents],
            total=total,
            skip=skip,
            limit=limit
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list agents: {str(e)}"
        )

@router.get("/{agent_id}", response_model=AgentBuilderResponse)
async def get_agent(
    agent_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Get a specific agent by ID"""
    try:
        agent = db.query(AgentBuilder).filter(AgentBuilder.id == agent_id).first()
        
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        
        return AgentBuilderResponse.from_orm(agent)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get agent: {str(e)}"
        )

@router.put("/{agent_id}", response_model=AgentBuilderResponse)
async def update_agent(
    agent_id: uuid.UUID,
    agent_update: AgentBuilderUpdate,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)  # TODO: Add authentication
):
    """Update an existing agent"""
    try:
        db_agent = db.query(AgentBuilder).filter(AgentBuilder.id == agent_id).first()
        
        if not db_agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        
        # TODO: Check if current_user owns the agent
        
        # Update fields
        update_data = agent_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field == "nodes" and value:
                # Convert nodes to dict format for storage
                setattr(db_agent, field, [node.dict() for node in value])
            elif field == "connections" and value:
                # Convert connections to dict format for storage
                setattr(db_agent, field, [conn.dict() for conn in value])
            else:
                setattr(db_agent, field, value)
        
        db_agent.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(db_agent)
        
        return AgentBuilderResponse.from_orm(db_agent)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update agent: {str(e)}"
        )

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: uuid.UUID,
    hard_delete: bool = False,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)  # TODO: Add authentication
):
    """Delete an agent"""
    try:
        db_agent = db.query(AgentBuilder).filter(AgentBuilder.id == agent_id).first()
        
        if not db_agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        
        # TODO: Check if current_user owns the agent
        
        if hard_delete:
            # Hard delete - permanently remove from database
            db.delete(db_agent)
        else:
            # Soft delete - mark as deleted instead of removing
            db_agent.status = "deleted"
            db_agent.updated_at = datetime.utcnow()
        
        db.commit()
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete agent: {str(e)}"
        )

# ============================================================================
# AGENT EXECUTION OPERATIONS
# ============================================================================

@router.post("/{agent_id}/execute", response_model=AgentExecutionResponse)
async def execute_agent(
    agent_id: uuid.UUID,
    execution: AgentExecutionCreate,
    db: Session = Depends(get_db)
):
    """Execute an agent"""
    try:
        # Verify agent exists
        agent = db.query(AgentBuilder).filter(AgentBuilder.id == agent_id).first()
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        
        # Create execution record
        db_execution = AgentExecution(
            id=uuid.uuid4(),
            agent_id=agent_id,
            session_id=execution.session_id,
            input_data=execution.input_data,
            conversation_history=execution.conversation_history,
            memory_context=execution.memory_context,
            status="running"
        )
        
        db.add(db_execution)
        db.commit()
        db.refresh(db_execution)
        
        # TODO: Actually execute the agent here
        # This would call the orchestrator service
        
        return AgentExecutionResponse.from_orm(db_execution)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute agent: {str(e)}"
        )

@router.get("/{agent_id}/executions", response_model=List[AgentExecutionResponse])
async def list_agent_executions(
    agent_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """List executions for a specific agent"""
    try:
        executions = db.query(AgentExecution)\
            .filter(AgentExecution.agent_id == agent_id)\
            .order_by(AgentExecution.started_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
        
        return [AgentExecutionResponse.from_orm(e) for e in executions]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list agent executions: {str(e)}"
        )