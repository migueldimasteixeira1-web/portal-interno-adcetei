from datetime import datetime
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from ...audit import add_audit
from ...database import get_db
from ...delivery_terms_service import open_delivery_term_for_asset, reservation_conflict_message
from ...delivery_terms_docx import render_delivery_term_docx, term_filename
from ...inventory_helpers import add_asset_movement, validate_contract
from ...inventory_service import apply_asset_allocation, asset_is_retired, asset_movement_state, build_asset_display_name, inventory_status_from_asset, movement_datetime, normalize_serial_number
from ...models import Asset, InventoryDeliveryTerm, InventoryDeliveryTermItem, InventorySector, User
from ...permissions import require_permission
from ...schemas import (
    InventoryDeliveryTermCreate,
    InventoryDeliveryTermDeliver,
    InventoryDeliveryTermNextNumberOut,
    InventoryDeliveryTermOut,
    InventoryDeliveryTermPreview,
    InventoryDeliveryTermPreviewOut,
    MessageOut,
)

router = APIRouter()


def term_query():
    return (
        select(InventoryDeliveryTerm)
        .options(
            joinedload(InventoryDeliveryTerm.recipient),
            joinedload(InventoryDeliveryTerm.destination_sector),
            selectinload(InventoryDeliveryTerm.items).joinedload(InventoryDeliveryTermItem.asset),
        )
    )


def term_payload(term: InventoryDeliveryTerm) -> dict:
    return {
        "id": term.id,
        "term_number": term.term_number,
        "contract_id": term.contract_id,
        "contract_number": term.contract_number,
        "issued_at": term.issued_at,
        "destination_sector_id": term.destination_sector_id,
        "destination_unit": term.destination_unit,
        "recipient_user_id": term.recipient_user_id,
        "recipient_name": term.recipient_name,
        "recipient_email": term.recipient_email,
        "recipient_registration": term.recipient_registration,
        "recipient_phone": term.recipient_phone,
        "adcetei_signer_name": term.adcetei_signer_name,
        "adcetei_signer_title": term.adcetei_signer_title,
        "item_observation": term.item_observation,
        "notes": term.notes,
        "status": term.status,
        "delivered_at": term.delivered_at,
        "created_at": term.created_at,
        "updated_at": term.updated_at,
        "items": [
            {
                "id": item.id,
                "asset_id": item.asset_id,
                "asset_type": item.asset_type,
                "manufacturer": item.manufacturer,
                "model": item.model,
                "serial_number": item.serial_number,
                "specification": item.specification,
                "observation": item.observation,
            }
            for item in term.items
        ],
    }


def get_term_or_404(db: Session, term_id: int) -> InventoryDeliveryTerm:
    term = db.scalar(term_query().where(InventoryDeliveryTerm.id == term_id))
    if not term:
        raise HTTPException(status_code=404, detail="Termo não encontrado")
    return term


def item_payload_from_asset(asset: Asset, item_id: int = 0, observation: str = "") -> dict:
    asset_type = (asset.equipment_type.name if asset.equipment_type else asset.asset_type).strip()
    manufacturer = (asset.manufacturer_ref.name if asset.manufacturer_ref else asset.manufacturer).strip()
    model = (asset.equipment_model.name if asset.equipment_model else asset.model).strip()
    return {
        "id": item_id,
        "asset_id": asset.id,
        "asset_type": asset_type,
        "manufacturer": manufacturer,
        "model": model,
        "serial_number": asset.serial_number,
        "specification": asset.specifications.strip() or build_asset_display_name(asset_type, manufacturer, model, ""),
        "observation": observation or asset_condition_observation(asset),
    }


def asset_condition_observation(asset: Asset) -> str:
    return "Equipamento usado" if asset.delivered_at else "Equipamento novo"


def asset_term_error(db: Session, asset: Asset) -> str | None:
    if asset_is_retired(asset):
        return "Equipamento baixado não pode entrar em termo"
    if inventory_status_from_asset(asset) != "stock":
        return "Somente equipamento em estoque pode entrar em termo"
    open_term = open_delivery_term_for_asset(db, asset.id)
    if open_term:
        return reservation_conflict_message(open_term)
    return None


def validate_assets_by_serial(db: Session, serial_numbers: list[str]) -> tuple[list[Asset], list[dict]]:
    normalized_to_input: dict[str, tuple[int, str]] = {}
    errors: list[dict] = []
    for index, serial in enumerate(serial_numbers):
        normalized = normalize_serial_number(serial)
        if not normalized:
            errors.append({"index": index, "serial_number": serial, "normalized_serial": "", "message": "Número de série obrigatório"})
            continue
        if normalized in normalized_to_input:
            errors.append({"index": index, "serial_number": serial, "normalized_serial": normalized, "message": "Número de série duplicado no termo"})
            continue
        normalized_to_input[normalized] = (index, serial)

    matches: dict[str, Asset] = {}
    for asset in db.scalars(select(Asset)):
        normalized = normalize_serial_number(asset.serial_number)
        if normalized in normalized_to_input:
            matches[normalized] = asset

    valid_assets: list[Asset] = []
    for normalized, (index, serial) in normalized_to_input.items():
        asset = matches.get(normalized)
        if not asset:
            errors.append({"index": index, "serial_number": serial, "normalized_serial": normalized, "message": "Número de série não encontrado"})
            continue
        message = asset_term_error(db, asset)
        if message:
            errors.append({"index": index, "serial_number": serial, "normalized_serial": normalized, "message": message})
            continue
        valid_assets.append(asset)
    return valid_assets, errors


def assets_by_serial(db: Session, serial_numbers: list[str], *, lock: bool = False) -> list[Asset]:
    assets, errors = validate_assets_by_serial(db, serial_numbers)
    if errors:
        first = errors[0]
        raise HTTPException(status_code=409, detail=f"{first['message']}: {first['serial_number']}")
    if lock:
        query = select(Asset).where(Asset.id.in_([asset.id for asset in assets]))
        if db.bind and db.bind.dialect.name == "postgresql":
            query = query.with_for_update()
        locked = {asset.id: asset for asset in db.scalars(query.execution_options(populate_existing=True))}
        assets = [locked[asset.id] for asset in assets]
        for asset in assets:
            message = asset_term_error(db, asset)
            if message:
                raise HTTPException(status_code=409, detail=f"{message}: {asset.serial_number}")
    return assets


def next_term_number(db: Session) -> str:
    year = datetime.now().year
    pattern = re.compile(rf"^(\d+)/{year}$")
    numbers = []
    for value in db.scalars(select(InventoryDeliveryTerm.term_number)):
        match = pattern.match((value or "").strip())
        if match:
            numbers.append(int(match.group(1)))
    return f"{(max(numbers) if numbers else 0) + 1:03d}/{year}"


def destination_sector_for_recipient(db: Session, recipient: User) -> InventorySector:
    if not recipient.department_sector_id:
        raise HTTPException(status_code=409, detail="Recebedor sem lotação cadastrada. Corrija o setor do usuário na Administração.")
    sector = db.scalar(
        select(InventorySector)
        .options(joinedload(InventorySector.secretariat))
        .where(InventorySector.id == recipient.department_sector_id)
    )
    if not sector:
        raise HTTPException(status_code=409, detail="Setor do recebedor não existe. Corrija a lotação do usuário na Administração.")
    if not sector.is_active:
        raise HTTPException(status_code=409, detail="Setor do recebedor está inativo. Corrija a lotação do usuário na Administração.")
    if not sector.secretariat:
        raise HTTPException(status_code=409, detail="Setor do recebedor está sem secretaria. Corrija o cadastro organizacional na Administração.")
    return sector


def destination_unit_for_sector(sector: InventorySector) -> str:
    return f"{sector.secretariat.name} - {sector.name}"


@router.get("/delivery-terms", response_model=list[InventoryDeliveryTermOut])
def list_delivery_terms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    terms = db.scalars(term_query().order_by(InventoryDeliveryTerm.created_at.desc(), InventoryDeliveryTerm.id.desc())).unique()
    return [term_payload(term) for term in terms]


@router.get("/delivery-terms/next-number", response_model=InventoryDeliveryTermNextNumberOut)
def get_next_delivery_term_number(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    return {"term_number": next_term_number(db)}


@router.post("/delivery-terms/preview", response_model=InventoryDeliveryTermPreviewOut)
def preview_delivery_term(
    payload: InventoryDeliveryTermPreview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    assets, errors = validate_assets_by_serial(db, payload.serial_numbers)
    return {
        "total": len(payload.serial_numbers),
        "valid_count": len(assets),
        "invalid_count": len(errors),
        "valid_items": [item_payload_from_asset(asset) for asset in assets],
        "errors": errors,
    }


@router.get("/delivery-terms/{term_id}", response_model=InventoryDeliveryTermOut)
def get_delivery_term(
    term_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    return term_payload(get_term_or_404(db, term_id))


@router.post("/delivery-terms", response_model=InventoryDeliveryTermOut, status_code=201)
def create_delivery_term(
    payload: InventoryDeliveryTermCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    if db.scalar(select(InventoryDeliveryTerm.id).where(func.lower(InventoryDeliveryTerm.term_number) == payload.term_number.strip().casefold())):
        raise HTTPException(status_code=409, detail="Já existe um termo com este número")
    recipient = db.get(User, payload.recipient_user_id)
    if not recipient:
        raise HTTPException(status_code=400, detail="Responsável recebedor inválido")
    sector = destination_sector_for_recipient(db, recipient)
    contract = validate_contract(db, payload.contract_id)

    assets = assets_by_serial(db, payload.serial_numbers, lock=True)
    recipient_registration = payload.recipient_registration.strip()
    recipient_phone = payload.recipient_phone.strip()
    if recipient_registration and not recipient.registration:
        recipient.registration = recipient_registration
    if recipient_phone and not recipient.phone:
        recipient.phone = recipient_phone

    issued_at = movement_datetime(payload.issued_at)
    term = InventoryDeliveryTerm(
        term_number=payload.term_number.strip(),
        contract_id=contract.id if contract else None,
        contract_number=contract.name if contract else payload.contract_number.strip(),
        issued_at=issued_at,
        destination_sector_id=sector.id,
        destination_unit=destination_unit_for_sector(sector),
        recipient_user_id=recipient.id,
        recipient_name=recipient.full_name,
        recipient_email=recipient.email,
        recipient_registration=recipient_registration,
        recipient_phone=recipient_phone,
        adcetei_signer_name=payload.adcetei_signer_name.strip(),
        adcetei_signer_title=payload.adcetei_signer_title.strip(),
        item_observation=payload.item_observation.strip(),
        notes=payload.notes.strip(),
        status="emitted",
        created_by_user_id=current_user.id,
    )
    try:
        db.add(term)
        db.flush()
        for asset in assets:
            item_observation = asset_condition_observation(asset) if asset.delivered_at else payload.item_observation.strip()
            term.items.append(
                InventoryDeliveryTermItem(
                    asset_id=asset.id,
                    asset_type=(asset.equipment_type.name if asset.equipment_type else asset.asset_type).strip(),
                    manufacturer=(asset.manufacturer_ref.name if asset.manufacturer_ref else asset.manufacturer).strip(),
                    model=(asset.equipment_model.name if asset.equipment_model else asset.model).strip(),
                    serial_number=asset.serial_number,
                    specification=asset.specifications.strip() or build_asset_display_name(
                        asset.equipment_type.name if asset.equipment_type else asset.asset_type,
                        asset.manufacturer_ref.name if asset.manufacturer_ref else asset.manufacturer,
                        asset.equipment_model.name if asset.equipment_model else asset.model,
                        "",
                    ),
                    observation=item_observation,
                )
            )
        add_audit(
            db,
            actor=current_user,
            action="create_delivery_term",
            entity_type="inventory_delivery_term",
            entity_id=term.id,
            summary=f"Emissão do termo de recebimento {term.term_number}",
            changes={"asset_ids": [asset.id for asset in assets], "recipient_user_id": recipient.id},
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Já existe um termo com este número") from exc
    except Exception:
        db.rollback()
        raise
    return term_payload(get_term_or_404(db, term.id))


@router.post("/delivery-terms/{term_id}/cancel", response_model=MessageOut)
def cancel_delivery_term(
    term_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    term = get_term_or_404(db, term_id)
    if term.status == "delivered":
        raise HTTPException(status_code=409, detail="Termo entregue não pode ser cancelado")
    if term.status == "cancelled":
        return {"message": "Termo já estava cancelado"}
    term.status = "cancelled"
    add_audit(
        db,
        actor=current_user,
        action="cancel_delivery_term",
        entity_type="inventory_delivery_term",
        entity_id=term.id,
        summary=f"Cancelamento do termo de recebimento {term.term_number}",
        changes={"asset_ids": [item.asset_id for item in term.items]},
    )
    db.commit()
    return {"message": "Termo cancelado"}


@router.get("/delivery-terms/{term_id}/document")
def download_delivery_term_document(
    term_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.view")),
):
    term = get_term_or_404(db, term_id)
    content = render_delivery_term_docx(term)
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{term_filename(term)}"'},
    )


@router.post("/delivery-terms/{term_id}/deliver", response_model=InventoryDeliveryTermOut)
def confirm_delivery_term(
    term_id: int,
    payload: InventoryDeliveryTermDeliver,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.move")),
):
    term = get_term_or_404(db, term_id)
    if term.status == "delivered":
        raise HTTPException(status_code=409, detail="Termo já foi confirmado")
    if term.status == "cancelled":
        raise HTTPException(status_code=409, detail="Termo cancelado não pode ser confirmado")
    recipient = db.get(User, term.recipient_user_id)
    if not recipient:
        raise HTTPException(status_code=409, detail="Recebedor do termo não existe mais. Cancele o termo e corrija o cadastro.")
    if recipient.department_sector_id != term.destination_sector_id:
        raise HTTPException(status_code=409, detail="A lotação do recebedor mudou após a emissão. Cancele e reemita o termo para a nova lotação.")
    sector = db.get(InventorySector, term.destination_sector_id)
    if not sector or not sector.is_active:
        raise HTTPException(status_code=400, detail="Setor de destino inválido")
    movement_at = movement_datetime(payload.movement_date)
    if movement_at.date() < term.issued_at.date():
        raise HTTPException(status_code=409, detail="Data da entrega não pode ser anterior à data de emissão do termo")
    notes = payload.notes.strip() or f"Entrega confirmada pelo termo {term.term_number}."
    asset_ids = [item.asset_id for item in term.items]
    query = select(Asset).where(Asset.id.in_(asset_ids))
    if db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    assets = {asset.id: asset for asset in db.scalars(query.execution_options(populate_existing=True))}
    try:
        for item in term.items:
            asset = assets.get(item.asset_id)
            if not asset:
                raise HTTPException(status_code=409, detail=f"Equipamento do termo não existe mais: {item.serial_number}")
            if inventory_status_from_asset(asset) != "stock":
                raise HTTPException(status_code=409, detail=f"Equipamento não está mais em estoque: {item.serial_number}")
            reservation = open_delivery_term_for_asset(db, asset.id)
            if not reservation or reservation.id != term.id:
                raise HTTPException(status_code=409, detail=f"Equipamento não está mais reservado por este termo: {item.serial_number}")
            if asset.received_at and movement_at.date() < asset.received_at.date():
                raise HTTPException(status_code=409, detail=f"Data da entrega não pode ser anterior ao recebimento do equipamento: {item.serial_number}")
            before = asset_movement_state(asset)
            apply_asset_allocation(asset, sector, term.recipient_user_id, movement_at)
            add_asset_movement(
                db,
                asset=asset,
                action="allocated",
                before=before,
                movement_at=movement_at,
                notes=notes,
                actor_id=current_user.id,
            )
        term.status = "delivered"
        term.delivered_at = movement_at
        term.delivered_by_user_id = current_user.id
        add_audit(
            db,
            actor=current_user,
            action="confirm_delivery_term",
            entity_type="inventory_delivery_term",
            entity_id=term.id,
            summary=f"Confirmação de entrega do termo {term.term_number}",
            changes={"asset_ids": asset_ids, "recipient_user_id": term.recipient_user_id},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return term_payload(get_term_or_404(db, term.id))
