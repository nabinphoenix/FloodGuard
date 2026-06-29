from importlib import import_module
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import Base, engine
from models import alert, report, sensor, user  # noqa: F401


app = FastAPI(
    title="FloodGuard API",
    description="Real-time Flood Early Warning System backend API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def include_project_router(module_name: str, prefix: str, tags: list[str]) -> None:
    module = import_module(f"routers.{module_name}")
    router = getattr(module, "router", APIRouter(prefix=prefix, tags=tags))
    app.include_router(router)


include_project_router("auth", "/auth", ["auth"])
include_project_router("public", "/public", ["public"])
include_project_router("reports", "/reports", ["reports"])
include_project_router("admin", "/admin", ["admin"])
include_project_router("sensors", "/sensors", ["sensors"])


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "FloodGuard API"}


backend_dir = Path(__file__).resolve().parent
frontend_dist_dir = backend_dir.parent / "frontend" / "dist"

if frontend_dist_dir.exists():
    frontend_assets_dir = frontend_dist_dir / "assets"
    if frontend_assets_dir.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=frontend_assets_dir),
            name="frontend-assets",
        )

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_react_app(full_path: str) -> FileResponse:
        requested_path = frontend_dist_dir / full_path
        if requested_path.is_file():
            return FileResponse(requested_path)
        return FileResponse(frontend_dist_dir / "index.html")
