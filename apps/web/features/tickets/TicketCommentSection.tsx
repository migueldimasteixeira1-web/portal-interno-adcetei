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
      <form onSubmit={onSubmit} className="border-t border-[#e8edf2] bg-[#f7f9fb] p-4">
        {canAddInternalNote && (
          <div className="mb-3 inline-flex rounded-md border border-[#d4dbe4] bg-white p-0.5">
            <button
              type="button"
              onClick={() => onInternalChange(false)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-semibold transition",
                !internal ? "bg-[#f3f7fb] text-[#1a5f9e]" : "text-[#8b97a8] hover:text-[#1a2332]",
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
                internal ? "bg-[#fffbeb] text-[#92400e]" : "text-[#8b97a8] hover:text-[#1a2332]",
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
          className={internal ? "border-[#fcd9a8] bg-[#fffbeb] focus:border-[#b45309] focus:ring-[#fffbeb]" : "bg-white"}
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#8b97a8]">
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
