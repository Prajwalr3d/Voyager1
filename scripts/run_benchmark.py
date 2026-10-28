"""Run fixed, structure, and SmartChunk keyword baselines from an explicit local source manifest.

No corpora or models are downloaded. See BENCHMARK_DATASET.md.
"""
from __future__ import annotations

import argparse, json, sys
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

from smartchunk.benchmark_lab import (
    DatasetValidationError,
    load_benchmark_jsonl,
    load_source_manifest_jsonl,
    validate_benchmark_bundle,
)
from smartchunk.evaluation import run_evaluation
from smartchunk.graph import RelationshipGraph
from smartchunk.ingest import ingest_bytes
from smartchunk.models import IngestOptions
from smartchunk.quality import repair_and_validate
from smartchunk.retrieval_index import PersistentRetrievalIndex


def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument('--dataset',required=True,type=Path)
    parser.add_argument('--sources',required=True,type=Path,help='JSONL: path, document_id, optional access')
    parser.add_argument('--output-dir',type=Path,default=Path('benchmark-results'))
    parser.add_argument('--top-k',type=int,default=5)
    args=parser.parse_args()
    cases=load_benchmark_jsonl(args.dataset.read_text(encoding='utf-8'))
    sources=load_source_manifest_jsonl(args.sources.read_text(encoding='utf-8'))
    try:
        validate_benchmark_bundle(cases, sources, base_dir=args.sources.parent)
    except DatasetValidationError as exc:
        print(f"benchmark validation failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
    run_dir=args.output_dir / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'); run_dir.mkdir(parents=True,exist_ok=False)
    output=[]
    for strategy in ('fixed','structure','smart'):
        db=run_dir/f'{strategy}.sqlite3'; graph=RelationshipGraph(db); index=PersistentRetrievalIndex(graph)
        started=perf_counter()
        for item in sources:
            path=Path(item['path']); content=path.read_bytes()
            document=ingest_bytes(content,path.name,IngestOptions(strategy=strategy,access=item.get('access',['public'])),document_id=item['document_id'])
            document,_=repair_and_validate(document); graph.add_document(document); index.sync_document(document)
        index_build_ms=(perf_counter()-started)*1000
        eligible=[d for _,d in graph.g.nodes(data=True) if d.get('kind')=='Chunk' and d.get('indexable',True)]
        config={'dataset_id':args.dataset.stem,'dataset_version':'source-file','chunking_strategy':strategy,'retrieval_mode':'keyword','top_k':args.top_k,
                'graph_enabled':False,'embedding_model':None,'source_manifest':str(args.sources),'index_build_ms':index_build_ms,
                'chunk_count':len(eligible),'token_count':sum(len((d.get('text') or '').split()) for d in eligible)}
        result=run_evaluation(cases,lambda q,c:(index.keyword(q,c.get('access',['public']),args.top_k),{'mode':'keyword'}),configuration=config,warmup_trials=1,measured_trials=3)
        (run_dir/f'{strategy}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,sort_keys=True),encoding='utf-8'); output.append(result)
    lines=['# SmartChunk benchmark summary','','This report is generated from explicitly supplied local data. It is not a claim of general improvement.','', '| Strategy | Status | Recall@5 | MRR@5 | nDCG@5 | Mean latency ms |', '|---|---|---:|---:|---:|---:|']
    for result in output:
        m=result['metrics']; lines.append(f"| {result['configuration']['chunking_strategy']} | {result['status']} | {m['Recall@5']} | {m['MRR@5']} | {m['nDCG@5']} | {m['latency_ms_mean']} |")
    (run_dir/'summary.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(run_dir)

if __name__=='__main__': main()
