# SmartChunk benchmark dataset contract

The benchmark dataset is UTF-8 JSONL. Every line is a human-reviewed query record:

```json
{"query_id":"q-001","query":"What evidence supports the reported method?","source_documents":["paper-a"],"source_fingerprints":{"paper-a":{"source_sha256":"<raw SHA-256>","canonical_text_sha256":"<canonical-text SHA-256>"}},"evidence":[{"document_id":"paper-a","char_start":1200,"char_end":1480,"grade":2}],"expected_answer":"Human-reviewed expected answer or criteria","category":"evidence","annotation_notes":"Reviewer disagreement/resolution notes","answerability":"answerable","split":"evaluation","review":{"reviewer_id":"reviewer-id","status":"approved","review_notes":"Final human review completed.","reviewed_at":"YYYY-MM-DD"}}
```

Required fields are `query_id`, `query`, and non-empty `source_documents`. Preferred evidence is a stable source span: `document_id`, `char_start`, and `char_end`; `grade` is optional and defaults to 1. These spans are mapped to each strategy's chunks by overlap, so labels do not assume that a fixed-size chunk ID is the same as a SmartChunk ID.

`answerability` may be `answerable` or `abstain`; abstention queries are kept separate from ordinary retrieval scoring. `split` is `development` or `evaluation`. Do not tune chunking parameters using the evaluation split. If both splits are present, every query must declare one, and the same normalized question must not occur in both splits.

For a production annotation, `expected_answer` or `answer_criteria`, `source_fingerprints`, and `review` are required. `source_fingerprints` maps each allowed document to the manifest's raw-source and canonical-text SHA-256 values. `review` records `reviewer_id`, `review_notes`, `reviewed_at`, and one of `draft`, `reviewed`, or `approved`; only `approved` passes the production gate. Production review notes must describe a review finding (not a blank or placeholder). Answerable production records require at least one evidence span. These fields remain optional for deliberately synthetic templates and non-production drafting.

Legacy `relevant_chunk_ids` or `relevance` records can still exercise the API, but they are strategy-specific and must not be used to claim a fair cross-strategy comparison. A query with absent labels is reported as missing. A source span that cannot be mapped because returned chunks lack valid provenance is reported as invalid and excluded, never assigned a zero.

Annotators should independently identify the smallest source span sufficient to support the query, record disagreements in `annotation_notes`, and resolve them before a final evaluation run. Only legally usable source documents and human-reviewed labels belong in a benchmark dataset.
