"use client";

import { MessageCircle, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import { Button, EmptyState, Input, cn } from "@/components/ui";
import type { ChatConversation } from "@/lib/types";
import { formatConversationTime, truncateMessage } from "./chat-utils";

export default function ChatConversationList({
  conversations,
  selectedContactId,
  onSelect,
  onNewConversation,
}: {
  conversations: ChatConversation[];
  selectedContactId: number | null;
  onSelect: (contactId: number) => void;
  onNewConversation: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => item.contact.full_name.toLowerCase().includes(query));
  }, [conversations, search]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" size={15} />
          <Input className="pl-8" placeholder="Buscar conversa" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onNewConversation} aria-label="Nova conversa">
          <Plus size={16} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto soft-scrollbar">
        {!filtered.length && (
          <EmptyState
            className="px-4 py-10"
            icon={<MessageCircle size={18} />}
            title={conversations.length ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
            description={conversations.length ? undefined : "Clique em + para começar a conversar com alguém."}
          />
        )}
        <ul>
          {filtered.map((item) => {
            const active = item.contact.id === selectedContactId;
            return (
              <li key={item.contact.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.contact.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-3 text-left transition-colors",
                    active ? "bg-[var(--status-blue-bg)]" : "hover:bg-[var(--surface-subtle)]",
                  )}
                >
                  <UserAvatar name={item.contact.full_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.contact.full_name}</p>
                      {item.last_message && (
                        <span className="shrink-0 text-[11px] text-[var(--muted-light)]">
                          {formatConversationTime(item.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-[var(--muted)]">
                        {item.last_message ? truncateMessage(item.last_message.body) : "Nenhuma mensagem ainda"}
                      </p>
                      {item.unread_count > 0 && (
                        <span className="shrink-0 rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {item.unread_count > 99 ? "99+" : item.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
