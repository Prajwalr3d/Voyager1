# Scientific corpus readiness checklist

Five research-paper PDFs are present only in `benchmark-candidates/originals/` as unapproved candidate files. They are not corpus sources and must not be benchmarked or copied into `benchmark-corpus/` until the complete per-source review is independently approved. The two files in `benchmark-templates/` are placeholders and must not be benchmarked. There are currently zero verified production source files, zero approved production-manifest records, and zero human-reviewed annotations. See the per-candidate notes in `benchmark-candidates/` for their evidence and unresolved blockers.

Before adding the selected five papers:

- Verify each source URL and its license or documented rights basis; record both in the source manifest.
- Place only the verified local source file in the approved corpus location. Do not silently replace a source after annotation.
- Record SHA-256 of raw source bytes and the SHA-256 of `canonical_source_text` output, plus the parser/version and any PDF extraction diagnostics.
- Create a manifest entry with the exact relative path and canonical-text location, then run `scripts/validate_benchmark_data.py`.
- Have independent reviewers create answerable and abstention questions, minimal supporting source spans, relevance grades, and disagreement notes.
- Split questions into development and held-out evaluation before tuning. Review span offsets against the exact canonical parser text, not rendered PDF pages.

Missing prerequisites: five legally verified source files, five manifest records with fingerprints, parser diagnostics, and human-reviewed query/evidence annotations for both splits.

## Per-source acquisition record

Complete the following record separately for each of the five selected papers before moving it from `benchmark-candidates/` to an approved manifest in `benchmark-corpus/`:

1. **Identity:** title, authors/year or DOI, canonical publisher/repository URL, reviewer, and review date.
2. **Rights:** exact license or documented permitted-use basis, URL or local evidence location supporting it, reviewer, and review date.
3. **Local integrity:** approved local path, raw SHA-256, filename/version source, reviewer, and review date.
4. **Extraction:** parser name and installed version, canonical-text SHA-256, page-count/extraction diagnostics, and reviewer sign-off. For PDFs, retain a page-to-canonical-offset map or a reproducible extraction note.
5. **Manual approval:** confirm the local file is the reviewed source, the canonical text is suitable for span annotation, and the record is approved for the benchmark.

Run the production gate only after all five sections have evidence:

```powershell
.\.venv\Scripts\python.exe scripts\validate_benchmark_data.py --sources benchmark-corpus\sources.jsonl --dataset benchmark-corpus\annotations.jsonl --production
```

The production gate rejects `TEMPLATE_ONLY_*` records, incomplete review evidence, hash mismatches, and non-approved manual reviews. It intentionally does not browse URLs or determine license validity; those remain human legal/research-review decisions.
