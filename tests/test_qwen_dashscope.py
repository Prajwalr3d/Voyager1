import httpx
import json
import pytest

from smartchunk.provider_config import QwenChunkingConfig
from smartchunk.qwen_chunking import (ChunkAnalysisRequest, SCHEMA_VERSION, SourceBlock,
                                      analyze_or_fallback)
from smartchunk.qwen_dashscope import DashScopeOpenAIChunkProvider, provider_from_config


def request():
    return ChunkAnalysisRequest("doc", "a" * 64, (SourceBlock("b1", "one two", 0, 7, "s", 1),), 500, 500, "v1", 7)


def config(**kwargs):
    api_key=kwargs.pop("api_key", "secret-value")
    endpoint=kwargs.pop("endpoint", "https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions")
    return QwenChunkingConfig(enabled=True, provider="dashscope_openai", model_id="configured-qwen-model",
        endpoint=endpoint, api_key=api_key, retries=1, **kwargs)


def completion(content=None, *, status=200, usage=None):
    if content is None:
        content = {"schema_version": SCHEMA_VERSION, "groups": [{"block_ids": ["b1"], "char_start": 0, "char_end": 7}]}
    body = {"choices": [{"message": {"content": json.dumps(content) if isinstance(content, dict) else content}}]}
    if usage is not None: body["usage"] = usage
    return httpx.Response(status, json=body)


class Transport:
    def __init__(self, responses): self.responses=list(responses); self.calls=[]
    def post(self, url, *, headers, json, timeout):
        self.calls.append((url, headers, json, timeout))
        item=self.responses.pop(0)
        if isinstance(item, BaseException): raise item
        return item


def test_valid_response_uses_https_transport_timeout_and_reports_usage():
    transport=Transport([completion(usage={"prompt_tokens": 12, "completion_tokens": 6})])
    provider=DashScopeOpenAIChunkProvider(config(), transport=transport)
    groups, metadata=analyze_or_fallback(request(), config(), provider)
    assert len(groups) == 1 and metadata["used"] and metadata["input_tokens"] == 12 and metadata["output_tokens"] == 6
    _, headers, payload, timeout=transport.calls[0]
    assert headers["Authorization"] != "secret-value" and payload["model"] == "configured-qwen-model"
    assert timeout.connect == 5 and timeout.read == 7 and payload["response_format"]["type"] == "json_schema"


@pytest.mark.parametrize("error", [httpx.ConnectTimeout("connect"), httpx.ReadTimeout("read")])
def test_connect_and_read_timeouts_retry_then_fall_back(error):
    transport=Transport([error, error])
    groups, metadata=analyze_or_fallback(request(), config(), DashScopeOpenAIChunkProvider(config(), transport=transport))
    assert len(groups) == 1 and metadata["fallback_reason"] == "provider_timeout" and len(transport.calls) == 2


def test_rate_limit_retries_but_authentication_and_invalid_requests_do_not():
    limited=Transport([completion(status=429), completion(status=429)])
    _, metadata=analyze_or_fallback(request(), config(), DashScopeOpenAIChunkProvider(config(), transport=limited))
    assert metadata["fallback_reason"] == "provider_rate_limit" and len(limited.calls) == 2
    denied=Transport([completion(status=401)])
    _, metadata=analyze_or_fallback(request(), config(), DashScopeOpenAIChunkProvider(config(), transport=denied))
    assert metadata["fallback_reason"] == "provider_authentication_failure" and len(denied.calls) == 1
    invalid=Transport([completion(status=400)])
    _, metadata=analyze_or_fallback(request(), config(), DashScopeOpenAIChunkProvider(config(), transport=invalid))
    assert metadata["fallback_reason"] == "provider_invalid_request" and len(invalid.calls) == 1


@pytest.mark.parametrize("response", [
    httpx.Response(500),
    completion(content="not-json"),
    httpx.Response(200, json={"choices": []}),
])
def test_server_and_malformed_responses_fall_back(response):
    transport=Transport([response, response])
    _, metadata=analyze_or_fallback(request(), config(), DashScopeOpenAIChunkProvider(config(), transport=transport))
    assert metadata["fallback_reason"] in {"provider_failure", "malformed_output", "provider_malformed_response"}


def test_missing_credentials_or_model_never_send_a_request_and_errors_do_not_leak_secret():
    transport=Transport([])
    missing_key=config(api_key=None)
    _, metadata=analyze_or_fallback(request(), missing_key, DashScopeOpenAIChunkProvider(missing_key, transport=transport))
    assert metadata["fallback_reason"] == "provider_authentication_failure" and not transport.calls
    missing_model=QwenChunkingConfig(enabled=True, provider="dashscope_openai", endpoint="https://example.test", api_key="secret-value")
    assert provider_from_config(missing_model) is not None
    _, metadata=analyze_or_fallback(request(), missing_model, provider_from_config(missing_model))
    assert metadata["fallback_reason"] == "provider_unavailable" and "secret-value" not in str(metadata)


def test_malformed_or_unknown_output_and_disabled_mode_make_no_live_request():
    unknown=completion(content={"schema_version": SCHEMA_VERSION, "groups": [{"block_ids": ["wrong"], "char_start": 0, "char_end": 7}]})
    transport=Transport([unknown])
    _, metadata=analyze_or_fallback(request(), config(), DashScopeOpenAIChunkProvider(config(), transport=transport))
    assert metadata["fallback_reason"] == "unknown_block_id"
    disabled=QwenChunkingConfig()
    provider=DashScopeOpenAIChunkProvider(config(), transport=transport)
    _, metadata=analyze_or_fallback(request(), disabled, provider)
    assert metadata["fallback_reason"] == "feature_disabled" and len(transport.calls) == 1


def test_non_model_studio_or_non_https_endpoint_is_rejected_before_transport():
    transport=Transport([])
    invalid=config(endpoint="https://example.test/compatible-mode/v1/chat/completions")
    _, metadata=analyze_or_fallback(request(), invalid, DashScopeOpenAIChunkProvider(invalid, transport=transport))
    assert metadata["fallback_reason"] == "provider_invalid_request" and not transport.calls
