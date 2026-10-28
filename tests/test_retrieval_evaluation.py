import json

import pytest
from fastapi.testclient import TestClient

from smartchunk.api import create_app
from smartchunk.embeddings import HashEmbeddingAdapter, ModelUnavailable, SentenceTransformerAdapter
from smartchunk.evaluation import load_dataset_jsonl, run_evaluation, validate_fair_comparison
from smartchunk.graph import RelationshipGraph
from smartchunk.models import Chunk, DocumentInput, Section
from smartchunk.retrieval_index import PersistentRetrievalIndex, reciprocal_rank_fusion


def doc():
    base={"source_sha256":"d"*64,"filename":"evidence.md","char_start":0}
    return DocumentInput(id="retrieval-doc",access=["team-a"],sections=[Section(id="s",header="Evidence")],chunks=[
        Chunk(id="cats",text="Cats sleep in sunny places.",section_id="s",access=["team-a"],provenance=base),
        Chunk(id="dogs",text="Dogs enjoy energetic walks.",section_id="s",access=["team-a"],provenance=base),
        Chunk(id="blocked",text="Cats secret restricted.",section_id="s",access=["team-b"],provenance=base,indexable=False,quality_status="REJECT")])


def test_fts_ranking_filtering_persistence_and_empty_query(tmp_path):
    path=tmp_path/'retrieval.db'; graph=RelationshipGraph(path); document=doc(); graph.add_document(document)
    index=PersistentRetrievalIndex(graph); assert index.sync_document(document)==2
    assert [row['chunk_id'] for row in index.keyword('cats',['team-a'])] == ['cats']
    assert not index.keyword('cats',['team-b'])
    with pytest.raises(ValueError): index.keyword('   ',['team-a'])
    restarted=PersistentRetrievalIndex(RelationshipGraph(path))
    assert restarted.keyword('walks',['team-a'])[0]['chunk_id'] == 'dogs'


def test_embedding_persistence_ranking_and_dimension_mismatch(tmp_path):
    path=tmp_path/'vector.db'; graph=RelationshipGraph(path); graph.add_document(doc()); index=PersistentRetrievalIndex(graph)
    adapter=HashEmbeddingAdapter(); assert index.ensure_embeddings(adapter)['created']==2
    assert index.semantic('sunny cats',['team-a'],adapter)[0]['chunk_id'] == 'cats'
    restarted=PersistentRetrievalIndex(RelationshipGraph(path)); assert restarted.ensure_embeddings(adapter)['created']==0
    with restarted.graph._connect() as db: db.execute("UPDATE embedding_records SET dimension=2")
    # Corrupt/incompatible dimensions are detected and regenerated, not silently reused.
    assert restarted.ensure_embeddings(adapter)['created']==2
    alternate=HashEmbeddingAdapter(dimension=32)
    assert restarted.ensure_embeddings(alternate)['created']==2


def test_hybrid_fusion_and_model_unavailability():
    rows=reciprocal_rank_fusion([{'chunk_id':'a','score':1},{'chunk_id':'b','score':1}],[{'chunk_id':'b','score':1}],k=1)
    assert [row['chunk_id'] for row in rows] == ['b','a']
    with pytest.raises(ModelUnavailable): SentenceTransformerAdapter('not-a-real-local-model').embed(['x'])


def test_labelled_evaluation_metrics_missing_labels_and_fairness():
    cases=load_dataset_jsonl('{"query_id":"q1","query":"x","relevance":{"a":2,"b":1}}\n{"query_id":"q2","query":"y"}\n')
    result=run_evaluation(cases,lambda q,c: ([{'chunk_id':'a'}],{'mode':'test'}),configuration={'dataset':'fixture'})
    assert result['metrics']['Recall@5']==1 and result['metrics']['MRR@5']==1
    assert result['metrics']['nDCG@5'] == pytest.approx(0.8262346571)
    assert result['metrics']['missing_label_queries']==1
    validate_fair_comparison([{'dataset':'d','model':'m','chunking_strategy':'fixed'},{'dataset':'d','model':'m','chunking_strategy':'smart'}])
    with pytest.raises(ValueError): validate_fair_comparison([{'dataset':'d','model':'m','chunking_strategy':'fixed'},{'dataset':'other','model':'m','chunking_strategy':'smart'}])


def test_search_and_evaluation_api(tmp_path):
    client=TestClient(create_app(str(tmp_path/'api.db')))
    assert client.post('/documents',json=doc().model_dump(mode='json')).status_code==200
    detail=client.post('/search/detailed',json={'query':'cats','access':['team-a'],'mode':'keyword'}); assert detail.status_code==200
    assert detail.json()['results'][0]['chunk_id']=='cats' and detail.json()['retrieval']['mode']=='keyword'
    evaluation=client.post('/evaluations',json={'dataset_id':'fixture','dataset_version':'v1','mode':'keyword','access':['team-a'],
        'cases':[{'query_id':'q1','query':'cats','relevant_chunk_ids':['cats']},{'query_id':'q2','query':'no label'}]})
    assert evaluation.status_code==200 and evaluation.json()['metrics']['missing_label_queries']==1
    run_id=evaluation.json()['run_id']; exported=client.get(f'/evaluations/{run_id}/export.json')
    assert exported.status_code==200 and json.loads(exported.text)['run_id']==run_id


def test_new_retrieval_graph_expansion_respects_node_limit(tmp_path):
    graph=RelationshipGraph(tmp_path/'limits.db'); graph.add_document(doc()); index=PersistentRetrievalIndex(graph); index.sync_document(doc())
    from smartchunk.retrieval import expand_ranked
    rows, meta=expand_ranked(graph,index.keyword('cats',['team-a']),['team-a'],top_k=5,max_hops=3,max_nodes=0,max_added_tokens=100)
    assert meta['added_nodes']==0 and [row['chunk_id'] for row in rows]==['cats']
