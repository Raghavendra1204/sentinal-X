"""FastAPI entry point: uvicorn backend.main:app --host 127.0.0.1 --port 8000."""

import logging
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings
from .database import Database
from .middleware import ApiGuard
from .models import WorkflowError
from .routes import approvals, findings, jobs, verification, publish
from .services.agent_adapter import AgentAdapter, ConfiguredAgentAdapter
from .services.verification_adapter import ConfiguredVerificationAdapter, VerificationAdapter
from .workflow import Workflow

logger = logging.getLogger("sentinel_x.backend")


def create_app(settings: Settings | None = None, agent: AgentAdapter | None = None,
               verifier: VerificationAdapter | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    app = FastAPI(title="SENTINEL-X Backend", version="0.3.0")
    frontend_origins = [settings.frontend_origin]
    origin = urlsplit(settings.frontend_origin)
    if origin.hostname in ("localhost", "127.0.0.1"):
        alias = "127.0.0.1" if origin.hostname == "localhost" else "localhost"
        port = f":{origin.port}" if origin.port is not None else ""
        frontend_origins.append(f"{origin.scheme}://{alias}{port}")
    app.add_middleware(ApiGuard, settings=settings)
    app.add_middleware(CORSMiddleware, allow_origins=frontend_origins,
                       allow_credentials=False, allow_methods=["GET", "POST"],
                       allow_headers=["Content-Type", "X-Operator-Token"])
    workflow = Workflow(Database(settings.database_path), settings,
                        agent or ConfiguredAgentAdapter(settings),
                        verifier or ConfiguredVerificationAdapter(settings))
    workflow.recover_interrupted()
    app.state.workflow = workflow

    @app.get("/", include_in_schema=False)
    def index():
        return RedirectResponse(url="/docs")

    @app.exception_handler(WorkflowError)
    async def workflow_error_handler(request: Request, error: WorkflowError):
        return JSONResponse(status_code=error.http_status,
                            content={"detail": str(error), "code": error.code})

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, error: RequestValidationError):
        fields = [{"loc": [str(item) for item in issue["loc"]], "type": issue["type"]}
                  for issue in error.errors()[:20]]
        return JSONResponse(status_code=422,
                            content={"detail": "request validation failed",
                                     "code": "REQUEST_VALIDATION_ERROR", "errors": fields})

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, error: StarletteHTTPException):
        return JSONResponse(status_code=error.status_code,
                            content={"detail": "HTTP request failed", "code": "HTTP_ERROR"})

    @app.exception_handler(Exception)
    async def internal_error_handler(request: Request, error: Exception):
        logger.error("unhandled backend error")
        return JSONResponse(status_code=500,
                            content={"detail": "internal server error", "code": "INTERNAL_ERROR"})

    @app.get("/ready", tags=["health"])
    def ready():
        if not settings.operator_token:
            return JSONResponse(status_code=503, content={"status": "not_ready"})
        if isinstance(workflow.agent, ConfiguredAgentAdapter) and not settings.agent_callable:
            return JSONResponse(status_code=503, content={"status": "not_ready"})
        if isinstance(workflow.verifier, ConfiguredVerificationAdapter) and not settings.verifier_callable:
            return JSONResponse(status_code=503, content={"status": "not_ready"})
        with workflow.db.read() as db:
            db.execute("SELECT 1").fetchone()
        return {"status": "ready"}

    @app.get("/health", tags=["health"])
    def health():
        return {"status": "ok", "service": "sentinel-x-backend"}

    app.include_router(findings.router)
    app.include_router(jobs.router)
    app.include_router(approvals.router)
    app.include_router(verification.router)
    app.include_router(verification.verifications_router)
    app.include_router(publish.router)
    return app


app = create_app()
