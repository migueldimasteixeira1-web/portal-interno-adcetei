from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from .inventory_constants import DEFAULT_INVENTORY_SECTOR
from .inventory_service import (
    apply_asset_allocation,
    apply_responsible_change,
    apply_retire_asset,
    apply_return_to_stock,
    apply_send_to_maintenance,
    asset_is_retired,
    asset_movement_state,
    build_asset_display_name,
    build_bulk_scan_preview,
    build_retirement_movement_notes,
    default_sector_update_error,
    display_serial_number,
    ensure_asset_movable,
    initial_inventory_status,
    inventory_status_from_asset,
    legacy_asset_status,
    movement_datetime,
    movement_values,
    normalize_catalog_name,
    normalize_serial_number,
    retirement_reason_label,
    validate_shipping_date_for_status,
)
from .models import (
    Asset,
    AssetMovement,
    InventoryContract,
    InventoryEquipmentModel,
    InventoryEquipmentType,
    InventoryManufacturer,
    InventorySecretariat,
    InventorySector,
    InventorySupplier,
    Ticket,
    User,
)
from .schemas import InventoryBulkScanRequest, InventoryCatalogItemCreate, InventoryCatalogItemUpdate
from .time_utils import utc_now

def catalog_name(value: str) -> str:
    name = " ".join(value.strip().split())
    if not name:
        raise HTTPException(status_code=422, detail="Nome obrigatório")
    return name


def ensure_unique_name(db: Session, model: type[Any], name: str, exclude_id: int | None = None) -> str:
    normalized_name = normalize_catalog_name(name)
    query = select(model).where(model.normalized_name == normalized_name)
    if exclude_id is not None:
        query = query.where(model.id != exclude_id)
    if db.scalar(query):
        raise HTTPException(status_code=409, detail="Já existe um cadastro com este nome")
    return normalized_name


def list_items(db: Session, model: type[Any]) -> list[Any]:
    return list(db.scalars(select(model).order_by(model.name)))


def get_item(db: Session, model: type[Any], item_id: int) -> Any:
    item = db.get(model, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cadastro não encontrado")
    return item


def has_rows(db: Session, query: Any) -> bool:
    return db.scalar(select(query.exists())) or False


def create_item(db: Session, model: type[Any], payload: InventoryCatalogItemCreate) -> Any:
    name = catalog_name(payload.name)
    normalized_name = ensure_unique_name(db, model, name)
    item = model(name=name, normalized_name=normalized_name, is_active=payload.is_active)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_item(db: Session, model: type[Any], item_id: int, payload: InventoryCatalogItemUpdate) -> Any:
    item = get_item(db, model, item_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        item.name = catalog_name(data["name"])
        item.normalized_name = ensure_unique_name(db, model, item.name, item_id)
    if "is_active" in data:
        item.is_active = data["is_active"]
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, model: type[Any], item_id: int, blocked_queries: tuple[Any, ...]) -> dict[str, str]:
    item = get_item(db, model, item_id)
    if any(has_rows(db, query) for query in blocked_queries):
        raise HTTPException(status_code=409, detail="Cadastro possui vínculos. Inative em vez de excluir.")
    db.delete(item)
    db.commit()
    return {"message": "Cadastro excluído com sucesso"}


def ensure_model_references(db: Session, manufacturer_id: int, equipment_type_id: int) -> None:
    if not db.get(InventoryManufacturer, manufacturer_id):
        raise HTTPException(status_code=400, detail="Fabricante inválido")
    if not db.get(InventoryEquipmentType, equipment_type_id):
        raise HTTPException(status_code=400, detail="Tipo de equipamento inválido")


def catalog_ref(item: Any | None) -> dict[str, Any] | None:
    if not item:
        return None
    payload = {"id": item.id, "name": item.name}
    if isinstance(item, InventorySector):
        payload["secretariat_id"] = item.secretariat_id
        payload["secretariat"] = catalog_ref(item.secretariat)
    return payload


def normalize_inventory_serial(value: str) -> str:
    serial = " ".join(value.strip().split())
    if not serial:
        raise HTTPException(status_code=422, detail="Número de série obrigatório")
    return serial


def ensure_unique_serial(db: Session, serial_number: str, exclude_id: int | None = None) -> None:
    normalized = normalize_serial_number(serial_number)
    # ponytail: O(n) scan avoids adding a normalized serial column before legacy data is cleaned up.
    for asset_id, existing_serial in db.execute(select(Asset.id, Asset.serial_number)):
        if exclude_id is not None and asset_id == exclude_id:
            continue
        if existing_serial and normalize_serial_number(existing_serial) == normalized:
            raise HTTPException(status_code=409, detail="Número de série já cadastrado")


def get_default_sector(db: Session) -> InventorySector:
    sector = db.scalar(
        select(InventorySector).where(InventorySector.normalized_name == normalize_catalog_name(DEFAULT_INVENTORY_SECTOR))
    )
    if not sector:
        sector = InventorySector(
            name=DEFAULT_INVENTORY_SECTOR,
            normalized_name=normalize_catalog_name(DEFAULT_INVENTORY_SECTOR),
            is_active=True,
        )
        db.add(sector)
        db.flush()
    return sector


def validate_user(db: Session, user_id: int | None) -> User | None:
    if user_id is None:
        return None
    user = db.get(User, user_id)
    if not user or not user.active:
        raise HTTPException(status_code=400, detail="Usuário responsável inválido")
    return user


def validate_user_for_sector(db: Session, user_id: int | None, sector: InventorySector | None) -> User | None:
    user = validate_user(db, user_id)
    if user and sector and user.department_sector_id != sector.id:
        raise HTTPException(status_code=400, detail="Responsável não pertence ao setor selecionado")
    return user


def validate_optional_catalogs(
    db: Session,
    supplier_id: int | None,
    sector_id: int | None,
) -> tuple[InventorySupplier | None, InventorySector | None]:
    supplier = db.get(InventorySupplier, supplier_id) if supplier_id is not None else None
    if supplier_id is not None and not supplier:
        raise HTTPException(status_code=400, detail="Fornecedor inválido")
    sector = db.get(InventorySector, sector_id) if sector_id is not None else None
    if sector_id is not None and not sector:
        raise HTTPException(status_code=400, detail="Setor inválido")
    return supplier, sector


def validate_contract(db: Session, contract_id: int | None) -> InventoryContract | None:
    if contract_id is None:
        return None
    contract = db.get(InventoryContract, contract_id)
    if not contract or not contract.is_active:
        raise HTTPException(status_code=400, detail="Contrato inválido")
    return contract


def validate_asset_catalogs(
    db: Session,
    equipment_type_id: int,
    manufacturer_id: int,
    equipment_model_id: int,
) -> tuple[InventoryEquipmentType, InventoryManufacturer, InventoryEquipmentModel]:
    equipment_type = db.get(InventoryEquipmentType, equipment_type_id)
    if not equipment_type:
        raise HTTPException(status_code=400, detail="Tipo de equipamento inválido")
    manufacturer = db.get(InventoryManufacturer, manufacturer_id)
    if not manufacturer:
        raise HTTPException(status_code=400, detail="Fabricante inválido")
    equipment_model = db.get(InventoryEquipmentModel, equipment_model_id)
    if not equipment_model:
        raise HTTPException(status_code=400, detail="Modelo inválido")
    if equipment_model.manufacturer_id != manufacturer_id:
        raise HTTPException(status_code=400, detail="Modelo incompatível com o fabricante informado")
    if equipment_model.equipment_type_id != equipment_type_id:
        raise HTTPException(status_code=400, detail="Modelo incompatível com o tipo informado")
    return equipment_type, manufacturer, equipment_model


def inventory_asset_query():
    return select(Asset).options(
        joinedload(Asset.supplier),
        joinedload(Asset.equipment_type),
        joinedload(Asset.manufacturer_ref),
        joinedload(Asset.equipment_model),
        joinedload(Asset.sector).joinedload(InventorySector.secretariat),
        joinedload(Asset.assigned_user),
        joinedload(Asset.retired_by),
    )


def asset_inventory_status(asset: Asset) -> str:
    return inventory_status_from_asset(asset)


def asset_display_name(asset: Asset) -> str:
    return build_asset_display_name(
        asset.equipment_type.name if asset.equipment_type else asset.asset_type,
        asset.manufacturer_ref.name if asset.manufacturer_ref else asset.manufacturer,
        asset.equipment_model.name if asset.equipment_model else asset.model,
        asset.serial_number,
    )


def inventory_asset_payload(asset: Asset) -> dict[str, Any]:
    return {
        "id": asset.id,
        "serial_number": asset.serial_number,
        "specifications": asset.specifications or "",
        "status": asset_inventory_status(asset),
        "display_name": asset_display_name(asset),
        "supplier_id": asset.supplier_id,
        "supplier": catalog_ref(asset.supplier),
        "equipment_type_id": asset.equipment_type_id,
        "equipment_type": catalog_ref(asset.equipment_type),
        "manufacturer_id": asset.manufacturer_id,
        "manufacturer": catalog_ref(asset.manufacturer_ref),
        "equipment_model_id": asset.equipment_model_id,
        "equipment_model": catalog_ref(asset.equipment_model),
        "sector_id": asset.sector_id,
        "sector": catalog_ref(asset.sector),
        "assigned_user_id": asset.assigned_user_id,
        "assigned_user": asset.assigned_user,
        "received_at": asset.received_at,
        "delivered_at": asset.delivered_at,
        "notes": asset.notes or "",
        "retired_at": asset.retired_at,
        "retired_by_user_id": asset.retired_by_user_id,
        "retirement_reason": asset.retirement_reason or None,
        "retirement_justification": asset.retirement_justification or "",
        "retirement_notes": asset.retirement_notes or "",
        "retired_by": asset.retired_by,
        "created_at": None,
        "updated_at": None,
    }


def inventory_movement_query():
    return select(AssetMovement).options(
        joinedload(AssetMovement.from_sector),
        joinedload(AssetMovement.to_sector),
        joinedload(AssetMovement.from_user),
        joinedload(AssetMovement.to_user),
        joinedload(AssetMovement.actor),
    )


def inventory_movement_payload(movement: AssetMovement) -> dict[str, Any]:
    return {
        "id": movement.id,
        "action": movement.action,
        "movement_date": movement.movement_date,
        "notes": movement.notes or "",
        "from_status": movement.from_status,
        "to_status": movement.to_status,
        "from_sector": catalog_ref(movement.from_sector),
        "to_sector": catalog_ref(movement.to_sector),
        "from_user": movement.from_user,
        "to_user": movement.to_user,
        "actor": movement.actor,
        "created_at": movement.created_at,
    }


def get_inventory_asset_or_404(db: Session, asset_id: int) -> Asset:
    asset = db.scalar(inventory_asset_query().where(Asset.id == asset_id))
    if not asset:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    return asset


def fresh_inventory_asset(db: Session, asset_id: int) -> Asset:
    return db.scalar(inventory_asset_query().where(Asset.id == asset_id).execution_options(populate_existing=True))


def add_asset_movement(
    db: Session,
    *,
    asset: Asset,
    action: str,
    before: dict[str, int | str | None],
    movement_at: Any,
    notes: str,
    actor_id: int | None,
) -> AssetMovement:
    movement = AssetMovement(
        **movement_values(
            asset_id=asset.id,
            action=action,
            before=before,
            after=asset_movement_state(asset),
            movement_date=movement_at,
            notes=notes,
            actor_id=actor_id,
        )
    )
    db.add(movement)
    return movement


def existing_serial_statuses(db: Session) -> dict[str, str]:
    return {
        normalize_serial_number(serial): status
        for serial, status in db.execute(select(Asset.serial_number, Asset.status))
        if serial and normalize_serial_number(serial)
    }


def existing_normalized_serials(db: Session) -> set[str]:
    return set(existing_serial_statuses(db))


def bulk_scan_preview_payload(db: Session, payload: InventoryBulkScanRequest) -> dict[str, Any]:
    validate_optional_catalogs(db, payload.supplier_id, None)
    validate_asset_catalogs(
        db,
        payload.equipment_type_id,
        payload.manufacturer_id,
        payload.equipment_model_id,
    )
    return build_bulk_scan_preview(payload.serial_numbers, existing_serial_statuses(db))


def create_bulk_scan_asset(
    db: Session,
    *,
    payload: InventoryBulkScanRequest,
    serial_number: str,
    supplier: InventorySupplier,
    equipment_type: InventoryEquipmentType,
    manufacturer: InventoryManufacturer,
    equipment_model: InventoryEquipmentModel,
    sector: InventorySector,
    received_at: Any,
    actor_id: int,
) -> Asset:
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
        status=legacy_asset_status("stock"),
        location=sector.name,
        assigned_user_id=None,
        supplier_id=supplier.id,
        equipment_type_id=equipment_type.id,
        manufacturer_id=manufacturer.id,
        equipment_model_id=equipment_model.id,
        sector_id=sector.id,
        received_at=received_at,
        delivered_at=None,
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
        actor_id=actor_id,
    )
    return asset


def calculated_asset_status(sector: InventorySector | None, assigned_user_id: int | None) -> str:
    return initial_inventory_status(sector.name if sector else DEFAULT_INVENTORY_SECTOR, assigned_user_id)


def ensure_shipping_date(status: str, delivered_at: Any | None) -> None:
    try:
        validate_shipping_date_for_status(status, delivered_at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def inventory_status_db_filter(status_filter: str):
    if status_filter == "allocated":
        return Asset.status.in_(["active", "allocated"])
    return Asset.status == status_filter


def inventory_asset_filter_conditions(
    *,
    status_filter: str | None,
    equipment_type_id: int | None,
    sector_id: int | None,
    search: str | None,
) -> tuple[list[Any], bool]:
    conditions: list[Any] = []
    needs_join = False
    if status_filter:
        conditions.append(inventory_status_db_filter(status_filter))
    if equipment_type_id:
        conditions.append(Asset.equipment_type_id == equipment_type_id)
    if sector_id:
        conditions.append(Asset.sector_id == sector_id)
    if search and search.strip():
        needs_join = True
        like = f"%{search.strip()}%"
        conditions.append(
            or_(
                Asset.serial_number.ilike(like),
                Asset.name.ilike(like),
                Asset.manufacturer.ilike(like),
                Asset.model.ilike(like),
                Asset.notes.ilike(like),
                Asset.asset_type.ilike(like),
                Asset.patrimony.ilike(like),
                InventorySupplier.name.ilike(like),
                InventoryEquipmentType.name.ilike(like),
                InventoryManufacturer.name.ilike(like),
                InventoryEquipmentModel.name.ilike(like),
                InventorySecretariat.name.ilike(like),
                InventorySector.name.ilike(like),
                User.full_name.ilike(like),
                User.department.ilike(like),
            )
        )
    return conditions, needs_join


def inventory_assets_base_query(*, conditions: list[Any], needs_join: bool):
    query = select(Asset)
    if needs_join:
        query = (
            query.outerjoin(Asset.supplier)
            .outerjoin(Asset.equipment_type)
            .outerjoin(Asset.manufacturer_ref)
            .outerjoin(Asset.equipment_model)
            .outerjoin(Asset.sector)
            .outerjoin(InventorySector.secretariat)
            .outerjoin(Asset.assigned_user)
        )
    return query.where(*conditions) if conditions else query


def list_inventory_assets_filtered(
    db: Session,
    *,
    status_filter: str | None,
    equipment_type_id: int | None,
    sector_id: int | None,
    search: str | None,
) -> list[Asset]:
    conditions, needs_join = inventory_asset_filter_conditions(
        status_filter=status_filter,
        equipment_type_id=equipment_type_id,
        sector_id=sector_id,
        search=search,
    )
    asset_ids = list(
        db.scalars(
            inventory_assets_base_query(conditions=conditions, needs_join=needs_join)
            .with_only_columns(Asset.id)
            .distinct()
            .order_by(Asset.id.desc())
        )
    )
    if not asset_ids:
        return []
    return list(
        db.scalars(inventory_asset_query().where(Asset.id.in_(asset_ids)).order_by(Asset.id.desc())).unique()
    )
