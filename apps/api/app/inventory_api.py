from fastapi import APIRouter, Depends

from .auth import get_current_user
from .inventory_constants import (
    DEFAULT_INVENTORY_SECTOR,
    INVENTORY_MOVEMENT_ACTIONS,
    INVENTORY_PERMISSIONS,
    INVENTORY_STATUSES,
)
from .models import User

router = APIRouter(prefix="/api/inventory", tags=["inventário"])


@router.get("/meta")
def inventory_meta(current_user: User = Depends(get_current_user)):
    return {
        "module": "Inventário",
        "default_sector": DEFAULT_INVENTORY_SECTOR,
        "statuses": list(INVENTORY_STATUSES),
        "movement_actions": list(INVENTORY_MOVEMENT_ACTIONS),
        "permissions": list(INVENTORY_PERMISSIONS),
    }
