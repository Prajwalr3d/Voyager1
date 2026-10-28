"""Typed, optional provider settings. Loading settings never performs a provider call."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _bool(name: str, default: bool = False) -> bool:
    value=os.getenv(name)
    if value is None: return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try: value=int(os.getenv(name, str(default)))
    except ValueError: return default
    return max(minimum, min(maximum, value))


@dataclass(frozen=True)
class QwenChunkingConfig:
    enabled: bool = False
    provider: str | None = None
    model_id: str | None = None
    endpoint: str | None = None
    api_key: str | None = field(default=None, repr=False)
    timeout_seconds: int = 20
    max_input_tokens: int = 2_000
    max_output_tokens: int = 800
    max_calls_per_document: int = 1
    retries: int = 1
    cache_enabled: bool = False
    prompt_version: str = "qwen-chunk-analysis/v1"

    @classmethod
    def from_env(cls) -> "QwenChunkingConfig":
        return cls(enabled=_bool("SMARTCHUNK_QWEN_ENABLED"), provider=os.getenv("SMARTCHUNK_QWEN_PROVIDER") or None,
            model_id=os.getenv("SMARTCHUNK_QWEN_MODEL") or None, endpoint=os.getenv("SMARTCHUNK_QWEN_ENDPOINT") or None,
            api_key=os.getenv("SMARTCHUNK_QWEN_API_KEY") or os.getenv("DASHSCOPE_API_KEY") or None,
            timeout_seconds=_bounded_int("SMARTCHUNK_QWEN_TIMEOUT_SECONDS",20,1,120),
            max_input_tokens=_bounded_int("SMARTCHUNK_QWEN_MAX_INPUT_TOKENS",2_000,100,16_000),
            max_output_tokens=_bounded_int("SMARTCHUNK_QWEN_MAX_OUTPUT_TOKENS",800,50,4_000),
            max_calls_per_document=_bounded_int("SMARTCHUNK_QWEN_MAX_CALLS_PER_DOCUMENT",1,0,10),
            retries=_bounded_int("SMARTCHUNK_QWEN_RETRIES",1,0,3), cache_enabled=_bool("SMARTCHUNK_QWEN_CACHE_ENABLED"),
            prompt_version=os.getenv("SMARTCHUNK_QWEN_PROMPT_VERSION","qwen-chunk-analysis/v1"))

    @property
    def configured(self) -> bool:
        return self.enabled and bool(self.provider and self.model_id)
