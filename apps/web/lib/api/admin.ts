import type { Asset, AuditLog, CatalogService, RoleConfig, User } from "../types";
import { request } from "./client";

export const adminApi = {
  createUser: (payload: Record<string, unknown>) =>
    request<User>("/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id: number, payload: Record<string, unknown>) =>
    request<User>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteUser: (id: number) =>
    request<{ message: string }>(`/admin/users/${id}`, { method: "DELETE" }),
  resendUserVerification: (id: number) =>
    request<User>(`/admin/users/${id}/resend-verification`, { method: "POST" }),
  createAsset: (payload: Record<string, unknown>) =>
    request<Asset>("/admin/assets", { method: "POST", body: JSON.stringify(payload) }),
  updateAsset: (id: number, payload: Record<string, unknown>) =>
    request<Asset>(`/admin/assets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAsset: (id: number) =>
    request<{ message: string }>(`/admin/assets/${id}`, { method: "DELETE" }),
  createCatalogService: (payload: Record<string, unknown>) =>
    request<CatalogService>("/admin/catalog", { method: "POST", body: JSON.stringify(payload) }),
  updateCatalogService: (id: number, payload: Record<string, unknown>) =>
    request<CatalogService>(`/admin/catalog/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCatalogService: (id: number) =>
    request<{ message: string }>(`/admin/catalog/${id}`, { method: "DELETE" }),
  roles: () => request<RoleConfig[]>("/admin/roles"),
  permissions: () => request<{ key: string; label: string; group: string }[]>("/admin/permissions"),
  updateRole: (role: string, payload: Record<string, unknown>) =>
    request<RoleConfig>(`/admin/roles/${role}`, { method: "PATCH", body: JSON.stringify(payload) }),
  audit: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<AuditLog[]>(`/admin/audit?${query.toString()}`);
  },
};
