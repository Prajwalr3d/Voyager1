from smartchunk.benchmark import evaluate
from smartchunk.graph import RelationshipGraph
from smartchunk.retrieval import search
from smartchunk.api import create_app
from smartchunk.ingest import ingest_bytes
from smartchunk.models import IngestOptions
from fastapi.testclient import TestClient


def payload():
    return {"id":"doc-a","title":"A","access":["team-a"],"sections":[{"id":"s1","header":"Intro"}],
      "chunks":[{"id":"c1","text":"alpha context","ordinal":1,"section_id":"s1","access":["team-a"],"references":["r1"]},
                {"id":"c2","text":"beta answer","ordinal":2,"section_id":"s1","access":["team-a"]},
                {"id":"c3","text":"secret","ordinal":3,"access":["team-b"]}],
      "equations":[{"id":"e1","text":"x=y","section_id":"s1","explained_by_chunk_id":"c1"}],
      "definitions":[{"id":"d1","text":"alpha means first","explained_by_chunk_id":"c1"}],
      "tables":[{"id":"t1","text":"values"}],"citations":[{"id":"r1","text":"[1] Source"}]}


def test_construction_and_grounding(tmp_path):
    g=RelationshipGraph(tmp_path/'g.db'); g.add_document(payload())
    relations={d['relation'] for _,_,_,d in g.g.edges(keys=True,data=True)}
    assert {"CONTAINS","NEXT_CHUNK","HAS_HEADER","REFERENCES","EXPLAINED_BY","DEFINES"} <= relations
    assert not any(d['relation']=="DEFINES" and d['source']=="inference" for *_,d in g.g.edges(keys=True,data=True))


def test_persistence_rebuild_and_cycle(tmp_path):
    p=tmp_path/'g.db'; g=RelationshipGraph(p); g.add_document(payload()); count=g.g.number_of_edges(); g.rebuild()
    assert g.g.number_of_edges()==count
    loaded=RelationshipGraph(p); assert loaded.g.number_of_nodes()==g.g.number_of_nodes()
    # A graph cycle must not make neighborhood inspection loop.
    a,b=list(loaded.g.nodes)[:2]; loaded._edge(a,b,"CONTAINS",source_kind="test",evidence="a"); loaded._edge(b,a,"CONTAINS",source_kind="test",evidence="b")
    assert len(loaded.nearby('c1',['team-a'],hops=9,limit=4)['nodes']) <= 4


def test_missing_relationships_limits_and_access(tmp_path):
    g=RelationshipGraph(tmp_path/'g.db'); d=payload(); d['chunks'][0]['references']=['missing']; g.add_document(d)
    assert not any(x['relation']=='REFERENCES' and 'missing' in x['evidence'] for *_,x in g.g.edges(keys=True,data=True))
    rows,meta=search(g,'alpha',['team-a'],top_k=1,expand_graph=True,max_hops=3,max_nodes=1,max_added_tokens=1)
    assert len(rows)==1 and meta['added_tokens']==0
    assert all(r['chunk_id']!='c3' for r in search(g,'secret',['team-a'])[0])
    assert g.nearby('c1',['team-b']) == {'nodes': [], 'relationships': []}


def test_benchmark_runs(tmp_path):
    g=RelationshipGraph(tmp_path/'g.db'); g.add_document(payload())
    report=evaluate(g,[{'query':'beta','access':['team-a'],'relevant_chunk_ids':['c2']}],False)
    assert report['Recall@5']==1 and report['added_tokens_mean']==0


def test_api_inspection_and_optional_search(tmp_path):
    client=TestClient(create_app(str(tmp_path/'api.db')))
    assert client.post('/documents',json=payload()).status_code == 200
    inspected=client.get('/chunks/c1/relationships?access=team-a').json()
    assert any(x['relation']=='NEXT_CHUNK' for x in inspected['relationships'])
    assert client.post('/search',json={'query':'beta','access':['team-a'],'graph':True}).status_code == 200


def test_text_ingestion_preserves_provenance_and_structure(tmp_path):
    data=b"# Intro\nAlpha begins here.\n\n## Details\nBeta follows here."
    doc=ingest_bytes(data,'paper.md',IngestOptions(strategy='smart',chunk_size=50,access=['team-a']))
    assert [s.header for s in doc.sections] == ['Intro','Details']
    assert all(c.provenance['source_sha256'] and c.source == 'utf8_text' for c in doc.chunks)
    client=TestClient(create_app(str(tmp_path/'upload.db')))
    response=client.post('/documents/upload',files={'file':('paper.md',data,'text/markdown')},data={'options':'{"strategy":"structure","access":["team-a"]}'})
    assert response.status_code == 200 and response.json()['chunks'] == 2
