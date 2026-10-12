from fastapi import APIRouter, Query, Request


router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("")
def list_jobs(request: Request, limit: int = Query(default=100, ge=1, le=100),
              offset: int = Query(default=0, ge=0)):
    return request.app.state.workflow.list_jobs(limit, offset)


@router.get("/{job_id}")
def get_job(job_id: str, request: Request):
    return request.app.state.workflow.get_job(job_id)


@router.get("/{job_id}/patch")
def get_patch(job_id: str, request: Request):
    return request.app.state.workflow.get_patch(job_id)


@router.post("/{job_id}/plan")
def plan_job(job_id: str, request: Request):
    request.app.state.workflow.plan(job_id)
    return request.app.state.workflow.get_job(job_id)


@router.get("/{job_id}/evidence")
def get_evidence(job_id: str, request: Request):
    return request.app.state.workflow.evidence(job_id)


@router.get("/{job_id}/events")
def get_events(job_id: str, request: Request):
    return request.app.state.workflow.events(job_id)


@router.get("/{job_id}/comments")
def get_comments(job_id: str, request: Request):
    return request.app.state.workflow.list_comments(job_id)


@router.post("/{job_id}/comments")
async def add_comment(job_id: str, request: Request):
    body = await request.json()
    author_id = str(body.get("author_id") or "OP-OPERATOR")
    author_name = str(body.get("author_name") or "Operator")
    author_role = str(body.get("author_role") or "Security Engineer")
    comment_text = str(body.get("comment_text") or "")
    if not comment_text.strip():
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="comment_text cannot be empty")
    return request.app.state.workflow.add_comment(
        job_id, author_id, author_name, author_role, comment_text
    )

