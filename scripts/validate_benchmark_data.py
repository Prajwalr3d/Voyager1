"""Validate local benchmark sources and human labels without network access."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from smartchunk.benchmark_lab import DatasetValidationError, load_benchmark_jsonl, load_source_manifest_jsonl, validate_benchmark_bundle


def main() -> None:
    parser=argparse.ArgumentParser(description="Validate SmartChunk benchmark manifests and annotations")
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--sources", required=True, type=Path)
    parser.add_argument("--production", action="store_true", help="Require auditable human review evidence; rejects templates/candidates")
    args=parser.parse_args()
    try:
        cases=load_benchmark_jsonl(args.dataset.read_text(encoding="utf-8"))
        sources=load_source_manifest_jsonl(args.sources.read_text(encoding="utf-8"))
        report=validate_benchmark_bundle(cases, sources, base_dir=args.sources.parent, production=args.production)
    except (OSError, DatasetValidationError) as exc:
        raise SystemExit(f"validation failed: {exc}") from exc
    print(f"validated {report['sources']} sources and {report['queries']} labelled queries")


if __name__ == "__main__":
    main()
