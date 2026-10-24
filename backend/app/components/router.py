from urllib.parse import quote

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response

from .models import ActionRequest, ComponentDocument, CreateDraftRequest, PublishRequest
from .service import serialize_component


router = APIRouter(prefix="/api/component-drafts", tags=["组件草稿"])
publication_router = APIRouter(prefix="/api/published-components", tags=["组件发布库"])


@publication_router.get("")
def list_publications(request: Request):
    return JSONResponse(request.app.state.publications.list(), headers={"Cache-Control": "no-store"})


@publication_router.get("/{publication_id}")
def publication(request: Request, publication_id: str):
    return JSONResponse(request.app.state.publications.detail(publication_id), headers={"Cache-Control": "no-store"})


@publication_router.get("/{publication_id}/download")
def publication_download(request: Request, publication_id: str):
    return Response(request.app.state.publications.package(publication_id), media_type="application/octet-stream", headers={
        "Content-Disposition": f'attachment; filename="{publication_id}.rwpart"', "Cache-Control": "no-store",
    })


@router.post("/{draft_id}/publish")
def publish_draft(request: Request, draft_id: str, body: PublishRequest):
    return JSONResponse(request.app.state.publications.publish(draft_id, body.expectedRevision), headers={"Cache-Control": "no-store"})


@router.get("")
def list_drafts(request: Request):
    return request.app.state.drafts.list()


@router.post("")
def create_draft(request: Request, body: CreateDraftRequest):
    return request.app.state.drafts.create(name=body.name, document=body.document)


@router.get("/{draft_id}")
def get_draft(request: Request, draft_id: str, afterRevision: int = Query(default=0, ge=0, le=9007199254740991)):
    return request.app.state.drafts.get(draft_id, after_revision=afterRevision)


@router.post("/{draft_id}/actions")
def update_draft(request: Request, draft_id: str, body: ActionRequest):
    return request.app.state.drafts.update(draft_id, body.expectedRevision, body.action)


@router.get("/{draft_id}/validation")
def get_validation(request: Request, draft_id: str):
    draft = request.app.state.drafts.get(draft_id)
    return {"draftId": draft_id, "revision": draft["document"]["revision"], "checks": draft["checks"]}


@router.get("/{draft_id}/export")
def export_draft(request: Request, draft_id: str):
    draft = request.app.state.drafts.get(draft_id)
    document = ComponentDocument.model_validate(draft["document"])
    return JSONResponse(serialize_component(document), headers={
        "Content-Disposition": f"attachment; filename=component.json; filename*=UTF-8''{quote(document.definition.name + '.json', safe='')}",
        "Cache-Control": "no-store",
    })
