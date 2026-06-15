"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Boxes, CheckCircle2, Clock3, History, Inbox, ListChecks, Plus, RefreshCcw, Settings2, TicketCheck, Tickets, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import { PriorityChip, StatusChip } from "@/components/StatusChip";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Card, EmptyState, SectionHeader, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, relativeTime, roleLabels } from "@/lib/format";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.dashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a visão geral.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);

  const copy = useMemo(() => {
    if (user?.role === "requester") return {
      eyebrow: "Portal do servidor",
      title: `Olá, ${user.full_name.split(" ")[0]}`,
      subtitle: "Acompanhe suas solicitações ou abra um novo chamado para a equipe de TI.",
      recentTitle: "Seus chamados recentes",
      recentDescription: "Últimas solicitações e atualizações da equipe de TI.",
    };
    if (user?.role === "technician") return {
      eyebrow: "Atendimento técnico",
      title: "Meus chamados atribuídos",
      subtitle: "Priorize os atendimentos em andamento e as solicitações que aguardam ação técnica.",
      recentTitle: "Atendimentos recentes",
      recentDescription: "Chamados atribuídos a você, ordenados pela última atualização.",
    };
    if (user?.role === "admin") return {
      eyebrow: "Visão administrativa",
      title: "Visão geral da operação",
      subtitle: "Acompanhe a central de atendimento e acesse as áreas administrativas do portal.",
      recentTitle: "Movimentações recentes",
      recentDescription: "Chamados com atividade recente em toda a operação.",
    };
    return {
      eyebrow: "Central operacional",
      title: "Fila de atendimento da TI",
      subtitle: "Acompanhe a entrada de chamados, pendências, prazos e distribuição da equipe.",
      recentTitle: "Chamados que exigem atenção",
      recentDescription: "Fila compartilhada ordenada pelas atualizações mais recentes.",
    };
  }, [user]);

  if (loading && !data) return <LoadingScreen label="Carregando visão geral..." />;

  if (!data) {
    return (
      <>
        <PageHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
        <Card>
          <EmptyState
            icon={<AlertTriangle size={18} />}
            title="Não foi possível carregar o dashboard"
            description={error || "Verifique a conexão com a API e tente novamente."}
            action={<button type="button" className={buttonStyles({ variant: "secondary" })} onClick={() => void loadDashboard()}><RefreshCcw size={15} /> Tentar novamente</button>}
          />
        </Card>
      </>
    );
  }

  const isRequester = user?.role === "requester";
  const isStaff = !isRequester;

  const primaryAction = isRequester
    ? { href: "/chamados/novo", label: "Abrir novo chamado", description: "Escolha o serviço e descreva sua necessidade." }
    : user?.role === "technician"
      ? { href: "/chamados", label: "Ver meus atendimentos", description: "Chamados atribuídos a você." }
      : { href: "/chamados", label: "Ir para a fila de triagem", description: "Priorize novos chamados e distribua a equipe." };
  const managementLinks = [
    { href: "/inventario", label: "Inventário", description: "Equipamentos e vínculos", icon: Boxes, permission: "assets.view" },
    { href: "/administracao/usuarios", label: "Usuários", description: "Contas e acessos", icon: Users, permission: "users.view" },
    { href: "/administracao/catalogo", label: "Catálogo", description: "Serviços e formulários", icon: BookOpen, permission: "catalog.manage" },
    { href: "/administracao/perfis", label: "Perfis", description: "Permissões por perfil", icon: Settings2, permission: "roles.manage" },
    { href: "/administracao/auditoria", label: "Auditoria", description: "Histórico administrativo", icon: History, permission: "audit.view" },
  ].filter((item) => user?.permissions.includes(item.permission));

  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={copy.subtitle}
        actions={<Link href="/chamados/novo" className={buttonStyles()}><Plus size={16} /> Abrir chamado</Link>}
      />

      {error && <Alert tone="danger" className="mb-4">{error} <button type="button" className="ml-1 font-semibold underline" onClick={() => void loadDashboard()}>Tentar novamente</button></Alert>}

      <div className="mb-4 flex flex-col gap-3 rounded-md border border-[#d4dbe4] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1a2332]">{primaryAction.label}</p>
          <p className="mt-0.5 text-sm text-[#5c6b7e]">{primaryAction.description}</p>
        </div>
        <Link href={primaryAction.href} className={buttonStyles({ variant: "secondary" })}>
          Acessar <ArrowRight size={15} />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {isRequester ? (
          <>
            <MetricCard label="Total de chamados" value={data.total} icon={<Tickets size={17} />} hint="Todas as suas solicitações" tone="blue" />
            <MetricCard label="Novos" value={data.new} icon={<Inbox size={17} />} hint="Aguardando triagem" tone="cyan" />
            <MetricCard label="Em andamento" value={data.assigned} icon={<ListChecks size={17} />} hint="Em triagem ou atendimento" tone="indigo" />
            <MetricCard label="Aguardando você" value={data.pending} icon={<Clock3 size={17} />} hint="Precisam do seu retorno" tone="amber" />
            <MetricCard label="Concluídos hoje" value={data.solved_today} icon={<CheckCircle2 size={17} />} hint="Resolvidos ou fechados" tone="green" />
          </>
        ) : (
          <>
            <MetricCard label="Novos" value={data.new} icon={<Inbox size={17} />} hint="Aguardando triagem" tone="blue" />
            <MetricCard label={user?.role === "technician" ? "Meus atendimentos" : "Em atendimento"} value={user?.role === "technician" ? data.my_open : data.assigned} icon={<Tickets size={17} />} hint="Atribuídos ou em andamento" tone="cyan" />
            <MetricCard label="Aguardando retorno" value={data.pending} icon={<Clock3 size={17} />} hint="Dependem do solicitante" tone="amber" />
            <MetricCard label="Com prazo vencido" value={data.overdue} icon={<AlertTriangle size={17} />} hint="Requerem priorização" tone="red" />
            <MetricCard label="Resolvidos hoje" value={data.solved_today} icon={<TicketCheck size={17} />} hint="Fechamentos do dia" tone="green" />
          </>
        )}
      </div>

      {managementLinks.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {managementLinks.map((item) => (
            <Link key={item.href} href={item.href} className="panel-flat flex items-center gap-3 p-3 transition hover:border-[#1a5f9e]">
              <span className="grid h-8 w-8 place-items-center rounded-md border border-[#e8edf2] bg-[#f7f9fb] text-[#5c6b7e]">
                <item.icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#1a2332]">{item.label}</span>
                <span className="block text-xs text-[#8b97a8]">{item.description}</span>
              </span>
              <ArrowRight size={14} className="text-[#8b97a8]" />
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden">
          <SectionHeader
            title={copy.recentTitle}
            description={copy.recentDescription}
            action={<Link href="/chamados" className="text-xs font-semibold text-[#1a5f9e] hover:underline">{isRequester ? "Ver todos" : "Abrir central"}</Link>}
          />
          <div className="divide-y divide-[#e8edf2]">
            {data.recent.map((ticket) => (
              <Link key={ticket.id} href={`/chamados/${ticket.id}`} className="block px-4 py-3 transition hover:bg-[#f7f9fb] sm:px-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-[#8b97a8]">#{String(ticket.id).padStart(4, "0")}</span>
                      <p className="truncate text-sm font-semibold text-[#1a2332]">{ticket.title}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#5c6b7e]">
                      {isRequester ? ticket.category : `${ticket.requester.full_name} · ${ticket.requester.department}`}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8b97a8]">
                      Atualizado {relativeTime(ticket.updated_at)} · prazo {formatDate(ticket.due_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <StatusChip status={ticket.status} />
                    {isStaff && <PriorityChip priority={ticket.priority} />}
                  </div>
                </div>
              </Link>
            ))}
            {!data.recent.length && (
              <EmptyState
                icon={<Tickets size={18} />}
                title={isRequester ? "Você ainda não possui chamados" : "Nenhum chamado na fila"}
                description={isRequester ? "Abra uma solicitação quando precisar de suporte da equipe de TI." : "Não há chamados disponíveis para acompanhamento neste momento."}
              />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {isStaff && (
            <Card className="overflow-hidden">
              <SectionHeader title="Distribuição da equipe" description="Chamados abertos por responsável." />
              <div className="divide-y divide-[#e8edf2] px-4 sm:px-5">
                {data.team_load.map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-[#1a2332]">{member.name}</p>
                      <p className="text-xs text-[#8b97a8]">{roleLabels[member.role]}</p>
                    </div>
                    <span className="min-w-7 rounded-md border border-[#d4dbe4] bg-[#f7f9fb] px-2 py-0.5 text-center text-sm font-semibold tabular-nums text-[#1a2332]">
                      {member.open}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {isRequester && (
            <Card className="overflow-hidden">
              <SectionHeader title="Como funciona" description="O fluxo depois da abertura." />
              <ol className="space-y-3 p-4 sm:p-5">
                {[
                  "A equipe de TI recebe e classifica sua solicitação.",
                  "Um responsável é definido para o atendimento.",
                  "Você acompanha respostas e mudanças pelo histórico.",
                ].map((item, index) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-6 text-[#5c6b7e]">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-[#d4dbe4] bg-[#f7f9fb] text-[11px] font-semibold text-[#1a5f9e]">
                      {index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card className="overflow-hidden">
            <SectionHeader title="Resumo por status" />
            <div className="space-y-2 p-4 sm:p-5">
              {data.by_status.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                  <StatusChip status={item.name} />
                  <span className="font-semibold tabular-nums text-[#1a2332]">{item.value}</span>
                </div>
              ))}
              {!data.by_status.length && <p className="text-sm text-[#8b97a8]">Nenhum status disponível.</p>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
