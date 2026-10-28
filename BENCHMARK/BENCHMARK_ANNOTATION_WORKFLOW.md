# Human retrieval-annotation workflow

Use this procedure only after an approved source passes the production manifest gate. Do not use the template records as evidence.

## Question authoring

Create questions only after the source passes the production manifest gate. Their answers must be retrievable from the approved source set without external knowledge. Mark each as `answerable` or `abstain`. Avoid yes/no wording when a precise scientific claim, method, population, result, limitation, or comparison can be queried instead. Record the allowed `source_documents` explicitly.

For each draft, copy the raw `source_sha256` and `canonical_text_sha256` for every allowed source into `source_fingerprints`. Record either `expected_answer` or `answer_criteria`. Add a `review` object with `reviewer_id`, `review_notes`, `reviewed_at`, and status `draft`, then advance it to `reviewed` and finally `approved` only after adjudication. The final review note must state what was checked or resolved; blanks and placeholder-only notes are rejected. Only `approved` records can pass production validation.

Before annotation, search the existing question list for near-duplicates, equivalent wording, and questions that can be answered from multiple unrelated passages. Merge or rewrite ambiguous duplicates and log the decision in `annotation_notes`.

## Evidence and grades

For each answerable question, two reviewers independently mark the smallest sufficient half-open canonical-text span, `[char_start, char_end)`, against the exact parser output retained in `canonical_text_location`. Do not use rendered page position as an offset. Record each disagreement and its resolution in `annotation_notes`.

Use relevance grade `2` for directly sufficient evidence, `1` for relevant but incomplete/supporting evidence, and `0` only when explicitly retaining a judged non-relevant span for adjudication. Do not omit evidence for a final answerable question. Abstention questions should state why the allowed sources do not contain sufficient evidence.

## Split discipline and review

Assign every finalized record to `development` or held-out `evaluation` before tuning. Use development questions for parameter choices only. Freeze the setup, then score evaluation once; never move difficult evaluation questions into development after seeing results. The validator rejects the same normalized question if it occurs in both splits.

Before acceptance, a reviewer checks query ID uniqueness, source scope, source fingerprints, canonical offsets, grades, expected answer/criteria, review status, split, annotation notes, and duplicate/ambiguity disposition. If extraction artifacts make the smallest sufficient span ambiguous, do not alter text or guess offsets: record the issue in `review_notes` and return it for source/extraction review. Run the production validator, then retain the reviewed JSONL and manifest together with the exact source files.

```powershell
.\.venv\Scripts\python.exe scripts\validate_benchmark_data.py --sources benchmark-corpus\sources.jsonl --dataset benchmark-corpus\annotations.jsonl --production
```
