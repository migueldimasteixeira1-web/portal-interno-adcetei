from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer

from .domain import TicketPriority, TicketStatus
from .time_utils import iso_utc


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: EmailStr
    role: str
    secretariat: str
    department: str
    phone: str
    source: str
    active: bool
    email_verified_at: Optional[datetime] = None
    permissions: list[str] = Field(default_factory=list)
    last_login_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("last_login_at", "email_verified_at")
    def serialize_user_datetimes(self, value: datetime | None) -> str | None:
        return iso_utc(value)


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=180)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    model_config = ConfigDict(extra="forbid")


class MessageOut(BaseModel):
    message: str


class VerifyEmailIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    model_config = ConfigDict(extra="forbid")


class ResendVerificationIn(BaseModel):
    email: EmailStr
    model_config = ConfigDict(extra="forbid")


class AssetOut(BaseModel):
    id: int
    name: str
    asset_type: str
    manufacturer: str
    model: str
    serial_number: str
    patrimony: str
    status: str
    location: str
    ip_address: str
    operating_system: str
    assigned_user_id: Optional[int] = None
    last_seen_at: Optional[datetime] = None
    assigned_user: Optional[UserOut] = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("last_seen_at")
    def serialize_last_seen_at(self, value: datetime | None) -> str | None:
        return iso_utc(value)


class AssetTicketOptionOut(BaseModel):
    id: int
    name: str
    asset_type: str
    patrimony: str
    model_config = ConfigDict(from_attributes=True)


class CatalogOut(BaseModel):
    id: int
    name: str
    category: str
    description: str
    icon: str
    color: str
    active: bool
    form_schema: dict[str, Any]
    model_config = ConfigDict(from_attributes=True)


RoleName = Literal["admin", "technician", "user"]
AssetStatus = Literal["active", "maintenance", "stock", "retired"]


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=120, pattern=r"^[A-Za-z0-9._-]+$")
    full_name: str = Field(min_length=3, max_length=180)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    role: RoleName = "user"
    secretariat: str = Field(default="Prefeitura de Cabo Frio", max_length=150)
    department: str = Field(default="Não informado", max_length=150)
    phone: str = Field(default="", max_length=40)
    active: bool = True
    email_verified: bool = True
    model_config = ConfigDict(extra="forbid")


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=3, max_length=180)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=10, max_length=128)
    role: Optional[RoleName] = None
    secretariat: Optional[str] = Field(default=None, max_length=150)
    department: Optional[str] = Field(default=None, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=40)
    active: Optional[bool] = None
    email_verified: Optional[bool] = None
    model_config = ConfigDict(extra="forbid")


class AssetCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    asset_type: str = Field(min_length=2, max_length=60)
    manufacturer: str = Field(default="", max_length=100)
    model: str = Field(default="", max_length=140)
    serial_number: str = Field(default="", max_length=120)
    patrimony: str = Field(default="", max_length=80)
    status: AssetStatus = "active"
    location: str = Field(default="", max_length=160)
    ip_address: str = Field(default="", max_length=60)
    operating_system: str = Field(default="", max_length=120)
    assigned_user_id: Optional[int] = None
    model_config = ConfigDict(extra="forbid")


class AssetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    asset_type: Optional[str] = Field(default=None, min_length=2, max_length=60)
    manufacturer: Optional[str] = Field(default=None, max_length=100)
    model: Optional[str] = Field(default=None, max_length=140)
    serial_number: Optional[str] = Field(default=None, max_length=120)
    patrimony: Optional[str] = Field(default=None, max_length=80)
    status: Optional[AssetStatus] = None
    location: Optional[str] = Field(default=None, max_length=160)
    ip_address: Optional[str] = Field(default=None, max_length=60)
    operating_system: Optional[str] = Field(default=None, max_length=120)
    assigned_user_id: Optional[int] = None
    model_config = ConfigDict(extra="forbid")


class CatalogCreate(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    category: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=2000)
    icon: str = Field(default="support_agent", max_length=60)
    color: str = Field(default="#1f5eff", pattern=r"^#[0-9A-Fa-f]{6}$")
    active: bool = True
    form_schema: dict[str, Any] = Field(default_factory=lambda: {"fields": []})
    model_config = ConfigDict(extra="forbid")


class CatalogUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=160)
    category: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=2000)
    icon: Optional[str] = Field(default=None, max_length=60)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    active: Optional[bool] = None
    form_schema: Optional[dict[str, Any]] = None
    model_config = ConfigDict(extra="forbid")


class RoleConfigOut(BaseModel):
    role: RoleName
    label: str
    description: str
    permissions: list[str]
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("updated_at")
    def serialize_updated_at(self, value: datetime) -> str:
        return iso_utc(value) or ""


class RoleConfigUpdate(BaseModel):
    description: Optional[str] = Field(default=None, max_length=300)
    permissions: Optional[list[str]] = None
    model_config = ConfigDict(extra="forbid")


class PermissionDefinitionOut(BaseModel):
    key: str
    label: str
    group: str


class InventoryCatalogItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    is_active: bool = True
    model_config = ConfigDict(extra="forbid")


class InventoryCatalogItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    is_active: Optional[bool] = None
    model_config = ConfigDict(extra="forbid")


class InventoryEquipmentModelCreate(InventoryCatalogItemCreate):
    manufacturer_id: int
    equipment_type_id: int


class InventoryEquipmentModelUpdate(InventoryCatalogItemUpdate):
    manufacturer_id: Optional[int] = None
    equipment_type_id: Optional[int] = None


class InventoryCatalogItemOut(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at")
    def serialize_catalog_datetimes(self, value: datetime) -> str:
        return iso_utc(value) or ""


class InventoryEquipmentModelOut(InventoryCatalogItemOut):
    manufacturer_id: int
    equipment_type_id: int


class InventoryCatalogsOut(BaseModel):
    suppliers: list[InventoryCatalogItemOut]
    equipment_types: list[InventoryCatalogItemOut]
    manufacturers: list[InventoryCatalogItemOut]
    models: list[InventoryEquipmentModelOut]
    sectors: list[InventoryCatalogItemOut]


InventoryAssetStatus = Literal["stock", "allocated", "maintenance", "retired"]
InventoryMovementAction = Literal["created", "updated", "allocated", "responsible_changed", "returned_to_stock", "maintenance"]


class InventoryAssetCatalogRefOut(BaseModel):
    id: int
    name: str


class InventoryAssetUserRefOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    department: str
    model_config = ConfigDict(from_attributes=True)


class InventoryAssetOut(BaseModel):
    id: int
    serial_number: str
    status: InventoryAssetStatus
    display_name: str
    supplier_id: Optional[int] = None
    supplier: Optional[InventoryAssetCatalogRefOut] = None
    equipment_type_id: Optional[int] = None
    equipment_type: Optional[InventoryAssetCatalogRefOut] = None
    manufacturer_id: Optional[int] = None
    manufacturer: Optional[InventoryAssetCatalogRefOut] = None
    equipment_model_id: Optional[int] = None
    equipment_model: Optional[InventoryAssetCatalogRefOut] = None
    sector_id: Optional[int] = None
    sector: Optional[InventoryAssetCatalogRefOut] = None
    assigned_user_id: Optional[int] = None
    assigned_user: Optional[InventoryAssetUserRefOut] = None
    received_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    notes: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer("received_at", "delivered_at", "created_at", "updated_at")
    def serialize_inventory_asset_datetimes(self, value: datetime | None) -> str | None:
        return iso_utc(value)


class InventoryAssetCreate(BaseModel):
    serial_number: str = Field(min_length=1, max_length=120)
    supplier_id: Optional[int] = None
    equipment_type_id: int
    manufacturer_id: int
    equipment_model_id: int
    sector_id: Optional[int] = None
    assigned_user_id: Optional[int] = None
    received_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    notes: str = Field(default="", max_length=2000)
    model_config = ConfigDict(extra="forbid")


class InventoryBulkScanRequest(BaseModel):
    supplier_id: int
    equipment_type_id: int
    manufacturer_id: int
    equipment_model_id: int
    received_at: date
    serial_numbers: list[str] = Field(min_length=1, max_length=500)
    notes: str = Field(default="", max_length=2000)
    model_config = ConfigDict(extra="forbid")


class InventoryBulkScanItemPreview(BaseModel):
    index: int
    serial_number: str
    normalized_serial: str


class InventoryBulkScanError(BaseModel):
    index: int
    serial_number: str
    normalized_serial: str
    message: str


class InventoryBulkScanPreviewOut(BaseModel):
    total: int
    valid_count: int
    invalid_count: int
    valid_items: list[InventoryBulkScanItemPreview]
    errors: list[InventoryBulkScanError]


class InventoryBulkScanConfirmOut(BaseModel):
    created_count: int
    assets: list[InventoryAssetOut]
    summary: InventoryBulkScanPreviewOut


class InventoryAssetUpdate(BaseModel):
    serial_number: Optional[str] = Field(default=None, min_length=1, max_length=120)
    status: Optional[InventoryAssetStatus] = None
    supplier_id: Optional[int] = None
    equipment_type_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    equipment_model_id: Optional[int] = None
    sector_id: Optional[int] = None
    assigned_user_id: Optional[int] = None
    received_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    model_config = ConfigDict(extra="forbid")


class InventoryMovementCreate(BaseModel):
    movement_date: date
    notes: str = Field(default="", max_length=2000)
    model_config = ConfigDict(extra="forbid")


class InventoryAllocateRequest(InventoryMovementCreate):
    sector_id: int
    assigned_user_id: Optional[int] = None


class InventoryChangeResponsibleRequest(InventoryMovementCreate):
    assigned_user_id: int


class InventoryReturnToStockRequest(InventoryMovementCreate):
    pass


class InventoryMaintenanceRequest(InventoryMovementCreate):
    pass


class InventoryMovementOut(BaseModel):
    id: int
    action: InventoryMovementAction
    movement_date: datetime
    notes: str
    from_status: Optional[InventoryAssetStatus] = None
    to_status: InventoryAssetStatus
    from_sector: Optional[InventoryAssetCatalogRefOut] = None
    to_sector: Optional[InventoryAssetCatalogRefOut] = None
    from_user: Optional[InventoryAssetUserRefOut] = None
    to_user: Optional[InventoryAssetUserRefOut] = None
    actor: Optional[InventoryAssetUserRefOut] = None
    created_at: datetime

    @field_serializer("movement_date", "created_at")
    def serialize_movement_datetimes(self, value: datetime) -> str:
        return iso_utc(value) or ""


class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: str
    summary: str
    changes: dict[str, Any]
    created_at: datetime
    actor: Optional[UserOut] = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return iso_utc(value) or ""


class CommentCreate(BaseModel):
    body: str = Field(min_length=2, max_length=5000)
    internal: bool = False
    model_config = ConfigDict(extra="forbid")


class CommentOut(BaseModel):
    id: int
    body: str
    internal: bool
    event_type: str
    created_at: datetime
    author: UserOut
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return iso_utc(value) or ""


class TicketCreate(BaseModel):
    # Regra de negócio do MVP: solicitante não define título nem prioridade.
    # O título nasce do catálogo e a prioridade inicial fica como média até a triagem.
    description: str = Field(min_length=5, max_length=10000)
    location: str = ""
    asset_id: Optional[int] = None
    service_id: int
    requester_id: Optional[int] = None
    form_data: dict[str, Any] = Field(default_factory=dict)
    model_config = ConfigDict(extra="forbid")


class TicketUpdate(BaseModel):
    # Apenas equipe de TI/admin pode atualizar estes campos.
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    urgency: Optional[TicketPriority] = None
    impact: Optional[TicketPriority] = None
    category: Optional[str] = Field(default=None, max_length=100)
    team: Optional[str] = Field(default=None, max_length=100)
    location: Optional[str] = Field(default=None, max_length=160)
    assignee_id: Optional[int] = None
    asset_id: Optional[int] = None
    model_config = ConfigDict(extra="forbid")


class TicketListOut(BaseModel):
    id: int
    title: str
    status: str
    priority: str
    category: str
    team: str
    requester: UserOut
    assignee: Optional[UserOut] = None
    asset: Optional[AssetOut | AssetTicketOptionOut] = None
    created_at: datetime
    updated_at: datetime
    due_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at", "due_at")
    def serialize_ticket_dates(self, value: datetime | None) -> str | None:
        return iso_utc(value)


class TicketDetailOut(TicketListOut):
    description: str
    service_id: Optional[int] = None
    form_data: dict[str, str] = Field(default_factory=dict)
    form_schema_snapshot: dict[str, Any] = Field(default_factory=dict)
    urgency: str
    impact: str
    origin: str
    location: str
    closed_at: Optional[datetime] = None
    comments: list[CommentOut] = []

    @field_serializer("closed_at")
    def serialize_closed_at(self, value: datetime | None) -> str | None:
        return iso_utc(value)


class TicketQueueSummaryOut(BaseModel):
    new: int
    assigned: int
    closed: int
    cancelled: int


class TicketPageOut(BaseModel):
    items: list[TicketListOut]
    total: int
    page: int
    page_size: int
    summary: TicketQueueSummaryOut


class DashboardOut(BaseModel):
    total: int
    new: int
    assigned: int
    closed: int
    cancelled: int
    overdue: int
    my_open: int
    by_category: list[dict[str, Any]]
    by_status: list[dict[str, Any]]
    recent: list[TicketListOut]
    team_load: list[dict[str, Any]]
