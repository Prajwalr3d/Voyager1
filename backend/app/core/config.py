"""
Application Configuration Module for SmartChunk.
Handles environment variables, default settings, and directory paths.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base backend directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load .env file from backend directory or workspace root
env_file = BASE_DIR / ".env"
if not env_file.exists():
    env_file = BASE_DIR.parent / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()


class Settings:
    PROJECT_NAME: str = "SmartChunk"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Evidence-Aware Scientific Document RAG with Quality Gate and Cryptographic Provenance"

    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # SQLite Database
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", str(BASE_DIR / "smartchunk.db"))

    # Embeddings
    EMBEDDING_MODEL_NAME: str = os.getenv(
        "EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2"
    )

    # LLM Settings
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # Static files directory (Vanilla frontend)
    STATIC_DIR: Path = BASE_DIR / "static"

    # Hybrid Search parameters
    RRF_K: int = 60
    DEFAULT_TOP_K: int = 5

    # Server Settings
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")


settings = Settings()

