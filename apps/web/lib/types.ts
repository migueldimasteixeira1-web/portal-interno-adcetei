export type Role = "admin" | "technician" | "user";

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: Role;
  secretariat: string;
  department: string;
  phone: string;
  source: string;
  active: boolean;
  email_verified_at?: string | null;
  permissions: string[];
  last_login_at?: string | null;
}

export interface Asset {
  id: number;
  name: string;
  asset_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  patrimony: string;
  status: string;
  location: string;
  ip_address: string;
  operating_system: string;
  assigned_user_id?: number | null;
  last_seen_at?: string | null;
  assigned_user?: User | null;
}

export interface AssetTicketOption {
  id: number;
  name: string;
  asset_type: string;
  patrimony: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  status?: string;
  location?: string;
  ip_address?: string;
  operating_system?: string;
  assigned_user_id?: number | null;
  last_seen_at?: string | null;
  assigned_user?: User | null;
}

export type InventoryAssetStatus = "stock" | "allocated" | "maintenance" | "retired";
export type InventoryMovementAction = "created" | "updated" | "allocated" | "responsible_changed" | "returned_to_stock" | "maintenance";

export interface InventoryCatalogItem {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryEquipmentModel extends InventoryCatalogItem {
  manufacturer_id: number;
  equipment_type_id: number;
}

export interface InventoryCatalogs {
  suppliers: InventoryCatalogItem[];
  equipment_types: InventoryCatalogItem[];
  manufacturers: InventoryCatalogItem[];
  models: InventoryEquipmentModel[];
  sectors: InventoryCatalogItem[];
}

export interface InventoryCatalogCreatePayload {
  name: string;
  is_active?: boolean;
}

export interface InventoryCatalogUpdatePayload {
  name?: string;
  is_active?: boolean;
}

export interface InventoryEquipmentModelCreatePayload extends InventoryCatalogCreatePayload {
  manufacturer_id: number;
  equipment_type_id: number;
}

export interface InventoryEquipmentModelUpdatePayload extends InventoryCatalogUpdatePayload {
  manufacturer_id?: number;
  equipment_type_id?: number;
}

export interface InventoryAssetCatalogRef {
  id: number;
  name: string;
}

export interface InventoryAssetUserRef {
  id: number;
  full_name: string;
  email: string;
  department: string;
}

export interface InventoryAsset {
  id: number;
  serial_number: string;
  status: InventoryAssetStatus;
  display_name: string;
  supplier_id?: number | null;
  supplier?: InventoryAssetCatalogRef | null;
  equipment_type_id?: number | null;
  equipment_type?: InventoryAssetCatalogRef | null;
  manufacturer_id?: number | null;
  manufacturer?: InventoryAssetCatalogRef | null;
  equipment_model_id?: number | null;
  equipment_model?: InventoryAssetCatalogRef | null;
  sector_id?: number | null;
  sector?: InventoryAssetCatalogRef | null;
  assigned_user_id?: number | null;
  assigned_user?: InventoryAssetUserRef | null;
  received_at?: string | null;
  delivered_at?: string | null;
  notes: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InventoryAssetPage {
  items: InventoryAsset[];
  total: number;
  page: number;
  page_size: number;
  summary: Record<InventoryAssetStatus, number>;
}

export interface InventoryAssetCreatePayload {
  serial_number: string;
  supplier_id: number;
  equipment_type_id: number;
  manufacturer_id: number;
  equipment_model_id: number;
  sector_id?: number | null;
  assigned_user_id?: number | null;
  received_at: string;
  delivered_at?: string | null;
  notes?: string;
}

export interface InventoryMovement {
  id: number;
  action: InventoryMovementAction;
  movement_date: string;
  notes: string;
  from_status?: InventoryAssetStatus | null;
  to_status: InventoryAssetStatus;
  from_sector?: InventoryAssetCatalogRef | null;
  to_sector?: InventoryAssetCatalogRef | null;
  from_user?: InventoryAssetUserRef | null;
  to_user?: InventoryAssetUserRef | null;
  actor?: InventoryAssetUserRef | null;
  created_at: string;
}

export interface InventoryMovementPayload {
  movement_date: string;
  notes?: string;
}

export interface InventoryAllocatePayload extends InventoryMovementPayload {
  sector_id: number;
  assigned_user_id?: number | null;
}

export interface InventoryChangeResponsiblePayload extends InventoryMovementPayload {
  assigned_user_id: number;
}

export interface InventoryBulkScanPayload {
  supplier_id: number;
  equipment_type_id: number;
  manufacturer_id: number;
  equipment_model_id: number;
  received_at: string;
  serial_numbers: string[];
  notes?: string;
}

export interface InventoryBulkScanItemPreview {
  index: number;
  serial_number: string;
  normalized_serial: string;
}

export interface InventoryBulkScanError {
  index: number;
  serial_number: string;
  normalized_serial: string;
  message: string;
}

export interface InventoryBulkScanPreview {
  total: number;
  valid_count: number;
  invalid_count: number;
  valid_items: InventoryBulkScanItemPreview[];
  errors: InventoryBulkScanError[];
}

export interface InventoryBulkScanConfirm {
  created_count: number;
  assets: InventoryAsset[];
  summary: InventoryBulkScanPreview;
}

export interface CatalogFormField {
  key: string;
  label: string;
  type: "text" | "email" | "textarea" | "select" | "date";
  required: boolean;
  placeholder: string;
  options: string[];
  max_length: number;
  help?: string;
}

export interface CatalogIconOption {
  key: string;
  label: string;
}

export interface CatalogOptions {
  categories: string[];
  icons: CatalogIconOption[];
  fields: CatalogFormField[];
}

export interface CatalogService {
  id: number;
  name: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  active: boolean;
  form_schema: { fields?: CatalogFormField[] };
}

export interface TicketComment {
  id: number;
  body: string;
  internal: boolean;
  event_type: string;
  created_at: string;
  author: User;
}

export interface Ticket {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  urgency?: string;
  impact?: string;
  category: string;
  team: string;
  origin?: string;
  location?: string;
  form_data?: Record<string, string>;
  form_schema_snapshot?: { fields?: CatalogFormField[] };
  requester: User;
  assignee?: User | null;
  asset?: AssetTicketOption | null;
  created_at: string;
  updated_at: string;
  due_at?: string | null;
  closed_at?: string | null;
  comments?: TicketComment[];
}

export interface TicketPage {
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
  summary: {
    new: number;
    assigned: number;
    closed: number;
    cancelled: number;
  };
}

export interface DashboardData {
  total: number;
  new: number;
  assigned: number;
  closed: number;
  cancelled: number;
  overdue: number;
  my_open: number;
  by_category: Array<{ name: string; value: number }>;
  by_status: Array<{ name: string; value: number }>;
  recent: Ticket[];
  team_load: Array<{ id: number; name: string; role: string; open: number }>;
}

export interface RoleConfig {
  role: Role;
  label: string;
  description: string;
  permissions: string[];
  updated_at: string;
}

export interface PermissionDefinition {
  key: string;
  label: string;
  group: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  changes: Record<string, unknown>;
  created_at: string;
  actor?: User | null;
}
