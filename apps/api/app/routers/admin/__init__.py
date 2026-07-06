from fastapi import APIRouter

from .assets import router as assets_router
from .audit import router as audit_router
from .catalog import router as catalog_router
from .roles import router as roles_router
from .users import router as users_router

router = APIRouter(prefix="/api/admin", tags=["administração"])
router.include_router(users_router)
router.include_router(assets_router)
router.include_router(catalog_router)
router.include_router(roles_router)
router.include_router(audit_router)

