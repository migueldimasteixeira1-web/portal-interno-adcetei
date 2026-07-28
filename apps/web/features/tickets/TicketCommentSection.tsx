import { FormEvent } from "react";
import { LockKeyhole, MessageSquareText, Send } from "lucide-react";
import TicketTimeline from "@/components/TicketTimeline";
import { Button, Card, SectionHeader, Textarea, cn } from "@/components/ui";
import type { Ticket, User } from "@/lib/types";

type Props = {
  ticket: Ticket;
  user: User;
  comment: string;
  internal: boolean;
  saving: boolean;
  canAddInternalNote: boolean;
  isUserProfile: boolean;
  onCommentChange: (value: string) => void;
  onInternalChange: (value: boolean) => void;
  onSubmit: (event: FormEvent) => void;
};

export default function TicketCommentSection({
  ticket,
  user,
  comment,
  internal,
  saving,
  canAddInternalNote,
  isUserProfile,
  onCommentChange,
  onInternalChange,
  onSubmit,
}: Props) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader title="Histórico do atendimento" description="Mensagens, notas internas e alterações administrativas." />
      <TicketTimeline comments={ticket.comments || []} currentUser={user} />
      <form onSubmit={onSubmit} className="border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
        {canAddInternalNote && (
          <div className="mb-3 inline-flex rounded-md border border-[var(--border)] bg-[var(--card)] p-0.5">
            <button
              type="button"
              onClick={() => onInternalChange(false)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-semibold transition",
                !internal ? "bg-[var(--status-blue-bg)] text-[var(--primary)]" : "text-[var(--muted-light)] hover:text-[var(--foreground)]",
              )}
            >
              <MessageSquareText className="mr-1 inline" size={13} />
              Resposta pública
            </button>
            <button
              type="button"
              onClick={() => onInternalChange(true)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-semibold transition",
                internal ? "bg-[var(--status-amber-bg)] text-[var(--status-amber-text)]" : "text-[var(--muted-light)] hover:text-[var(--foreground)]",
              )}
            >
              <LockKeyhole className="mr-1 inline" size={13} />
              Nota interna
            </button>
          </div>
        )}
        <Textarea
          aria-label={internal ? "Nota interna da equipe de TI" : "Resposta pública do chamado"}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder={
            internal
              ? "Registre uma nota visível apenas para a equipe de TI."
              : "Escreva uma resposta para os participantes do chamado."
          }
          className={internal ? "border-[var(--status-amber-border)] bg-[var(--status-amber-bg)] focus:border-[var(--amber-600)] focus:ring-[var(--status-amber-bg)]" : "bg-[var(--card)]"}
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--muted-light)]">
            {internal
              ? "Esta nota não será exibida ao solicitante."
              : isUserProfile
                ? "Sua mensagem será enviada à equipe de TI."
                : "A resposta será visível ao solicitante."}
          </p>
          <Button disabled={saving || comment.trim().length < 2}>
            <Send size={15} />
            {saving ? "Enviando..." : internal ? "Adicionar nota" : "Enviar resposta"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
