import json

from fastapi.testclient import TestClient

from smartchunk.api import create_app
from smartchunk.export import export_jsonl, import_jsonl
from smartchunk.graph import RelationshipGraph
from smartchunk.models import Chunk, DocumentInput, Section
from smartchunk.quality import repair_and_validate, validate_document
from smartchunk.retrieval import search


def document(chunks):
    return DocumentInput(id="doc-quality", access=["team-a"], sections=[Section(id="s1",header="Heading")], chunks=chunks)


def valid_chunk(text="A sufficiently descriptive chunk with several words.", **kwargs):
    provenance={"source_sha256":"a"*64,"filename":"paper.md","char_start":0,"media_type":"text/markdown",
                "chunker_version":"smartchunk-ingest/1","chunk_strategy":"smart","parser_version":"utf8_text_v1"}
    provenance.update(kwargs.pop("provenance",{}))
    return Chunk(id=kwargs.pop("id","c1"),text=text,section_id="s1",access=["team-a"],provenance=provenance,**kwargs)


def result(report, chunk_id="c1"):
    return next(item for item in report.chunks if item.chunk_id == chunk_id)


def test_empty_missing_provenance_offsets_and_size_are_hard_failures():
    bad=valid_chunk(" ",provenance={"source_sha256":"","filename":"","char_start":-1})
    report=validate_document(document([bad]),max_words=3)
    codes={d.code for d in result(report).diagnostics}
    assert result(report).status == "REJECT"
    assert {"EMPTY_CHUNK","MISSING_SOURCE_FINGERPRINT","MISSING_SOURCE_FILENAME","INVALID_SOURCE_OFFSET"} <= codes
    oversized=validate_document(document([valid_chunk("one two three four")]),max_words=3)
    assert result(oversized).status == "REJECT"


def test_duplicates_are_soft_and_hard_cannot_be_overridden():
    first=valid_chunk("Repeated source content here.",id="c1")
    second=valid_chunk("Repeated source content here.",id="c2")
    report=validate_document(document([first,second]))
    assert all(item.status == "REVIEW" and item.indexable for item in report.chunks)
    first.provenance["source_sha256"]=""
    report=validate_document(document([first,second]))
    assert result(report,"c1").status == "REJECT"


def test_repair_is_conservative_and_revalidated():
    repaired, report=repair_and_validate(document([valid_chunk("  reliable source text  ")]))
    assert repaired.chunks[0].text == "reliable source text"
    assert result(report).status == "REPAIR"
    assert any(d.code == "REPAIRED_TRIM_WHITESPACE" for d in result(report).diagnostics)


def test_rejected_chunks_are_not_retrievable(tmp_path):
    rejected, _=repair_and_validate(document([valid_chunk("",id="bad")]))
    allowed, _=repair_and_validate(document([valid_chunk("visible answer",id="good")]))
    # Same document uses the post-gate records to mirror upload indexing.
    rejected.chunks.extend(allowed.chunks); rejected.sections=allowed.sections
    graph=RelationshipGraph(tmp_path/'quality.db'); graph.add_document(rejected)
    assert [row['chunk_id'] for row in search(graph,'answer',['team-a'])[0]] == ['good']


def test_jsonl_validity_roundtrip_unicode_and_optional_metadata():
    chunk=valid_chunk("Euler says π ≈ 3.14159\nE = mc²",provenance={"source_sha256":"b"*64,"filename":"math.md"})
    doc, _=repair_and_validate(document([chunk]))
    output=export_jsonl(doc); records=import_jsonl(output)
    assert len(records)==1 and records[0]['text'] == chunk.text
    assert records[0]['source_offsets']['char_start'] == 0
    assert json.loads(output).get('quality_status') in {'PASS','REVIEW','REPAIR'}


def test_missing_optional_metadata_warns_without_rejecting_and_exports_audit_status():
    chunk=valid_chunk(provenance={"source_sha256":"c"*64,"filename":"minimal.txt"})
    chunk.provenance.pop("media_type")
    doc, report=repair_and_validate(document([chunk]))
    item=result(report)
    assert item.status == "REVIEW" and item.indexable
    assert any(d.code == "MISSING_OPTIONAL_MEDIA_TYPE" for d in item.diagnostics)
    doc.chunks[0].quality_status="REJECT"; doc.chunks[0].indexable=False
    assert import_jsonl(export_jsonl(doc))[0]['quality_status'] == "REJECT"


def test_upload_returns_diagnostics_and_export_is_safe_jsonl(tmp_path):
    client=TestClient(create_app(str(tmp_path/'api.db')))
    response=client.post('/documents/upload',files={'file':('π.md','# Maths\nE = mc²','text/markdown')},
                         data={'options':'{"strategy":"smart","access":["team-a"]}'})
    assert response.status_code == 200
    document_id=response.json()['document_id']
    assert response.json()['quality']['chunks'][0]['status'] in {'PASS','REVIEW','REPAIR'}
    exported=client.get(f'/documents/{document_id}/export.jsonl')
    assert exported.status_code == 200 and exported.headers['content-type'].startswith('application/x-ndjson')
    assert 'mc²' in exported.text and import_jsonl(exported.text)[0]['source_document'] == document_id
