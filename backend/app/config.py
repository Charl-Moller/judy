import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Load from project .env by default
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Azure OpenAI
    AZURE_OPENAI_API_BASE: str = os.getenv("AZURE_OPENAI_API_BASE", "")
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    
    # Azure Cognitive Search
    AZURE_SEARCH_SERVICE_URL: str = os.getenv("AZURE_SEARCH_SERVICE_URL", "")
    AZURE_SEARCH_API_KEY: str = os.getenv("AZURE_SEARCH_API_KEY", "")
    
    # Azure Blob Storage
    AZURE_BLOB_CONNECTION_STRING: str = os.getenv("AZURE_BLOB_CONNECTION_STRING", "")
    AZURE_BLOB_CONTAINER: str = os.getenv("AZURE_BLOB_CONTAINER", "uploads")

    # Database
    # Fallback to local SQLite if not provided
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

settings = Settings()