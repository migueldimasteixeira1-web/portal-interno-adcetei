"use client";

import { Bell, Check, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button, cn } from "./ui";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { playStandardNotification, playVoiceNotification } from "@/lib/notificationSound";
import type { Notification, NotificationPreferences } from "@/lib/types";

const POLL_INTERVAL_MS = 15000;

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const preferencesRef = useRef<NotificationPreferences | null>(null);
  const seenIdRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    if (!user) return;
    void api.notificationPreferences().then(setPreferences).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const seenKey = `notif_seen_id_${user.id}`;
    const stored = Number(window.localStorage.getItem(seenKey) || 0);
    seenIdRef.current = stored || null;
    let cancelled = false;

    const poll = () => {
      void api
        .notifications()
        .then((list) => {
          if (cancelled) return;
          setItems(list);
          const maxId = list.reduce((max, item) => Math.max(max, item.id), 0);

          if (seenIdRef.current === null) {
            seenIdRef.current = maxId;
            window.localStorage.setItem(seenKey, String(maxId));
            return;
          }

          const newItems = list.filter((item) => item.id > seenIdRef.current!);
          const prefs = preferencesRef.current;
          if (newItems.length && prefs && !prefs.master_muted) {
            const onTicketPage = (ticketId?: number | null) =>
              ticketId != null && window.location.pathname === `/chamados/${ticketId}`;
            const relevant = newItems.filter((item) => !onTicketPage(item.ticket_id));
            if (relevant.some((item) => item.sound_kind === "voice") && !prefs.voice_muted) {
              playVoiceNotification();
            }
            if (relevant.some((item) => item.sound_kind === "standard") && !prefs.standard_sound_muted) {
              playStandardNotification();
            }
          }

          if (maxId > seenIdRef.current) {
            seenIdRef.current = maxId;
            window.localStorage.setItem(seenKey, String(maxId));
          }
        })
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!open) setShowPreferences(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unreadCount = items.filter((item) => !item.read_at).length;

  const updatePreferences = (patch: Partial<NotificationPreferences>) => {
    if (!preferences) return;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    void api.updateNotificationPreferences(patch).catch(() => setPreferences(preferences));
  };

  const openNotification = (notification: Notification) => {
    setOpen(false);
    if (!notification.read_at) {
      setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item)));
      void api.markNotificationRead(notification.id).catch(() => {});
    }
    if (notification.ticket_id) router.push(`/chamados/${notification.ticket_id}`);
  };

  const markAllRead = () => {
    setItems((current) => current.map((item) => (item.read_at ? item : { ...item, read_at: new Date().toISOString() })));
    void api.markAllNotificationsRead().catch(() => {});
  };

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--foreground)]"
        aria-label="Notificações"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-[22rem] max-w-[90vw] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2.5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Notificações</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPreferences((current) => !current)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--foreground)]"
                aria-label="Preferências de notificação"
              >
                <Settings2 size={15} />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--foreground)]"
                  aria-label="Marcar todas como lidas"
                >
                  <Check size={15} />
                </button>
              )}
            </div>
          </div>

          {showPreferences && preferences && (
            <div className="space-y-2 border-b border-[var(--border-subtle)] px-3 py-3 text-sm">
              <PreferenceToggle
                label="Silenciar tudo"
                checked={preferences.master_muted}
                onChange={(value) => updatePreferences({ master_muted: value })}
              />
              <PreferenceToggle
                label="Voz de novo chamado"
                checked={!preferences.voice_muted}
                onChange={(value) => updatePreferences({ voice_muted: !value })}
                disabled={preferences.master_muted}
              />
              <PreferenceToggle
                label="Som padrão"
                checked={!preferences.standard_sound_muted}
                onChange={(value) => updatePreferences({ standard_sound_muted: !value })}
                disabled={preferences.master_muted}
              />
            </div>
          )}

          <div className="soft-scrollbar max-h-[60vh] overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-[var(--muted-light)]">Nenhuma notificação por aqui.</p>
            )}
            {items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-[var(--border-subtle)] px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--border-subtle)]",
                  !notification.read_at && "bg-[var(--status-blue-bg)]",
                )}
              >
                <p className="text-sm text-[var(--foreground)]">{notification.message}</p>
                <p className="text-xs text-[var(--muted-light)]">{relativeTime(notification.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PreferenceToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-3", disabled && "opacity-50")}>
      <span className="text-[var(--foreground)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
    </label>
  );
}
