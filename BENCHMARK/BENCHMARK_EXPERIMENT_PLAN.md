# Chunking comparison experiment plan

This plan is preparation only. It does not report a benchmark result or model improvement.

## Fixed conditions

Compare fixed-size, deterministic structure-aware, deterministic SmartChunk, and Qwen-assisted SmartChunk on the exact same five verified source files, canonical parser output, source-span labels, access scope, keyword/embedding/reranking configuration, graph setting, top-k=5, hardware, and warm-up/measured-trial protocol. Keep the embedding model and reranker unchanged for all four conditions. Qwen changes grouping only; its deterministic fallback remains part of that condition and must be reported.

## Splits and procedure

Use development questions exclusively to set chunk size, overlap, ambiguity-selection rule, budgets, retry configuration, and any Qwen prompt/configuration version. Freeze those values and run one held-out evaluation. Validate the manifest and labels first; never convert absent/invalid evidence spans into a zero score.

For each condition, ingest all sources from scratch, apply the quality gate, index once, and issue every query with the same top-k and retrieval configuration. Store the raw run JSON, source fingerprints, parser/chunker versions, configuration, and environment metadata. Do not mix development and evaluation summaries.

## Measurements

For human-reviewed answerable labels, report Recall@5, MRR@5, and nDCG@5; report abstention cases separately. Also report chunk count, token count, index-build time, measured retrieval latency, quality-gate exclusions, and retrieval availability. For Qwen-assisted SmartChunk additionally report provider analysis latency, supplied/estimated token usage, call count, provider-failure count by sanitized category, fallback rate, and invalid-output rate. A Qwen fallback is not a successful assisted grouping.

The current runner supports the first three deterministic conditions. Add the fourth only after an approved live smoke test and legally verified, human-reviewed corpus are available. No conclusion may claim improvement until the held-out run completes.
