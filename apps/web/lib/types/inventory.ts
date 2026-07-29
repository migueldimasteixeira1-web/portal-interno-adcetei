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

export interface InventoryContract extends InventoryCatalogItem {
  supplier_id: number;
}

export interface InventoryEquipmentModel extends InventoryCatalogItem {
  manufacturer_id: number;
  equipment_type_id: number;
}

export interface InventorySector extends InventoryCatalogItem {
  secretariat_id?: number | null;
  secretariat?: InventoryCatalogItem | null;
}

export interface InventoryCatalogs {
  secretariats: InventoryCatalogItem[];
  suppliers: InventoryCatalogItem[];
  contracts: InventoryContract[];
  equipment_types: InventoryCatalogItem[];
  manufacturers: InventoryCatalogItem[];
  models: InventoryEquipmentModel[];
  sectors: InventorySector[];
}

export interface InventoryCatalogCreatePayload {
  name: string;
  is_active?: boolean;
}

export interface InventoryCatalogUpdatePayload {
  name?: string;
  is_active?: boolean;
}

export interface InventorySectorCreatePayload extends InventoryCatalogCreatePayload {
  secretariat_id: number;
}

export interface InventorySectorUpdatePayload extends InventoryCatalogUpdatePayload {
  secretariat_id?: number | null;
}

export interface InventoryEquipmentModelCreatePayload extends InventoryCatalogCreatePayload {
  manufacturer_id: number;
  equipment_type_id: number;
}

export interface InventoryEquipmentModelUpdatePayload extends InventoryCatalogUpdatePayload {
  manufacturer_id?: number;
  equipment_type_id?: number;
}

export interface InventoryContractCreatePayload extends InventoryCatalogCreatePayload {
  supplier_id: number;
}

export interface InventoryContractUpdatePayload extends InventoryCatalogUpdatePayload {
  supplier_id?: number;
}

export interface InventoryAssetCatalogRef {
  id: number;
  name: string;
  secretariat_id?: number | null;
  secretariat?: InventoryAssetCatalogRef | null;
}

export interface InventoryAssetUserRef {
  id: number;
  full_name: string;
  email: string;
  secretariat: string;
  department_sector_id?: number | null;
  department: string;
}

export interface InventoryAsset {
  id: number;
  serial_number: string;
  specifications: string;
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
  specifications?: string;
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
  specifications?: string;
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

export type InventoryDeliveryTermStatus = "draft" | "emitted" | "delivered" | "cancelled";

export interface InventoryDeliveryTermItem {
  id: number;
  asset_id: number;
  asset_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  specification: string;
  observation: string;
}

export interface InventoryDeliveryTerm {
  id: number;
  term_number: string;
  contract_id?: number | null;
  contract_number: string;
  issued_at: string;
  destination_sector_id: number;
  destination_unit: string;
  recipient_user_id: number;
  recipient_name: string;
  recipient_email: string;
  recipient_registration: string;
  recipient_phone: string;
  adcetei_signer_name: string;
  adcetei_signer_title: string;
  item_observation: string;
  notes: string;
  status: InventoryDeliveryTermStatus;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
  items: InventoryDeliveryTermItem[];
}

export interface InventoryDeliveryTermCreatePayload {
  term_number: string;
  contract_id?: number | null;
  contract_number?: string;
  issued_at: string;
  destination_unit: string;
  recipient_user_id: number;
  recipient_registration?: string;
  recipient_phone?: string;
  adcetei_signer_name: string;
  adcetei_signer_title: string;
  item_observation?: string;
  serial_numbers: string[];
  notes?: string;
}

export interface InventoryDeliveryTermPreviewPayload {
  serial_numbers: string[];
}

export interface InventoryDeliveryTermPreviewError {
  index: number;
  serial_number: string;
  normalized_serial: string;
  message: string;
}

export interface InventoryDeliveryTermPreview {
  total: number;
  valid_count: number;
  invalid_count: number;
  valid_items: InventoryDeliveryTermItem[];
  errors: InventoryDeliveryTermPreviewError[];
}

export interface InventoryDeliveryTermDeliverPayload {
  movement_date: string;
  notes?: string;
}

export type InventoryReturnTermStatus = "draft" | "emitted" | "confirmed" | "cancelled";

export interface InventoryReturnTermItem {
  id: number;
  asset_id: number;
  asset_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  specification: string;
  observation: string;
}

export interface InventoryReturnTerm {
  id: number;
  term_number: string;
  contract_id?: number | null;
  contract_number: string;
  related_delivery_term_id?: number | null;
  issued_at: string;
  origin_sector_id: number;
  origin_unit: string;
  returner_user_id: number;
  returner_name: string;
  returner_email: string;
  returner_registration: string;
  returner_phone: string;
  adcetei_signer_name: string;
  adcetei_signer_title: string;
  item_observation: string;
  notes: string;
  status: InventoryReturnTermStatus;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  items: InventoryReturnTermItem[];
}

export interface InventoryReturnTermCreatePayload {
  term_number: string;
  contract_id?: number | null;
  contract_number?: string;
  related_delivery_term_id?: number | null;
  issued_at: string;
  returner_user_id: number;
  returner_registration?: string;
  returner_phone?: string;
  adcetei_signer_name: string;
  adcetei_signer_title: string;
  item_observation?: string;
  serial_numbers: string[];
  notes?: string;
}

export interface InventoryReturnTermPreviewPayload {
  returner_user_id: number;
  serial_numbers: string[];
}

export interface InventoryReturnTermPreview {
  total: number;
  valid_count: number;
  invalid_count: number;
  valid_items: InventoryReturnTermItem[];
  errors: InventoryDeliveryTermPreviewError[];
}

export interface InventoryReturnTermConfirmPayload {
  movement_date: string;
  notes?: string;
}
