"""No-network demo smoke test. Uses a temporary SQLite database and a mock Gemini provider."""
from __future__ import annotations

import os
import sys
import tempfile
import gc
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from smartchunk.ai import MockProvider
from smartchunk.api import create_app


FIXTURE = b"""# Photosynthesis study
## Finding
Chlorophyll absorbs light energy and supports photosynthesis in plants.
## Method
The experiment measured leaf pigment under controlled illumination.
"""


def main() -> None:
    response = {"answer": "Chlorophyll absorbs light energy.", "citations": ["chunk-1"], "abstained": False, "uncertainty": "low"}
    with tempfile.TemporaryDirectory(prefix="smartchunk-smoke-") as directory:
        app = create_app(Path(directory) / "smoke.sqlite3", provider_factory=lambda: MockProvider(response))
        with TestClient(app) as client:
            upload = client.post("/documents/upload", files={"file": ("paper.md", FIXTURE, "text/markdown")},
                                 data={"options": '{"strategy":"smart","access":["demo"]}', "document_id": "paper-demo"})
            assert upload.status_code == 200, upload.text
            assert upload.json()["source_sha256"] and upload.json()["quality"]["chunks"]

            found = client.post("/search/detailed", json={"query": "chlorophyll light", "access": ["demo"], "mode": "keyword"})
            assert found.status_code == 200 and found.json()["results"], found.text
            rows = found.json()["results"]
            assert all(row["document_id"] == "paper-demo" for row in rows)
            exported = client.get("/documents/paper-demo/export.jsonl")
            assert exported.status_code == 200 and 'source_fingerprint' in exported.text and 'paper-demo' in exported.text

            chat = client.post("/chat", json={"question": "What absorbs light energy?", "access": ["demo"], "mode": "keyword"})
            assert chat.status_code == 200 and not chat.json()["abstained"], chat.text
            cited_ids = {item["chunk_id"] for item in chat.json()["citations"]}
            assert cited_ids <= {row["chunk_id"] for row in rows} and cited_ids

            task = client.post("/agent/tasks", json={"question": "What absorbs light energy?", "access": ["demo"], "mode": "keyword"})
            assert task.status_code == 200 and task.json()["status"] == "completed", task.text
            status = client.get(f"/agent/tasks/{task.json()['task_id']}")
            assert status.status_code == 200 and status.json()["result"]["citations"]

        # The entry point's real Gemini provider must fail before making a network request.
        with TestClient(create_app(Path(directory) / "missing.sqlite3")) as missing:
            safe_error = missing.post("/chat", json={"question": "anything"})
            assert safe_error.status_code == 503 and "GEMINI_API_KEY" in safe_error.json()["detail"]
        # Starlette's test clients retain application references until collection on Windows.
        del client, missing, app
        gc.collect()
    print("local smoke test passed (mocked Gemini; no network calls)")


if __name__ == "__main__":
    # The script does not inspect or print credentials; this guards against accidental live-provider use.
    os.environ.pop("GEMINI_API_KEY", None)
    main()
