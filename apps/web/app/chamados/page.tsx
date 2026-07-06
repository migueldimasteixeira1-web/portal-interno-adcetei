"use client";

import Link from "next/link";
import { Ban, CheckCircle2, Plus, TicketCheck, Tickets, UserCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { Alert, buttonStyles } from "@/components/ui";
import TicketListContent, { TicketFiltersToolbar } from "@/features/tickets/TicketListContent";
import { api } from "@/lib/api";
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
  const [summary, setSummary] = useState({ new: 0, assigned: 0, closed: 0, cancelled: 0 });
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

  const canViewAll = !!user?.permissions.includes("tickets.view_all");
  const isUserProfile = user?.role === "user" && !canViewAll;

  useEffect(() => { void load({ search: "", status: "", priority: "" }, 1); }, []);

  useEffect(() => {
    if (!hasLoaded.current) return;
    const effectivePriority = isUserProfile ? "" : priority;
    if (search === appliedFilters.search && status === appliedFilters.status && effectivePriority === appliedFilters.priority) return;
    const timer = setTimeout(() => {
      void load({ search, status, priority: effectivePriority }, 1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, status, priority, isUserProfile, appliedFilters]);

  const assignedOnly = user?.role === "technician" && !canViewAll;
  const hasFilters = !!(search || status || (!isUserProfile && priority));
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    void load({ search: "", status: "", priority: "" }, 1);
  };

  return (
    <>
      <PageHeader
        eyebrow={isUserProfile ? "Suas solicitações" : assignedOnly ? "Atendimento técnico" : "Atendimento"}
        title={isUserProfile ? "Meus chamados" : assignedOnly ? "Chamados atribuídos" : "Central de chamados"}
        subtitle={isUserProfile ? "Acompanhe o andamento e as respostas da equipe de TI." : assignedOnly ? "Visualize os atendimentos sob sua responsabilidade." : "Fila compartilhada para triagem, priorização e distribuição dos atendimentos."}
        actions={<Link href="/chamados/novo" className={buttonStyles()}><Plus size={16} /> Abrir chamado</Link>}
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Chamados" value={total} icon={<Tickets size={17} />} hint="Total encontrado" tone="blue" />
        <MetricCard label="Novos" value={summary.new} icon={<TicketCheck size={17} />} hint="Aguardando atribuição" tone="cyan" />
        <MetricCard label="Atribuídos" value={summary.assigned} icon={<UserCheck size={17} />} hint="Com responsável" tone="amber" />
        <MetricCard label="Fechados" value={summary.closed} icon={<CheckCircle2 size={17} />} hint="Encerrados" tone="green" />
        <MetricCard label="Cancelados" value={summary.cancelled} icon={<Ban size={17} />} hint="Interrompidos" tone="slate" />
      </div>

      <TicketFiltersToolbar
        isUserProfile={isUserProfile}
        filters={{ search, status, priority }}
        hasFilters={hasFilters}
        onFiltersChange={(changes) => {
          if ("search" in changes) setSearch(changes.search ?? "");
          if ("status" in changes) setStatus(changes.status ?? "");
          if ("priority" in changes) setPriority(changes.priority ?? "");
        }}
        onClearFilters={clearFilters}
      />

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {initialLoading ? <LoadingScreen label="Carregando chamados..." /> : (
        <TicketListContent
          tickets={tickets}
          total={total}
          page={page}
          totalPages={totalPages}
          updating={updating}
          hasFilters={hasFilters}
          isUserProfile={isUserProfile}
          onClearFilters={clearFilters}
          onPageChange={(nextPage) => void load(appliedFilters, nextPage)}
        />
      )}
    </>
  );
}
