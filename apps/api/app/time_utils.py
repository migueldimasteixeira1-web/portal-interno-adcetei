from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

SAO_PAULO = ZoneInfo("America/Sao_Paulo")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def iso_utc(value: datetime | None) -> str | None:
    normalized = ensure_utc(value)
    if normalized is None:
        return None
    return normalized.isoformat().replace("+00:00", "Z")


def sao_paulo_day_bounds_utc(reference: datetime | None = None) -> tuple[datetime, datetime]:
    current = ensure_utc(reference) or utc_now()
    local_date = current.astimezone(SAO_PAULO).date()
    start_local = datetime.combine(local_date, time.min, tzinfo=SAO_PAULO)
    end_local = datetime.combine(local_date, time.max, tzinfo=SAO_PAULO)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)
