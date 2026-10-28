"""End-to-end tests for scripts/run_benchmark.py fail-fast validation."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "run_benchmark.py"
PYTHON = sys.executable


def _source_file(tmp_path: Path, name: str, content: str) -> Path:
    p = tmp_path / name
    p.write_text(content, encoding="utf-8")
    return p


def _manifest(tmp_path: Path, source_path: Path, **overrides) -> Path:
    content = source_path.read_bytes()
    canonical = content.decode("utf-8")
    manifest = {
        "document_id": "paper",
        "path": source_path.name,
        "source_url": "https://example.invalid/paper",
        "license": "CC-BY",
        "source_sha256": hashlib.sha256(content).hexdigest(),
        "canonical_text_sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "canonical_text_location": source_path.name,
    }
    manifest.update(overrides)
    mpath = tmp_path / "sources.jsonl"
    mpath.write_text(json.dumps(manifest) + "\n", encoding="utf-8")
    return mpath


def _dataset(tmp_path: Path, **overrides) -> Path:
    case = {
        "query_id": "q1",
        "query": "light",
        "source_documents": ["paper"],
        "evidence": [{"document_id": "paper", "char_start": 0, "char_end": 5, "grade": 2}],
        "answerability": "answerable",
        "split": "development",
    }
    case.update(overrides)
    dpath = tmp_path / "dataset.jsonl"
    dpath.write_text(json.dumps(case) + "\n", encoding="utf-8")
    return dpath


def _run(tmp_path: Path, dataset: Path, sources: Path, extra_args=None):
    out_dir = tmp_path / "out"
    cmd = [PYTHON, str(SCRIPT), "--dataset", str(dataset), "--sources", str(sources), "--output-dir", str(out_dir)]
    if extra_args:
        cmd.extend(extra_args)
    return subprocess.run(cmd, capture_output=True, text=True, cwd=str(tmp_path))


def _latest_run_dir(out_dir: Path) -> Path:
    subdirs=[p for p in out_dir.iterdir() if p.is_dir()] if out_dir.exists() else []
    assert subdirs, f"no run subdirectory created under {out_dir}"
    return sorted(subdirs)[-1]


def test_valid_bundle_runs_all_three_strategies(tmp_path):
    src = _source_file(tmp_path, "paper.md", "# Finding\nPlants use light.\n")
    manifest = _manifest(tmp_path, src)
    dataset = _dataset(tmp_path)
    result = _run(tmp_path, dataset, manifest)
    assert result.returncode == 0, result.stderr
    out_dir = tmp_path / "out"
    run_dir = _latest_run_dir(out_dir)
    assert (run_dir / "fixed.json").is_file()
    assert (run_dir / "structure.json").is_file()
    assert (run_dir / "smart.json").is_file()
    assert (run_dir / "summary.md").is_file()


def test_invalid_source_hash_prevents_all_strategy_runs(tmp_path):
    src = _source_file(tmp_path, "paper.md", "# Finding\nPlants use light.\n")
    manifest = _manifest(tmp_path, src, source_sha256="0" * 64)
    dataset = _dataset(tmp_path)
    result = _run(tmp_path, dataset, manifest)
    assert result.returncode != 0
    assert "benchmark validation failed" in result.stderr
    out_dir = tmp_path / "out"
    assert not out_dir.exists()


def test_invalid_canonical_hash_prevents_all_strategy_runs(tmp_path):
    src = _source_file(tmp_path, "paper.md", "# Finding\nPlants use light.\n")
    manifest = _manifest(tmp_path, src, canonical_text_sha256="0" * 64)
    dataset = _dataset(tmp_path)
    result = _run(tmp_path, dataset, manifest)
    assert result.returncode != 0
    assert "benchmark validation failed" in result.stderr
    out_dir = tmp_path / "out"
    assert not out_dir.exists()


def test_invalid_evidence_span_prevents_all_strategy_runs(tmp_path):
    src = _source_file(tmp_path, "paper.md", "# Finding\nPlants use light.\n")
    manifest = _manifest(tmp_path, src)
    dataset = _dataset(tmp_path, evidence=[{"document_id": "paper", "char_start": 0, "char_end": 9999, "grade": 2}])
    result = _run(tmp_path, dataset, manifest)
    assert result.returncode != 0
    assert "benchmark validation failed" in result.stderr
    out_dir = tmp_path / "out"
    assert not out_dir.exists()


def test_runner_errors_produce_nonzero_exit_status(tmp_path):
    src = _source_file(tmp_path, "paper.md", "# Finding\nPlants use light.\n")
    manifest = _manifest(tmp_path, src, source_sha256="0" * 64)
    dataset = _dataset(tmp_path)
    result = _run(tmp_path, dataset, manifest)
    assert result.returncode != 0
