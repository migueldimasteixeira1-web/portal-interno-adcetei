"use client";

import { ArrowLeft, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import { Button, EmptyState, cn } from "@/components/ui";
import type { ChatContact, ChatMessage, User } from "@/lib/types";
import { formatMessageTime } from "./chat-utils";

export default function ChatThread({
  contact,
  messages,
  loading,
  currentUser,
  sending,
  onSend,
  onBack,
}: {
  contact: ChatContact;
  messages: ChatMessage[];
  loading: boolean;
  currentUser: User;
  sending: boolean;
  onSend: (body: string) => Promise<void>;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, contact.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await onSend(body);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] p-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--border-subtle)] md:hidden"
            aria-label="Voltar para as conversas"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <UserAvatar name={contact.full_name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{contact.full_name}</p>
          <p className="truncate text-xs text-[var(--muted-light)]">{contact.department} · {contact.secretariat}</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4 soft-scrollbar">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[var(--muted-light)]">
            <LoaderCircle className="animate-spin" size={20} />
          </div>
        ) : !messages.length ? (
          <EmptyState
            className="h-full items-center justify-center"
            icon={<MessageCircle size={18} />}
            title="Nenhuma mensagem ainda"
            description={`Envie a primeira mensagem para ${contact.full_name.split(" ")[0]}.`}
          />
        ) : (
          messages.map((message) => {
            const own = message.sender_id === currentUser.id;
            return (
              <div key={message.id} className={cn("flex", own ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-md px-3.5 py-2.5 text-sm leading-6",
                    own ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className={cn("mt-1 text-right text-[11px]", own ? "text-white/70" : "text-[var(--muted-light)]")}>
                    {formatMessageTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-[var(--border-subtle)] p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit(event);
            }
          }}
          placeholder="Escreva uma mensagem..."
          rows={1}
          className="min-h-9 max-h-32 flex-1 resize-none rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-light)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--blue-100)]"
        />
        <Button type="submit" disabled={sending || !draft.trim()} aria-label="Enviar mensagem">
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
}
