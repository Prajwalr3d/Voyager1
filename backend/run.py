"""
Runner script for SmartChunk FastAPI backend.
Binds to 0.0.0.0:8000 for local and container/cloud compatibility.
Usage:
    python run.py
"""

import sys
from pathlib import Path
import uvicorn

BACKEND_DIR = Path(__file__).resolve().parent
APP_DIR = BACKEND_DIR / "app"

for p in [str(BACKEND_DIR), str(APP_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from app.core.config import settings

if __name__ == "__main__":
    print(f"Starting SmartChunk API on http://0.0.0.0:{settings.PORT} ...")
    print(f"Frontend: http://localhost:{settings.PORT}/app")
    print(f"Swagger Docs: http://localhost:{settings.PORT}/docs")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
    )
