from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db.database import engine
from .db import models
from .routers import chat, agents, llm_configs, capabilities, rag_indexes, files

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

# Register routers
app.include_router(chat.router)
app.include_router(agents.router)
app.include_router(llm_configs.router)
app.include_router(capabilities.router)
app.include_router(rag_indexes.router)
app.include_router(files.router)

@app.get("/")
async def root():
    return {"message": "Multi-Agent AI Assistant API running"}


@app.on_event("startup")
def on_startup():
    # Create DB tables if they don't exist
    models.Base.metadata.create_all(bind=engine)