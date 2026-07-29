import type { User } from "./auth";
import type { AssetTicketOption } from "./auth";
import type { CatalogFormField } from "./catalog";

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
    assigned: number;
    in_progress: number;
    waiting_requester: number;
    resolved: number;
    closed: number;
    cancelled: number;
  };
}

export interface DashboardData {
  total: number;
  new: number;
  assigned: number;
  in_progress: number;
  waiting_requester: number;
  resolved: number;
  closed: number;
  cancelled: number;
  overdue: number;
  my_open: number;
  by_category: Array<{ name: string; value: number }>;
  by_status: Array<{ name: string; value: number }>;
  recent: Ticket[];
  team_load: Array<{ id: number; name: string; role: string; open: number }>;
}

