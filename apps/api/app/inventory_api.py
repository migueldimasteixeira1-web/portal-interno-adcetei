from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .inventory_constants import (
    DEFAULT_INVENTORY_SECTOR,
    INVENTORY_MOVEMENT_ACTIONS,
    INVENTORY_PERMISSIONS,
    INVENTORY_STATUSES,
)
from .inventory_service import normalize_catalog_name
from .models import (
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
    InventoryEquipmentModelCreate,
    InventoryEquipmentModelOut,
    InventoryEquipmentModelUpdate,
)

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
