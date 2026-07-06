import type { Asset, AssetTicketOption, AuditLog, CatalogOptions, CatalogService, DashboardData, InventoryAllocatePayload, InventoryAsset, InventoryAssetCreatePayload, InventoryAssetPage, InventoryBulkScanConfirm, InventoryBulkScanPayload, InventoryBulkScanPreview, InventoryCatalogCreatePayload, InventoryCatalogItem, InventoryCatalogs, InventoryCatalogUpdatePayload, InventoryChangeResponsiblePayload, InventoryEquipmentModel, InventoryEquipmentModelCreatePayload, InventoryEquipmentModelUpdatePayload, InventoryMovement, InventoryMovementPayload, PermissionDefinition, RoleConfig, Ticket, TicketPage, User } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
export const SESSION_EXPIRED_EVENT = "pti:session-expired";
export const SESSION_MESSAGE_KEY = "pti_session_message";
let sessionExpiryInProgress = false;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pti_token");
}

function clearStoredSession() {
  localStorage.removeItem("pti_token");
  localStorage.removeItem("pti_user");
}

export function resetSessionExpiryGuard() {
  sessionExpiryInProgress = false;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, cache: "no-store" });
  if (!response.ok) {
    let message = "Não foi possível concluir a operação.";
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {}
    if (response.status === 401 && typeof window !== "undefined" && token) {
      clearStoredSession();
      if (!sessionExpiryInProgress) {
        sessionExpiryInProgress = true;
        sessionStorage.setItem(SESSION_MESSAGE_KEY, "Sua sessão expirou. Entre novamente.");
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (payload: { full_name: string; email: string; password: string }) =>
    request<{ message: string }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  resendVerification: (email: string) =>
    request<{ message: string }>("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
  me: () => request<User>("/auth/me"),
  dashboard: () => request<DashboardData>("/dashboard"),
  tickets: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value !== undefined && value !== "" && query.set(key, String(value)));
    return request<TicketPage>(`/tickets?${query.toString()}`);
  },
  ticket: (id: number | string) => request<Ticket>(`/tickets/${id}`),
  createTicket: (payload: Record<string, unknown>) =>
    request<Ticket>("/tickets", { method: "POST", body: JSON.stringify(payload) }),
  updateTicket: (id: number, payload: Record<string, unknown>) =>
    request<Ticket>(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  addComment: (id: number, body: string, internal: boolean) =>
    request(`/tickets/${id}/comments`, { method: "POST", body: JSON.stringify({ body, internal }) }),
  users: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<User[]>(`/users?${query.toString()}`);
  },
  createUser: (payload: Record<string, unknown>) =>
    request<User>("/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id: number, payload: Record<string, unknown>) =>
    request<User>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteUser: (id: number) =>
    request<{ message: string }>(`/admin/users/${id}`, { method: "DELETE" }),
  resendUserVerification: (id: number) =>
    request<User>(`/admin/users/${id}/resend-verification`, { method: "POST" }),
  assets: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<Asset[]>(`/assets?${query.toString()}`);
  },
  createAsset: (payload: Record<string, unknown>) =>
    request<Asset>("/admin/assets", { method: "POST", body: JSON.stringify(payload) }),
  updateAsset: (id: number, payload: Record<string, unknown>) =>
    request<Asset>(`/admin/assets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAsset: (id: number) =>
    request<{ message: string }>(`/admin/assets/${id}`, { method: "DELETE" }),
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
  assetTicketOptions: () => request<AssetTicketOption[]>("/assets/ticket-options"),
  catalog: (includeInactive = false) => request<CatalogService[]>(`/catalog?include_inactive=${includeInactive}`),
  catalogOptions: () => request<CatalogOptions>("/admin/catalog/options"),
  createCatalogService: (payload: Record<string, unknown>) =>
    request<CatalogService>("/admin/catalog", { method: "POST", body: JSON.stringify(payload) }),
  updateCatalogService: (id: number, payload: Record<string, unknown>) =>
    request<CatalogService>(`/admin/catalog/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCatalogService: (id: number) =>
    request<{ message: string }>(`/admin/catalog/${id}`, { method: "DELETE" }),
  roles: () => request<RoleConfig[]>("/admin/roles"),
  permissions: () => request<PermissionDefinition[]>("/admin/permissions"),
  updateRole: (role: string, payload: Record<string, unknown>) =>
    request<RoleConfig>(`/admin/roles/${role}`, { method: "PATCH", body: JSON.stringify(payload) }),
  audit: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<AuditLog[]>(`/admin/audit?${query.toString()}`);
  },
};
