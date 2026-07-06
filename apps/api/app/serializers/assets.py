from typing import Any

from ..models import Asset
from .users import serialize_user


def serialize_asset(asset: Asset | None) -> dict[str, Any] | None:
    if not asset:
        return None
    return {
        "id": asset.id,
        "name": asset.name,
        "asset_type": asset.asset_type,
        "manufacturer": asset.manufacturer,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "patrimony": asset.patrimony,
        "status": asset.status,
        "location": asset.location,
        "ip_address": asset.ip_address,
        "operating_system": asset.operating_system,
        "assigned_user_id": asset.assigned_user_id,
        "last_seen_at": asset.last_seen_at,
        "assigned_user": serialize_user(asset.assigned_user),
    }


def serialize_asset_option(asset: Asset | None) -> dict[str, Any] | None:
    if not asset:
        return None
    return {
        "id": asset.id,
        "name": asset.name,
        "asset_type": asset.asset_type,
        "patrimony": asset.patrimony,
    }
