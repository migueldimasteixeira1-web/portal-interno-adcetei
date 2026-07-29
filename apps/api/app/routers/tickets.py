from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..auth import get_current_user
from ..catalog_forms import normalize_form_schema, validate_form_data
from ..database import get_db
from ..domain import OPEN_STATUSES, OVERDUE_ELIGIBLE_STATUSES, TECHNICIAN_STATUSES
from ..models import Asset, ServiceCatalog, Ticket, TicketComment, User
from ..permissions import has_permission
from ..schemas import CommentCreate, CommentOut, DashboardOut, TicketCreate, TicketDetailOut, TicketPageOut, TicketUpdate
from ..serializers.tickets import serialize_ticket
from ..services.tickets_service import (
    FINAL_TICKET_STATUSES,
    NON_NULLABLE_UPDATE_FIELDS,
    STATUS_WITH_RESOLUTION_MESSAGE,
    TECHNICIAN_UPDATE_FIELDS,
    can_reopen,
    change_message,
    due_for_priority,
    ensure_ticket_access,
    now_utc,
    reopen_ticket,
    ticket_filter_conditions,
    ticket_visibility,
    ticket_visibility_conditions,
    validate_ticket_references,
)

router = APIRouter(prefix="/api", tags=["chamados"])


@router.get("/tickets", response_model=TicketPageOut)
def list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = None,
    assignee_id: int | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = ticket_filter_conditions(current_user, status_filter, priority, assignee_id, search, db)
    base = select(Ticket).where(*conditions)

    def aggregate_count(*extra_conditions: Any) -> int:
        query = select(func.count(Ticket.id)).where(*conditions, *extra_conditions)
        return db.scalar(query) or 0

    total = aggregate_count()
    query = (
        base.options(joinedload(Ticket.requester), joinedload(Ticket.assignee), joinedload(Ticket.asset))
        .order_by(Ticket.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = list(db.scalars(query).unique())
    return TicketPageOut(
        items=[
            serialize_ticket(item, include_sensitive_asset=has_permission(db, current_user, "assets.view"))
            for item in items
        ],
        total=total,
        page=page,
        page_size=page_size,
        summary={
            "new": aggregate_count(Ticket.status == "new"),
            "assigned": aggregate_count(Ticket.status == "assigned"),
            "in_progress": aggregate_count(Ticket.status == "in_progress"),
            "waiting_requester": aggregate_count(Ticket.status == "waiting_requester"),
            "resolved": aggregate_count(Ticket.status == "resolved"),
            "closed": aggregate_count(Ticket.status == "closed"),
            "cancelled": aggregate_count(Ticket.status == "cancelled"),
        },
    )


@router.get("/tickets/{ticket_id}", response_model=TicketDetailOut)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            joinedload(Ticket.requester),
            joinedload(Ticket.assignee),
            joinedload(Ticket.asset).joinedload(Asset.assigned_user),
            selectinload(Ticket.comments).joinedload(TicketComment.author),
        )
    )
    ticket = db.scalar(query)
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    ensure_ticket_access(ticket, current_user, db)
    return serialize_ticket(
        ticket,
        include_comments=True,
        can_view_internal=has_permission(db, current_user, "tickets.internal_notes"),
        include_sensitive_asset=has_permission(db, current_user, "assets.view"),
    )


@router.post("/tickets", response_model=TicketDetailOut, status_code=201)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requester_id = current_user.id
    if payload.requester_id and has_permission(db, current_user, "tickets.triage"):
        requester = db.get(User, payload.requester_id)
        if not requester or not requester.active:
            raise HTTPException(status_code=400, detail="Solicitante inválido")
        requester_id = payload.requester_id

    service = db.get(ServiceCatalog, payload.service_id)
    if not service or not service.active:
        raise HTTPException(status_code=400, detail="Serviço inválido ou inativo")
    asset = db.get(Asset, payload.asset_id) if payload.asset_id is not None else None
    if payload.asset_id is not None and not asset:
        raise HTTPException(status_code=400, detail="Equipamento inválido")
    if current_user.role == "user" and asset and asset.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="O equipamento selecionado não está vinculado ao seu usuário")
    try:
        normalized_form_schema = normalize_form_schema(service.form_schema)
        form_data = validate_form_data(normalized_form_schema, payload.form_data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    priority = "medium"
    ticket = Ticket(
        title=service.name.strip(),
        description=payload.description.strip(),
        status="new",
        priority=priority,
        urgency="medium",
        impact="medium",
        category=f"{service.category} > {service.name}",
        location=payload.location,
        requester_id=requester_id,
        asset_id=payload.asset_id,
        service_id=service.id,
        form_data=form_data,
        form_schema_snapshot=normalized_form_schema,
        due_at=due_for_priority(priority),
    )
    db.add(ticket)
    db.flush()
    db.add(
        TicketComment(
            ticket_id=ticket.id,
            author_id=current_user.id,
            body=f"Chamado aberto pelo Portal do Servidor no serviço: {service.name}.",
            event_type="event",
        )
    )
    db.commit()
    return get_ticket(ticket.id, db, current_user)


@router.patch("/tickets/{ticket_id}", response_model=TicketDetailOut)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    ensure_ticket_access(ticket, current_user, db)

    data = payload.model_dump(exclude_unset=True)
    resolution_message = (data.pop("resolution_message", None) or "").strip()
    null_fields = NON_NULLABLE_UPDATE_FIELDS.intersection(
        field for field, value in data.items() if value is None
    )
    if null_fields:
        raise HTTPException(status_code=422, detail="Campos obrigatórios não podem ser nulos")
    if not has_permission(db, current_user, "tickets.triage"):
        if current_user.role == "user":
            raise HTTPException(status_code=403, detail="Acesso não permitido")
        forbidden = set(data) - TECHNICIAN_UPDATE_FIELDS
        if forbidden:
            raise HTTPException(status_code=403, detail="Técnicos podem alterar apenas o status")
        if data.get("status") not in TECHNICIAN_STATUSES:
            raise HTTPException(status_code=403, detail="Status não permitido para técnico")

    if ticket.status in FINAL_TICKET_STATUSES and data:
        requested_status = data.get("status")
        if set(data) <= {"status"} and requested_status in OPEN_STATUSES and can_reopen(ticket):
            reopen_ticket(ticket, current_user, db, target_status=requested_status)
            db.commit()
            return get_ticket(ticket_id, db, current_user)
        raise HTTPException(status_code=409, detail="Chamado finalizado não pode ser alterado")

    validate_ticket_references(data, db)
    if resolution_message and data.get("status") not in STATUS_WITH_RESOLUTION_MESSAGE:
        raise HTTPException(status_code=422, detail="Mensagem só é aceita ao resolver ou encerrar o chamado")

    if data.get("status") == "resolved":
        if not (data.get("assignee_id") or ticket.assignee_id):
            raise HTTPException(status_code=409, detail="Atribua um responsável antes de resolver o chamado")
        if not resolution_message:
            raise HTTPException(status_code=422, detail="Informe a mensagem de resolução")

    if data.get("status") == "closed":
        if not (data.get("assignee_id") or ticket.assignee_id):
            raise HTTPException(status_code=409, detail="Atribua um responsável antes de encerrar o chamado")
        if ticket.status != "resolved" and not resolution_message:
            raise HTTPException(status_code=422, detail="Informe a mensagem de encerramento")

    if data.get("assignee_id") and ticket.status == "new" and data.get("status", "new") == "new":
        data["status"] = "assigned"

    changes: list[tuple[str, Any, Any]] = []
    for field, value in data.items():
        old = getattr(ticket, field)
        if old != value:
            setattr(ticket, field, value)
            changes.append((field, old, value))

    if "priority" in data:
        ticket.due_at = due_for_priority(ticket.priority)

    if "status" in data:
        if ticket.status in {"closed", "cancelled"}:
            ticket.closed_at = now_utc()
        else:
            ticket.closed_at = None

    if changes:
        ticket.updated_at = now_utc()
        update_comments = [
            TicketComment(
                ticket_id=ticket.id,
                author_id=current_user.id,
                body=change_message(current_user, field, old, new, db),
                internal=False,
                event_type="update",
            )
            for field, old, new in changes
        ]
        if resolution_message and data.get("status") in STATUS_WITH_RESOLUTION_MESSAGE:
            label = "resolução" if data.get("status") == "resolved" else "encerramento"
            update_comments.append(
                TicketComment(
                    ticket_id=ticket.id,
                    author_id=current_user.id,
                    body=f"Mensagem de {label}: {resolution_message}",
                    internal=False,
                    event_type="event",
                )
            )
        db.add_all(update_comments)
    db.commit()
    return get_ticket(ticket_id, db, current_user)


@router.post("/tickets/{ticket_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(
    ticket_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    ensure_ticket_access(ticket, current_user, db)
    if payload.internal and not has_permission(db, current_user, "tickets.internal_notes"):
        raise HTTPException(status_code=403, detail="Seu perfil não pode criar notas internas")

    comment = TicketComment(ticket_id=ticket_id, author_id=current_user.id, body=payload.body.strip(), internal=payload.internal)
    ticket.updated_at = now_utc()
    db.add(comment)

    if not payload.internal and current_user.id == ticket.requester_id and can_reopen(ticket):
        reopen_ticket(ticket, current_user, db, auto=True)

    db.commit()
    db.refresh(comment)
    return db.scalar(select(TicketComment).where(TicketComment.id == comment.id).options(joinedload(TicketComment.author)))


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_time = now_utc()
    visibility = ticket_visibility_conditions(current_user, db)

    def count(*conditions):
        query = select(func.count(Ticket.id))
        for condition in visibility + list(conditions):
            query = query.where(condition)
        return db.scalar(query) or 0

    category_query = select(Ticket.category, func.count(Ticket.id)).group_by(Ticket.category).order_by(func.count(Ticket.id).desc()).limit(5)
    status_query = select(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status)
    for condition in visibility:
        category_query = category_query.where(condition)
        status_query = status_query.where(condition)

    recent_query = (
        ticket_visibility(select(Ticket), current_user, db)
        .options(joinedload(Ticket.requester), joinedload(Ticket.assignee), joinedload(Ticket.asset))
        .order_by(Ticket.updated_at.desc())
        .limit(6)
    )
    recent = list(db.scalars(recent_query).unique())

    team_load = []
    if has_permission(db, current_user, "users.view"):
        technicians = list(
            db.scalars(select(User).where(User.role == "technician", User.active.is_(True)).order_by(User.full_name))
        )
        for member in technicians:
            member_count = db.scalar(select(func.count(Ticket.id)).where(Ticket.assignee_id == member.id, Ticket.status.in_(OPEN_STATUSES))) or 0
            team_load.append({"id": member.id, "name": member.full_name, "role": member.role, "open": member_count})

    return DashboardOut(
        total=count(),
        new=count(Ticket.status == "new"),
        assigned=count(Ticket.status == "assigned"),
        in_progress=count(Ticket.status == "in_progress"),
        waiting_requester=count(Ticket.status == "waiting_requester"),
        resolved=count(Ticket.status == "resolved"),
        closed=count(Ticket.status == "closed"),
        cancelled=count(Ticket.status == "cancelled"),
        overdue=count(Ticket.due_at < current_time, Ticket.status.in_(OVERDUE_ELIGIBLE_STATUSES)),
        my_open=count(Ticket.assignee_id == current_user.id, Ticket.status.in_(OPEN_STATUSES))
        if current_user.role != "user"
        else count(Ticket.status.in_(OPEN_STATUSES)),
        by_category=[{"name": name, "value": value} for name, value in db.execute(category_query)],
        by_status=[{"name": name, "value": value} for name, value in db.execute(status_query)],
        recent=[
            serialize_ticket(item, include_sensitive_asset=has_permission(db, current_user, "assets.view"))
            for item in recent
        ],
        team_load=team_load,
    )
