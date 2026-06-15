"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleOff, Filter, LoaderCircle, Plus, Search, Tickets, UserRoundX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { PriorityChip, StatusChip } from "@/components/StatusChip";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Button, Card, EmptyState, FilterChip, Input, SectionHeader, Select, Toolbar, buttonStyles, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, priorityOptions, relativeTime, statusOptions } from "@/lib/format";
import type { Ticket } from "@/lib/types";

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "", priority: "" });
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState({ new: 0, unassigned: 0, urgent: 0, waiting_user: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const hasLoaded = useRef(false);

  const load = async (filters: { search: string; status: string; priority: string }, requestedPage = 1) => {
    const requestId = ++requestSequence.current;
    if (hasLoaded.current) setUpdating(true);
    else setInitialLoading(true);
    try {
      const result = await api.tickets({ ...filters, page: requestedPage, page_size: 20 });
      if (requestId !== requestSequence.current) return;
      setTickets(result.items);
      setTotal(result.total);
      setPage(result.page);
      setSummary(result.summary);
      setAppliedFilters(filters);
      setError("");
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar chamados");
    } finally {
      if (requestId === requestSequence.current) {
        hasLoaded.current = true;
        setInitialLoading(false);
        setUpdating(false);
      }
    }
  };

  useEffect(() => { void load({ search: "", status: "", priority: "" }, 1); }, []);

  const canViewAll = !!user?.permissions.includes("tickets.view_all");
  const requester = user?.role === "requester" && !canViewAll;
  const assignedOnly = user?.role === "technician" && !canViewAll;
  const hasFilters = !!(appliedFilters.search || appliedFilters.status || appliedFilters.priority);
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    void load({ search: "", status: "", priority: "" }, 1);
  };
  const applyQuickStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    void load({ search, status: nextStatus, priority: requester ? "" : priority }, 1);
  };

  const rowAccent = (ticket: Ticket) => {
    if (ticket.priority === "critical") return "border-l-[#b91c1c]";
    if (ticket.priority === "high") return "border-l-[#b45309]";
    if (!ticket.assignee && !requester) return "border-l-[#b45309]";
    if (ticket.status === "resolved" || ticket.status === "closed") return "border-l-[#0d7a6a]";
    return "border-l-[#1a5f9e]";
  };

  return (
    <>
      <PageHeader
        eyebrow={requester ? "Suas solicitações" : assignedOnly ? "Atendimento técnico" : "Atendimento"}
        title={requester ? "Meus chamados" : assignedOnly ? "Chamados atribuídos" : "Central de chamados"}
        subtitle={requester ? "Acompanhe o andamento e as respostas da equipe de TI." : assignedOnly ? "Visualize os atendimentos sob sua responsabilidade." : "Fila compartilhada para triagem, priorização e distribuição dos atendimentos."}
        actions={<Link href="/chamados/novo" className={buttonStyles()}><Plus size={16} /> Abrir chamado</Link>}
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className="panel-flat px-3.5 py-2.5">
          <p className="text-xs font-medium text-[#5c6b7e]">{requester ? "Novos" : "Entrada da fila"}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#1a2332]">{summary.new}</p>
        </div>
        <div className="panel-flat px-3.5 py-2.5">
          <p className="text-xs font-medium text-[#5c6b7e]">{requester ? "Aguardando você" : "Sem responsável"}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#1a2332]">{requester ? summary.waiting_user : summary.unassigned}</p>
        </div>
        <div className="panel-flat px-3.5 py-2.5">
          <p className="text-xs font-medium text-[#5c6b7e]">{requester ? "Em acompanhamento" : "Alta ou crítica"}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#1a2332]">{requester ? Math.max(0, total - summary.new) : summary.urgent}</p>
        </div>
      </div>

      <Toolbar className="mb-4">
        <form onSubmit={(event) => { event.preventDefault(); void load({ search, status, priority: requester ? "" : priority }, 1); }} className={cn("grid w-full gap-2", requester ? "lg:grid-cols-[minmax(240px,1fr)_180px_auto]" : "lg:grid-cols-[minmax(240px,1fr)_180px_180px_auto]")}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} />
            <Input aria-label="Buscar chamados" className="pl-8" placeholder="Buscar por título, descrição ou categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          {!requester && (
            <Select aria-label="Filtrar por prioridade" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Todas as prioridades</option>
              {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" className="flex-1" disabled={updating}><Filter size={15} /> Aplicar</Button>
            {hasFilters && <Button type="button" variant="ghost" onClick={clearFilters} aria-label="Limpar filtros"><X size={16} /></Button>}
          </div>
        </form>
        <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-[#e8edf2] pt-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#8b97a8]">Rápidos</span>
          {[
            ["", "Todos"],
            ["new", "Novos"],
            ["in_progress", "Em atendimento"],
            ["waiting_user", "Aguardando solicitante"],
            ["resolved", "Resolvidos"],
          ].map(([value, label]) => (
            <FilterChip key={value} active={status === value} onClick={() => applyQuickStatus(value)}>
              {label}
            </FilterChip>
          ))}
        </div>
      </Toolbar>

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {initialLoading ? <LoadingScreen label="Carregando chamados..." /> : (
        <Card className="relative overflow-hidden" aria-busy={updating}>
          {updating && (
            <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-[#c5daf0] bg-white px-2.5 py-1 text-xs font-medium text-[#164f84] shadow-sm">
              <LoaderCircle className="animate-spin" size={13} /> Atualizando
            </div>
          )}
          <SectionHeader
            title={`${total} ${total === 1 ? "chamado encontrado" : "chamados encontrados"}`}
            description={hasFilters ? "Resultado dos filtros aplicados." : requester ? "Suas solicitações mais recentes." : "Chamados ordenados pela data de abertura."}
          />

          <div className="divide-y divide-[#e8edf2] md:hidden">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/chamados/${ticket.id}`} className={cn("block border-l-[3px] p-3.5 transition hover:bg-[#f7f9fb]", rowAccent(ticket))}>
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tabular-nums text-[#8b97a8]">#{String(ticket.id).padStart(4, "0")}</p>
                    <p className="mt-0.5 font-semibold text-[#1a2332]">{ticket.title}</p>
                  </div>
                  <StatusChip status={ticket.status} />
                </div>
                <p className="truncate text-xs text-[#5c6b7e]">{requester ? ticket.category : `${ticket.requester.full_name} · ${ticket.requester.department}`}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {!requester && <PriorityChip priority={ticket.priority} />}
                  {!ticket.assignee && <Badge className="border border-[#fcd9a8] bg-[#fffbeb] text-[#92400e]"><UserRoundX size={12} />Sem responsável</Badge>}
                  <span className="text-xs text-[#8b97a8]">Aberto {relativeTime(ticket.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto soft-scrollbar md:block">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>Chamado</th>
                  {!requester && <th>Solicitante</th>}
                  <th>Status</th>
                  {!requester && <th>Prioridade</th>}
                  <th>Responsável</th>
                  <th>Aberto</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className={cn("border-l-[3px]", rowAccent(ticket))}>
                      <Link href={`/chamados/${ticket.id}`} className="font-semibold text-[#1a2332] hover:text-[#1a5f9e]">
                        #{String(ticket.id).padStart(4, "0")} · {ticket.title}
                      </Link>
                      <p className="mt-0.5 max-w-md truncate text-xs text-[#8b97a8]">{ticket.category}</p>
                      {ticket.asset && <p className="mt-0.5 text-xs text-[#8b97a8]">{ticket.asset.name} · {ticket.asset.ip_address || "IP não informado"}</p>}
                    </td>
                    {!requester && (
                      <td>
                        <p className="font-medium text-[#1a2332]">{ticket.requester.full_name}</p>
                        <p className="mt-0.5 text-xs text-[#8b97a8]">{ticket.requester.department}</p>
                      </td>
                    )}
                    <td><StatusChip status={ticket.status} /></td>
                    {!requester && <td><PriorityChip priority={ticket.priority} /></td>}
                    <td>
                      {ticket.assignee
                        ? <span className="text-[#5c6b7e]">{ticket.assignee.full_name}</span>
                        : <Badge className="border border-[#fcd9a8] bg-[#fffbeb] text-[#92400e]"><UserRoundX size={12} />Sem responsável</Badge>}
                    </td>
                    <td className="text-[#5c6b7e]">{relativeTime(ticket.created_at)}</td>
                    <td className="text-[#5c6b7e]">{formatDate(ticket.due_at, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!tickets.length && (
            <EmptyState
              icon={<CircleOff size={18} />}
              title={hasFilters ? "Nenhum chamado corresponde aos filtros" : requester ? "Você ainda não possui chamados" : "A fila está vazia"}
              description={hasFilters ? "Revise os termos ou limpe os filtros para ampliar a busca." : requester ? "Abra uma solicitação quando precisar de suporte da equipe de TI." : "Nenhum chamado está disponível para este perfil no momento."}
              action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button> : requester ? <Link href="/chamados/novo" className={buttonStyles()}>Abrir primeiro chamado</Link> : undefined}
            />
          )}

          {(total > 0 || hasFilters) && (
            <div className="flex flex-col gap-3 border-t border-[#e8edf2] bg-[#f7f9fb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#5c6b7e]">
                Página <strong className="text-[#1a2332]">{page}</strong> de <strong className="text-[#1a2332]">{totalPages}</strong>
                <span className="ml-1">· {total} registro(s) no total</span>
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={updating || page <= 1}
                  onClick={() => void load(appliedFilters, page - 1)}
                >
                  <ChevronLeft size={15} /> Anterior
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={updating || page >= totalPages}
                  onClick={() => void load(appliedFilters, page + 1)}
                >
                  Próxima <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
