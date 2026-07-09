from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ...database import get_db
from ...inventory_constants import DEFAULT_INVENTORY_SECTOR
from ...inventory_helpers import (
    catalog_name,
    create_item,
    delete_item,
    ensure_model_references,
    ensure_unique_name,
    get_item,
    list_items,
    update_item,
)
from ...inventory_service import default_sector_update_error, normalize_catalog_name
from ...models import (
    Asset,
    AssetMovement,
    InventoryContract,
    InventoryDeliveryTerm,
    InventoryEquipmentModel,
    InventoryEquipmentType,
    InventoryManufacturer,
    InventorySector,
    InventorySupplier,
    User,
)
from ...permissions import require_permission
from ...schemas import (
    InventoryCatalogItemCreate,
    InventoryCatalogItemOut,
    InventoryCatalogItemUpdate,
    InventoryCatalogsOut,
    InventoryContractCreate,
    InventoryContractOut,
    InventoryContractUpdate,
    InventoryEquipmentModelCreate,
    InventoryEquipmentModelOut,
    InventoryEquipmentModelUpdate,
)

router = APIRouter()

@router.get("/catalogs", response_model=InventoryCatalogsOut)
def list_catalogs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    return {
        "suppliers": list_items(db, InventorySupplier),
        "contracts": list_items(db, InventoryContract),
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


@router.delete("/catalogs/suppliers/{item_id}")
def delete_supplier(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return delete_item(
        db,
        InventorySupplier,
        item_id,
        (
            select(Asset.id).where(Asset.supplier_id == item_id),
            select(InventoryContract.id).where(InventoryContract.supplier_id == item_id),
        ),
    )


@router.post("/catalogs/contracts", response_model=InventoryContractOut, status_code=201)
def create_contract(
    payload: InventoryContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    if not db.get(InventorySupplier, payload.supplier_id):
        raise HTTPException(status_code=400, detail="Fornecedor inválido")
    name = catalog_name(payload.name)
    contract = InventoryContract(
        name=name,
        normalized_name=ensure_unique_name(db, InventoryContract, name),
        supplier_id=payload.supplier_id,
        is_active=payload.is_active,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.patch("/catalogs/contracts/{item_id}", response_model=InventoryContractOut)
def update_contract(
    item_id: int,
    payload: InventoryContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    contract = get_item(db, InventoryContract, item_id)
    data = payload.model_dump(exclude_unset=True)
    if "supplier_id" in data:
        if not db.get(InventorySupplier, data["supplier_id"]):
            raise HTTPException(status_code=400, detail="Fornecedor inválido")
        contract.supplier_id = data["supplier_id"]
    if "name" in data:
        contract.name = catalog_name(data["name"])
        contract.normalized_name = ensure_unique_name(db, InventoryContract, contract.name, item_id)
    if "is_active" in data:
        contract.is_active = data["is_active"]
    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/catalogs/contracts/{item_id}")
def delete_contract(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return delete_item(db, InventoryContract, item_id, (select(InventoryDeliveryTerm.id).where(InventoryDeliveryTerm.contract_id == item_id),))


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


@router.delete("/catalogs/equipment-types/{item_id}")
def delete_equipment_type(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return delete_item(
        db,
        InventoryEquipmentType,
        item_id,
        (
            select(Asset.id).where(Asset.equipment_type_id == item_id),
            select(InventoryEquipmentModel.id).where(InventoryEquipmentModel.equipment_type_id == item_id),
        ),
    )


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


@router.delete("/catalogs/manufacturers/{item_id}")
def delete_manufacturer(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return delete_item(
        db,
        InventoryManufacturer,
        item_id,
        (
            select(Asset.id).where(Asset.manufacturer_id == item_id),
            select(InventoryEquipmentModel.id).where(InventoryEquipmentModel.manufacturer_id == item_id),
        ),
    )


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


@router.delete("/catalogs/models/{item_id}")
def delete_equipment_model(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    return delete_item(db, InventoryEquipmentModel, item_id, (select(Asset.id).where(Asset.equipment_model_id == item_id),))


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
    sector = get_item(db, InventorySector, item_id)
    data = payload.model_dump(exclude_unset=True)
    error = default_sector_update_error(data, current_name=sector.name)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return update_item(db, InventorySector, item_id, payload)


@router.delete("/catalogs/sectors/{item_id}")
def delete_sector(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage_catalogs")),
):
    sector = get_item(db, InventorySector, item_id)
    if normalize_catalog_name(sector.name) == normalize_catalog_name(DEFAULT_INVENTORY_SECTOR):
        raise HTTPException(status_code=400, detail="O setor ADCETEI é o estoque padrão e não pode ser excluído")
    return delete_item(
        db,
        InventorySector,
        item_id,
        (
            select(Asset.id).where(Asset.sector_id == item_id),
            select(AssetMovement.id).where(or_(AssetMovement.from_sector_id == item_id, AssetMovement.to_sector_id == item_id)),
        ),
    )
