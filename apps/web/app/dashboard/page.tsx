"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Plus, RefreshCcw, Tickets } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ModuleCard from "@/components/ModuleCard";
import PageHeader from "@/components/PageHeader";
import { PriorityChip, StatusChip } from "@/components/StatusChip";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Card, EmptyState, SectionHeader, buttonStyles, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/format";
import { canAccessNavItem, moduleLabelForUser, portalModules } from "@/lib/modules";
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
      setError(err instanceof Error ? err.message : "Não foi possível carregar os indicadores de chamados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);

  const firstName = user?.full_name.split(" ")[0] || "servidor";
  const visibleModules = useMemo(
    () => portalModules.filter((item) => canAccessNavItem(item, user)),
    [user],
  );
  const hubStats = data ? [
    { label: "Chamados abertos", value: data.total, hint: user?.role === "requester" ? "Suas solicitações" : "Na operação" },
    { label: "Novos", value: data.new, hint: "Aguardando triagem" },
    { label: "Pendências", value: data.pending, hint: "Aguardando retorno" },
    { label: "Resolvidos hoje", value: data.solved_today, hint: "Fechamentos do dia" },
  ] : [];

  return (
    <>
      <PageHeader
        eyebrow="Portal Interno ADCETEI"
        title={`Olá, ${firstName}`}
        subtitle="Central de acesso aos módulos operacionais da ADCETEI. Chamados e inventário são os primeiros recursos do portal; novos módulos serão incorporados sem mudar sua rotina de entrada."
        actions={<Link href="/chamados/novo" className={buttonStyles()}><Plus size={16} /> Abrir chamado</Link>}
      />

      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-md border border-[#c5daf0] bg-[#f3f7fb] p-4">
          <p className="text-sm font-semibold text-[#164f84]">Hub modular do portal</p>
          <p className="mt-1 text-sm leading-6 text-[#5c6b7e]">
            Use esta tela como ponto de partida para suporte técnico, ativos, formalizações, impressão e serviços internos. Os cards indicam o que já está disponível e o que está planejado.
          </p>
        </div>
        <div className="rounded-md border border-[#d4dbe4] bg-white p-4">
          <p className="text-sm font-semibold text-[#1a2332]">Atalho recomendado</p>
          <p className="mt-1 text-sm leading-6 text-[#5c6b7e]">
            {user?.role === "requester" ? "Abra ou acompanhe suas solicitações técnicas pelo módulo de chamados." : "Acompanhe a fila técnica pelo módulo de chamados."}
          </p>
          <Link href="/chamados" className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "mt-3")}>
            {moduleLabelForUser(portalModules[0], user)} <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleModules.map((item) => <ModuleCard key={item.href} item={item} />)}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <SectionHeader
            title="Continuidade operacional"
            description="Indicadores de chamados permanecem visíveis, mas agora como contexto de um portal mais amplo."
            action={error ? <button type="button" className="text-xs font-semibold text-[#1a5f9e] hover:underline" onClick={() => void loadDashboard()}><RefreshCcw size={13} className="inline" /> Atualizar</button> : undefined}
          />
          {error && <Alert tone="warning" className="m-4">{error}</Alert>}
          {loading && !data ? (
            <div className="p-4 text-sm text-[#5c6b7e]">Carregando indicadores operacionais...</div>
          ) : data ? (
            <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {hubStats.map((item) => (
                <div key={item.label} className="rounded-md border border-[#e8edf2] bg-[#f7f9fb] px-3.5 py-3">
                  <p className="text-xs font-medium text-[#5c6b7e]">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[#1a2332]">{item.value}</p>
                  <p className="mt-0.5 text-xs text-[#8b97a8]">{item.hint}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader
            title="Chamados recentes"
            description="Últimas movimentações do módulo técnico."
            action={<Link href="/chamados" className="text-xs font-semibold text-[#1a5f9e] hover:underline">Ver módulo</Link>}
          />
          {data?.recent.length ? (
            <div className="divide-y divide-[#e8edf2]">
              {data.recent.slice(0, 4).map((ticket) => (
                <Link key={ticket.id} href={`/chamados/${ticket.id}`} className="block px-4 py-3 transition hover:bg-[#f7f9fb]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1a2332]">#{String(ticket.id).padStart(4, "0")} · {ticket.title}</p>
                      <p className="mt-1 text-xs text-[#8b97a8]">
                        Atualizado {relativeTime(ticket.updated_at)} · prazo {formatDate(ticket.due_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusChip status={ticket.status} />
                      {user?.role !== "requester" && <PriorityChip priority={ticket.priority} />}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : loading ? (
            <div className="p-4 text-sm text-[#5c6b7e]">Carregando movimentações...</div>
          ) : (
            <EmptyState
              icon={<Tickets size={18} />}
              title="Sem chamados recentes"
              description="Quando houver movimentação técnica, ela aparecerá aqui."
              className="py-10"
            />
          )}
        </Card>
      </div>

      {data?.overdue ? (
        <Alert tone="warning" className="mt-4">
          Há {data.overdue} chamado(s) com prazo vencido na operação técnica.
        </Alert>
      ) : null}

      {!visibleModules.length && (
        <Card className="mt-4">
          <EmptyState
            icon={<AlertTriangle size={18} />}
            title="Nenhum módulo disponível para seu perfil"
            description="Procure a administração do portal para revisar seu acesso."
          />
        </Card>
      )}
    </>
  );
}
