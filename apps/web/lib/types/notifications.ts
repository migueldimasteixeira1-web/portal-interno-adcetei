export type NotificationEventType = "ticket_created" | "ticket_assigned" | "ticket_status_changed" | "ticket_comment";

export type NotificationSoundKind = "voice" | "standard";

export interface Notification {
  id: number;
  event_type: NotificationEventType;
  sound_kind: NotificationSoundKind;
  message: string;
  ticket_id?: number | null;
  created_at: string;
  read_at?: string | null;
}

export interface NotificationPreferences {
  master_muted: boolean;
  voice_muted: boolean;
  standard_sound_muted: boolean;
}

export interface NotificationPreferencesUpdate {
  master_muted?: boolean;
  voice_muted?: boolean;
  standard_sound_muted?: boolean;
}
