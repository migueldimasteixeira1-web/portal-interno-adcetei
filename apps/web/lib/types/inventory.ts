export type InventoryAssetStatus = "stock" | "allocated" | "maintenance" | "retired";
export type InventoryMovementAction = "created" | "updated" | "allocated" | "responsible_changed" | "returned_to_stock" | "maintenance" | "retired";
export type InventoryRetirementReason =
  | "CONTRATO_ENCERRADO"
  | "DEVOLVIDO_AO_FORNECEDOR"
  | "DEFEITO_IRRECUPERAVEL"
  | "DESCARTE"
  | "SUBSTITUICAO"
  | "PERDA"
  | "FURTO_ROUBO"
  | "CORRECAO_ADMINISTRATIVA"
  | "OUTRO";

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
  retired_at?: string | null;
  retired_by_user_id?: number | null;
  retirement_reason?: InventoryRetirementReason | null;
  retirement_justification?: string;
  retirement_notes?: string;
  retired_by?: InventoryAssetUserRef | null;
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

export interface InventoryRetirePayload {
  reason: InventoryRetirementReason;
  justification: string;
  movement_date: string;
  notes?: string;
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

