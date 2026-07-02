from datetime import date, datetime

from .inventory_constants import DEFAULT_INVENTORY_SECTOR


def normalize_catalog_name(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


def normalize_serial_number(value: str | None) -> str:
    return " ".join((value or "").strip().split()).casefold()


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
