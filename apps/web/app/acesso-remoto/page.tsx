"use client";

import { useSearchParams } from "next/navigation";
import { MonitorCog, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import SearchParamsSuspense from "@/components/SearchParamsSuspense";
import { Alert } from "@/components/ui";
import RemoteAccessPanels from "@/features/remote-access/RemoteAccessPanels";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { RemoteAccessDevice, RemoteAccessHealth, RemoteAccessSummary } from "@/lib/types";

function RemoteAccessContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const defaultTicketId = searchParams.get("ticket_id") || "";
  const defaultAssetId = searchParams.get("asset_id") || "";
  const canView = hasPermission(user, "remote_access.view");
  const canConnect = hasPermission(user, "remote_access.connect");
  const [devices, setDevices] = useState<RemoteAccessDevice[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RemoteAccessSummary>({ total: 0, online: 0, offline: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "" });
  const [page, setPage] = useState(1);
  const [health, setHealth] = useState<RemoteAccessHealth | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const hasLoaded = useRef(false);

  const load = async (filters: { search: string; status: string }, requestedPage = 1) => {
    const requestId = ++requestSequence.current;
    if (hasLoaded.current) setUpdating(true);
    else setInitialLoading(true);
    try {
      const result = await api.remoteDevices({
        search: filters.search || undefined,
        status: filters.status || undefined,
        page: requestedPage,
        page_size: 20,
      });
      if (requestId !== requestSequence.current) return;
      setDevices(result.items);
      setTotal(result.total);
      setSummary(result.summary);
      setPage(result.page);
      setAppliedFilters(filters);
      setError("");
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar computadores remotos.");
    } finally {
      if (requestId === requestSequence.current) {
        hasLoaded.current = true;
        setInitialLoading(false);
        setUpdating(false);
      }
    }
  };

  useEffect(() => {
    if (!canView) {
      if (user) setInitialLoading(false);
      return;
    }
    void api.remoteAccessHealth().then(setHealth).catch((err) => setHealth({ enabled: false, bridge_online: false, message: err instanceof Error ? err.message : "Não foi possível verificar o Mesh Bridge." }));
    void load({ search: "", status: "" }, 1);
  }, [canView, user]);

  useEffect(() => {
    if (!canView || !hasLoaded.current) return;
    if (search === appliedFilters.search && status === appliedFilters.status) return;
    const timer = setTimeout(() => {
      void load({ search, status }, 1);
    }, 250);
    return () => clearTimeout(timer);
  }, [canView, search, status, appliedFilters]);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    void load({ search: "", status: "" }, 1);
  };

  const hasFilters = Boolean(appliedFilters.search || appliedFilters.status);
  const totalPages = Math.max(1, Math.ceil(total / 20));

  if (initialLoading) return <LoadingScreen label="Carregando acesso remoto..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Acesso remoto"
        title="Acesso Remoto"
        subtitle="Acesse computadores gerenciados pelo MeshCentral com permissão, justificativa e auditoria no Portal."
      />
      {health && !health.bridge_online && <Alert tone={health.enabled ? "warning" : "danger"} className="mb-4">{health.message}</Alert>}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Computadores" value={summary.total} icon={<MonitorCog size={17} />} hint="Total retornado" tone="blue" />
        <MetricCard label="Online" value={summary.online} icon={<Wifi size={17} />} hint="Prontos para conexão" tone="green" />
        <MetricCard label="Offline" value={summary.offline} icon={<WifiOff size={17} />} hint="Sem agente conectado" tone="slate" />
        <MetricCard label="Auditoria" value="Ativa" icon={<ShieldCheck size={17} />} hint="Justificativa obrigatória" tone="cyan" />
      </div>

      <RemoteAccessPanels
        devices={devices}
        total={total}
        page={page}
        totalPages={totalPages}
        updating={updating}
        hasFilters={hasFilters}
        filters={{ search, status }}
        canConnect={canConnect}
        defaultTicketId={defaultTicketId}
        defaultAssetId={defaultAssetId}
        onFiltersChange={(changes) => {
          if ("search" in changes) setSearch(changes.search ?? "");
          if ("status" in changes) setStatus(changes.status ?? "");
        }}
        onClearFilters={clearFilters}
        onPageChange={(nextPage) => void load(appliedFilters, nextPage)}
        onError={setError}
      />
    </>
  );
}

export default function RemoteAccessPage() {
  return (
    <SearchParamsSuspense>
      <RemoteAccessContent />
    </SearchParamsSuspense>
  );
}
