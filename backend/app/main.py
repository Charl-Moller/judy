from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from .db.database import engine
from .db import models
from .routers import agents, capabilities, chat, files, llm_configs, rag_indexes, orchestrator, workflows
import os

app = FastAPI(title="Multi-Agent AI Assistant API", version="1.0.0")

# CORS (enable frontend -> backend calls in dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
        "*",  # safe for local dev; tighten in prod
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Register routers
app.include_router(agents.router)
app.include_router(capabilities.router)
app.include_router(chat.router)
app.include_router(files.router)
app.include_router(llm_configs.router)
app.include_router(rag_indexes.router)
app.include_router(orchestrator.router)
app.include_router(workflows.router)

@app.get("/")
async def root():
    return {"message": "Multi-Agent AI Assistant API running"}


@app.on_event("startup")
def on_startup():
    # Create DB tables if they don't exist
    models.Base.metadata.create_all(bind=engine)