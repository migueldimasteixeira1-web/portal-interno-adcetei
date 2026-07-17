from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Asset, User
from ..serializers.assets import serialize_asset_option


def ticket_asset_options(db: Session, current_user: User) -> list[dict[str, Any]]:
    query = select(Asset).order_by(Asset.name).where(Asset.status != "retired")
    if current_user.role == "user":
        query = query.where(Asset.assigned_user_id == current_user.id)
    return [option for asset in db.scalars(query) if (option := serialize_asset_option(asset)) is not None]
