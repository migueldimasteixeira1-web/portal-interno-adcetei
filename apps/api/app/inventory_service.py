from datetime import date, datetime, time, timezone

from .inventory_constants import DEFAULT_INVENTORY_SECTOR
from .time_utils import SAO_PAULO, ensure_utc


def normalize_catalog_name(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


DEFAULT_SECTOR_UPDATE_ERROR = "O setor padrão ADCETEI não pode ser renomeado ou desativado."


def is_default_inventory_sector_name(name: str) -> bool:
    return normalize_catalog_name(name) == normalize_catalog_name(DEFAULT_INVENTORY_SECTOR)


def default_sector_update_error(updates: dict[str, object], *, current_name: str) -> str | None:
    if not is_default_inventory_sector_name(current_name):
        return None
    if "name" in updates and not is_default_inventory_sector_name(str(updates["name"])):
        return DEFAULT_SECTOR_UPDATE_ERROR
    if updates.get("is_active") is False:
        return DEFAULT_SECTOR_UPDATE_ERROR
    return None


def normalize_serial_number(value: str | None) -> str:
    return " ".join((value or "").strip().split()).casefold()


def display_serial_number(value: str | None) -> str:
    return " ".join((value or "").strip().split())


def initial_inventory_status(sector: str | None, responsible_id: int | None = None) -> str:
    normalized_sector = " ".join((sector or "").strip().split()).casefold()
    default_sector = DEFAULT_INVENTORY_SECTOR.casefold()
    if normalized_sector == default_sector and responsible_id is None:
        return "stock"
    return "allocated"


def validate_shipping_date_for_status(status: str, shipping_date: date | datetime | None) -> None:
    if status == "allocated" and shipping_date is None:
        raise ValueError("Data de envio obrigatória para equipamento alocado")


def build_asset_display_name(
    asset_type: str | None = None,
    manufacturer: str | None = None,
    model: str | None = None,
    serial_number: str | None = None,
) -> str:
    parts = [
        " ".join((part or "").strip().split())
        for part in (asset_type, manufacturer, model, serial_number)
        if part and part.strip()
    ]
    return " - ".join(parts) if parts else "Equipamento sem identificação"


def inventory_status_from_asset(asset) -> str:
    return "allocated" if getattr(asset, "status", "") == "active" else getattr(asset, "status", "")


def legacy_asset_status(status: str) -> str:
    return "active" if status == "allocated" else status


def movement_datetime(value: date | datetime) -> datetime:
    if isinstance(value, datetime):
        normalized = ensure_utc(value)
        if normalized is None:
            raise ValueError("Data da movimentação obrigatória")
        return normalized
    return datetime.combine(value, time(hour=12), tzinfo=SAO_PAULO).astimezone(timezone.utc)


def asset_movement_state(asset) -> dict[str, int | str | None]:
    return {
        "sector_id": getattr(asset, "sector_id", None),
        "user_id": getattr(asset, "assigned_user_id", None),
        "status": inventory_status_from_asset(asset),
    }


def movement_values(
    *,
    asset_id: int,
    action: str,
    before: dict[str, int | str | None],
    after: dict[str, int | str | None],
    movement_date: datetime,
    notes: str,
    actor_id: int | None,
) -> dict[str, int | str | datetime | None]:
    return {
        "asset_id": asset_id,
        "action": action,
        "from_sector_id": before.get("sector_id"),
        "to_sector_id": after.get("sector_id"),
        "from_user_id": before.get("user_id"),
        "to_user_id": after.get("user_id"),
        "from_status": before.get("status"),
        "to_status": after.get("status") or "",
        "movement_date": movement_date,
        "notes": notes.strip(),
        "actor_id": actor_id,
    }


def apply_asset_allocation(asset, sector, assigned_user_id: int | None, delivered_at: datetime) -> None:
    asset.sector_id = sector.id
    asset.location = sector.name
    asset.assigned_user_id = assigned_user_id
    asset.delivered_at = delivered_at
    asset.status = legacy_asset_status("allocated")


def apply_responsible_change(asset, assigned_user_id: int, movement_at: datetime) -> None:
    if inventory_status_from_asset(asset) == "stock":
        raise ValueError("Equipamento em estoque deve ser enviado para setor antes de trocar responsável")
    asset.assigned_user_id = assigned_user_id
    asset.delivered_at = movement_at
    asset.status = legacy_asset_status("allocated")


def apply_return_to_stock(asset, default_sector) -> None:
    asset.sector_id = default_sector.id
    asset.location = default_sector.name
    asset.assigned_user_id = None
    asset.delivered_at = None
    asset.status = legacy_asset_status("stock")


def apply_send_to_maintenance(asset) -> None:
    asset.status = legacy_asset_status("maintenance")


def asset_is_retired(asset) -> bool:
    return inventory_status_from_asset(asset) == "retired"


def ensure_asset_movable(asset) -> None:
    if asset_is_retired(asset):
        raise ValueError("Equipamento baixado não pode ser movimentado")


def retirement_reason_label(reason: str) -> str:
    from .inventory_constants import INVENTORY_RETIREMENT_REASON_LABELS

    return INVENTORY_RETIREMENT_REASON_LABELS.get(reason, reason)


def build_retirement_movement_notes(*, reason: str, justification: str, notes: str = "") -> str:
    parts = [
        f"Motivo: {retirement_reason_label(reason)} ({reason})",
        f"Justificativa: {justification.strip()}",
    ]
    cleaned_notes = (notes or "").strip()
    if cleaned_notes:
        parts.append(f"Observações: {cleaned_notes}")
    return "\n".join(parts)


def apply_retire_asset(
    asset,
    *,
    retired_at,
    retired_by_user_id: int,
    reason: str,
    justification: str,
    notes: str = "",
) -> None:
    if asset_is_retired(asset):
        raise ValueError("Equipamento já está baixado")
    asset.status = legacy_asset_status("retired")
    asset.retired_at = retired_at
    asset.retired_by_user_id = retired_by_user_id
    asset.retirement_reason = reason
    asset.retirement_justification = justification.strip()
    asset.retirement_notes = (notes or "").strip()


def build_bulk_scan_preview(serial_numbers: list[str], existing_serial_statuses: dict[str, str]) -> dict:
    valid_items: list[dict] = []
    errors: list[dict] = []
    seen: set[str] = set()

    for index, raw_serial in enumerate(serial_numbers, start=1):
        serial = display_serial_number(raw_serial)
        normalized = normalize_serial_number(serial)
        if not normalized:
            errors.append({
                "index": index,
                "serial_number": raw_serial,
                "normalized_serial": "",
                "message": "Número de série obrigatório",
            })
            continue
        if normalized in seen:
            errors.append({
                "index": index,
                "serial_number": serial,
                "normalized_serial": normalized,
                "message": "Número de série duplicado no lote",
            })
            continue
        seen.add(normalized)
        if normalized in existing_serial_statuses:
            status = existing_serial_statuses[normalized]
            if status == "retired":
                message = "Equipamento baixado — consulte o histórico no inventário; não pode ser reentrado em lote"
            else:
                message = "Número de série já cadastrado"
            errors.append({
                "index": index,
                "serial_number": serial,
                "normalized_serial": normalized,
                "message": message,
            })
            continue
        valid_items.append({
            "index": index,
            "serial_number": serial,
            "normalized_serial": normalized,
        })

    return {
        "total": len(serial_numbers),
        "valid_count": len(valid_items),
        "invalid_count": len(errors),
        "valid_items": valid_items,
        "errors": errors,
    }
