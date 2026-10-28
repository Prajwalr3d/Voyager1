"""Opt-in Alibaba Cloud Model Studio OpenAI-compatible Qwen adapter."""
from __future__ import annotations

import json
import re
from typing import Any, Protocol
from urllib.parse import urlsplit

import httpx

from .provider_config import QwenChunkingConfig
from .qwen_chunking import (AnalysisOutput, ChunkAnalysisRequest, ProviderAnalysisResponse,
                            ProviderAuthenticationError, ProviderCallError,
                            ProviderInvalidRequestError, ProviderMalformedResponseError,
                            ProviderRateLimitError, ProviderTimeoutError)


PROVIDER_NAME = "dashscope_openai"
_MODEL_STUDIO_HOST = re.compile(r"^[a-z0-9-]+\.[a-z0-9-]+\.maas\.aliyuncs\.com$", re.IGNORECASE)


def endpoint_error(endpoint: str | None) -> str | None:
    """Accept only the documented workspace-and-region Model Studio chat endpoint shape."""
    if not endpoint:
        return "missing_endpoint"
    parsed=urlsplit(endpoint)
    if parsed.scheme != "https": return "endpoint_must_use_https"
    if parsed.username or parsed.password or parsed.port or not parsed.hostname or not _MODEL_STUDIO_HOST.fullmatch(parsed.hostname):
        return "endpoint_must_be_model_studio_workspace_endpoint"
    if parsed.path.rstrip("/") != "/compatible-mode/v1/chat/completions" or parsed.query or parsed.fragment:
        return "endpoint_must_be_chat_completions"
    return None


class HttpPost(Protocol):
    def post(self, url: str, *, headers: dict[str, str], json: dict[str, Any], timeout: httpx.Timeout) -> httpx.Response: ...


class DashScopeOpenAIChunkProvider:
    """Calls a configured full `/chat/completions` endpoint only from `analyze`."""

    def __init__(self, config: QwenChunkingConfig, *, transport: HttpPost | None = None):
        self._config = config
        self._transport = transport or httpx.Client()

    @staticmethod
    def _timeout(seconds: int) -> httpx.Timeout:
        # httpx applies these limits at the socket transport, rather than merely recording them.
        return httpx.Timeout(timeout=float(seconds), connect=min(float(seconds), 5.0), read=float(seconds), write=float(seconds), pool=float(seconds))

    @staticmethod
    def _schema() -> dict[str, Any]:
        return AnalysisOutput.model_json_schema()

    def _payload(self, request: ChunkAnalysisRequest) -> dict[str, Any]:
        blocks = [{"id": block.id, "text": block.text, "char_start": block.char_start,
                   "char_end": block.char_end, "section_id": block.section_id, "ordinal": block.ordinal}
                  for block in request.blocks]
        return {"model": self._config.model_id, "max_tokens": request.max_output_tokens,
                "temperature": 0,
                "response_format": {"type": "json_schema", "json_schema": {"name": "smartchunk_grouping",
                                    "schema": self._schema(), "strict": True}},
                "messages": [
                    {"role": "system", "content": "Return only JSON matching the supplied schema. Group existing blocks only; do not rewrite text or IDs."},
                    {"role": "user", "content": json.dumps({"schema_version": "smartchunk.qwen.chunk-analysis/v1",
                        "source_fingerprint": request.source_fingerprint, "blocks": blocks}, separators=(",", ":"), ensure_ascii=False)},
                ]}

    def analyze(self, request: ChunkAnalysisRequest) -> ProviderAnalysisResponse:
        if not self._config.api_key:
            raise ProviderAuthenticationError("Qwen API key is not configured")
        if error:=endpoint_error(self._config.endpoint):
            raise ProviderInvalidRequestError(error)
        try:
            response = self._transport.post(self._config.endpoint,
                headers={"Authorization": f"Bearer {self._config.api_key}", "Content-Type": "application/json"},
                json=self._payload(request), timeout=self._timeout(request.timeout_seconds))
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("Qwen transport timeout") from exc
        except httpx.RequestError as exc:
            raise ProviderCallError("Qwen transport failure") from exc
        if response.status_code in {401, 403}:
            raise ProviderAuthenticationError("Qwen authentication failed")
        if response.status_code == 429:
            raise ProviderRateLimitError("Qwen rate limited the request")
        if response.status_code >= 500:
            raise ProviderCallError("Qwen server error")
        if response.status_code >= 400:
            raise ProviderInvalidRequestError("Qwen rejected the request")
        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            if not isinstance(content, str):
                raise TypeError("completion content is not a string")
        except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ProviderMalformedResponseError("Qwen returned a malformed completion") from exc
        usage = payload.get("usage") if isinstance(payload, dict) else None
        input_tokens = usage.get("prompt_tokens") if isinstance(usage, dict) and isinstance(usage.get("prompt_tokens"), int) else None
        output_tokens = usage.get("completion_tokens") if isinstance(usage, dict) and isinstance(usage.get("completion_tokens"), int) else None
        return ProviderAnalysisResponse(content=content, input_tokens=input_tokens, output_tokens=output_tokens)


def provider_from_config(config: QwenChunkingConfig) -> DashScopeOpenAIChunkProvider | None:
    """Construct only the supported adapter; construction performs no network I/O."""
    if config.provider != PROVIDER_NAME:
        return None
    return DashScopeOpenAIChunkProvider(config)
