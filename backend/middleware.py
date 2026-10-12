"""ASGI request limits and local operator protection for all job data."""

from contextvars import ContextVar
from uuid import uuid4

from fastapi.responses import JSONResponse

from .approvals import require_operator
from .models import WorkflowError


correlation_id: ContextVar[str | None] = ContextVar("sentinel_correlation_id", default=None)


class ApiGuard:
    def __init__(self, app, settings):
        self.app = app
        self.settings = settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope.get("path", "").startswith("/api/"):
            await self.app(scope, receive, send)
            return
        if scope.get("method") == "OPTIONS":
            await self.app(scope, receive, send)
            return

        request_id = "req-" + uuid4().hex
        correlation_id.set(request_id)

        async def reply(status, message, code):
            response = JSONResponse(status_code=status,
                                    content={"detail": message, "code": code},
                                    headers={"Cache-Control": "no-store",
                                             "X-Content-Type-Options": "nosniff",
                                             "Referrer-Policy": "no-referrer",
                                             "X-Correlation-ID": request_id})
            await response(scope, receive, send)

        tokens = [value.decode("latin-1") for key, value in scope["headers"]
                  if key.lower() == b"x-operator-token"]
        if len(tokens) != 1 or len(tokens[0]) > 256:
            await reply(401, "operator authentication required", "AUTH_REQUIRED")
            return
        try:
            require_operator(self.settings, tokens[0])
        except WorkflowError as error:
            await reply(error.http_status, str(error),
                        "AUTH_NOT_CONFIGURED" if error.http_status == 503 else "AUTH_REQUIRED")
            return

        async def send_no_store(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(((b"cache-control", b"no-store"),
                                (b"x-content-type-options", b"nosniff"),
                                (b"referrer-policy", b"no-referrer"),
                                (b"x-correlation-id", request_id.encode("ascii"))))
                message = {**message, "headers": headers}
            await send(message)

        if scope.get("method") not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send_no_store)
            return
        lengths = [value for key, value in scope["headers"] if key.lower() == b"content-length"]
        if len(lengths) > 1:
            await reply(400, "invalid content length", "INVALID_REQUEST")
            return
        if lengths:
            try:
                size = int(lengths[0])
            except ValueError:
                await reply(400, "invalid content length", "INVALID_REQUEST")
                return
            if size < 0 or size > self.settings.max_request_bytes:
                await reply(413, "request body too large", "REQUEST_TOO_LARGE")
                return
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                await reply(400, "invalid request stream", "INVALID_REQUEST")
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.settings.max_request_bytes:
                await reply(413, "request body too large", "REQUEST_TOO_LARGE")
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send_no_store)
