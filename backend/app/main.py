from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import httpx
from pydantic import BaseModel

from .config import PROJECT_ROOT, Settings, load_settings
from .library import LibraryError, router
from .preview import PreviewCache, router as preview_router


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "component-template-api"


def create_app(
    settings: Settings | None = None,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    dist_dir: Path | None = PROJECT_ROOT / "dist",
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = settings if settings is not None else load_settings()
        app.state.preview_cache = PreviewCache()
        async with httpx.AsyncClient(timeout=10, follow_redirects=False, trust_env=False, transport=transport) as client:
            app.state.http = client
            yield

    app = FastAPI(title="组件模板平台 API", version="0.1.0", lifespan=lifespan)

    @app.exception_handler(LibraryError)
    async def library_error(_request: Request, error: LibraryError):
        return JSONResponse({"error": {"code": error.code}}, status_code=error.status, headers={"Cache-Control": "no-store"})

    @app.get("/api/health", tags=["服务"], response_model=HealthResponse, summary="检查组件后端是否运行")
    async def health() -> HealthResponse:
        return HealthResponse()

    app.include_router(router)
    app.include_router(preview_router)

    if dist_dir is not None and (dist_dir / "index.html").is_file():
        app.mount("/", StaticFiles(directory=dist_dir, html=True), name="workbench")
    return app


app = create_app()
