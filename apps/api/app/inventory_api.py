from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .inventory_constants import (
    DEFAULT_INVENTORY_SECTOR,
    INVENTORY_MOVEMENT_ACTIONS,
    INVENTORY_PERMISSIONS,
    INVENTORY_STATUSES,
)
from .inventory_service import (
    build_asset_display_name,
    initial_inventory_status,
    normalize_catalog_name,
    normalize_serial_number,
    validate_shipping_date_for_status,
)
from .models import (
    Asset,
    InventoryEquipmentModel,
    InventoryEquipmentType,
    InventoryManufacturer,
    InventorySector,
    InventorySupplier,
    User,
)
from .permissions import require_permission
from .schemas import (
    InventoryCatalogItemCreate,
    InventoryCatalogItemOut,
    InventoryCatalogItemUpdate,
    InventoryCatalogsOut,
    InventoryAssetCreate,
    InventoryAssetOut,
    InventoryAssetUpdate,
    InventoryEquipmentModelCreate,
    InventoryEquipmentModelOut,
    InventoryEquipmentModelUpdate,
)
from .time_utils import utc_now

router = APIRouter(prefix="/api/inventory", tags=["inventário"])


@router.get("/meta")
def inventory_meta(current_user: User = Depends(require_permission("inventory.view"))):
    return {
        "module": "Inventário",
        "default_sector": DEFAULT_INVENTORY_SECTOR,
        "statuses": list(INVENTORY_STATUSES),
        "movement_actions": list(INVENTORY_MOVEMENT_ACTIONS),
        "permissions": list(INVENTORY_PERMISSIONS),
    }


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


def ensure_model_references(db: Session, manufacturer_id: int, equipment_type_id: int) -> None:
    if not db.get(InventoryManufacturer, manufacturer_id):
        raise HTTPException(status_code=400, detail="Fabricante inválido")
    if not db.get(InventoryEquipmentType, equipment_type_id):
        raise HTTPException(status_code=400, detail="Tipo de equipamento inválido")


def catalog_ref(item: Any | None) -> dict[str, Any] | None:
    if not item:
        return None
    return {"id": item.id, "name": item.name}


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
        joinedload(Asset.sector),
        joinedload(Asset.assigned_user),
    )


def asset_inventory_status(asset: Asset) -> str:
    return "allocated" if asset.status == "active" else asset.status


def legacy_asset_status(status: str) -> str:
    return "active" if status == "allocated" else status


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
        "created_at": None,
        "updated_at": None,
    }


def calculated_asset_status(sector: InventorySector | None, assigned_user_id: int | None) -> str:
    return initial_inventory_status(sector.name if sector else DEFAULT_INVENTORY_SECTOR, assigned_user_id)


def ensure_shipping_date(status: str, delivered_at: Any | None) -> None:
    try:
        validate_shipping_date_for_status(status, delivered_at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/assets", response_model=list[InventoryAssetOut])
def list_inventory_assets(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    query = inventory_asset_query().order_by(Asset.id)
    assets = list(db.scalars(query).unique())
    if status_filter:
        assets = [asset for asset in assets if asset_inventory_status(asset) == status_filter]
    return [inventory_asset_payload(asset) for asset in assets]


@router.get("/assets/{asset_id}", response_model=InventoryAssetOut)
def get_inventory_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    asset = db.scalar(inventory_asset_query().where(Asset.id == asset_id))
    if not asset:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    return inventory_asset_payload(asset)


@router.post("/assets", response_model=InventoryAssetOut, status_code=201)
def create_inventory_asset(
    payload: InventoryAssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.create")),
):
    serial_number = normalize_inventory_serial(payload.serial_number)
    ensure_unique_serial(db, serial_number)
    validate_user(db, payload.assigned_user_id)
    supplier, sector = validate_optional_catalogs(db, payload.supplier_id, payload.sector_id)
    if sector is None:
        sector = get_default_sector(db)
    equipment_type, manufacturer, equipment_model = validate_asset_catalogs(
        db,
        payload.equipment_type_id,
        payload.manufacturer_id,
        payload.equipment_model_id,
    )
    status = calculated_asset_status(sector, payload.assigned_user_id)
    ensure_shipping_date(status, payload.delivered_at)
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
        status=legacy_asset_status(status),
        location=sector.name,
        assigned_user_id=payload.assigned_user_id,
        supplier_id=supplier.id if supplier else None,
        equipment_type_id=equipment_type.id,
        manufacturer_id=manufacturer.id,
        equipment_model_id=equipment_model.id,
        sector_id=sector.id,
        received_at=payload.received_at or utc_now(),
        delivered_at=payload.delivered_at,
        notes=payload.notes.strip(),
    )
    db.add(asset)
    db.commit()
    return inventory_asset_payload(db.scalar(inventory_asset_query().where(Asset.id == asset.id)))


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
    data = payload.model_dump(exclude_unset=True)
    if "serial_number" in data:
        asset.serial_number = normalize_inventory_serial(data["serial_number"])
        ensure_unique_serial(db, asset.serial_number, asset.id)
    if "assigned_user_id" in data:
        validate_user(db, data["assigned_user_id"])
        asset.assigned_user_id = data["assigned_user_id"]
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
    if "received_at" in data:
        asset.received_at = data["received_at"]
    if "delivered_at" in data:
        asset.delivered_at = data["delivered_at"]
    if "notes" in data:
        asset.notes = (data["notes"] or "").strip()

    sector = db.get(InventorySector, asset.sector_id) if asset.sector_id else get_default_sector(db)
    status = data.get("status") if data.get("status") in {"maintenance", "retired"} else calculated_asset_status(sector, asset.assigned_user_id)
    ensure_shipping_date(status, asset.delivered_at)
    asset.status = legacy_asset_status(status)
    asset.name = asset_display_name(asset)[:160]
    db.commit()
    return inventory_asset_payload(db.scalar(inventory_asset_query().where(Asset.id == asset.id)))


@router.get("/catalogs", response_model=InventoryCatalogsOut)
def list_catalogs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    return {
        "suppliers": list_items(db, InventorySupplier),
        "equipment_types": list_items(db, InventoryEquipmentType),
        "manufacturers": list_items(db, InventoryManufacturer),
        "models": list_items(db, InventoryEquipmentModel),
        "sectors": list_items(db, InventorySector),
    }


@router.post("/catalogs/suppliers", response_model=InventoryCatalogItemOut, status_code=201)
def create_supplier(
    payload: InventoryCatalogItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return create_item(db, InventorySupplier, payload)


@router.patch("/catalogs/suppliers/{item_id}", response_model=InventoryCatalogItemOut)
def update_supplier(
    item_id: int,
    payload: InventoryCatalogItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return update_item(db, InventorySupplier, item_id, payload)


@router.post("/catalogs/equipment-types", response_model=InventoryCatalogItemOut, status_code=201)
def create_equipment_type(
    payload: InventoryCatalogItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return create_item(db, InventoryEquipmentType, payload)


@router.patch("/catalogs/equipment-types/{item_id}", response_model=InventoryCatalogItemOut)
def update_equipment_type(
    item_id: int,
    payload: InventoryCatalogItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return update_item(db, InventoryEquipmentType, item_id, payload)


@router.post("/catalogs/manufacturers", response_model=InventoryCatalogItemOut, status_code=201)
def create_manufacturer(
    payload: InventoryCatalogItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return create_item(db, InventoryManufacturer, payload)


@router.patch("/catalogs/manufacturers/{item_id}", response_model=InventoryCatalogItemOut)
def update_manufacturer(
    item_id: int,
    payload: InventoryCatalogItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return update_item(db, InventoryManufacturer, item_id, payload)


@router.post("/catalogs/models", response_model=InventoryEquipmentModelOut, status_code=201)
def create_equipment_model(
    payload: InventoryEquipmentModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    name = catalog_name(payload.name)
    ensure_model_references(db, payload.manufacturer_id, payload.equipment_type_id)
    model = InventoryEquipmentModel(
        name=name,
        normalized_name=ensure_unique_name(db, InventoryEquipmentModel, name),
        manufacturer_id=payload.manufacturer_id,
        equipment_type_id=payload.equipment_type_id,
        is_active=payload.is_active,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


@router.patch("/catalogs/models/{item_id}", response_model=InventoryEquipmentModelOut)
def update_equipment_model(
    item_id: int,
    payload: InventoryEquipmentModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    model = get_item(db, InventoryEquipmentModel, item_id)
    data = payload.model_dump(exclude_unset=True)
    manufacturer_id = data.get("manufacturer_id", model.manufacturer_id)
    equipment_type_id = data.get("equipment_type_id", model.equipment_type_id)
    ensure_model_references(db, manufacturer_id, equipment_type_id)
    if "name" in data:
        model.name = catalog_name(data["name"])
        model.normalized_name = ensure_unique_name(db, InventoryEquipmentModel, model.name, item_id)
    if "manufacturer_id" in data:
        model.manufacturer_id = manufacturer_id
    if "equipment_type_id" in data:
        model.equipment_type_id = equipment_type_id
    if "is_active" in data:
        model.is_active = data["is_active"]
    db.commit()
    db.refresh(model)
    return model


@router.post("/catalogs/sectors", response_model=InventoryCatalogItemOut, status_code=201)
def create_sector(
    payload: InventoryCatalogItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return create_item(db, InventorySector, payload)


@router.patch("/catalogs/sectors/{item_id}", response_model=InventoryCatalogItemOut)
def update_sector(
    item_id: int,
    payload: InventoryCatalogItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return update_item(db, InventorySector, item_id, payload)
