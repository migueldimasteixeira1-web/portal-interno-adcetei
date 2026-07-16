from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ...audit import add_audit
from ...database import get_db
from ...delivery_terms_service import ensure_asset_not_reserved
from ...inventory_export import export_inventory_assets
from ...inventory_helpers import (
    add_asset_movement,
    asset_display_name,
    bulk_scan_preview_payload,
    calculated_asset_status,
    create_bulk_scan_asset,
    ensure_shipping_date,
    ensure_unique_serial,
    fresh_inventory_asset,
    get_default_sector,
    get_inventory_asset_or_404,
    inventory_asset_filter_conditions,
    inventory_asset_payload,
    inventory_asset_query,
    inventory_assets_base_query,
    inventory_movement_payload,
    inventory_movement_query,
    normalize_inventory_serial,
    validate_asset_catalogs,
    validate_optional_catalogs,
    validate_user_for_sector,
    has_rows,
)
from ...inventory_service import (
    apply_asset_allocation,
    apply_responsible_change,
    apply_retire_asset,
    apply_return_to_stock,
    apply_send_to_maintenance,
    asset_is_retired,
    asset_movement_state,
    build_asset_display_name,
    build_retirement_movement_notes,
    display_serial_number,
    ensure_asset_movable,
    legacy_asset_status,
    movement_datetime,
)
from ...models import Asset, AssetMovement, InventorySector, Ticket, User
from ...permissions import require_permission
from ...schemas import (
    InventoryAllocateRequest,
    InventoryAssetCreate,
    InventoryAssetOut,
    InventoryAssetPageOut,
    InventoryAssetUpdate,
    InventoryBulkScanConfirmOut,
    InventoryBulkScanPreviewOut,
    InventoryBulkScanRequest,
    InventoryChangeResponsibleRequest,
    InventoryMaintenanceRequest,
    InventoryMovementOut,
    InventoryRetireRequest,
    InventoryReturnToStockRequest,
)
from ...time_utils import utc_now

router = APIRouter()


def _guard_movable(asset: Asset) -> None:
    try:
        ensure_asset_movable(asset)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/assets", response_model=InventoryAssetPageOut)
def list_inventory_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = None,
    equipment_type_id: int | None = None,
    secretariat_id: int | None = None,
    sector_id: int | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    conditions, needs_join = inventory_asset_filter_conditions(
        status_filter=status_filter,
        equipment_type_id=equipment_type_id,
        secretariat_id=secretariat_id,
        sector_id=sector_id,
        search=search,
    )

    def aggregate_count(*extra_conditions: Any) -> int:
        merged = [*conditions, *extra_conditions]
        if needs_join:
            return db.scalar(
                select(func.count()).select_from(
                    inventory_assets_base_query(conditions=merged, needs_join=True)
                    .with_only_columns(Asset.id)
                    .distinct()
                    .subquery()
                )
            ) or 0
        count_stmt = select(func.count(Asset.id))
        if merged:
            count_stmt = count_stmt.where(*merged)
        return db.scalar(count_stmt) or 0

    total = aggregate_count()
    asset_ids = list(
        db.scalars(
            inventory_assets_base_query(conditions=conditions, needs_join=needs_join)
            .with_only_columns(Asset.id)
            .distinct()
            .order_by(Asset.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    items = list(
        db.scalars(inventory_asset_query().where(Asset.id.in_(asset_ids)).order_by(Asset.id.desc())).unique()
    ) if asset_ids else []
    return InventoryAssetPageOut(
        items=[inventory_asset_payload(asset) for asset in items],
        total=total,
        page=page,
        page_size=page_size,
        summary={
            "stock": aggregate_count(Asset.status == "stock"),
            "allocated": aggregate_count(Asset.status.in_(["active", "allocated"])),
            "maintenance": aggregate_count(Asset.status == "maintenance"),
            "retired": aggregate_count(Asset.status == "retired"),
        },
    )


@router.get("/assets/export")
def export_inventory_assets_spreadsheet(
    status_filter: str | None = None,
    equipment_type_id: int | None = None,
    secretariat_id: int | None = None,
    sector_id: int | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    content, filename, exported_count = export_inventory_assets(
        db,
        actor=current_user,
        status_filter=status_filter,
        equipment_type_id=equipment_type_id,
        secretariat_id=secretariat_id,
        sector_id=sector_id,
        search=search,
    )
    add_audit(
        db,
        actor=current_user,
        action="export_inventory",
        entity_type="inventory",
        entity_id="export",
        summary=f"Exportação de inventário ({exported_count} registro(s))",
        changes={
            "count": exported_count,
            "filters": {
                "search": search or "",
                "status_filter": status_filter or "",
                "equipment_type_id": equipment_type_id,
                "secretariat_id": secretariat_id,
                "sector_id": sector_id,
            },
        },
    )
    db.commit()
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.post("/assets/bulk-scan/preview", response_model=InventoryBulkScanPreviewOut)
def preview_inventory_bulk_scan(
    payload: InventoryBulkScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.bulk_scan")),
):
    return bulk_scan_preview_payload(db, payload)


@router.post("/assets/bulk-scan/confirm", response_model=InventoryBulkScanConfirmOut)
def confirm_inventory_bulk_scan(
    payload: InventoryBulkScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.bulk_scan")),
):
    preview = bulk_scan_preview_payload(db, payload)
    if preview["errors"]:
        raise HTTPException(status_code=409, detail="Corrija os erros do lote antes de confirmar")

    supplier, _ = validate_optional_catalogs(db, payload.supplier_id, None)
    equipment_type, manufacturer, equipment_model = validate_asset_catalogs(
        db,
        payload.equipment_type_id,
        payload.manufacturer_id,
        payload.equipment_model_id,
    )
    if supplier is None:
        raise HTTPException(status_code=400, detail="Fornecedor inválido")
    sector = get_default_sector(db)
    received_at = movement_datetime(payload.received_at)
    created_assets = [
        create_bulk_scan_asset(
            db,
            payload=payload,
            serial_number=display_serial_number(item["serial_number"]),
            supplier=supplier,
            equipment_type=equipment_type,
            manufacturer=manufacturer,
            equipment_model=equipment_model,
            sector=sector,
            received_at=received_at,
            actor_id=current_user.id,
        )
        for item in preview["valid_items"]
    ]
    db.commit()
    assets = [inventory_asset_payload(fresh_inventory_asset(db, asset.id)) for asset in created_assets]
    return {
        "created_count": len(assets),
        "assets": assets,
        "summary": preview,
    }


@router.get("/assets/{asset_id}", response_model=InventoryAssetOut)
def get_inventory_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    return inventory_asset_payload(get_inventory_asset_or_404(db, asset_id))


@router.post("/assets", response_model=InventoryAssetOut, status_code=201)
def create_inventory_asset(
    payload: InventoryAssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.create")),
):
    serial_number = normalize_inventory_serial(payload.serial_number)
    ensure_unique_serial(db, serial_number)
    supplier, sector = validate_optional_catalogs(db, payload.supplier_id, payload.sector_id)
    if sector is None:
        sector = get_default_sector(db)
    validate_user_for_sector(db, payload.assigned_user_id, sector)
    equipment_type, manufacturer, equipment_model = validate_asset_catalogs(
        db,
        payload.equipment_type_id,
        payload.manufacturer_id,
        payload.equipment_model_id,
    )
    status = calculated_asset_status(sector, payload.assigned_user_id)
    ensure_shipping_date(status, payload.delivered_at)
    received_at = payload.received_at or utc_now()
    display_name = build_asset_display_name(
        equipment_type.name,
        manufacturer.name,
        equipment_model.name,
        serial_number,
    )
    asset = Asset(
        name=display_name[:160],
        asset_type=equipment_type.name[:60],
        manufacturer=manufacturer.name[:100],
        model=equipment_model.name[:140],
        serial_number=serial_number,
        specifications=payload.specifications.strip(),
        status=legacy_asset_status(status),
        location=sector.name,
        assigned_user_id=payload.assigned_user_id,
        supplier_id=supplier.id if supplier else None,
        equipment_type_id=equipment_type.id,
        manufacturer_id=manufacturer.id,
        equipment_model_id=equipment_model.id,
        sector_id=sector.id,
        received_at=received_at,
        delivered_at=payload.delivered_at,
        notes=payload.notes.strip(),
    )
    db.add(asset)
    db.flush()
    add_asset_movement(
        db,
        asset=asset,
        action="created",
        before={"sector_id": None, "user_id": None, "status": None},
        movement_at=received_at,
        notes=payload.notes,
        actor_id=current_user.id,
    )
    db.commit()
    return inventory_asset_payload(fresh_inventory_asset(db, asset.id))


@router.patch("/assets/{asset_id}", response_model=InventoryAssetOut)
def update_inventory_asset(
    asset_id: int,
    payload: InventoryAssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.edit")),
):
    asset = db.scalar(inventory_asset_query().where(Asset.id == asset_id))
    if not asset:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    ensure_asset_not_reserved(db, asset.id)
    data = payload.model_dump(exclude_unset=True)
    if "serial_number" in data:
        asset.serial_number = normalize_inventory_serial(data["serial_number"])
        ensure_unique_serial(db, asset.serial_number, asset.id)
    if "specifications" in data:
        asset.specifications = (data["specifications"] or "").strip()
    next_assigned_user_id = data.get("assigned_user_id", asset.assigned_user_id)
    if "supplier_id" in data:
        supplier, _ = validate_optional_catalogs(db, data["supplier_id"], None)
        asset.supplier_id = supplier.id if supplier else None
    equipment_type_id = data.get("equipment_type_id", asset.equipment_type_id)
    manufacturer_id = data.get("manufacturer_id", asset.manufacturer_id)
    equipment_model_id = data.get("equipment_model_id", asset.equipment_model_id)
    if "equipment_type_id" in data or "manufacturer_id" in data or "equipment_model_id" in data:
        if equipment_type_id is None or manufacturer_id is None or equipment_model_id is None:
            raise HTTPException(status_code=400, detail="Tipo, fabricante e modelo são obrigatórios")
        equipment_type, manufacturer, equipment_model = validate_asset_catalogs(
            db,
            equipment_type_id,
            manufacturer_id,
            equipment_model_id,
        )
        asset.equipment_type_id = equipment_type.id
        asset.manufacturer_id = manufacturer.id
        asset.equipment_model_id = equipment_model.id
        asset.asset_type = equipment_type.name[:60]
        asset.manufacturer = manufacturer.name[:100]
        asset.model = equipment_model.name[:140]
    if "sector_id" in data:
        _, sector = validate_optional_catalogs(db, None, data["sector_id"])
        asset.sector_id = sector.id if sector else None
        asset.location = sector.name if sector else ""
    sector = db.get(InventorySector, asset.sector_id) if asset.sector_id else get_default_sector(db)
    validate_user_for_sector(db, next_assigned_user_id, sector)
    if "assigned_user_id" in data:
        asset.assigned_user_id = data["assigned_user_id"]
    if "received_at" in data:
        asset.received_at = data["received_at"]
    if "delivered_at" in data:
        asset.delivered_at = data["delivered_at"]
    if "notes" in data:
        asset.notes = (data["notes"] or "").strip()

    if data.get("status") == "retired":
        raise HTTPException(status_code=400, detail="Use POST /inventory/assets/{id}/retire para baixar equipamento")
    if asset_is_retired(asset) and "status" in data:
        raise HTTPException(status_code=409, detail="Equipamento baixado não pode ter status alterado por edição direta")

    status = data.get("status") if data.get("status") == "maintenance" else calculated_asset_status(sector, asset.assigned_user_id)
    ensure_shipping_date(status, asset.delivered_at)
    asset.status = legacy_asset_status(status)
    asset.name = asset_display_name(asset)[:160]
    db.commit()
    return inventory_asset_payload(fresh_inventory_asset(db, asset.id))


@router.delete("/assets/{asset_id}")
def delete_inventory_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.edit")),
):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    if has_rows(db, select(Ticket.id).where(Ticket.asset_id == asset.id)):
        raise HTTPException(status_code=409, detail="Equipamento possui chamados vinculados. Baixe ou arquive em vez de excluir.")
    db.execute(delete(AssetMovement).where(AssetMovement.asset_id == asset.id))
    db.delete(asset)
    db.commit()
    return {"message": "Equipamento excluído com sucesso"}


@router.get("/assets/{asset_id}/movements", response_model=list[InventoryMovementOut])
def list_inventory_asset_movements(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    get_inventory_asset_or_404(db, asset_id)
    movements = db.scalars(
        inventory_movement_query()
        .where(AssetMovement.asset_id == asset_id)
        .order_by(AssetMovement.movement_date.desc(), AssetMovement.id.desc())
    ).unique()
    return [inventory_movement_payload(movement) for movement in movements]


@router.post("/assets/{asset_id}/allocate", response_model=InventoryAssetOut)
def allocate_inventory_asset(
    asset_id: int,
    payload: InventoryAllocateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    asset = get_inventory_asset_or_404(db, asset_id)
    ensure_asset_not_reserved(db, asset.id)
    _guard_movable(asset)
    sector = db.get(InventorySector, payload.sector_id)
    if not sector:
        raise HTTPException(status_code=400, detail="Setor inválido")
    validate_user_for_sector(db, payload.assigned_user_id, sector)
    movement_at = movement_datetime(payload.movement_date)
    before = asset_movement_state(asset)
    apply_asset_allocation(asset, sector, payload.assigned_user_id, movement_at)
    add_asset_movement(
        db,
        asset=asset,
        action="allocated",
        before=before,
        movement_at=movement_at,
        notes=payload.notes,
        actor_id=current_user.id,
    )
    db.commit()
    return inventory_asset_payload(fresh_inventory_asset(db, asset.id))


@router.post("/assets/{asset_id}/change-responsible", response_model=InventoryAssetOut)
def change_inventory_asset_responsible(
    asset_id: int,
    payload: InventoryChangeResponsibleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    asset = get_inventory_asset_or_404(db, asset_id)
    ensure_asset_not_reserved(db, asset.id)
    _guard_movable(asset)
    sector = db.get(InventorySector, asset.sector_id) if asset.sector_id else get_default_sector(db)
    validate_user_for_sector(db, payload.assigned_user_id, sector)
    movement_at = movement_datetime(payload.movement_date)
    before = asset_movement_state(asset)
    try:
        apply_responsible_change(asset, payload.assigned_user_id, movement_at)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    add_asset_movement(
        db,
        asset=asset,
        action="responsible_changed",
        before=before,
        movement_at=movement_at,
        notes=payload.notes,
        actor_id=current_user.id,
    )
    db.commit()
    return inventory_asset_payload(fresh_inventory_asset(db, asset.id))


@router.post("/assets/{asset_id}/return-to-stock", response_model=InventoryAssetOut)
def return_inventory_asset_to_stock(
    asset_id: int,
    payload: InventoryReturnToStockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    asset = get_inventory_asset_or_404(db, asset_id)
    ensure_asset_not_reserved(db, asset.id)
    _guard_movable(asset)
    movement_at = movement_datetime(payload.movement_date)
    before = asset_movement_state(asset)
    apply_return_to_stock(asset, get_default_sector(db))
    add_asset_movement(
        db,
        asset=asset,
        action="returned_to_stock",
        before=before,
        movement_at=movement_at,
        notes=payload.notes,
        actor_id=current_user.id,
    )
    db.commit()
    return inventory_asset_payload(fresh_inventory_asset(db, asset.id))


@router.post("/assets/{asset_id}/maintenance", response_model=InventoryAssetOut)
def send_inventory_asset_to_maintenance(
    asset_id: int,
    payload: InventoryMaintenanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    asset = get_inventory_asset_or_404(db, asset_id)
    ensure_asset_not_reserved(db, asset.id)
    _guard_movable(asset)
    movement_at = movement_datetime(payload.movement_date)
    before = asset_movement_state(asset)
    apply_send_to_maintenance(asset)
    add_asset_movement(
        db,
        asset=asset,
        action="maintenance",
        before=before,
        movement_at=movement_at,
        notes=payload.notes,
        actor_id=current_user.id,
    )
    db.commit()
    return inventory_asset_payload(fresh_inventory_asset(db, asset.id))


@router.post("/assets/{asset_id}/retire", response_model=InventoryAssetOut)
def retire_inventory_asset(
    asset_id: int,
    payload: InventoryRetireRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    if payload.reason == "CORRECAO_ADMINISTRATIVA" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Correção administrativa disponível apenas para administrador")
    asset = get_inventory_asset_or_404(db, asset_id)
    ensure_asset_not_reserved(db, asset.id)
    movement_at = movement_datetime(payload.movement_date)
    before = asset_movement_state(asset)
    previous_status = before.get("status")
    try:
        apply_retire_asset(
            asset,
            retired_at=movement_at,
            retired_by_user_id=current_user.id,
            reason=payload.reason,
            justification=payload.justification,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    add_asset_movement(
        db,
        asset=asset,
        action="retired",
        before=before,
        movement_at=movement_at,
        notes=build_retirement_movement_notes(
            reason=payload.reason,
            justification=payload.justification,
            notes=payload.notes,
        ),
        actor_id=current_user.id,
    )
    add_audit(
        db,
        actor=current_user,
        action="inventory_asset_retired",
        entity_type="inventory_asset",
        entity_id=asset.id,
        summary=f"Baixa de inventário: {asset.serial_number}",
        changes={
            "asset_id": asset.id,
            "serial_number": asset.serial_number,
            "reason": payload.reason,
            "previous_status": previous_status,
            "new_status": "retired",
            "retired_at": movement_at.isoformat(),
        },
    )
    db.commit()
    return inventory_asset_payload(fresh_inventory_asset(db, asset.id))
