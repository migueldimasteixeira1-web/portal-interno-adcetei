from fastapi import APIRouter, Depends

from ...inventory_constants import (
    DEFAULT_INVENTORY_SECTOR,
    INVENTORY_MOVEMENT_ACTIONS,
    INVENTORY_PERMISSIONS,
    INVENTORY_RETIREMENT_REASONS,
    INVENTORY_RETIREMENT_REASON_LABELS,
    INVENTORY_STATUSES,
)
from ...models import User
from ...permissions import require_permission

router = APIRouter()


@router.get("/meta")
def inventory_meta(current_user: User = Depends(require_permission("inventory.view"))):
    return {
        "module": "Inventário",
        "default_sector": DEFAULT_INVENTORY_SECTOR,
        "statuses": list(INVENTORY_STATUSES),
        "movement_actions": list(INVENTORY_MOVEMENT_ACTIONS),
        "retirement_reasons": [
            {"key": key, "label": INVENTORY_RETIREMENT_REASON_LABELS[key]}
            for key in INVENTORY_RETIREMENT_REASONS
        ],
        "permissions": list(INVENTORY_PERMISSIONS),
    }

