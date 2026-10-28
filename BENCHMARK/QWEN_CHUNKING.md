# Optional Qwen-assisted chunk analysis

This feature is disabled by default. It performs no network I/O at import or application startup and deterministic SmartChunk grouping remains the fallback for every provider failure.

## Supported adapter

Phase 12 implements exactly one adapter: `dashscope_openai`, for Alibaba Cloud Model Studio's OpenAI-compatible Chat Completions endpoint. Model Studio documents a workspace-and-region-specific `POST .../compatible-mode/v1/chat/completions` endpoint, Bearer API-key authentication, and OpenAI-compatible responses. API keys are region-bound. The endpoint is deliberately required as configuration; SmartChunk does not guess a region, workspace, or model ID. See Alibaba's [Chat Completions contract](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope) and [structured-output documentation](https://help.aliyun.com/en/model-studio/qwen-structured-output).

Set all of the following only for an explicitly approved deployment:

```text
SMARTCHUNK_QWEN_ENABLED=true
SMARTCHUNK_QWEN_PROVIDER=dashscope_openai
SMARTCHUNK_QWEN_MODEL=<a model enabled for the account and JSON-schema output>
SMARTCHUNK_QWEN_ENDPOINT=https://<workspace>.<region>.maas.aliyuncs.com/compatible-mode/v1/chat/completions
DASHSCOPE_API_KEY=<region-matched API key>
```

`SMARTCHUNK_QWEN_API_KEY` is accepted as a narrowly scoped alternative to `DASHSCOPE_API_KEY`. Do not commit either value. The adapter accepts only the HTTPS workspace-and-region `*.maas.aliyuncs.com/compatible-mode/v1/chat/completions` endpoint shape; an endpoint/key regional mismatch is detected by the provider as an authentication failure. The model name is intentionally configurable rather than hardcoded, because availability and JSON-schema support vary by account and region.

The adapter sends `response_format.type=json_schema`, a strict schema derived from the SmartChunk v1 response schema, `temperature=0`, and `max_tokens` from `SMARTCHUNK_QWEN_MAX_OUTPUT_TOKENS`. It receives only deterministic source blocks (ID, text, offsets, section, ordinal) and may return only groupings of those blocks. Canonical source text and offsets remain authoritative.

## Limits, timeouts, and fallback

Input and output use the conservative `approx_utf8_4chars_v1` budget estimate. Oversized input is rejected before transport; output is validated after receipt. The adapter passes `SMARTCHUNK_QWEN_TIMEOUT_SECONDS` to `httpx` as connect, read, write, and pool transport limits (connect is capped at five seconds), so the timeout is enforced by the HTTP transport rather than stored as metadata.

At most `SMARTCHUNK_QWEN_MAX_CALLS_PER_DOCUMENT` analyses are attempted, and transient timeouts, rate limits, and server/transport failures retry up to `SMARTCHUNK_QWEN_RETRIES`. Authentication failures, invalid requests, malformed HTTP completions, and invalid SmartChunk schemas do not retry. Every such result falls back to deterministic grouping with a sanitized fallback category. Provenance contains only configuration identifiers, limits, elapsed time, attempts, and supplied or estimated token usage; it never contains keys, prompts, source text, or response bodies.

## Offline tests

All tests mock the HTTP transport; none call Qwen:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests\test_qwen_dashscope.py tests\test_qwen_chunking.py
```

## Optional manual live smoke test

Do not run this automatically. The synthetic-only readiness check refuses to make a request unless `--live` is supplied, checks configuration without printing values, validates the production response schema, and emits only sanitized metadata. It may incur provider charges:

```powershell
.\.venv\Scripts\python.exe scripts\run_qwen_live_smoke.py --live
```

It sends one harmless synthetic source block, never a research paper. Do not paste credentials, prompts, or response bodies into logs or issue trackers. A region-mismatched key or endpoint is expected to return `provider_error: provider_authentication_failure`.
