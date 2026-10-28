"""Explicitly opt-in, synthetic-only live readiness smoke test for the Qwen adapter."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from time import perf_counter

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from smartchunk.provider_config import QwenChunkingConfig
from smartchunk.qwen_chunking import (AnalysisRejected, ChunkAnalysisRequest, ProviderCallError,
                                      SourceBlock, validate_output)
from smartchunk.qwen_dashscope import PROVIDER_NAME, DashScopeOpenAIChunkProvider, endpoint_error


def configuration_errors(config: QwenChunkingConfig) -> list[str]:
    errors=[]
    if not config.enabled: errors.append("qwen_disabled")
    if config.provider != PROVIDER_NAME: errors.append("unsupported_or_missing_provider")
    if not config.model_id: errors.append("missing_model")
    if endpoint_validation:=endpoint_error(config.endpoint): errors.append(endpoint_validation)
    if not config.api_key: errors.append("missing_api_key")
    return errors


def main() -> None:
    parser=argparse.ArgumentParser(description="Run one synthetic Qwen chunk-analysis request; may incur provider charges.")
    parser.add_argument("--live", action="store_true", help="Required acknowledgement before any provider request is sent")
    args=parser.parse_args()
    if not args.live:
        raise SystemExit("refusing_live_request: pass --live to send one synthetic provider request")
    load_dotenv(override=False)
    config=QwenChunkingConfig.from_env()
    errors=configuration_errors(config)
    if errors:
        raise SystemExit("configuration_error: " + ",".join(errors))
    text="Synthetic smoke-test text only. No research document content is sent."
    block=SourceBlock("live-smoke-block-1", text, 0, len(text), "live-smoke-section", 1)
    request=ChunkAnalysisRequest("live-smoke-document", hashlib.sha256(text.encode("utf-8")).hexdigest(),
        (block,), config.max_input_tokens, config.max_output_tokens, config.prompt_version, config.timeout_seconds)
    provider=DashScopeOpenAIChunkProvider(config)
    started=perf_counter()
    try:
        response=provider.analyze(request)
        groups=validate_output(response.content, request)
    except ProviderCallError as exc:
        raise SystemExit(f"provider_error: {exc.category}") from exc
    except AnalysisRejected as exc:
        raise SystemExit(f"validation_error: {exc}") from exc
    except Exception as exc:
        raise SystemExit("unexpected_provider_error") from exc
    # Deliberately omit endpoint, request, response content, and every credential from output.
    print(json.dumps({"status":"validated", "provider":config.provider, "model_id":config.model_id,
        "latency_ms":round((perf_counter()-started)*1000,3), "groups":len(groups),
        "input_tokens":response.input_tokens, "output_tokens":response.output_tokens}, sort_keys=True))


if __name__ == "__main__":
    main()
