"""
MCP Servers API Router
Provides endpoints for managing MCP server configurations
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from uuid import UUID
import logging

from ..db.database import get_db
from ..db import models
from ..services.mcp_manager import create_mcp_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp-servers", tags=["MCP Servers"])

# Pydantic schemas
class MCPServerCreate(BaseModel):
    name: str
    description: str = ""
    transport: str  # "sse", "stdio", "http"
    url: str = ""
    command: str = ""
    auth_token: str = ""

class MCPServerUpdate(BaseModel):
    name: str = None
    description: str = None
    transport: str = None
    url: str = None
    command: str = None
    auth_token: str = None

class MCPServerResponse(BaseModel):
    id: str
    name: str
    description: str
    transport: str
    url: str
    command: str
    status: str
    tools_count: int
    error_message: Optional[str] = None
    last_connected_at: Optional[str] = None
    tools_discovered_at: Optional[str] = None
    created_at: str
    updated_at: str

    @classmethod
    def from_db_model(cls, server: models.MCPServer):
        return cls(
            id=str(server.id),
            name=server.name,
            description=server.description or "",
            transport=server.transport.value,
            url=server.url or "",
            command=server.command or "",
            status=server.status.value,
            tools_count=server.tools_count or 0,
            error_message=server.error_message,
            last_connected_at=server.last_connected_at.isoformat() if server.last_connected_at else None,
            tools_discovered_at=server.tools_discovered_at.isoformat() if server.tools_discovered_at else None,
            created_at=server.created_at.isoformat(),
            updated_at=server.updated_at.isoformat()
        )

class MCPServerTools(BaseModel):
    server_id: str
    server_name: str
    tools: dict

class MCPHealthCheck(BaseModel):
    total_servers: int
    healthy_servers: int
    servers: dict


@router.get("/", response_model=List[MCPServerResponse])
async def list_mcp_servers(db: Session = Depends(get_db)):
    """List all configured MCP servers"""
    try:
        servers = db.query(models.MCPServer).all()
        return [MCPServerResponse.from_db_model(server) for server in servers]
    except Exception as e:
        logger.error(f"Error listing MCP servers: {e}")
        raise HTTPException(status_code=500, detail="Failed to list MCP servers")


@router.post("/", response_model=MCPServerResponse)
async def create_mcp_server(
    server_data: MCPServerCreate,
    db: Session = Depends(get_db)
):
    """Create a new MCP server configuration"""
    try:
        # Validate transport type
        if server_data.transport not in ["sse", "stdio", "http"]:
            raise HTTPException(
                status_code=400, 
                detail="Invalid transport type. Must be 'sse', 'stdio', or 'http'"
            )
        
        # Validate required fields based on transport
        if server_data.transport in ["sse", "http"] and not server_data.url:
            raise HTTPException(
                status_code=400,
                detail="URL is required for SSE and HTTP transports"
            )
        
        if server_data.transport == "stdio" and not server_data.command:
            raise HTTPException(
                status_code=400,
                detail="Command is required for stdio transport"
            )
        
        # Create the server record
        server = models.MCPServer(
            name=server_data.name,
            description=server_data.description,
            transport=getattr(models.MCPTransportType, server_data.transport),
            url=server_data.url if server_data.url else None,
            command=server_data.command if server_data.command else None,
            auth_token=server_data.auth_token if server_data.auth_token else None,
            status=models.MCPServerStatus.inactive
        )
        
        db.add(server)
        db.commit()
        db.refresh(server)
        
        logger.info(f"Created MCP server: {server.name} ({server.id})")
        return MCPServerResponse.from_db_model(server)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating MCP server: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create MCP server")


@router.get("/{server_id}", response_model=MCPServerResponse)
async def get_mcp_server(server_id: UUID, db: Session = Depends(get_db)):
    """Get a specific MCP server by ID"""
    try:
        server = db.query(models.MCPServer).filter(
            models.MCPServer.id == server_id
        ).first()
        
        if not server:
            raise HTTPException(status_code=404, detail="MCP server not found")
        
        return MCPServerResponse.from_db_model(server)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting MCP server {server_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get MCP server")


@router.put("/{server_id}", response_model=MCPServerResponse)
async def update_mcp_server(
    server_id: UUID,
    server_data: MCPServerUpdate,
    db: Session = Depends(get_db)
):
    """Update an MCP server configuration"""
    try:
        server = db.query(models.MCPServer).filter(
            models.MCPServer.id == server_id
        ).first()
        
        if not server:
            raise HTTPException(status_code=404, detail="MCP server not found")
        
        # Update fields if provided
        if server_data.name is not None:
            server.name = server_data.name
        if server_data.description is not None:
            server.description = server_data.description
        if server_data.transport is not None:
            if server_data.transport not in ["sse", "stdio", "http"]:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid transport type"
                )
            server.transport = getattr(models.MCPTransportType, server_data.transport)
        if server_data.url is not None:
            server.url = server_data.url
        if server_data.command is not None:
            server.command = server_data.command
        if server_data.auth_token is not None:
            server.auth_token = server_data.auth_token
        
        server.updated_at = models.datetime.utcnow()
        db.commit()
        db.refresh(server)
        
        logger.info(f"Updated MCP server: {server.name} ({server.id})")
        return MCPServerResponse.from_db_model(server)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating MCP server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update MCP server")


@router.delete("/{server_id}")
async def delete_mcp_server(server_id: UUID, db: Session = Depends(get_db)):
    """Delete an MCP server configuration"""
    try:
        server = db.query(models.MCPServer).filter(
            models.MCPServer.id == server_id
        ).first()
        
        if not server:
            raise HTTPException(status_code=404, detail="MCP server not found")
        
        db.delete(server)
        db.commit()
        
        logger.info(f"Deleted MCP server: {server.name} ({server.id})")
        return {"message": "MCP server deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting MCP server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete MCP server")


@router.post("/{server_id}/connect")
async def connect_mcp_server(server_id: UUID, db: Session = Depends(get_db)):
    """Connect to an MCP server and discover its tools"""
    try:
        server = db.query(models.MCPServer).filter(
            models.MCPServer.id == server_id
        ).first()
        
        if not server:
            raise HTTPException(status_code=404, detail="MCP server not found")
        
        # Create MCP manager and attempt connection
        mcp_manager = create_mcp_manager(db)
        success = await mcp_manager.connect_to_server(server)
        
        if success:
            return {"message": f"Successfully connected to MCP server: {server.name}"}
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to connect to MCP server: {server.error_message or 'Unknown error'}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting to MCP server {server_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to MCP server")


@router.post("/{server_id}/disconnect")
async def disconnect_mcp_server(server_id: UUID, db: Session = Depends(get_db)):
    """Disconnect from an MCP server"""
    try:
        server = db.query(models.MCPServer).filter(
            models.MCPServer.id == server_id
        ).first()
        
        if not server:
            raise HTTPException(status_code=404, detail="MCP server not found")
        
        # Create MCP manager and disconnect
        mcp_manager = create_mcp_manager(db)
        await mcp_manager.disconnect_from_server(str(server_id))
        
        return {"message": f"Disconnected from MCP server: {server.name}"}
        
    except Exception as e:
        logger.error(f"Error disconnecting from MCP server {server_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect from MCP server")


@router.get("/{server_id}/tools", response_model=MCPServerTools)
async def get_mcp_server_tools(server_id: UUID, db: Session = Depends(get_db)):
    """Get tools available from a specific MCP server"""
    try:
        server = db.query(models.MCPServer).filter(
            models.MCPServer.id == server_id
        ).first()
        
        if not server:
            raise HTTPException(status_code=404, detail="MCP server not found")
        
        # Get tools from MCP manager
        mcp_manager = create_mcp_manager(db)
        tools = mcp_manager.get_tools_for_server(str(server_id))
        
        return MCPServerTools(
            server_id=str(server_id),
            server_name=server.name,
            tools=tools
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tools for MCP server {server_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get MCP server tools")


@router.post("/{server_id}/refresh-tools")
async def refresh_mcp_server_tools(server_id: UUID, db: Session = Depends(get_db)):
    """Refresh tool discovery for an MCP server"""
    try:
        server = db.query(models.MCPServer).filter(
            models.MCPServer.id == server_id
        ).first()
        
        if not server:
            raise HTTPException(status_code=404, detail="MCP server not found")
        
        # Refresh tools via MCP manager
        mcp_manager = create_mcp_manager(db)
        success = await mcp_manager.refresh_server_tools(str(server_id))
        
        if success:
            return {"message": f"Successfully refreshed tools for MCP server: {server.name}"}
        else:
            raise HTTPException(
                status_code=400,
                detail="Failed to refresh tools for MCP server"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing tools for MCP server {server_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh MCP server tools")


@router.get("/health/check", response_model=MCPHealthCheck)
async def mcp_health_check(db: Session = Depends(get_db)):
    """Perform health check on all MCP servers"""
    try:
        mcp_manager = create_mcp_manager(db)
        health_status = await mcp_manager.health_check()
        
        return MCPHealthCheck(**health_status)
        
    except Exception as e:
        logger.error(f"Error performing MCP health check: {e}")
        raise HTTPException(status_code=500, detail="Failed to perform MCP health check")