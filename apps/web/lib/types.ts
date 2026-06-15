export type Role = "admin" | "helpdesk" | "technician" | "requester";

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

export interface CatalogFormField {
  key: string;
  label: string;
  type: "text" | "email" | "textarea" | "select" | "date";
  required: boolean;
  placeholder: string;
  options: string[];
  max_length: number;
}

export interface CatalogService {
  id: number;
  name: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  active: boolean;
  form_schema: { fields?: CatalogFormField[] };
}

export interface TicketComment {
  id: number;
  body: string;
  internal: boolean;
  event_type: string;
  created_at: string;
  author: User;
}

export interface Ticket {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  urgency?: string;
  impact?: string;
  category: string;
  team: string;
  origin?: string;
  location?: string;
  form_data?: Record<string, string>;
  form_schema_snapshot?: { fields?: CatalogFormField[] };
  requester: User;
  assignee?: User | null;
  asset?: AssetTicketOption | null;
  created_at: string;
  updated_at: string;
  due_at?: string | null;
  closed_at?: string | null;
  comments?: TicketComment[];
}

export interface TicketPage {
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
  summary: {
    new: number;
    unassigned: number;
    urgent: number;
    waiting_user: number;
  };
}

export interface DashboardData {
  total: number;
  new: number;
  assigned: number;
  pending: number;
  overdue: number;
  solved_today: number;
  my_open: number;
  by_category: Array<{ name: string; value: number }>;
  by_status: Array<{ name: string; value: number }>;
  recent: Ticket[];
  team_load: Array<{ id: number; name: string; role: string; open: number }>;
}

export interface RoleConfig {
  role: Role;
  label: string;
  description: string;
  ldap_group: string;
  permissions: string[];
  updated_at: string;
}

export interface PermissionDefinition {
  key: string;
  label: string;
  group: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  changes: Record<string, unknown>;
  created_at: string;
  actor?: User | null;
}
