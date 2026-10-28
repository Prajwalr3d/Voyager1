import hashlib

import pytest

from smartchunk.ingest import canonical_source_text, ingest_bytes
from smartchunk.models import IngestOptions
from smartchunk.provider_config import QwenChunkingConfig
from smartchunk.qwen_chunking import (AnalysisRejected, ChunkAnalysisRequest, SCHEMA_VERSION, SourceBlock,
                                      analyze_or_fallback, validate_output)


def request():
    blocks=(SourceBlock("block-1","alpha beta",0,10,"s",1),SourceBlock("block-2","gamma delta",11,22,"s",2))
    return ChunkAnalysisRequest("d","a"*64,blocks,100,100,"v1")


class Provider:
    def __init__(self, result=None, error=None): self.result=result; self.error=error; self.calls=0
    def analyze(self, _):
        self.calls += 1
        if self.error: raise self.error
        return self.result


def valid():
    return {"schema_version":SCHEMA_VERSION,"groups":[{"block_ids":["block-1"],"char_start":0,"char_end":10},{"block_ids":["block-2"],"char_start":11,"char_end":22}]}


def config(**kwargs): return QwenChunkingConfig(enabled=True,provider="mock",model_id="mock-model",**kwargs)


def test_feature_disabled_default_does_not_call_provider(monkeypatch):
    monkeypatch.delenv("SMARTCHUNK_QWEN_ENABLED", raising=False)
    assert not QwenChunkingConfig.from_env().enabled
    provider=Provider(valid()); groups,metadata=analyze_or_fallback(request(),QwenChunkingConfig(),provider)
    assert provider.calls == 0 and metadata["fallback_reason"] == "feature_disabled" and len(groups)==2


@pytest.mark.parametrize("payload,reason",[
    ({"schema_version":SCHEMA_VERSION,"groups":[{"block_ids":["unknown","block-2"],"char_start":0,"char_end":22}]},"unknown_block_id"),
    ({"schema_version":SCHEMA_VERSION,"groups":[{"block_ids":["block-1","block-1"],"char_start":0,"char_end":10}]},"duplicate_block_id"),
    ({"schema_version":SCHEMA_VERSION,"groups":[{"block_ids":["block-2","block-1"],"char_start":11,"char_end":10}]},"missing_or_invalid_order"),
    ({"schema_version":SCHEMA_VERSION,"groups":[{"block_ids":["block-1"],"char_start":1,"char_end":10},{"block_ids":["block-2"],"char_start":11,"char_end":22}]},"invalid_group_span"),
])
def test_strict_output_validation_rejects_invalid_ids_order_and_spans(payload,reason):
    with pytest.raises(AnalysisRejected,match=reason): validate_output(payload,request())


def test_provider_failure_malformed_and_output_limit_fall_back():
    groups,metadata=analyze_or_fallback(request(),config(),Provider(error=TimeoutError()))
    assert len(groups)==2 and metadata["fallback_reason"]=="provider_timeout" and metadata["attempts"] == 2
    groups,metadata=analyze_or_fallback(request(),config(),Provider("not json"))
    assert len(groups)==2 and metadata["fallback_reason"]=="malformed_output"
    tiny=ChunkAnalysisRequest("d","a"*64,request().blocks,100,1,"v1")
    groups,metadata=analyze_or_fallback(tiny,config(max_output_tokens=1),Provider(valid()))
    assert len(groups)==2 and metadata["fallback_reason"]=="output_token_limit"


def test_missing_configuration_and_invalid_source_blocks_fall_back_without_calling_provider():
    provider=Provider(valid())
    groups,metadata=analyze_or_fallback(request(),QwenChunkingConfig(enabled=True),provider)
    assert len(groups)==2 and metadata["fallback_reason"] == "provider_unavailable" and provider.calls == 0
    bad=ChunkAnalysisRequest("d","a"*64,(SourceBlock("same","one",0,3,"s",1),SourceBlock("same","two",4,7,"s",2)),100,100,"v1")
    groups,metadata=analyze_or_fallback(bad,config(),provider)
    assert len(groups)==2 and metadata["fallback_reason"] == "invalid_source_blocks" and provider.calls == 0


def test_valid_multi_block_grouping_and_retries_are_recorded():
    merged={"schema_version":SCHEMA_VERSION,"groups":[{"block_ids":["block-1","block-2"],"char_start":0,"char_end":22}]}
    groups,metadata=analyze_or_fallback(request(),config(),Provider(merged))
    assert [block.id for block in groups[0]] == ["block-1","block-2"]
    assert metadata["used"] and metadata["strategy_version"] and metadata["input_tokens_estimated"] > 0


def test_input_budget_prevents_provider_invocation():
    provider=Provider(valid())
    constrained=ChunkAnalysisRequest("d","a"*64,request().blocks,1,100,"v1")
    groups,metadata=analyze_or_fallback(constrained,config(),provider)
    assert len(groups) == 2 and metadata["fallback_reason"] == "input_token_limit" and provider.calls == 0


def test_valid_grouping_preserves_source_text_offsets_and_provenance():
    text=("alpha " * 60).encode()
    original=canonical_source_text(text,"paper.txt")
    prefix=hashlib.sha256(text).hexdigest()[:16]
    provider=Provider({"schema_version":SCHEMA_VERSION,"groups":[{"block_ids":[f"{prefix}:block-1"],"char_start":0,"char_end":len(" ".join(original.split()[:50]))},
        {"block_ids":[f"{prefix}:block-2"],"char_start":len(" ".join(original.split()[:50]))+1,"char_end":len(" ".join(original.split()))}]})
    document=ingest_bytes(text,"paper.txt",IngestOptions(strategy="smart",chunk_size=50),qwen_config=config(),chunk_analyzer=provider)
    assert provider.calls==1 and all(chunk.provenance["chunk_analysis"]["used"] for chunk in document.chunks)
    assert " ".join(chunk.text for chunk in document.chunks)==" ".join(original.split())
    assert all(0 <= chunk.provenance["char_start"] < chunk.provenance["char_end"] <= len(original) for chunk in document.chunks)
    assert all(chunk.provenance["source_sha256"] == hashlib.sha256(text).hexdigest() for chunk in document.chunks)
