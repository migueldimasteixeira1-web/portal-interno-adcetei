from fastapi import APIRouter

from .assets import router as assets_router
from .catalogs import router as catalogs_router
from .meta import router as meta_router
from .terms import router as terms_router

router = APIRouter(prefix="/api/inventory", tags=["inventário"])
router.include_router(meta_router)
router.include_router(assets_router)
router.include_router(catalogs_router)
router.include_router(terms_router)
