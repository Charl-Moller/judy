from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import os
import uuid
from pathlib import Path
try:
    from azure.storage.blob import BlobServiceClient
except Exception:  # pragma: no cover
    BlobServiceClient = None
from ..db.database import get_db
from ..db import models
from ..config import settings

router = APIRouter(prefix="/files", tags=["Files"])

@router.post("")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Check if Azure Blob Storage is configured
    if BlobServiceClient and settings.AZURE_BLOB_CONNECTION_STRING:
        # Use Azure Blob Storage
        try:
            blob_service = BlobServiceClient.from_connection_string(settings.AZURE_BLOB_CONNECTION_STRING)
            container_client = blob_service.get_container_client(settings.AZURE_BLOB_CONTAINER)
            try:
                container_client.create_container()
            except Exception:
                pass
            blob_id = str(uuid.uuid4())
            blob_name = f"uploads/{blob_id}_{file.filename}"
            blob_client = container_client.get_blob_client(blob_name)
            data = await file.read()
            blob_client.upload_blob(data, overwrite=True, content_type=file.content_type)
            url = blob_client.url
            from uuid import UUID
            fmodel = models.File(id=UUID(blob_id), filename=file.filename, content_type=file.content_type, size=len(data), url=url)
            db.add(fmodel)
            db.commit()
            return {"file_id": str(fmodel.id), "url": fmodel.url}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Azure Blob Storage error: {str(e)}")
    
    # Fallback to local file storage
    try:
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads")
        upload_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix if file.filename else ""
        local_filename = f"{file_id}{file_extension}"
        file_path = upload_dir / local_filename
        
        # Save file locally
        data = await file.read()
        with open(file_path, "wb") as f:
            f.write(data)
        
        # Create file record in database
        from uuid import UUID
        file_url = f"/uploads/{local_filename}"
        fmodel = models.File(
            id=UUID(file_id), 
            filename=file.filename, 
            content_type=file.content_type, 
            size=len(data), 
            url=file_url
        )
        db.add(fmodel)
        db.commit()
        
        return {"file_id": str(fmodel.id), "url": file_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Local file storage error: {str(e)}")

@router.get("/{id}")
async def get_file(id: str, db: Session = Depends(get_db)):
    f = db.query(models.File).filter(models.File.id == id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    return {"file_id": str(f.id), "filename": f.filename, "content_type": f.content_type, "size": f.size, "url": f.url, "uploaded_at": f.uploaded_at}