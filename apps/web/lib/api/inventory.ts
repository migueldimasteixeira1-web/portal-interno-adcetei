import type {
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
  InventoryChangeResponsiblePayload,
  InventoryEquipmentModel,
  InventoryEquipmentModelCreatePayload,
  InventoryEquipmentModelUpdatePayload,
  InventoryMovement,
  InventoryMovementPayload,
} from "../types";
import { downloadRequest, request } from "./client";

export const inventoryApi = {
  inventoryCatalogs: () => request<InventoryCatalogs>("/inventory/catalogs"),
  createInventorySupplier: (payload: InventoryCatalogCreatePayload) =>
    request<InventoryCatalogItem>("/inventory/catalogs/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  updateInventorySupplier: (id: number, payload: InventoryCatalogUpdatePayload) =>
    request<InventoryCatalogItem>(`/inventory/catalogs/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventorySupplier: (id: number) =>
    request<{ message: string }>(`/inventory/catalogs/suppliers/${id}`, { method: "DELETE" }),
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
  createInventorySector: (payload: InventoryCatalogCreatePayload) =>
    request<InventoryCatalogItem>("/inventory/catalogs/sectors", { method: "POST", body: JSON.stringify(payload) }),
  updateInventorySector: (id: number, payload: InventoryCatalogUpdatePayload) =>
    request<InventoryCatalogItem>(`/inventory/catalogs/sectors/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInventorySector: (id: number) =>
    request<{ message: string }>(`/inventory/catalogs/sectors/${id}`, { method: "DELETE" }),
  inventoryAssets: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value !== undefined && value !== "" && query.set(key, String(value)));
    return request<InventoryAssetPage>(`/inventory/assets?${query.toString()}`);
  },
  exportInventorySpreadsheet: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value !== undefined && value !== "" && query.set(key, String(value)));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return downloadRequest(`/inventory/assets/export${suffix}`, "inventario_adcetei.xlsx");
  },
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
};
