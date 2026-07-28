import type { ChatContact, ChatConversation, ChatMessage } from "../types";
import { buildQuery, request } from "./client";

export const chatApi = {
  chatContacts: (search?: string) => request<ChatContact[]>(`/chat/contacts${buildQuery({ search })}`),
  chatConversations: () => request<ChatConversation[]>("/chat/conversations"),
  chatUnreadCount: () => request<{ unread_count: number }>("/chat/unread-count"),
  chatMessages: (contactId: number, afterId?: number) =>
    request<ChatMessage[]>(`/chat/messages/${contactId}${buildQuery({ after_id: afterId })}`),
  sendChatMessage: (recipientId: number, body: string) =>
    request<ChatMessage>("/chat/messages", { method: "POST", body: JSON.stringify({ recipient_id: recipientId, body }) }),
  markChatRead: (contactId: number) =>
    request<{ message: string }>(`/chat/messages/${contactId}/read`, { method: "POST" }),
};
