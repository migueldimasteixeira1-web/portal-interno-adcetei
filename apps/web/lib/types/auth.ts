export type Role = "admin" | "technician" | "user";

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: Role;
  secretariat: string;
  department: string;
  phone: string;
  source: string;
  active: boolean;
  email_verified_at?: string | null;
  permissions: string[];
  last_login_at?: string | null;
}

export interface Asset {
  id: number;
  name: string;
  asset_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  patrimony: string;
  status: string;
  location: string;
  ip_address: string;
  operating_system: string;
  assigned_user_id?: number | null;
  last_seen_at?: string | null;
  assigned_user?: User | null;
}

export interface AssetTicketOption {
  id: number;
  name: string;
  asset_type: string;
  patrimony: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  status?: string;
  location?: string;
  ip_address?: string;
  operating_system?: string;
  assigned_user_id?: number | null;
  last_seen_at?: string | null;
  assigned_user?: User | null;
}

