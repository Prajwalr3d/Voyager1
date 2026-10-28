# Benchmark preparation and review

`benchmark-templates/` contains deliberately invalid-for-production template records. Replace every placeholder using legally usable local source files and human-reviewed annotations; templates are not evaluation data.

## Source manifest

Each JSONL record requires `document_id`, local `path`, `source_url`, `license`, raw-file `source_sha256`, `canonical_text_sha256`, and `canonical_text_location`. `path` is relative to the manifest and is the exact file passed to ingestion. `canonical_text_location` records where that exact source text is retained; it is provenance, not a downloaded URL.

For an actual benchmark, keep unverified notes in `benchmark-candidates/` and approved records in `benchmark-corpus/`. The production validator additionally requires a `verification` object with bibliographic, license, local-file, extraction, and manual-review evidence. Its `manual_review.status` must be `approved`; the reviewed local-file hash must match `source_sha256`; and the canonical URL must match `source_url`. This is an audit gate, not automated legal advice.

`source_sha256` is SHA-256 of the source bytes. `canonical_text_sha256` is SHA-256 of UTF-8 parser output. Character offsets are against that parser output: UTF-8 TXT/Markdown is decoded with replacement for invalid bytes and otherwise receives no Unicode normalization; line splitting preserves the parser's source text offsets. PDF offsets are against the installed `pypdf` extraction output. Changing source bytes, parser version, Unicode normalization, or newline representation requires regenerating fingerprints and annotations.

To obtain offsets, ingest the exact file, export JSONL for chunk offset guidance, then inspect the same canonical parser text and annotate half-open ranges `[char_start, char_end)`. A reviewer must check that the span contains the smallest sufficient evidence.

## Annotation review checklist

- Confirm source URL, reuse license/rights basis, local path, and both fingerprints.
- Write a question and set `answerability` to `answerable` or `abstain`.
- Restrict `source_documents` to the documents the question may use.
- For answerable questions, independently record evidence spans and relevance grades; resolve disagreements in `annotation_notes`.
- Assign every record to `development` or held-out `evaluation`; never tune on held-out records.
- Run the validator before any benchmark; it rejects duplicate IDs, changed files, invalid/out-of-scope spans, missing labels, and split leakage.

## Commands

```powershell
.\.venv\Scripts\python.exe scripts\validate_benchmark_data.py --sources path\to\sources.jsonl --dataset path\to\annotations.jsonl
.\.venv\Scripts\python.exe scripts\validate_benchmark_data.py --sources benchmark-corpus\sources.jsonl --dataset benchmark-corpus\annotations.jsonl --production
.\.venv\Scripts\python.exe scripts\run_benchmark.py --sources path\to\sources.jsonl --dataset path\to\annotations.jsonl --output-dir benchmark-results --top-k 5
```

The existing runner uses the same local source manifest, query file, keyword retrieval, `top_k`, warm-up/trial protocol, and metric implementation for fixed, structure, and smart chunking. It emits per-strategy chunk counts, index build time, mean retrieval latency, Recall@5, MRR@5, and nDCG@5. Run development and held-out evaluation records in separate files/runs; do not select parameters from the held-out output.

See `CORPUS_READINESS.md` for the required five-paper intake checks and `BENCHMARK_EXPERIMENT_PLAN.md` for the frozen four-condition comparison plan. The Qwen-assisted condition is not runnable or reportable until its opt-in smoke test is approved and the legally verified, human-reviewed corpus exists.

See `BENCHMARK_ANNOTATION_WORKFLOW.md` for dual-review span annotation, relevance-grade, duplicate/ambiguity, and split instructions.

## Multi-user security boundary

SmartChunk currently has no authentication or identity-aware authorization. Access lists submitted in requests/documents are filtering metadata only. Agent task IDs are identifiers, not authorization: anyone who obtains one can read the in-memory task result. Deploy the current API only in a trusted/local environment. Before a multi-user deployment, add an authenticated principal, server-side document ACL/tenant ownership, task owner/tenant binding enforced on create/read, and an authenticated upload policy. A UUID or hidden endpoint is not a substitute.
