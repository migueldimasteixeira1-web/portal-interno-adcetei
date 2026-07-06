import type { Role, User } from "./auth";

export interface RoleConfig {
  role: Role;
  label: string;
  description: string;
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
