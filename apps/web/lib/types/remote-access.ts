export type RemoteAccessMode = "desktop";
export type RemoteAccessSessionStatus = "authorized" | "open" | "ended" | "failed";

export interface RemoteAccessAssetRef {
  id: number;
  display_name: string;
  serial_number: string;
}

export interface RemoteAccessDevice {
  node_id: string;
  name: string;
  group_id: string;
  group_name: string;
  online: boolean;
  operating_system: string;
  ip_address: string;
  last_seen_at?: string | null;
  agent_version: string;
  asset?: RemoteAccessAssetRef | null;
}

export interface RemoteAccessSummary {
  total: number;
  online: number;
  offline: number;
}

export interface RemoteAccessDevicePage {
  items: RemoteAccessDevice[];
  total: number;
  page: number;
  page_size: number;
  summary: RemoteAccessSummary;
  enabled: boolean;
}

export interface RemoteAccessSessionPayload {
  node_id: string;
  reason: string;
  ticket_id?: number | null;
  asset_id?: number | null;
  access_mode?: RemoteAccessMode;
}

export interface RemoteAccessSession {
  id: string;
  portal_user_id: number;
  mesh_user_id: string;
  mesh_node_id: string;
  mesh_group_id: string;
  asset_id?: number | null;
  ticket_id?: number | null;
  device_name_snapshot: string;
  reason: string;
  access_mode: RemoteAccessMode;
  status: RemoteAccessSessionStatus;
  requested_at: string;
  authorized_at?: string | null;
  opened_at?: string | null;
  ended_at?: string | null;
  source_ip: string;
  failure_reason: string;
  asset?: RemoteAccessAssetRef | null;
}

export interface RemoteAccessLaunch {
  session: RemoteAccessSession;
  embed_url: string;
  expires_in_seconds: number;
}

export interface RemoteAccessHealth {
  enabled: boolean;
  bridge_online: boolean;
  message: string;
}
