import type { DashboardData, Ticket, TicketPage } from "../types";
import { request } from "./client";

export const ticketsApi = {
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
};
