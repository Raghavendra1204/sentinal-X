from fastapi import APIRouter, Request

router = APIRouter(prefix="/api", tags=["publish"])


@router.post("/publish")
async def publish_file(request: Request):
    workflow = request.app.state.workflow
    payload = await request.json()
    response = workflow.publish_job(payload)
    return response
