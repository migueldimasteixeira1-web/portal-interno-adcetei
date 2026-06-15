from datetime import datetime, timedelta
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from .admin_api import router as admin_router
from .auth import (
    create_access_token,
    generate_public_token,
    get_current_user,
    hash_password,
    hash_token,
    normalize_email,
    validate_institutional_email,
    verify_password,
)
from .catalog_forms import normalize_form_schema, validate_form_data
from .config import settings
from .database import Base, SessionLocal, engine, ensure_schema_compatibility, get_db
from .domain import OPEN_STATUSES, PRIORITY_LABELS, STATUS_LABELS, TECHNICIAN_STATUSES
from .email_service import send_verification_email
from .models import Asset, ServiceCatalog, Ticket, TicketComment, User
from .permissions import (
    ensure_role_configs,
    has_permission,
    permissions_for_role,
    require_permission,
)
from .schemas import (
    AssetOut,
    AssetTicketOptionOut,
    CatalogOut,
    CommentCreate,
    CommentOut,
    DashboardOut,
    LoginIn,
    LoginOut,
    MessageOut,
    RegisterIn,
    ResendVerificationIn,
    TicketCreate,
    TicketDetailOut,
    TicketPageOut,
    TicketUpdate,
    UserOut,
    VerifyEmailIn,
)
from .seed import seed_database
from .time_utils import ensure_utc, sao_paulo_day_bounds_utc, utc_now

app = FastAPI(title=settings.app_name, version="0.3.0", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(admin_router)

FIELD_LABELS = {
    "status": "o status",
    "priority": "a prioridade",
    "urgency": "a urgência",
    "impact": "o impacto",
    "category": "a categoria",
    "team": "a equipe",
    "location": "a localização",
    "assignee_id": "o responsável",
    "asset_id": "o equipamento",
}

TECHNICIAN_UPDATE_FIELDS = {"status"}
NON_NULLABLE_UPDATE_FIELDS = {"status", "priority", "urgency", "impact", "category", "team", "location"}


def now_utc() -> datetime:
    return utc_now()


def due_for_priority(priority: str) -> datetime:
    hours = {"critical": 2, "high": 4, "medium": 48, "low": 72}.get(priority, 48)
    return now_utc() + timedelta(hours=hours)


def display_value(field: str, value: Any, db: Session) -> str:
    if value in (None, ""):
        return "—"
    if field == "status":
        return STATUS_LABELS.get(str(value), str(value))
    if field in {"priority", "urgency", "impact"}:
        return PRIORITY_LABELS.get(str(value), str(value))
    if field == "assignee_id":
        user = db.get(User, value)
        return user.full_name if user else "—"
    if field == "asset_id":
        asset = db.get(Asset, value)
        return asset.name if asset else "—"
    return str(value)


def ensure_ticket_access(ticket: Ticket, current_user: User, db: Session) -> None:
    if has_permission(db, current_user, "tickets.view_all"):
        return
    if current_user.role == "requester" and ticket.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso não permitido")
    if current_user.role != "requester" and ticket.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso não permitido")


def validate_ticket_references(data: dict[str, Any], db: Session) -> None:
    if data.get("assignee_id") is not None:
        assignee = db.get(User, data["assignee_id"])
        if not assignee or not assignee.active or assignee.role not in {"admin", "helpdesk", "technician"}:
            raise HTTPException(status_code=400, detail="Responsável inválido")
    if data.get("asset_id") is not None and not db.get(Asset, data["asset_id"]):
        raise HTTPException(status_code=400, detail="Equipamento inválido")


def change_message(actor: User, field: str, old: Any, new: Any, db: Session) -> str:
    old_label = display_value(field, old, db)
    new_label = display_value(field, new, db)
    if field == "assignee_id":
        if new is None:
            return f"{actor.full_name} removeu o responsável do chamado."
        if old is None:
            return f"{actor.full_name} atribuiu o chamado para {new_label}."
        return f"{actor.full_name} alterou o responsável de {old_label} para {new_label}."
    if field == "asset_id":
        if new is None:
            return f"{actor.full_name} removeu o equipamento vinculado ao chamado."
        if old is None:
            return f"{actor.full_name} vinculou o equipamento {new_label} ao chamado."
        return f"{actor.full_name} alterou o equipamento de {old_label} para {new_label}."
    label = FIELD_LABELS.get(field, f"o campo {field}")
    return f"{actor.full_name} alterou {label} de {old_label} para {new_label}."


def serialize_user(
    user: User | None,
    db: Session | None = None,
    include_permissions: bool = False,
) -> dict[str, Any] | None:
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "secretariat": user.secretariat,
        "department": user.department,
        "phone": user.phone,
        "source": user.source,
        "active": user.active,
        "email_verified_at": user.email_verified_at,
        "permissions": sorted(permissions_for_role(db, user.role)) if db and include_permissions else [],
        "last_login_at": user.last_login_at,
    }


def serialize_asset(asset: Asset | None) -> dict[str, Any] | None:
    if not asset:
        return None
    return {
        "id": asset.id,
        "name": asset.name,
        "asset_type": asset.asset_type,
        "manufacturer": asset.manufacturer,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "patrimony": asset.patrimony,
        "status": asset.status,
        "location": asset.location,
        "ip_address": asset.ip_address,
        "operating_system": asset.operating_system,
        "assigned_user_id": asset.assigned_user_id,
        "last_seen_at": asset.last_seen_at,
        "assigned_user": serialize_user(asset.assigned_user),
    }


def serialize_asset_option(asset: Asset | None) -> dict[str, Any] | None:
    if not asset:
        return None
    return {
        "id": asset.id,
        "name": asset.name,
        "asset_type": asset.asset_type,
        "patrimony": asset.patrimony,
    }


def serialize_comment(comment: TicketComment) -> dict[str, Any]:
    return {
        "id": comment.id,
        "body": comment.body,
        "internal": comment.internal,
        "event_type": comment.event_type,
        "created_at": comment.created_at,
        "author": serialize_user(comment.author),
    }


def serialize_ticket(
    ticket: Ticket,
    include_comments: bool = False,
    can_view_internal: bool = False,
    include_sensitive_asset: bool = True,
) -> dict[str, Any]:
    data = {
        "id": ticket.id,
        "title": ticket.title,
        "status": ticket.status,
        "priority": ticket.priority,
        "category": ticket.category,
        "team": ticket.team,
        "requester": serialize_user(ticket.requester),
        "assignee": serialize_user(ticket.assignee),
        "asset": serialize_asset(ticket.asset) if include_sensitive_asset else serialize_asset_option(ticket.asset),
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "due_at": ticket.due_at,
    }
    if include_comments:
        comments = ticket.comments or []
        if not can_view_internal:
            comments = [item for item in comments if not item.internal]
        data.update(
            {
                "description": ticket.description,
                "service_id": ticket.service_id,
                "form_data": ticket.form_data or {},
                "form_schema_snapshot": ticket.form_schema_snapshot or {},
                "urgency": ticket.urgency,
                "impact": ticket.impact,
                "origin": ticket.origin,
                "location": ticket.location,
                "closed_at": ticket.closed_at,
                "comments": [serialize_comment(item) for item in comments],
            }
        )
    return data


def verification_url(token: str) -> str:
    base = settings.public_app_url.rstrip("/")
    return f"{base}/confirmar-email?token={token}"


def generate_username_from_email(db: Session, email: str) -> str:
    base = email.split("@", 1)[0].replace("+", ".")[:100]
    username = base
    suffix = 2
    while db.scalar(select(User.id).where(func.lower(User.username) == username.casefold())):
        username = f"{base[:110]}{suffix}"
        suffix += 1
    return username


def set_email_verification_token(user: User) -> str:
    token = generate_public_token()
    user.email_verification_token_hash = hash_token(token)
    user.email_verification_expires_at = now_utc() + timedelta(minutes=settings.email_verification_expire_minutes)
    return token


def queue_verification_email(user: User) -> None:
    token = set_email_verification_token(user)
    send_verification_email(user.email, user.full_name, verification_url(token))


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()
    with SessionLocal() as db:
        ensure_role_configs(db)
        if settings.demo_seed_enabled:
            seed_database(db)
        db.execute(update(Ticket).where(Ticket.status == "solved").values(status="resolved"))
        db.commit()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name, "auth_mode": settings.auth_mode}


@app.post("/api/auth/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    identifier = payload.username.strip().lower()
    user = db.scalar(
        select(User).where(
            or_(func.lower(User.email) == identifier, func.lower(User.username) == identifier)
        )
    )

    if user and not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha inválidos")

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha inválidos")

    if not user.email_verified_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirme seu e-mail institucional antes de entrar no portal.",
        )

    user.last_login_at = now_utc()
    db.commit()
    db.refresh(user)
    return LoginOut(
        access_token=create_access_token(user),
        user=serialize_user(user, db, include_permissions=True),
    )


@app.post("/api/auth/register", response_model=MessageOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    email = validate_institutional_email(str(payload.email))
    existing = db.scalar(select(User).where(func.lower(User.email) == email.casefold()))
    if existing:
        if existing.active and not existing.email_verified_at:
            try:
                queue_verification_email(existing)
            except Exception as exc:
                db.rollback()
                raise HTTPException(status_code=503, detail="Não foi possível enviar o e-mail de verificação. Tente novamente mais tarde.") from exc
            db.commit()
        return {"message": "Se o cadastro puder ser concluído, enviaremos um link de verificação para seu e-mail institucional."}

    user = User(
        username=generate_username_from_email(db, email),
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="requester",
        secretariat="Prefeitura de Cabo Frio",
        department="Não informado",
        source="email",
        active=True,
        email_verified_at=None,
    )
    db.add(user)
    db.flush()
    try:
        queue_verification_email(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Não foi possível enviar o e-mail de verificação. Tente novamente mais tarde.") from exc
    db.commit()
    return {"message": "Se o cadastro puder ser concluído, enviaremos um link de verificação para seu e-mail institucional."}


@app.post("/api/auth/verify-email", response_model=MessageOut)
def verify_email(payload: VerifyEmailIn, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.token)
    user = db.scalar(select(User).where(User.email_verification_token_hash == token_hash))
    expires_at = ensure_utc(user.email_verification_expires_at) if user else None
    if not user or not expires_at or expires_at < now_utc():
        raise HTTPException(status_code=400, detail="Link de verificação inválido ou expirado.")

    user.email_verified_at = now_utc()
    user.email_verification_token_hash = ""
    user.email_verification_expires_at = None
    db.commit()
    return {"message": "E-mail confirmado com sucesso. Você já pode entrar no portal."}


@app.post("/api/auth/resend-verification", response_model=MessageOut)
def resend_verification(payload: ResendVerificationIn, db: Session = Depends(get_db)):
    email = normalize_email(str(payload.email))
    generic = {"message": "Se houver uma conta pendente para este e-mail, enviaremos um novo link de verificação."}
    user = db.scalar(select(User).where(func.lower(User.email) == email.casefold()))
    if not user or user.email_verified_at or not user.active:
        return generic
    try:
        queue_verification_email(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Não foi possível enviar o e-mail de verificação. Tente novamente mais tarde.") from exc
    db.commit()
    return generic


@app.get("/api/auth/me", response_model=UserOut)
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return serialize_user(current_user, db, include_permissions=True)


@app.get("/api/users", response_model=list[UserOut])
def list_users(
    role: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
):
    query = select(User).order_by(User.full_name)
    if role:
        query = query.where(User.role == role)
    if search:
        like = f"%{search}%"
        query = query.where(or_(User.full_name.ilike(like), User.username.ilike(like), User.email.ilike(like)))
    return list(db.scalars(query))


@app.get("/api/assets", response_model=list[AssetOut])
def list_assets(
    asset_type: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("assets.view")),
):
    query = select(Asset).options(joinedload(Asset.assigned_user)).order_by(Asset.name)
    if asset_type:
        query = query.where(Asset.asset_type == asset_type)
    if status_filter:
        query = query.where(Asset.status == status_filter)
    if search:
        like = f"%{search}%"
        query = query.where(
            or_(Asset.name.ilike(like), Asset.model.ilike(like), Asset.patrimony.ilike(like), Asset.ip_address.ilike(like))
        )
    return list(db.scalars(query).unique())


@app.get("/api/assets/ticket-options", response_model=list[AssetTicketOptionOut])
def list_asset_ticket_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Asset).order_by(Asset.name)
    if current_user.role == "requester":
        query = query.where(Asset.assigned_user_id == current_user.id)
    return list(db.scalars(query))


@app.get("/api/catalog", response_model=list[CatalogOut])
def list_catalog(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if include_inactive and not has_permission(db, current_user, "catalog.manage"):
        raise HTTPException(status_code=403, detail="Acesso não permitido")
    query = select(ServiceCatalog).order_by(ServiceCatalog.category, ServiceCatalog.name)
    if not include_inactive:
        query = query.where(ServiceCatalog.active.is_(True))
    services = list(db.scalars(query))
    return [
        {
            "id": service.id,
            "name": service.name,
            "category": service.category,
            "description": service.description,
            "icon": service.icon,
            "color": service.color,
            "active": service.active,
            "form_schema": normalize_form_schema(service.form_schema),
        }
        for service in services
    ]


def ticket_visibility_conditions(current_user: User, db: Session) -> list[Any]:
    if has_permission(db, current_user, "tickets.view_all"):
        return []
    if current_user.role == "requester":
        return [Ticket.requester_id == current_user.id]
    return [Ticket.assignee_id == current_user.id]


def ticket_visibility(query, current_user: User, db: Session):
    return query.where(*ticket_visibility_conditions(current_user, db))


def ticket_filter_conditions(
    current_user: User,
    status_filter: str | None,
    priority: str | None,
    assignee_id: int | None,
    search: str | None,
    db: Session,
) -> list[Any]:
    conditions = ticket_visibility_conditions(current_user, db)
    if status_filter:
        statuses = [item.strip() for item in status_filter.split(",") if item.strip()]
        conditions.append(Ticket.status.in_(statuses))
    if priority:
        conditions.append(Ticket.priority == priority)
    if assignee_id:
        conditions.append(Ticket.assignee_id == assignee_id)
    if search:
        like = f"%{search}%"
        conditions.append(or_(Ticket.title.ilike(like), Ticket.description.ilike(like), Ticket.category.ilike(like)))
    return conditions


@app.get("/api/tickets", response_model=TicketPageOut)
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
            "unassigned": aggregate_count(Ticket.assignee_id.is_(None)),
            "urgent": aggregate_count(Ticket.priority.in_(["high", "critical"])),
            "waiting_user": aggregate_count(Ticket.status == "waiting_user"),
        },
    )


@app.post("/api/tickets", response_model=TicketDetailOut, status_code=201)
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
    if current_user.role == "requester" and asset and asset.assigned_user_id != current_user.id:
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


@app.get("/api/tickets/{ticket_id}", response_model=TicketDetailOut)
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


@app.patch("/api/tickets/{ticket_id}", response_model=TicketDetailOut)
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
    null_fields = NON_NULLABLE_UPDATE_FIELDS.intersection(
        field for field, value in data.items() if value is None
    )
    if null_fields:
        raise HTTPException(status_code=422, detail="Campos obrigatórios não podem ser nulos")
    if not has_permission(db, current_user, "tickets.triage"):
        if current_user.role == "requester":
            raise HTTPException(status_code=403, detail="Acesso não permitido")
        forbidden = set(data) - TECHNICIAN_UPDATE_FIELDS
        if forbidden:
            raise HTTPException(status_code=403, detail="Técnicos podem alterar apenas o status")
        if data.get("status") not in TECHNICIAN_STATUSES:
            raise HTTPException(status_code=403, detail="Status não permitido para técnico")

    validate_ticket_references(data, db)
    changes: list[tuple[str, Any, Any]] = []
    for field, value in data.items():
        old = getattr(ticket, field)
        if old != value:
            setattr(ticket, field, value)
            changes.append((field, old, value))

    if "priority" in data:
        ticket.due_at = due_for_priority(ticket.priority)

    if "status" in data:
        if ticket.status in {"resolved", "closed"}:
            ticket.closed_at = now_utc()
        else:
            ticket.closed_at = None

    if changes:
        ticket.updated_at = now_utc()
        db.add_all(
            [
                TicketComment(
                    ticket_id=ticket.id,
                    author_id=current_user.id,
                    body=change_message(current_user, field, old, new, db),
                    internal=False,
                    event_type="update",
                )
                for field, old, new in changes
            ]
        )
    db.commit()
    return get_ticket(ticket_id, db, current_user)


@app.post("/api/tickets/{ticket_id}/comments", response_model=CommentOut, status_code=201)
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
    db.commit()
    db.refresh(comment)
    return db.scalar(select(TicketComment).where(TicketComment.id == comment.id).options(joinedload(TicketComment.author)))


@app.get("/api/dashboard", response_model=DashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_time = now_utc()
    day_start, day_end = sao_paulo_day_bounds_utc(current_time)
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
        helpdeskers = list(
            db.scalars(select(User).where(User.role.in_(["helpdesk", "technician"]), User.active.is_(True)).order_by(User.full_name))
        )
        for member in helpdeskers:
            member_count = db.scalar(select(func.count(Ticket.id)).where(Ticket.assignee_id == member.id, Ticket.status.in_(OPEN_STATUSES))) or 0
            team_load.append({"id": member.id, "name": member.full_name, "role": member.role, "open": member_count})

    return DashboardOut(
        total=count(),
        new=count(Ticket.status == "new"),
        assigned=count(Ticket.status.in_(["assigned", "in_progress", "triage"])),
        pending=count(Ticket.status == "waiting_user"),
        overdue=count(Ticket.due_at < current_time, Ticket.status.in_(OPEN_STATUSES)),
        solved_today=count(Ticket.closed_at >= day_start, Ticket.closed_at <= day_end),
        my_open=count(Ticket.assignee_id == current_user.id, Ticket.status.in_(OPEN_STATUSES))
        if current_user.role != "requester"
        else count(Ticket.status.in_(OPEN_STATUSES)),
        by_category=[{"name": name, "value": value} for name, value in db.execute(category_query)],
        by_status=[{"name": name, "value": value} for name, value in db.execute(status_query)],
        recent=[
            serialize_ticket(item, include_sensitive_asset=has_permission(db, current_user, "assets.view"))
            for item in recent
        ],
        team_load=team_load,
    )
