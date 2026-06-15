import type { Asset, AssetTicketOption, AuditLog, CatalogService, DashboardData, PermissionDefinition, RoleConfig, Ticket, TicketPage, User } from "./types";

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
  assets: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<Asset[]>(`/assets?${query.toString()}`);
  },
  createAsset: (payload: Record<string, unknown>) =>
    request<Asset>("/admin/assets", { method: "POST", body: JSON.stringify(payload) }),
  updateAsset: (id: number, payload: Record<string, unknown>) =>
    request<Asset>(`/admin/assets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  assetTicketOptions: () => request<AssetTicketOption[]>("/assets/ticket-options"),
  catalog: (includeInactive = false) => request<CatalogService[]>(`/catalog?include_inactive=${includeInactive}`),
  createCatalogService: (payload: Record<string, unknown>) =>
    request<CatalogService>("/admin/catalog", { method: "POST", body: JSON.stringify(payload) }),
  updateCatalogService: (id: number, payload: Record<string, unknown>) =>
    request<CatalogService>(`/admin/catalog/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  roles: () => request<RoleConfig[]>("/admin/roles"),
  permissions: () => request<PermissionDefinition[]>("/admin/permissions"),
  updateRole: (role: string, payload: Record<string, unknown>) =>
    request<RoleConfig>(`/admin/roles/${role}`, { method: "PATCH", body: JSON.stringify(payload) }),
  audit: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<AuditLog[]>(`/admin/audit?${query.toString()}`);
  },
  syncAdDemo: () => request<{ message: string; processed: number }>("/integrations/ad/sync-demo", { method: "POST" }),
};
