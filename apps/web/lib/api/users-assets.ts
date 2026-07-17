import type { Asset, CatalogOptions, CatalogService, User } from "../types";
import { request } from "./client";

export const usersAssetsApi = {
  users: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<User[]>(`/users?${query.toString()}`);
  },
  assets: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return request<Asset[]>(`/assets?${query.toString()}`);
  },
  catalog: (includeInactive = false) => request<CatalogService[]>(`/catalog?include_inactive=${includeInactive}`),
  catalogOptions: () => request<CatalogOptions>("/admin/catalog/options"),
};
