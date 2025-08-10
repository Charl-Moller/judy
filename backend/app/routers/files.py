from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
try:
    from azure.storage.blob import BlobServiceClient
except Exception:  # pragma: no cover
    BlobServiceClient = None
import uuid
from ..db.database import get_db
from ..db import models
from ..config import settings

router = APIRouter(prefix="/files", tags=["Files"])

@router.post("")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if BlobServiceClient is None:
        raise HTTPException(status_code=500, detail="azure-storage-blob not installed")
    if not settings.AZURE_BLOB_CONNECTION_STRING:
        raise HTTPException(status_code=500, detail="Blob storage not configured")
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

@router.get("/{id}")
async def get_file(id: str, db: Session = Depends(get_db)):
    f = db.query(models.File).filter(models.File.id == id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    return {"file_id": str(f.id), "filename": f.filename, "content_type": f.content_type, "size": f.size, "url": f.url, "uploaded_at": f.uploaded_at}