import { Save } from "lucide-react";
import { PriorityChip, StatusChip } from "@/components/StatusChip";
import { Badge, Button, cn } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Ticket } from "@/lib/types";

type Change = { label: string; from: string; to: string; field: string };

type Props = {
  ticket: Ticket;
  isUserProfile: boolean;
  overdue: boolean;
  canChangeStatus: boolean;
  isFinalStatus: boolean;
  changes: Change[];
  onSaveClick: () => void;
};

export default function TicketDetailHeader({
  ticket,
  isUserProfile,
  overdue,
  canChangeStatus,
  isFinalStatus,
  changes,
  onSaveClick,
}: Props) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tabular-nums text-[var(--muted-light)]">#{String(ticket.id).padStart(4, "0")}</span>
          <StatusChip status={ticket.status} />
          {!isUserProfile && <PriorityChip priority={ticket.priority} />}
          {overdue && <Badge className="border border-[var(--status-red-border)] bg-[var(--status-red-bg)] text-[var(--status-red-text)]">Prazo vencido</Badge>}
        </div>
        <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{ticket.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Aberto por {ticket.requester.full_name} em {formatDate(ticket.created_at)}
        </p>
      </div>
      {canChangeStatus && (
        <Button
          className={cn(changes.length && "border-[var(--amber-600)] bg-[var(--amber-600)] hover:border-[var(--status-amber-text)] hover:bg-[var(--status-amber-text)]")}
          disabled={!changes.length || isFinalStatus}
          onClick={onSaveClick}
        >
          <Save size={16} />
          {changes.length ? `Salvar ${changes.length} alteração(ões)` : "Sem alterações"}
        </Button>
      )}
    </div>
  );
}

export type TicketChange = Change;
