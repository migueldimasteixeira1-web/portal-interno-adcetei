import Link from "next/link";
import { CircleOff, Eye, LoaderCircle, Search, UserRoundX, X } from "lucide-react";
import ListPagination from "@/components/ListPagination";
import { PriorityChip, StatusChip } from "@/components/StatusChip";
import { Badge, Button, Card, EmptyState, Input, SectionHeader, Select, Toolbar, buttonStyles, cn } from "@/components/ui";
import { formatDate, priorityOptions, relativeTime, statusOptions } from "@/lib/format";
import type { Ticket } from "@/lib/types";

type FilterState = {
  search: string;
  status: string;
  priority: string;
};

type Props = {
  tickets: Ticket[];
  total: number;
  page: number;
  totalPages: number;
  updating: boolean;
  hasFilters: boolean;
  isUserProfile: boolean;
  filters: FilterState;
  onFiltersChange: (changes: Partial<FilterState>) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
};

function rowAccent(ticket: Ticket, isUserProfile: boolean) {
  if (ticket.priority === "critical") return "border-l-[#b91c1c]";
  if (ticket.priority === "high") return "border-l-[#b45309]";
  if (!ticket.assignee && !isUserProfile) return "border-l-[#b45309]";
  if (ticket.status === "closed") return "border-l-[#0d7a6a]";
  if (ticket.status === "cancelled") return "border-l-[#991b1b]";
  return "border-l-[#1a5f9e]";
}

export function TicketFiltersToolbar({ isUserProfile, filters, hasFilters, onFiltersChange, onClearFilters }: Pick<Props, "isUserProfile" | "filters" | "hasFilters" | "onFiltersChange" | "onClearFilters">) {
  return (
    <Toolbar className="mb-4">
      <div className={cn("grid w-full gap-2", isUserProfile ? "xl:grid-cols-[minmax(240px,1fr)_180px_auto]" : "xl:grid-cols-[minmax(240px,1fr)_180px_180px_auto]")}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} />
          <Input aria-label="Buscar chamados" className="pl-8" placeholder="Buscar por título, descrição ou categoria" value={filters.search} onChange={(e) => onFiltersChange({ search: e.target.value })} />
        </div>
        <Select aria-label="Filtrar por status" value={filters.status} onChange={(e) => onFiltersChange({ status: e.target.value })}>
          <option value="">Todos os status</option>
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        {!isUserProfile && (
          <Select aria-label="Filtrar por prioridade" value={filters.priority} onChange={(e) => onFiltersChange({ priority: e.target.value })}>
            <option value="">Todas as prioridades</option>
            {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        )}
        {hasFilters && <Button type="button" variant="ghost" onClick={onClearFilters} aria-label="Limpar filtros"><X size={16} /></Button>}
      </div>
    </Toolbar>
  );
}

export default function TicketListContent({
  tickets,
  total,
  page,
  totalPages,
  updating,
  hasFilters,
  isUserProfile,
  onClearFilters,
  onPageChange,
}: Omit<Props, "filters" | "onFiltersChange">) {
  return (
    <Card className="relative overflow-hidden" aria-busy={updating}>
      {updating && (
        <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-[#c5daf0] bg-white px-2.5 py-1 text-xs font-medium text-[#164f84] shadow-sm">
          <LoaderCircle className="animate-spin" size={13} /> Atualizando
        </div>
      )}
      <SectionHeader
        title={`${total} ${total === 1 ? "chamado encontrado" : "chamados encontrados"}`}
        description={hasFilters ? "Resultado dos filtros aplicados." : isUserProfile ? "Suas solicitações mais recentes." : "Chamados ordenados pela data de abertura."}
      />

      <div className="divide-y divide-[#e8edf2] md:hidden">
        {tickets.map((ticket) => (
          <Link key={ticket.id} href={`/chamados/${ticket.id}`} className={cn("block border-l-[3px] p-3.5 transition hover:bg-[#f7f9fb]", rowAccent(ticket, isUserProfile))}>
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold tabular-nums text-[#8b97a8]">#{String(ticket.id).padStart(4, "0")}</p>
                <p className="mt-0.5 font-semibold text-[#1a2332]">{ticket.title}</p>
              </div>
              <StatusChip status={ticket.status} />
            </div>
            <p className="truncate text-xs text-[#5c6b7e]">{isUserProfile ? ticket.category : `${ticket.requester.full_name} · ${ticket.requester.department}`}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {!isUserProfile && <PriorityChip priority={ticket.priority} />}
              {!ticket.assignee && <Badge className="border border-[#fcd9a8] bg-[#fffbeb] text-[#92400e]"><UserRoundX size={12} />Sem responsável</Badge>}
              <span className="text-xs text-[#8b97a8]">Aberto {relativeTime(ticket.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="hidden overflow-x-auto soft-scrollbar md:block">
        <table className="data-table min-w-[1040px]">
          <thead>
            <tr>
              <th>Chamado</th>
              {!isUserProfile && <th>Solicitante</th>}
              <th>Status</th>
              {!isUserProfile && <th>Prioridade</th>}
              <th>Responsável</th>
              <th>Aberto</th>
              <th>Prazo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <Link href={`/chamados/${ticket.id}`} className="font-semibold text-[#1a2332] hover:text-[#1a5f9e]">
                    #{String(ticket.id).padStart(4, "0")} · {ticket.title}
                  </Link>
                  <p className="mt-0.5 max-w-md truncate text-xs text-[#8b97a8]">{ticket.category}</p>
                  {ticket.asset && <p className="mt-0.5 text-xs text-[#8b97a8]">{ticket.asset.name} · {ticket.asset.ip_address || "IP não informado"}</p>}
                </td>
                {!isUserProfile && (
                  <td>
                    <p className="font-medium text-[#1a2332]">{ticket.requester.full_name}</p>
                    <p className="mt-0.5 text-xs text-[#8b97a8]">{ticket.requester.department}</p>
                  </td>
                )}
                <td><StatusChip status={ticket.status} /></td>
                {!isUserProfile && <td><PriorityChip priority={ticket.priority} /></td>}
                <td>
                  {ticket.assignee
                    ? <span className="text-[#5c6b7e]">{ticket.assignee.full_name}</span>
                    : <Badge className="border border-[#fcd9a8] bg-[#fffbeb] text-[#92400e]"><UserRoundX size={12} />Sem responsável</Badge>}
                </td>
                <td className="text-[#5c6b7e]">{relativeTime(ticket.created_at)}</td>
                <td className="text-[#5c6b7e]">{formatDate(ticket.due_at, false)}</td>
                <td>
                  <Link href={`/chamados/${ticket.id}`} className={buttonStyles({ variant: "ghost", size: "sm" })}>
                    <Eye size={15} />Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!tickets.length && (
        <EmptyState
          icon={<CircleOff size={18} />}
          title={hasFilters ? "Nenhum chamado corresponde aos filtros" : isUserProfile ? "Você ainda não possui chamados" : "A fila está vazia"}
          description={hasFilters ? "Revise os termos ou limpe os filtros para ampliar a busca." : isUserProfile ? "Abra uma solicitação quando precisar de suporte da equipe de TI." : "Nenhum chamado está disponível para este perfil no momento."}
          action={hasFilters ? <Button variant="secondary" onClick={onClearFilters}>Limpar filtros</Button> : isUserProfile ? <Link href="/chamados/novo" className={buttonStyles()}>Abrir primeiro chamado</Link> : undefined}
        />
      )}

      <ListPagination page={page} totalPages={totalPages} total={total} updating={updating} hasFilters={hasFilters} onPageChange={onPageChange} />
    </Card>
  );
}
