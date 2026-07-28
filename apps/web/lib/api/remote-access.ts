import type { RemoteAccessDevicePage, RemoteAccessHealth, RemoteAccessLaunch, RemoteAccessSession, RemoteAccessSessionPayload } from "../types/remote-access";
import { buildQuery, request } from "./client";

export const remoteAccessApi = {
  remoteAccessHealth: () => request<RemoteAccessHealth>("/remote-access/health"),
  remoteDevices: (params: { page?: number; page_size?: number; search?: string; status?: string } = {}) =>
    request<RemoteAccessDevicePage>(`/remote-access/devices${buildQuery(params)}`),
  createRemoteSession: (payload: RemoteAccessSessionPayload) =>
    request<RemoteAccessSession>("/remote-access/sessions", { method: "POST", body: JSON.stringify(payload) }),
  connectRemoteSession: (payload: RemoteAccessSessionPayload) =>
    request<RemoteAccessLaunch>("/remote-access/sessions/connect", { method: "POST", body: JSON.stringify(payload) }),
  remoteSession: (id: string) => request<RemoteAccessSession>(`/remote-access/sessions/${id}`),
  launchRemoteSession: (id: string) =>
    request<RemoteAccessLaunch>(`/remote-access/sessions/${id}/launch`, { method: "POST" }),
  closeRemoteSession: (id: string) =>
    request<RemoteAccessSession>(`/remote-access/sessions/${id}/close`, { method: "POST" }),
};
