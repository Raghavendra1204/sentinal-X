from __future__ import annotations
import os
from .context import build_context
from .parser import parse_proposal
from .edits import GUARD_SCHEMA, build_guard_diff, parse_guard_response
from .prompts.guard import build_guard_prompt
from .providers.gemini import GeminiProvider
from .providers.ollama import OllamaProvider

class GenerationError(RuntimeError):
    def __init__(self, message: str, failure_type: str | None = None):
        super().__init__(message)
        self.failure_type = failure_type


def _get_provider():
    provider_name = os.getenv("SENTINEL_LLM_PROVIDER", "").lower()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if provider_name == "gemini" or (gemini_key and provider_name != "ollama"):
        return GeminiProvider(api_key=gemini_key)
    return OllamaProvider()


def generate_patch(finding: dict, source_context: dict[str, str], attempt: int,
                   revision_guidance: str | None = None) -> dict:
    """Generate a proposal only. Does not read files, apply patches, approve or verify."""
    if not isinstance(attempt, int) or isinstance(attempt, bool) or attempt < 0 or attempt >= int(os.getenv("SENTINEL_MAX_ATTEMPTS", "3")):
        raise GenerationError("Attempt number is outside the configured limit")
    allowed = {p.strip() for p in os.getenv("SENTINEL_ALLOWED_PATHS", "app/access.py").split(",") if p.strip()} | set(source_context.keys())
    # For this proposal, only caller-supplied paths that are also explicitly allowlisted are sent to the provider.
    context = build_context(finding, source_context, allowed_paths=allowed)
    if not context["source_context"]:
        raise GenerationError("No authorized source context remains")
    provider = _get_provider()
    prompt = build_guard_prompt(context, attempt, revision_guidance)
    try:
        raw = provider.generate(prompt, format_schema=GUARD_SCHEMA)
        try:
            from pathlib import Path
            Path("local-audit/last_generator_raw.json").write_text(raw, encoding="utf-8")
        except Exception:
            pass
        root_cause, explanation, guard_code = parse_guard_response(raw)
        path, source = next(iter(context["source_context"].items()))
        source = source.replace("\r\n", "\n")
        patch_text = build_guard_diff(source, path, guard_code).replace("\r\n", "\n")
        proposal = {"root_cause": root_cause, "explanation": explanation,
                    "patch_format": "unified_diff", "patch_text": patch_text,
                    "files_changed": [path]}
        import json
        parsed = parse_proposal(json.dumps(proposal), set(context["source_context"]))
    except (Exception,) as exc:
        # Deliberately do not echo prompts, source, raw model output, URLs, or exception details.
        if isinstance(exc, (KeyboardInterrupt, SystemExit)): raise
        raise GenerationError(f"Patch generation failed ({type(exc).__name__}: {str(exc)[:100]})", type(exc).__name__) from None
    return {"root_cause": parsed.root_cause, "explanation": parsed.explanation,
            "patch_format": parsed.patch_format, "patch_text": parsed.patch_text,
            "files_changed": parsed.files_changed,
            "model": provider.model, "attempt": attempt}
