import Link from "next/link";
import { RefreshCcw, Tickets } from "lucide-react";
import ModuleCard from "@/components/ModuleCard";
import { PriorityChip, StatusChip } from "@/components/StatusChip";
import { Alert, Card, EmptyState, SectionHeader } from "@/components/ui";
import { formatDate, relativeTime } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import type { PortalNavItem } from "@/lib/modules";

type HubStat = { label: string; value: number; hint: string };

type OperationalProps = {
  data: DashboardData | null;
  loading: boolean;
  error: string;
  hubStats: HubStat[];
  showPriority: boolean;
  onRefresh: () => void;
};

export function DashboardOperationalSection({ data, loading, error, hubStats, showPriority, onRefresh }: OperationalProps) {
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden">
        <SectionHeader
          title="Continuidade operacional"
          description="Indicadores de chamados permanecem visíveis, mas agora como contexto de um portal mais amplo."
          action={error ? <button type="button" className="text-xs font-semibold text-[#1a5f9e] hover:underline" onClick={onRefresh}><RefreshCcw size={13} className="inline" /> Atualizar</button> : undefined}
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
                    {showPriority && <PriorityChip priority={ticket.priority} />}
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
  );
}

type ModulesProps = {
  visibleModules: PortalNavItem[];
  plannedModules: PortalNavItem[];
};

export function DashboardModuleSections({ visibleModules, plannedModules }: ModulesProps) {
  return (
    <>
      <section aria-labelledby="available-modules-title">
        <div className="mb-2 flex items-center gap-3">
          <h2 id="available-modules-title" className="text-sm font-semibold text-[#1a2332]">Módulos disponíveis</h2>
          <span className="h-px flex-1 bg-[#d4dbe4]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((item) => <ModuleCard key={item.href} item={item} />)}
        </div>
      </section>

      {plannedModules.length > 0 && (
        <section className="mt-5" aria-labelledby="planned-modules-title">
          <div className="mb-2 flex items-center gap-3">
            <h2 id="planned-modules-title" className="text-sm font-semibold text-[#1a2332]">Próximos módulos</h2>
            <span className="h-px flex-1 bg-[#d4dbe4]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {plannedModules.map((item) => <ModuleCard key={item.href} item={item} />)}
          </div>
        </section>
      )}
    </>
  );
}
