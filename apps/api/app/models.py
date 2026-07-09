from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
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
    registration: Mapped[str] = mapped_column(String(80), default="")
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
    specifications: Mapped[str] = mapped_column(Text, default="")
    patrimony: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(40), default="active", index=True)
    location: Mapped[str] = mapped_column(String(160), default="")
    ip_address: Mapped[str] = mapped_column(String(60), default="")
    operating_system: Mapped[str] = mapped_column(String(120), default="")
    assigned_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_suppliers.id"), nullable=True)
    equipment_type_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_equipment_types.id"), nullable=True)
    manufacturer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_manufacturers.id"), nullable=True)
    equipment_model_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_equipment_models.id"), nullable=True)
    sector_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_sectors.id"), nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    retired_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    retired_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    retirement_reason: Mapped[str] = mapped_column(String(60), default="")
    retirement_justification: Mapped[str] = mapped_column(Text, default="")
    retirement_notes: Mapped[str] = mapped_column(Text, default="")

    assigned_user: Mapped[Optional[User]] = relationship(foreign_keys=[assigned_user_id])
    retired_by: Mapped[Optional[User]] = relationship(foreign_keys=[retired_by_user_id])
    supplier: Mapped[Optional[InventorySupplier]] = relationship()
    equipment_type: Mapped[Optional[InventoryEquipmentType]] = relationship()
    manufacturer_ref: Mapped[Optional[InventoryManufacturer]] = relationship()
    equipment_model: Mapped[Optional[InventoryEquipmentModel]] = relationship()
    sector: Mapped[Optional[InventorySector]] = relationship()
    tickets: Mapped[list[Ticket]] = relationship(back_populates="asset")


class InventorySupplier(Base):
    __tablename__ = "inventory_suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    normalized_name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class InventoryContract(Base):
    __tablename__ = "inventory_contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    normalized_name: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("inventory_suppliers.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    supplier: Mapped[InventorySupplier] = relationship()


class InventoryEquipmentType(Base):
    __tablename__ = "inventory_equipment_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    normalized_name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class InventoryManufacturer(Base):
    __tablename__ = "inventory_manufacturers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    normalized_name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class InventoryEquipmentModel(Base):
    __tablename__ = "inventory_equipment_models"
    __table_args__ = (UniqueConstraint("normalized_name", name="uq_inventory_equipment_models_normalized_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    normalized_name: Mapped[str] = mapped_column(String(180), index=True)
    manufacturer_id: Mapped[int] = mapped_column(ForeignKey("inventory_manufacturers.id"), index=True)
    equipment_type_id: Mapped[int] = mapped_column(ForeignKey("inventory_equipment_types.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    manufacturer: Mapped[InventoryManufacturer] = relationship()
    equipment_type: Mapped[InventoryEquipmentType] = relationship()


class InventorySector(Base):
    __tablename__ = "inventory_sectors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    normalized_name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class AssetMovement(Base):
    __tablename__ = "asset_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    from_sector_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_sectors.id"), nullable=True)
    to_sector_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_sectors.id"), nullable=True)
    from_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    to_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    from_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    to_status: Mapped[str] = mapped_column(String(40))
    movement_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    asset: Mapped[Asset] = relationship()
    from_sector: Mapped[Optional[InventorySector]] = relationship(foreign_keys=[from_sector_id])
    to_sector: Mapped[Optional[InventorySector]] = relationship(foreign_keys=[to_sector_id])
    from_user: Mapped[Optional[User]] = relationship(foreign_keys=[from_user_id])
    to_user: Mapped[Optional[User]] = relationship(foreign_keys=[to_user_id])
    actor: Mapped[Optional[User]] = relationship(foreign_keys=[actor_id])


class InventoryDeliveryTerm(Base):
    __tablename__ = "inventory_delivery_terms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    term_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    contract_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_contracts.id"), nullable=True, index=True)
    contract_number: Mapped[str] = mapped_column(String(120), default="")
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    destination_sector_id: Mapped[int] = mapped_column(ForeignKey("inventory_sectors.id"), index=True)
    destination_unit: Mapped[str] = mapped_column(String(180))
    recipient_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    recipient_name: Mapped[str] = mapped_column(String(180))
    recipient_email: Mapped[str] = mapped_column(String(180))
    recipient_registration: Mapped[str] = mapped_column(String(80), default="")
    recipient_phone: Mapped[str] = mapped_column(String(40), default="")
    adcetei_signer_name: Mapped[str] = mapped_column(String(180), default="William Barreto Corrêa")
    adcetei_signer_title: Mapped[str] = mapped_column(String(180), default="Coordenador Geral de Tecnologia da Informação")
    item_observation: Mapped[str] = mapped_column(String(180), default="Equipamento locado")
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    delivered_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    recipient: Mapped[User] = relationship(foreign_keys=[recipient_user_id])
    contract: Mapped[Optional[InventoryContract]] = relationship()
    destination_sector: Mapped[InventorySector] = relationship()
    created_by: Mapped[Optional[User]] = relationship(foreign_keys=[created_by_user_id])
    delivered_by: Mapped[Optional[User]] = relationship(foreign_keys=[delivered_by_user_id])
    items: Mapped[list[InventoryDeliveryTermItem]] = relationship(
        back_populates="term",
        cascade="all, delete-orphan",
        order_by="InventoryDeliveryTermItem.id",
    )


class InventoryDeliveryTermItem(Base):
    __tablename__ = "inventory_delivery_term_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    term_id: Mapped[int] = mapped_column(ForeignKey("inventory_delivery_terms.id"), index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    asset_type: Mapped[str] = mapped_column(String(80), default="")
    manufacturer: Mapped[str] = mapped_column(String(120), default="")
    model: Mapped[str] = mapped_column(String(160), default="")
    serial_number: Mapped[str] = mapped_column(String(120), default="")
    specification: Mapped[str] = mapped_column(Text, default="")
    observation: Mapped[str] = mapped_column(String(180), default="")

    term: Mapped[InventoryDeliveryTerm] = relationship(back_populates="items")
    asset: Mapped[Asset] = relationship()


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
    team: Mapped[str] = mapped_column(String(100), default="Técnico")
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
