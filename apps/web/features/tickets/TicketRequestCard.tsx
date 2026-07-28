import { CalendarClock, MapPin, UserRound } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { Card, SectionHeader } from "@/components/ui";
import { catalogFieldLabels, relativeTime } from "@/lib/format";
import type { Ticket } from "@/lib/types";

type Props = {
  ticket: Ticket;
  formFieldLabels: Record<string, string>;
};

export default function TicketRequestCard({ ticket, formFieldLabels }: Props) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader title="Solicitação original" description="Descrição enviada na abertura do chamado." />
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <UserAvatar name={ticket.requester.full_name} />
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{ticket.requester.full_name}</p>
            <p className="text-xs text-[var(--muted-light)]">
              {ticket.requester.department} · {ticket.requester.secretariat}
            </p>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">{ticket.description}</p>
        {ticket.form_data && Object.keys(ticket.form_data).length > 0 && (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-light)]">Informações do serviço</h3>
            <dl className="mt-2 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              {Object.entries(ticket.form_data).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-medium text-[var(--muted-light)]">{formFieldLabels[key] || catalogFieldLabels[key] || key}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--foreground)]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--muted-light)]">
          <span className="flex items-center gap-1.5">
            <UserRound size={14} />
            {ticket.requester.department}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={14} />
            {ticket.location || "Localização não informada"}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarClock size={14} />
            Aberto {relativeTime(ticket.created_at)}
          </span>
        </div>
      </div>
    </Card>
  );
}
