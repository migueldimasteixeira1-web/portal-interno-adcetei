from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..admin_helpers import has_rows, reject_null_fields
from ..audit import add_audit
from ..catalog_forms import catalog_options_payload, catalog_payload, normalize_form_schema
from ..database import get_db
from ..models import ServiceCatalog, Ticket, User
from ..permissions import require_permission
from ..schemas import CatalogCreate, CatalogOptionsOut, CatalogOut, CatalogUpdate

router = APIRouter()

@router.get("/catalog/options", response_model=CatalogOptionsOut)
def get_catalog_options(actor: User = Depends(require_permission("catalog.manage"))):
    return catalog_options_payload()


@router.post("/catalog", response_model=CatalogOut, status_code=201)
def create_catalog_service(
    payload: CatalogCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("catalog.manage")),
):
    name = payload.name.strip()
    if db.scalar(select(ServiceCatalog).where(func.lower(ServiceCatalog.name) == name.casefold())):
        raise HTTPException(status_code=409, detail="Já existe um serviço com este nome")
    service = ServiceCatalog(
        name=name,
        category=payload.category.strip(),
        description=payload.description.strip(),
        icon=payload.icon.strip(),
        color=payload.color,
        active=payload.active,
        form_schema=normalize_form_schema(payload.form_schema),
    )
    db.add(service)
    db.flush()
    add_audit(
        db,
        actor,
        "create",
        "catalog",
        service.id,
        f"{actor.full_name} criou o serviço {service.name}.",
        {"category": service.category, "active": service.active},
    )
    db.commit()
    return catalog_payload(service)


@router.patch("/catalog/{service_id}", response_model=CatalogOut)
def update_catalog_service(
    service_id: int,
    payload: CatalogUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("catalog.manage")),
):
    service = db.get(ServiceCatalog, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    data = payload.model_dump(exclude_unset=True)
    reject_null_fields(
        data,
        {"name", "category", "description", "icon", "color", "active", "form_schema"},
    )
    if "name" in data:
        duplicate = db.scalar(
            select(ServiceCatalog).where(
                func.lower(ServiceCatalog.name) == data["name"].strip().casefold(),
                ServiceCatalog.id != service.id,
            )
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Já existe um serviço com este nome")
    if "form_schema" in data:
        data["form_schema"] = normalize_form_schema(data["form_schema"])
    changes: dict[str, Any] = {}
    for field, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        old = getattr(service, field)
        if old != value:
            setattr(service, field, value)
            changes[field] = {"from": old, "to": value}
    if changes:
        add_audit(
            db,
            actor,
            "update",
            "catalog",
            service.id,
            f"{actor.full_name} atualizou o serviço {service.name}.",
            changes,
        )
        db.commit()
    return catalog_payload(service)


@router.delete("/catalog/{service_id}")
def delete_catalog_service(
    service_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("catalog.manage")),
):
    service = db.get(ServiceCatalog, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    if has_rows(db, select(Ticket.id).where(Ticket.service_id == service.id)):
        raise HTTPException(status_code=409, detail="Serviço possui chamados vinculados. Arquive em vez de excluir.")

    deleted_name = service.name
    db.delete(service)
    add_audit(
        db,
        actor,
        "delete",
        "catalog",
        service_id,
        f"{actor.full_name} excluiu o serviço {deleted_name}.",
        {"name": deleted_name, "category": service.category},
    )
    db.commit()
    return {"message": "Serviço excluído com sucesso"}


