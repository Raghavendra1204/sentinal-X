from __future__ import annotations
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from .base import ProviderError, ProviderTimeoutError


class GeminiProvider:
    """Gemini API provider using standard library HTTP only."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        connect_timeout: float | None = None,
        inference_timeout: float | None = None,
        retries: int | None = None,
        max_output_chars: int | None = None,
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = model or os.getenv("SENTINEL_GEMINI_MODEL", "gemini-3.5-flash")
        self.connect_timeout = connect_timeout or float(os.getenv("SENTINEL_CONNECT_TIMEOUT", "3"))
        self.inference_timeout = inference_timeout or float(os.getenv("SENTINEL_INFERENCE_TIMEOUT", "60"))
        self.retries = retries if retries is not None else int(os.getenv("SENTINEL_PROVIDER_RETRIES", "2"))
        self.max_output_chars = max_output_chars or int(os.getenv("SENTINEL_MAX_OUTPUT_CHARS", "40000"))

        if not self.api_key.strip():
            raise ValueError("Gemini API key is required")
        if not self.model.strip():
            raise ValueError("Gemini model name is required")
        if min(self.connect_timeout, self.inference_timeout) <= 0 or self.retries < 0:
            raise ValueError("Timeouts must be positive and retries non-negative")

    def health(self) -> bool:
        """Check if Gemini API is reachable with key."""
        return bool(self.api_key)

    def _clean_schema(self, schema: dict) -> dict:
        """Gemini's responseSchema is a subset of OpenAPI 3.0; remove unsupported JSON-schema fields."""
        cleaned = {}
        for k, v in schema.items():
            if k in ("additionalProperties", "$schema"):
                continue
            if isinstance(v, dict):
                cleaned[k] = self._clean_schema(v)
            elif isinstance(v, list):
                cleaned[k] = [self._clean_schema(i) if isinstance(i, dict) else i for i in v]
            else:
                cleaned[k] = v
        return cleaned

    def generate(self, prompt: str, format_schema: dict | None = None) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        payload: dict = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json",
            }
        }

        if format_schema:
            payload["generationConfig"]["responseSchema"] = self._clean_schema(format_schema)

        body = json.dumps(payload).encode("utf-8")
        fallback_models = [self.model, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
        seen_models = []
        for m in fallback_models:
            if m not in seen_models:
                seen_models.append(m)

        last_error = None
        for current_model in seen_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={self.api_key}"
            req = Request(
                url,
                data=body,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                method="POST",
            )
            for attempt in range(self.retries + 1):
                try:
                    with urlopen(req, timeout=self.inference_timeout) as response:
                        raw = response.read(self.max_output_chars * 4 + 1)
                    if len(raw) > self.max_output_chars * 4:
                        raise ProviderError("Provider response exceeded configured size limit")
                    data = json.loads(raw.decode("utf-8"))
                    
                    # Extract response text
                    candidates = data.get("candidates", [])
                    if not candidates:
                        raise ProviderError("Provider returned no candidates")
                    
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if not parts:
                        raise ProviderError("Provider candidate contains no parts")
                    
                    result = parts[0].get("text", "")
                    if not isinstance(result, str) or not result.strip():
                        raise ProviderError("Provider returned an empty or malformed response")
                    if len(result) > self.max_output_chars:
                        raise ProviderError("Provider response exceeded configured size limit")
                    return result
                except HTTPError as exc:
                    if exc.code in (429, 503) and current_model != seen_models[-1]:
                        # High demand spike or RPM rate limit on this model; fail over to next model tier
                        break
                    if exc.code not in (408, 425, 429, 500, 502, 503, 504) or attempt >= self.retries:
                        raise ProviderError(f"Gemini request failed (HTTP {exc.code})") from None
                except TimeoutError:
                    if attempt >= self.retries:
                        raise ProviderTimeoutError("Gemini inference timed out") from None
                except URLError as exc:
                    if attempt >= self.retries:
                        if isinstance(exc.reason, TimeoutError):
                            raise ProviderTimeoutError("Gemini inference timed out") from None
                        raise ProviderError("Gemini unavailable") from None
                except (ConnectionError, OSError):
                    if attempt >= self.retries:
                        raise ProviderError("Gemini unavailable") from None
                except (UnicodeDecodeError, json.JSONDecodeError):
                    raise ProviderError("Gemini returned malformed JSON") from None

                import time
                time.sleep(min(0.5 * (2 ** attempt), 2.0))

        raise ProviderError("Gemini request exhausted retries")
