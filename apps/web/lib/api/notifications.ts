import type { Notification, NotificationPreferences, NotificationPreferencesUpdate } from "../types/notifications";
import { request } from "./client";

export const notificationsApi = {
  notifications: () => request<Notification[]>("/notifications"),
  notificationsUnreadCount: () => request<{ unread_count: number }>("/notifications/unread-count"),
  markNotificationRead: (notificationId: number) =>
    request<{ message: string }>(`/notifications/${notificationId}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<{ message: string }>("/notifications/read-all", { method: "POST" }),
  notificationPreferences: () => request<NotificationPreferences>("/notifications/preferences"),
  updateNotificationPreferences: (payload: NotificationPreferencesUpdate) =>
    request<NotificationPreferences>("/notifications/preferences", { method: "PATCH", body: JSON.stringify(payload) }),
};
