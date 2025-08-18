from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from ..db.database import get_db
from ..db.models import Workflow, WorkflowExecution, WorkflowTemplate
from ..schemas.workflow import (
    WorkflowCreate, 
    WorkflowUpdate, 
    WorkflowResponse, 
    WorkflowListResponse,
    WorkflowExecutionCreate,
    WorkflowExecutionResponse,
    WorkflowTemplateResponse
)

router = APIRouter(prefix="/workflows", tags=["workflows"])

# ============================================================================
# WORKFLOW TEMPLATE OPERATIONS (MUST COME BEFORE PARAMETERIZED ROUTES)
# ============================================================================

@router.get("/templates", response_model=List[WorkflowTemplateResponse])
async def list_workflow_templates(
    category: Optional[str] = None,
    is_public: bool = True,
    db: Session = Depends(get_db)
):
    """List available workflow templates"""
    try:
        query = db.query(WorkflowTemplate)
        
        if category:
            query = query.filter(WorkflowTemplate.category == category)
        
        if is_public:
            query = query.filter(WorkflowTemplate.is_public == True)
        
        templates = query.order_by(WorkflowTemplate.usage_count.desc()).all()
        
        return [WorkflowTemplateResponse.from_orm(t) for t in templates]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list workflow templates: {str(e)}"
        )

@router.post("/templates/{template_id}/use", response_model=WorkflowResponse)
async def use_workflow_template(
    template_id: uuid.UUID,
    workflow_name: str,
    db: Session = Depends(get_db)
):
    """Create a new workflow from a template"""
    try:
        template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow template not found"
            )
        
        # Create new workflow from template
        new_workflow = Workflow(
            id=uuid.uuid4(),
            name=workflow_name,
            description=f"Created from template: {template.name}",
            version="1.0.0",
            nodes=[node.dict() for node in template.nodes],
            connections=[conn.dict() for conn in template.connections],
            workflow_metadata={
                "template_id": str(template.id),
                "template_name": template.name,
                "created_from_template": True
            },
            tags=template.template_metadata.get("tags", []),
            status="draft",
            is_template=False
        )
        
        db.add(new_workflow)
        
        # Update template usage count
        template.usage_count += 1
        
        db.commit()
        db.refresh(new_workflow)
        
        return WorkflowResponse.from_orm(new_workflow)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to use workflow template: {str(e)}"
        )

# ============================================================================
# WORKFLOW CRUD OPERATIONS
# ============================================================================

@router.post("/", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow: WorkflowCreate,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)  # TODO: Add authentication
):
    """Create a new workflow"""
    try:
        # Create workflow instance
        db_workflow = Workflow(
            id=uuid.uuid4(),
            name=workflow.name,
            description=workflow.description,
            version=workflow.version,
            nodes=[node.dict() for node in workflow.nodes],
            connections=[conn.dict() for conn in workflow.connections],
            workflow_metadata=workflow.workflow_metadata,
            tags=workflow.tags,
            owner_id=workflow.owner_id,  # TODO: Get from current_user
            is_public=workflow.is_public,
            status=workflow.status,
            is_template=workflow.is_template
        )
        
        db.add(db_workflow)
        db.commit()
        db.refresh(db_workflow)
        
        return WorkflowResponse.from_orm(db_workflow)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create workflow: {str(e)}"
        )

@router.get("/", response_model=WorkflowListResponse)
async def list_workflows(
    skip: int = 0,
    limit: int = 100,
    owner_id: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List workflows with optional filtering"""
    try:
        query = db.query(Workflow)
        
        # Always exclude deleted workflows unless specifically requested
        if status and status == "deleted":
            query = query.filter(Workflow.status == status)
        else:
            query = query.filter(Workflow.status != "deleted")
        
        # Apply additional filters
        if owner_id:
            query = query.filter(Workflow.owner_id == owner_id)
        if status and status != "deleted":
            query = query.filter(Workflow.status == status)
        if category:
            query = query.filter(Workflow.workflow_metadata['category'].astext == category)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        workflows = query.offset(skip).limit(limit).all()
        
        return WorkflowListResponse(
            workflows=[WorkflowResponse.from_orm(w) for w in workflows],
            total=total,
            skip=skip,
            limit=limit
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list workflows: {str(e)}"
        )

@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Get a specific workflow by ID"""
    try:
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        return WorkflowResponse.from_orm(workflow)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get workflow: {str(e)}"
        )

@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: uuid.UUID,
    workflow_update: WorkflowUpdate,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)  # TODO: Add authentication
):
    """Update an existing workflow"""
    try:
        db_workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        
        if not db_workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        # TODO: Check if current_user owns the workflow
        
        # Update fields
        update_data = workflow_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_workflow, field, value)
        
        db_workflow.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(db_workflow)
        
        return WorkflowResponse.from_orm(db_workflow)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update workflow: {str(e)}"
        )

@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: uuid.UUID,
    hard_delete: bool = False,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)  # TODO: Add authentication
):
    """Delete a workflow"""
    try:
        db_workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        
        if not db_workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        # TODO: Check if current_user owns the workflow
        
        if hard_delete:
            # Hard delete - permanently remove from database
            db.delete(db_workflow)
        else:
            # Soft delete - mark as deleted instead of removing
            db_workflow.status = "deleted"
            db_workflow.updated_at = datetime.utcnow()
        
        db.commit()
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete workflow: {str(e)}"
        )

# ============================================================================
# WORKFLOW EXECUTION OPERATIONS
# ============================================================================

@router.post("/{workflow_id}/execute", response_model=WorkflowExecutionResponse)
async def execute_workflow(
    workflow_id: uuid.UUID,
    execution: WorkflowExecutionCreate,
    db: Session = Depends(get_db)
):
    """Execute a workflow"""
    try:
        # Verify workflow exists
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        # Create execution record
        db_execution = WorkflowExecution(
            id=uuid.uuid4(),
            workflow_id=workflow_id,
            session_id=execution.session_id,
            input_data=execution.input_data,
            conversation_history=execution.conversation_history,
            memory_context=execution.memory_context,
            status="running"
        )
        
        db.add(db_execution)
        db.commit()
        db.refresh(db_execution)
        
        # TODO: Actually execute the workflow here
        # This would call the orchestrator service
        
        return WorkflowExecutionResponse.from_orm(db_execution)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute workflow: {str(e)}"
        )

@router.get("/{workflow_id}/executions", response_model=List[WorkflowExecutionResponse])
async def list_workflow_executions(
    workflow_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """List executions for a specific workflow"""
    try:
        executions = db.query(WorkflowExecution)\
            .filter(WorkflowExecution.workflow_id == workflow_id)\
            .order_by(WorkflowExecution.started_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
        
        return [WorkflowExecutionResponse.from_orm(e) for e in executions]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list workflow executions: {str(e)}"
        )

# ============================================================================
# WORKFLOW TEMPLATE OPERATIONS (MOVED TO TOP)
# ============================================================================
