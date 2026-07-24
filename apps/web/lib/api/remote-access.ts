import type { RemoteAccessDevicePage, RemoteAccessHealth, RemoteAccessLaunch, RemoteAccessSession, RemoteAccessSessionPayload } from "../types/remote-access";
import { request } from "./client";

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const remoteAccessApi = {
  remoteAccessHealth: () => request<RemoteAccessHealth>("/remote-access/health"),
  remoteDevices: (params: { page?: number; page_size?: number; search?: string; status?: string } = {}) =>
    request<RemoteAccessDevicePage>(`/remote-access/devices${query(params)}`),
  createRemoteSession: (payload: RemoteAccessSessionPayload) =>
    request<RemoteAccessSession>("/remote-access/sessions", { method: "POST", body: JSON.stringify(payload) }),
  remoteSession: (id: string) => request<RemoteAccessSession>(`/remote-access/sessions/${id}`),
  launchRemoteSession: (id: string) =>
    request<RemoteAccessLaunch>(`/remote-access/sessions/${id}/launch`, { method: "POST" }),
  closeRemoteSession: (id: string) =>
    request<RemoteAccessSession>(`/remote-access/sessions/${id}/close`, { method: "POST" }),
};
