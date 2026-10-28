"""Provider-neutral, strictly validated optional grouping suggestions for SmartChunk."""
from __future__ import annotations

import json
import math
import time
from dataclasses import replace
from dataclasses import dataclass
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .provider_config import QwenChunkingConfig


SCHEMA_VERSION = "smartchunk.qwen.chunk-analysis/v1"
STRATEGY_VERSION = "smartchunk.qwen-assisted-grouping/1"
TOKEN_COUNT_METHOD = "approx_utf8_4chars_v1"


@dataclass(frozen=True)
class SourceBlock:
    id: str
    text: str
    char_start: int
    char_end: int
    section_id: str
    ordinal: int


@dataclass(frozen=True)
class ChunkAnalysisRequest:
    document_id: str
    source_fingerprint: str
    blocks: tuple[SourceBlock, ...]
    max_input_tokens: int
    max_output_tokens: int
    prompt_version: str
    timeout_seconds: int = 20


class Group(BaseModel):
    model_config = ConfigDict(extra="forbid")
    block_ids: list[str] = Field(min_length=1)
    char_start: int = Field(ge=0)
    char_end: int = Field(gt=0)


class AnalysisOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: str
    groups: list[Group] = Field(min_length=1)


class ChunkAnalysisProvider(Protocol):
    def analyze(self, request: ChunkAnalysisRequest) -> "ProviderAnalysisResponse | dict[str, Any] | str": ...


@dataclass(frozen=True)
class ProviderAnalysisResponse:
    """Adapter response with optional provider-reported usage, never raw HTTP metadata."""
    content: dict[str, Any] | str
    input_tokens: int | None = None
    output_tokens: int | None = None


class ProviderCallError(RuntimeError):
    category = "provider_failure"
    retryable = True


class ProviderTimeoutError(TimeoutError, ProviderCallError):
    category = "provider_timeout"


class ProviderRateLimitError(ProviderCallError):
    category = "provider_rate_limit"


class ProviderAuthenticationError(ProviderCallError):
    category = "provider_authentication_failure"
    retryable = False


class ProviderInvalidRequestError(ProviderCallError):
    category = "provider_invalid_request"
    retryable = False


class ProviderMalformedResponseError(ProviderCallError):
    category = "provider_malformed_response"
    retryable = False


class AnalysisRejected(ValueError):
    pass


def token_count(value: str) -> int:
    """Conservative, provider-neutral budget estimate; not a model tokenizer."""
    return max(1, math.ceil(len(value.encode("utf-8")) / 4)) if value else 0


def _validate_request_blocks(request: ChunkAnalysisRequest) -> None:
    blocks = request.blocks
    if not blocks or len({block.id for block in blocks}) != len(blocks):
        raise AnalysisRejected("invalid_source_blocks")
    previous_end = -1
    for block in blocks:
        if not block.id or block.char_start < 0 or block.char_end <= block.char_start:
            raise AnalysisRejected("invalid_source_blocks")
        if block.char_start < previous_end:
            raise AnalysisRejected("overlapping_source_blocks")
        previous_end = block.char_end


def _input_token_estimate(request: ChunkAnalysisRequest) -> int:
    """Budget the complete adapter input, including IDs and structural metadata."""
    payload = {"document_id": request.document_id, "source_fingerprint": request.source_fingerprint,
               "prompt_version": request.prompt_version,
               "blocks": [{"id": block.id, "text": block.text, "char_start": block.char_start,
                           "char_end": block.char_end, "section_id": block.section_id, "ordinal": block.ordinal}
                          for block in request.blocks]}
    return token_count(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))


def validate_output(raw: dict[str, Any] | str, request: ChunkAnalysisRequest) -> list[list[SourceBlock]]:
    """Enforce exact, ordered coverage. Suggestions may group but never rewrite blocks."""
    _validate_request_blocks(request)
    try:
        payload = json.loads(raw) if isinstance(raw, str) else raw
        output = AnalysisOutput.model_validate(payload)
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise AnalysisRejected("malformed_output") from exc
    if output.schema_version != SCHEMA_VERSION:
        raise AnalysisRejected("unsupported_schema_version")
    if token_count(json.dumps(payload, separators=(",", ":"), ensure_ascii=False)) > request.max_output_tokens:
        raise AnalysisRejected("output_token_limit")
    by_id = {block.id: block for block in request.blocks}
    expected = [block.id for block in request.blocks]
    observed = [block_id for group in output.groups for block_id in group.block_ids]
    if len(output.groups) > len(expected):
        raise AnalysisRejected("excessive_groups")
    if any(block_id not in by_id for block_id in observed):
        raise AnalysisRejected("unknown_block_id")
    if len(set(observed)) != len(observed):
        raise AnalysisRejected("duplicate_block_id")
    if observed != expected:
        raise AnalysisRejected("missing_or_invalid_order")
    groups = []
    for group in output.groups:
        selected = [by_id[block_id] for block_id in group.block_ids]
        if group.char_start != selected[0].char_start or group.char_end != selected[-1].char_end:
            raise AnalysisRejected("invalid_group_span")
        groups.append(selected)
    return groups


def analyze_or_fallback(request: ChunkAnalysisRequest, config: QwenChunkingConfig,
                        provider: ChunkAnalysisProvider | None) -> tuple[list[list[SourceBlock]], dict[str, Any]]:
    fallback = [[block] for block in request.blocks]
    effective_request = replace(request, max_input_tokens=min(request.max_input_tokens, config.max_input_tokens),
                                max_output_tokens=min(request.max_output_tokens, config.max_output_tokens),
                                timeout_seconds=min(request.timeout_seconds, config.timeout_seconds))
    base = {"schema_version": SCHEMA_VERSION, "strategy_version": STRATEGY_VERSION,
            "provider": config.provider, "model_id": config.model_id,
            "prompt_version": config.prompt_version, "max_input_tokens": config.max_input_tokens,
            "max_output_tokens": config.max_output_tokens, "timeout_seconds": effective_request.timeout_seconds,
            "token_count_method": TOKEN_COUNT_METHOD, "cache_enabled": config.cache_enabled, "used": False}
    if not config.enabled:
        return fallback, {**base, "fallback_reason": "feature_disabled"}
    if not config.configured or provider is None or config.max_calls_per_document == 0:
        return fallback, {**base, "fallback_reason": "provider_unavailable"}
    try:
        _validate_request_blocks(effective_request)
    except AnalysisRejected as exc:
        return fallback, {**base, "fallback_reason": str(exc)}
    input_tokens = _input_token_estimate(effective_request)
    if input_tokens > effective_request.max_input_tokens:
        return fallback, {**base, "fallback_reason": "input_token_limit"}
    started = time.monotonic()
    for attempt in range(1, config.retries + 2):
        try:
            response = provider.analyze(effective_request)
            raw = response.content if isinstance(response, ProviderAnalysisResponse) else response
            groups = validate_output(raw, effective_request)
            output_tokens = (response.output_tokens if isinstance(response, ProviderAnalysisResponse) else None)
            input_usage = (response.input_tokens if isinstance(response, ProviderAnalysisResponse) else None)
            output_tokens = output_tokens if output_tokens is not None else token_count(json.dumps(raw, separators=(",", ":"), ensure_ascii=False))
            input_usage = input_usage if input_usage is not None else input_tokens
            return groups, {**base, "used": True, "attempts": attempt,
                            "latency_ms": round((time.monotonic() - started) * 1000, 3),
                            "input_tokens_estimated": input_tokens, "input_tokens": input_usage,
                            "output_tokens": output_tokens}
        except AnalysisRejected as exc:
            return fallback, {**base, "fallback_reason": str(exc), "attempts": attempt,
                              "latency_ms": round((time.monotonic() - started) * 1000, 3)}
        except ProviderCallError as exc:
            failure = exc.category
            if not exc.retryable:
                return fallback, {**base, "fallback_reason": failure, "attempts": attempt,
                                  "latency_ms": round((time.monotonic() - started) * 1000, 3)}
        except TimeoutError:
            failure = "provider_timeout"
        except Exception:
            failure = "provider_failure"
        if attempt == config.retries + 1:
            return fallback, {**base, "fallback_reason": failure, "attempts": attempt,
                              "latency_ms": round((time.monotonic() - started) * 1000, 3)}
    raise AssertionError("unreachable")
