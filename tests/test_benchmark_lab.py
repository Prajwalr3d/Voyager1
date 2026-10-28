import hashlib

import pytest

from smartchunk.benchmark_lab import (DatasetValidationError, load_benchmark_jsonl, load_source_manifest_jsonl,
                                      map_evidence, validate_benchmark_bundle, validate_leakage, validate_production_source_reviews)
from smartchunk.evaluation import run_evaluation


def test_dataset_contract_and_leakage_rules():
    rows=load_benchmark_jsonl('{"query_id":"q1","query":"method","source_documents":["d1"],"evidence":[{"document_id":"d1","char_start":2,"char_end":8,"grade":2}],"split":"evaluation"}\n')
    assert rows[0]['evidence'][0]['grade']==2
    with pytest.raises(DatasetValidationError): load_benchmark_jsonl('{"query_id":"q1","query":"x","source_documents":[]}\n')
    with pytest.raises(DatasetValidationError): validate_leakage(rows+[{'query_id':'q2','query':'x','source_documents':['d1'],'split':'development'},{'query_id':'q3','query':'x','source_documents':['d1']}])
    with pytest.raises(DatasetValidationError,match="same question"):
        validate_leakage(rows+[{'query_id':'q2','query':' Method ','source_documents':['d1'],'split':'development'}])
    with pytest.raises(DatasetValidationError,match="invalid review status"):
        load_benchmark_jsonl('{"query_id":"q2","query":"x","source_documents":["d1"],"review":{"reviewer_id":"r","status":"invalid","review_notes":"n","reviewed_at":"2026-01-01"}}\n')
    draft=load_benchmark_jsonl('{"query_id":"draft-q","query":"draft","source_documents":["d1"],"review":{"reviewer_id":"r","status":"draft","review_notes":"draft note","reviewed_at":"2026-01-01"}}\n')
    assert draft[0]["review"]["status"] == "draft"


def test_stable_source_span_mapping_and_invalid_provenance():
    rows=[{'chunk_id':'strategy-a','document_id':'d1','source_provenance':{'char_start':0,'char_end':10}}]
    labels,reason=map_evidence(rows,[{'document_id':'d1','char_start':5,'char_end':12,'grade':2}])
    assert labels=={'strategy-a':2.0} and reason is None
    labels,reason=map_evidence([{'chunk_id':'bad','document_id':'d1','source_provenance':{}}],[{'document_id':'d1','char_start':1,'char_end':2}])
    assert labels is None and 'no valid source span' in reason


def test_source_span_miss_uses_human_grade_for_ndcg_ideal():
    cases=[{'query_id':'miss','query':'x','source_documents':['d'],'evidence':[{'document_id':'d','char_start':0,'char_end':3,'grade':2}]}]
    result=run_evaluation(cases,lambda q,c: ([{'chunk_id':'wrong','document_id':'d','source_provenance':{'char_start':4,'char_end':8}}],{}),configuration={})
    assert result['metrics']['Recall@5']==0 and result['metrics']['nDCG@5']==0


def test_evaluation_status_invalid_mapping_failures_and_determinism():
    cases=[{'query_id':'good','query':'x','source_documents':['d'],'evidence':[{'document_id':'d','char_start':0,'char_end':3}]},
           {'query_id':'invalid','query':'y','source_documents':['d'],'evidence':[{'document_id':'d','char_start':0,'char_end':3}]},
           {'query_id':'fail','query':'z','source_documents':['d'],'relevant_chunk_ids':['a']}]
    def retrieve(query, _):
        if query=='z': raise RuntimeError('offline')
        if query=='y': return ([{'chunk_id':'bad','document_id':'d','source_provenance':{}}],{})
        return ([{'chunk_id':'a','document_id':'d','source_provenance':{'char_start':0,'char_end':4}}],{})
    result=run_evaluation(cases,retrieve,configuration={'dataset':'fixture'},warmup_trials=0,measured_trials=1)
    assert result['status']=='partial' and result['metrics']['scored_queries']==1
    assert result['invalid_mappings']==['invalid'] and result['failed_queries']==['fail']
    assert {'python','sqlite'} <= set(result['configuration']['software'])


def test_metric_output_is_deterministic_when_latency_is_ignored():
    cases=[{'query_id':'q','query':'x','relevant_chunk_ids':['a']}]
    retrieve=lambda q,c: ([{'chunk_id':'a'}],{})
    first=run_evaluation(cases,retrieve,configuration={'dataset':'fixture'},warmup_trials=0)
    second=run_evaluation(cases,retrieve,configuration={'dataset':'fixture'},warmup_trials=0)
    assert first['metrics']['Recall@5']==second['metrics']['Recall@5']==1
    assert first['per_query'][0]['retrieved_chunk_ids']==second['per_query'][0]['retrieved_chunk_ids']==['a']


def test_manifest_bundle_validates_fingerprints_scopes_spans_and_missing_labels(tmp_path):
    source=tmp_path/'paper.md'; content=b'# Finding\nPlants use light.\n'; source.write_bytes(content)
    canonical=content.decode('utf-8')
    manifest={"document_id":"paper","path":"paper.md","source_url":"https://example.invalid/paper","license":"CC-BY",
              "source_sha256":hashlib.sha256(content).hexdigest(),"canonical_text_sha256":hashlib.sha256(canonical.encode()).hexdigest(),
              "canonical_text_location":"paper.md"}
    sources=load_source_manifest_jsonl(__import__('json').dumps(manifest)+'\n')
    cases=load_benchmark_jsonl('{"query_id":"q","query":"light","source_documents":["paper"],"evidence":[{"document_id":"paper","char_start":10,"char_end":15,"grade":2}],"answerability":"answerable","split":"development"}\n')
    report=validate_benchmark_bundle(cases,sources,base_dir=tmp_path)
    assert report['sources']==1 and report['canonical_text_lengths']['paper']==len(canonical)
    cases[0]['evidence'][0]['char_end']=len(canonical)+1
    with pytest.raises(DatasetValidationError,match='outside canonical text'): validate_benchmark_bundle(cases,sources,base_dir=tmp_path)
    cases[0]['evidence']=None
    with pytest.raises(DatasetValidationError,match='missing evidence labels'): validate_benchmark_bundle(cases,sources,base_dir=tmp_path)


def test_manifest_rejects_duplicate_ids_and_invalid_sha():
    line='{"document_id":"same","path":"x.md","source_url":"https://x","license":"CC-BY","source_sha256":"' + 'a'*64 + '","canonical_text_sha256":"' + 'b'*64 + '","canonical_text_location":"x.md"}'
    with pytest.raises(DatasetValidationError,match='unique'): load_source_manifest_jsonl(line+'\n'+line)


def test_production_gate_rejects_templates_and_requires_review_evidence():
    template={"document_id":"TEMPLATE_ONLY_DO_NOT_BENCHMARK","path":"x.md","source_url":"https://example.invalid/paper",
              "license":"CC-BY","source_sha256":"a"*64,"canonical_text_sha256":"b"*64,"canonical_text_location":"x.md"}
    with pytest.raises(DatasetValidationError,match='template'): validate_production_source_reviews([template])
    source={**template,"document_id":"approved-paper","verification":{
        "bibliographic":{"title":"Synthetic test fixture","canonical_url":"https://example.invalid/paper","reviewed_by":"reviewer","reviewed_at":"2026-01-01"},
        "license_review":{"rights_basis":"fixture only","evidence_url":"https://example.invalid/license","reviewed_by":"reviewer","reviewed_at":"2026-01-01"},
        "local_file_review":{"source_sha256":"a"*64,"reviewed_by":"reviewer","reviewed_at":"2026-01-01"},
        "extraction_review":{"parser":"utf8_text","parser_version":"fixture","diagnostics":"none","reviewed_by":"reviewer","reviewed_at":"2026-01-01"},
        "manual_review":{"status":"approved","reviewed_by":"reviewer","reviewed_at":"2026-01-01"},
    }}
    validate_production_source_reviews([source])


def test_production_bundle_rejects_template_annotation(tmp_path):
    source_file=tmp_path/'paper.md'; source_file.write_text('approved source', encoding='utf-8')
    content=source_file.read_bytes(); text=content.decode('utf-8'); digest=hashlib.sha256(content).hexdigest()
    source={"document_id":"approved-paper","path":"paper.md","source_url":"https://example.invalid/paper","license":"fixture",
            "source_sha256":digest,"canonical_text_sha256":hashlib.sha256(text.encode()).hexdigest(),"canonical_text_location":"paper.md",
            "verification":{"bibliographic":{"title":"Synthetic test fixture","canonical_url":"https://example.invalid/paper","reviewed_by":"reviewer","reviewed_at":"2026-01-01"},
            "license_review":{"rights_basis":"fixture","evidence_url":"https://example.invalid/license","reviewed_by":"reviewer","reviewed_at":"2026-01-01"},
            "local_file_review":{"source_sha256":digest,"reviewed_by":"reviewer","reviewed_at":"2026-01-01"},
            "extraction_review":{"parser":"utf8_text","parser_version":"fixture","diagnostics":"none","reviewed_by":"reviewer","reviewed_at":"2026-01-01"},
            "manual_review":{"status":"approved","reviewed_by":"reviewer","reviewed_at":"2026-01-01"}}}
    case={"query_id":"TEMPLATE_ONLY_DO_NOT_BENCHMARK-q","query":"synthetic","source_documents":["approved-paper"],"evidence":[{"document_id":"approved-paper","char_start":0,"char_end":1}],"answerability":"answerable","split":"development"}
    with pytest.raises(DatasetValidationError,match="template records"):
        validate_benchmark_bundle([case],[source],base_dir=tmp_path,production=True)


def test_production_annotations_bind_human_review_evidence_and_fingerprints(tmp_path):
    source_file=tmp_path/'paper.md'; source_file.write_text('approved source evidence',encoding='utf-8')
    content=source_file.read_bytes(); digest=hashlib.sha256(content).hexdigest(); canonical=content.decode('utf-8'); canonical_digest=hashlib.sha256(canonical.encode()).hexdigest()
    source={"document_id":"paper","path":"paper.md","source_url":"https://example.invalid/paper","license":"fixture","source_sha256":digest,"canonical_text_sha256":canonical_digest,"canonical_text_location":"paper.md","verification":{"bibliographic":{"title":"fixture","canonical_url":"https://example.invalid/paper","reviewed_by":"r","reviewed_at":"2026-01-01"},"license_review":{"rights_basis":"fixture","evidence_url":"https://example.invalid/license","reviewed_by":"r","reviewed_at":"2026-01-01"},"local_file_review":{"source_sha256":digest,"reviewed_by":"r","reviewed_at":"2026-01-01"},"extraction_review":{"parser":"utf8_text","parser_version":"fixture","diagnostics":"none","reviewed_by":"r","reviewed_at":"2026-01-01"},"manual_review":{"status":"approved","reviewed_by":"r","reviewed_at":"2026-01-01"}}}
    case={"query_id":"synthetic-q","query":"What is approved?","source_documents":["paper"],"source_fingerprints":{"paper":{"source_sha256":digest,"canonical_text_sha256":canonical_digest}},"evidence":[{"document_id":"paper","char_start":0,"char_end":8,"grade":2}],"expected_answer":"approved source","answerability":"answerable","split":"development","review":{"reviewer_id":"r","status":"approved","review_notes":"synthetic fixture","reviewed_at":"2026-01-01"}}
    validate_benchmark_bundle([case],[source],base_dir=tmp_path,production=True)
    case["review"]={"status":"approved"}
    with pytest.raises(DatasetValidationError,match="reviewer_id"):
        validate_benchmark_bundle([case],[source],base_dir=tmp_path,production=True)
    case["review"]={"reviewer_id":"r","status":"approved","review_notes":"ok","reviewed_at":"2026-01-01"}
    with pytest.raises(DatasetValidationError,match="meaningful review"):
        validate_benchmark_bundle([case],[source],base_dir=tmp_path,production=True)
    case["review"]={"reviewer_id":"r","status":"approved","review_notes":"synthetic fixture","reviewed_at":"2026-01-01"}
    case["source_fingerprints"]["paper"]["source_sha256"]="0"*64
    with pytest.raises(DatasetValidationError,match="fingerprint"):
        validate_benchmark_bundle([case],[source],base_dir=tmp_path,production=True)
    case["source_fingerprints"]["paper"]["source_sha256"]=digest; case["evidence"]=[]
    with pytest.raises(DatasetValidationError,match="need evidence"):
        validate_benchmark_bundle([case],[source],base_dir=tmp_path,production=True)
