"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Card, EmptyState, buttonStyles, cn } from "@/components/ui";
import { DashboardModuleSections, DashboardOperationalSection } from "@/features/dashboard/DashboardSections";
import { api } from "@/lib/api";
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
    () => portalModules.filter((item) => item.area === "modules" && item.status !== "planned" && canAccessNavItem(item, user)),
    [user],
  );
  const plannedModules = useMemo(
    () => portalModules.filter((item) => item.area === "modules" && item.status === "planned" && canAccessNavItem(item, user)),
    [user],
  );
  const hubStats = data ? [
    { label: "Chamados abertos", value: data.total, hint: user?.role === "user" ? "Suas solicitações" : "Na operação" },
    { label: "Novos", value: data.new, hint: "Aguardando atribuição" },
    { label: "Atribuídos", value: data.assigned, hint: "Com responsável" },
    { label: "Fechados", value: data.closed, hint: "Encerrados" },
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
        <div className="rounded-md border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] p-4">
          <p className="text-sm font-semibold text-[var(--primary-hover)]">Hub modular do portal</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Use esta tela como ponto de partida para suporte técnico, ativos e módulos planejados do portal.
          </p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">Atalho recomendado</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {user?.role === "user" ? "Abra ou acompanhe suas solicitações técnicas pelo módulo de chamados." : "Acompanhe a fila técnica pelo módulo de chamados."}
          </p>
          <Link href="/chamados" className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "mt-3")}>
            {moduleLabelForUser(portalModules[0], user)} <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <DashboardModuleSections visibleModules={visibleModules} plannedModules={plannedModules} />

      <DashboardOperationalSection
        data={data}
        loading={loading}
        error={error}
        hubStats={hubStats}
        showPriority={user?.role !== "user"}
        onRefresh={() => void loadDashboard()}
      />

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
