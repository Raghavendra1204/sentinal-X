from fastapi import APIRouter, Header, Request

from ..approvals import require_operator


router = APIRouter(prefix="/api/jobs", tags=["verification"])
verifications_router = APIRouter(prefix="/api", tags=["verification"])


@router.post("/{job_id}/verify")
def verify(job_id: str, request: Request,
           x_operator_token: str | None = Header(default=None)):
    require_operator(request.app.state.workflow.settings, x_operator_token)
    return request.app.state.workflow.verify(job_id)


@verifications_router.get("/verifications")
def list_verifications(request: Request, limit: int = 50):
    return request.app.state.workflow.list_verifications(limit)


