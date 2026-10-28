"""
SmartChunk Main FastAPI Application Root Entrypoint.
Delegates to app.main so running 'uvicorn main:app --reload' from backend/ works seamlessly.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
APP_DIR = BACKEND_DIR / "app"

for p in [str(BACKEND_DIR), str(APP_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Re-export app instance
from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

