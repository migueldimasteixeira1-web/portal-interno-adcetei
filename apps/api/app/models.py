from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .time_utils import utc_now


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(180))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    role: Mapped[str] = mapped_column(String(40), default="user", index=True)
    secretariat: Mapped[str] = mapped_column(String(150), default="Prefeitura de Cabo Frio")
    department: Mapped[str] = mapped_column(String(150), default="Não informado")
    phone: Mapped[str] = mapped_column(String(40), default="")
    source: Mapped[str] = mapped_column(String(20), default="local")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    email_verification_token_hash: Mapped[str] = mapped_column(String(128), default="")
    email_verification_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    password_reset_token_hash: Mapped[str] = mapped_column(String(128), default="")
    password_reset_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    requested_tickets: Mapped[list[Ticket]] = relationship(
        back_populates="requester", foreign_keys="Ticket.requester_id"
    )
    assigned_tickets: Mapped[list[Ticket]] = relationship(
        back_populates="assignee", foreign_keys="Ticket.assignee_id"
    )


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    asset_type: Mapped[str] = mapped_column(String(60), index=True)
    manufacturer: Mapped[str] = mapped_column(String(100), default="")
    model: Mapped[str] = mapped_column(String(140), default="")
    serial_number: Mapped[str] = mapped_column(String(120), default="")
    patrimony: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(40), default="active", index=True)
    location: Mapped[str] = mapped_column(String(160), default="")
    ip_address: Mapped[str] = mapped_column(String(60), default="")
    operating_system: Mapped[str] = mapped_column(String(120), default="")
    assigned_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    assigned_user: Mapped[Optional[User]] = relationship()
    tickets: Mapped[list[Ticket]] = relationship(back_populates="asset")


class ServiceCatalog(Base):
    __tablename__ = "service_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(60), default="support_agent")
    color: Mapped[str] = mapped_column(String(30), default="#1f5eff")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    form_schema: Mapped[dict] = mapped_column(JSON, default=dict)


class RoleConfig(Base):
    __tablename__ = "role_configs"

    role: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(300), default="")
    ldap_group: Mapped[str] = mapped_column(String(180), default="")
    permissions: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(220), index=True)
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="new", index=True)
    priority: Mapped[str] = mapped_column(String(30), default="medium", index=True)
    urgency: Mapped[str] = mapped_column(String(30), default="medium")
    impact: Mapped[str] = mapped_column(String(30), default="medium")
    category: Mapped[str] = mapped_column(String(100), index=True)
    team: Mapped[str] = mapped_column(String(100), default="Helpdesk")
    origin: Mapped[str] = mapped_column(String(40), default="portal")
    location: Mapped[str] = mapped_column(String(160), default="")
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    assignee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    asset_id: Mapped[Optional[int]] = mapped_column(ForeignKey("assets.id"), nullable=True)
    service_id: Mapped[Optional[int]] = mapped_column(ForeignKey("service_catalog.id"), nullable=True)
    form_data: Mapped[dict] = mapped_column(JSON, default=dict)
    form_schema_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    requester: Mapped[User] = relationship(back_populates="requested_tickets", foreign_keys=[requester_id])
    assignee: Mapped[Optional[User]] = relationship(back_populates="assigned_tickets", foreign_keys=[assignee_id])
    asset: Mapped[Optional[Asset]] = relationship(back_populates="tickets")
    service: Mapped[Optional[ServiceCatalog]] = relationship()
    comments: Mapped[list[TicketComment]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan", order_by="TicketComment.created_at"
    )


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    internal: Mapped[bool] = mapped_column(Boolean, default=False)
    event_type: Mapped[str] = mapped_column(String(30), default="comment")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    ticket: Mapped[Ticket] = relationship(back_populates="comments")
    author: Mapped[User] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    entity_type: Mapped[str] = mapped_column(String(60), index=True)
    entity_id: Mapped[str] = mapped_column(String(80), default="")
    summary: Mapped[str] = mapped_column(String(500))
    changes: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    actor: Mapped[Optional[User]] = relationship()
