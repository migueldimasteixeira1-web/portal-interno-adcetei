import type {
  AssetTicketOption,
  AuditLog,
  InventoryAllocatePayload,
  InventoryAsset,
  InventoryAssetCreatePayload,
  InventoryAssetPage,
  InventoryBulkScanConfirm,
  InventoryBulkScanPayload,
  InventoryBulkScanPreview,
  InventoryCatalogCreatePayload,
  InventoryCatalogItem,
  InventoryCatalogs,
  InventoryCatalogUpdatePayload,
  InventoryContract,
  InventoryContractCreatePayload,
  InventoryContractUpdatePayload,
  InventoryChangeResponsiblePayload,
  InventoryDeliveryTerm,
  InventoryDeliveryTermCreatePayload,
  InventoryDeliveryTermDeliverPayload,
  InventoryDeliveryTermPreview,
  InventoryDeliveryTermPreviewPayload,
  InventoryEquipmentModel,
  InventoryEquipmentModelCreatePayload,
  InventoryEquipmentModelUpdatePayload,
  InventoryMovement,
  InventoryMovementPayload,
  InventoryRetirePayload,
  InventoryReturnTerm,
  InventoryReturnTermConfirmPayload,
  InventoryReturnTermCreatePayload,
  InventoryReturnTermPreview,
  InventoryReturnTermPreviewPayload,
  InventorySectorCreatePayload,
  InventorySectorUpdatePayload,
} from "../types";
import { buildQuery, downloadRequest, request } from "./client";

export const inventoryApi = {
  assetTicketOptions: () => request<AssetTicketOption[]>("/inventory/assets/ticket-options"),
  inventoryCatalogs: () => request<InventoryCatalogs>("/inventory/catalogs"),
  createInventorySecretariat: (payload: InventoryCatalogCreatePayload) =>
    request<InventoryCatalogItem>("/inventory/catalogs/secretariats", { method: "POST", body: JSON.stringify(payload) }),
  updateInventorySecretariat: (id: number, payload: InventoryCatalogUpdatePayload) =>
    request<InventoryCatalogItem>(`/inventory/catalogs/secretariats/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventorySecretariat: (id: number) =>
    request<{ message: string }>(`/inventory/catalogs/secretariats/${id}`, { method: "DELETE" }),
  createInventorySupplier: (payload: InventoryCatalogCreatePayload) =>
    request<InventoryCatalogItem>("/inventory/catalogs/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  updateInventorySupplier: (id: number, payload: InventoryCatalogUpdatePayload) =>
    request<InventoryCatalogItem>(`/inventory/catalogs/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventorySupplier: (id: number) =>
    request<{ message: string }>(`/inventory/catalogs/suppliers/${id}`, { method: "DELETE" }),
  createInventoryContract: (payload: InventoryContractCreatePayload) =>
    request<InventoryContract>("/inventory/catalogs/contracts", { method: "POST", body: JSON.stringify(payload) }),
  updateInventoryContract: (id: number, payload: InventoryContractUpdatePayload) =>
    request<InventoryContract>(`/inventory/catalogs/contracts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventoryContract: (id: number) =>
    request<{ message: string }>(`/inventory/catalogs/contracts/${id}`, { method: "DELETE" }),
  createInventoryEquipmentType: (payload: InventoryCatalogCreatePayload) =>
    request<InventoryCatalogItem>("/inventory/catalogs/equipment-types", { method: "POST", body: JSON.stringify(payload) }),
  updateInventoryEquipmentType: (id: number, payload: InventoryCatalogUpdatePayload) =>
    request<InventoryCatalogItem>(`/inventory/catalogs/equipment-types/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventoryEquipmentType: (id: number) =>
    request<{ message: string }>(`/inventory/catalogs/equipment-types/${id}`, { method: "DELETE" }),
  createInventoryManufacturer: (payload: InventoryCatalogCreatePayload) =>
    request<InventoryCatalogItem>("/inventory/catalogs/manufacturers", { method: "POST", body: JSON.stringify(payload) }),
  updateInventoryManufacturer: (id: number, payload: InventoryCatalogUpdatePayload) =>
    request<InventoryCatalogItem>(`/inventory/catalogs/manufacturers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventoryManufacturer: (id: number) =>
    request<{ message: string }>(`/inventory/catalogs/manufacturers/${id}`, { method: "DELETE" }),
  createInventoryModel: (payload: InventoryEquipmentModelCreatePayload) =>
    request<InventoryEquipmentModel>("/inventory/catalogs/models", { method: "POST", body: JSON.stringify(payload) }),
  updateInventoryModel: (id: number, payload: InventoryEquipmentModelUpdatePayload) =>
    request<InventoryEquipmentModel>(`/inventory/catalogs/models/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventoryModel: (id: number) =>
    request<{ message: string }>(`/inventory/catalogs/models/${id}`, { method: "DELETE" }),
  createInventorySector: (payload: InventorySectorCreatePayload) =>
    request<InventoryCatalogItem>("/inventory/catalogs/sectors", { method: "POST", body: JSON.stringify(payload) }),
  updateInventorySector: (id: number, payload: InventorySectorUpdatePayload) =>
    request<InventoryCatalogItem>(`/inventory/catalogs/sectors/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventorySector: (id: number) =>
    request<{ message: string }>(`/inventory/catalogs/sectors/${id}`, { method: "DELETE" }),
  inventoryAssets: (params: Record<string, string | number | undefined> = {}) =>
    request<InventoryAssetPage>(`/inventory/assets${buildQuery(params)}`),
  exportInventorySpreadsheet: (params: Record<string, string | number | undefined> = {}) =>
    downloadRequest(`/inventory/assets/export${buildQuery(params)}`, "inventario_adcetei.xlsx"),
  inventoryAsset: (id: number | string) => request<InventoryAsset>(`/inventory/assets/${id}`),
  inventoryAssetMovements: (id: number | string) => request<InventoryMovement[]>(`/inventory/assets/${id}/movements`),
  createInventoryAsset: (payload: InventoryAssetCreatePayload) =>
    request<InventoryAsset>("/inventory/assets", { method: "POST", body: JSON.stringify(payload) }),
  deleteInventoryAsset: (id: number | string) =>
    request<{ message: string }>(`/inventory/assets/${id}`, { method: "DELETE" }),
  previewInventoryBulkScan: (payload: InventoryBulkScanPayload) =>
    request<InventoryBulkScanPreview>("/inventory/assets/bulk-scan/preview", { method: "POST", body: JSON.stringify(payload) }),
  confirmInventoryBulkScan: (payload: InventoryBulkScanPayload) =>
    request<InventoryBulkScanConfirm>("/inventory/assets/bulk-scan/confirm", { method: "POST", body: JSON.stringify(payload) }),
  allocateInventoryAsset: (id: number | string, payload: InventoryAllocatePayload) =>
    request<InventoryAsset>(`/inventory/assets/${id}/allocate`, { method: "POST", body: JSON.stringify(payload) }),
  changeInventoryAssetResponsible: (id: number | string, payload: InventoryChangeResponsiblePayload) =>
    request<InventoryAsset>(`/inventory/assets/${id}/change-responsible`, { method: "POST", body: JSON.stringify(payload) }),
  returnInventoryAssetToStock: (id: number | string, payload: InventoryMovementPayload) =>
    request<InventoryAsset>(`/inventory/assets/${id}/return-to-stock`, { method: "POST", body: JSON.stringify(payload) }),
  sendInventoryAssetToMaintenance: (id: number | string, payload: InventoryMovementPayload) =>
    request<InventoryAsset>(`/inventory/assets/${id}/maintenance`, { method: "POST", body: JSON.stringify(payload) }),
  retireInventoryAsset: (id: number | string, payload: InventoryRetirePayload) =>
    request<InventoryAsset>(`/inventory/assets/${id}/retire`, { method: "POST", body: JSON.stringify(payload) }),
  inventoryDeliveryTerms: () => request<InventoryDeliveryTerm[]>("/inventory/delivery-terms"),
  nextInventoryDeliveryTermNumber: () => request<{ term_number: string }>("/inventory/delivery-terms/next-number"),
  previewInventoryDeliveryTerm: (payload: InventoryDeliveryTermPreviewPayload) =>
    request<InventoryDeliveryTermPreview>("/inventory/delivery-terms/preview", { method: "POST", body: JSON.stringify(payload) }),
  createInventoryDeliveryTerm: (payload: InventoryDeliveryTermCreatePayload) =>
    request<InventoryDeliveryTerm>("/inventory/delivery-terms", { method: "POST", body: JSON.stringify(payload) }),
  downloadInventoryDeliveryTerm: (id: number | string, filename?: string) =>
    downloadRequest(`/inventory/delivery-terms/${id}/document`, filename || `termo-recebimento-${id}.docx`),
  confirmInventoryDeliveryTerm: (id: number | string, payload: InventoryDeliveryTermDeliverPayload) =>
    request<InventoryDeliveryTerm>(`/inventory/delivery-terms/${id}/deliver`, { method: "POST", body: JSON.stringify(payload) }),
  cancelInventoryDeliveryTerm: (id: number | string) =>
    request<{ message: string }>(`/inventory/delivery-terms/${id}/cancel`, { method: "POST" }),
  inventoryReturnTerms: () => request<InventoryReturnTerm[]>("/inventory/return-terms"),
  nextInventoryReturnTermNumber: () => request<{ term_number: string }>("/inventory/return-terms/next-number"),
  previewInventoryReturnTerm: (payload: InventoryReturnTermPreviewPayload) =>
    request<InventoryReturnTermPreview>("/inventory/return-terms/preview", { method: "POST", body: JSON.stringify(payload) }),
  createInventoryReturnTerm: (payload: InventoryReturnTermCreatePayload) =>
    request<InventoryReturnTerm>("/inventory/return-terms", { method: "POST", body: JSON.stringify(payload) }),
  downloadInventoryReturnTerm: (id: number | string, filename?: string) =>
    downloadRequest(`/inventory/return-terms/${id}/document`, filename || `termo-devolucao-${id}.docx`),
  confirmInventoryReturnTerm: (id: number | string, payload: InventoryReturnTermConfirmPayload) =>
    request<InventoryReturnTerm>(`/inventory/return-terms/${id}/confirm`, { method: "POST", body: JSON.stringify(payload) }),
  cancelInventoryReturnTerm: (id: number | string) =>
    request<{ message: string }>(`/inventory/return-terms/${id}/cancel`, { method: "POST" }),
};
