"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import { api } from "@/lib/api";
import type { ChatContact } from "@/lib/types";

export default function NewConversationDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (contact: ChatContact) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(() => {
      void api
        .chatContacts(query.trim() || undefined)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--navy-950)]/50" />
        <Dialog.Content className="fixed left-1/2 top-[15%] z-50 w-[92vw] max-w-md -translate-x-1/2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)] outline-none">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
            <Dialog.Title className="text-sm font-semibold text-[var(--foreground)]">Nova conversa</Dialog.Title>
            <Dialog.Close aria-label="Fechar" className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--border-subtle)]">
              <X size={16} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Busque um servidor pelo nome, setor ou secretaria para iniciar uma conversa.
          </Dialog.Description>
          <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 py-2.5">
            <Search size={16} className="shrink-0 text-[var(--muted-light)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, setor ou secretaria..."
              className="h-6 w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)]"
            />
          </div>
          <div className="soft-scrollbar max-h-[50vh] overflow-y-auto p-2">
            {!loading && !results.length && (
              <p className="px-3 py-6 text-center text-sm text-[var(--muted-light)]">Nenhum servidor encontrado.</p>
            )}
            {results.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => onSelect(contact)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--border-subtle)]"
              >
                <UserAvatar name={contact.full_name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{contact.full_name}</p>
                  <p className="truncate text-xs text-[var(--muted-light)]">{contact.department} · {contact.secretariat}</p>
                </div>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
