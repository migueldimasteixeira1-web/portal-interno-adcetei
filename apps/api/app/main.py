from datetime import datetime, timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .admin_api import router as admin_router
from .config import settings
from .database import SessionLocal
from .inventory_api import router as inventory_router
from .permissions import ensure_role_configs
from .routers.auth import router as auth_router
from .routers.tickets import router as tickets_router
from .routers.remote_access import router as remote_access_router
from .routers.users_assets import router as users_assets_router
from .seed import seed_database

app = FastAPI(
    title=settings.app_name,
    version="0.3.0",
    docs_url="/docs" if settings.is_local_environment else None,
    redoc_url="/redoc" if settings.is_local_environment else None,
    openapi_url="/openapi.json" if settings.is_local_environment else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(users_assets_router)
app.include_router(tickets_router)
app.include_router(admin_router)
app.include_router(inventory_router)
app.include_router(remote_access_router)


@app.on_event("startup")
def startup() -> None:
    with SessionLocal() as db:
        ensure_role_configs(db)
        if settings.demo_seed_enabled:
            seed_database(db)
        db.commit()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name, "auth_mode": settings.auth_mode}
