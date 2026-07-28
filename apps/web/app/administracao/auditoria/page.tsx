"use client";

import { History, LoaderCircle, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Card, EmptyState, Input, Select, Toolbar } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { AuditLog } from "@/lib/types";

const entityLabels: Record<string, string> = {
  user: "Usuário",
  asset: "Equipamento",
  catalog: "Catálogo",
  role: "Perfil",
};

export default function AuditPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "audit.view");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("");
  const [error, setError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const requestSequence = useRef(0);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!canView) {
      if (user) setInitialLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      const requestId = ++requestSequence.current;
      if (hasLoaded.current) setUpdating(true);
      api.audit({ ...(entity ? { entity_type: entity } : {}), ...(search ? { search } : {}) })
        .then((result) => {
          if (requestId !== requestSequence.current) return;
          setLogs(result);
          setError("");
        })
        .catch((err) => {
          if (requestId !== requestSequence.current) return;
          setError(err.message);
        })
        .finally(() => {
          if (requestId !== requestSequence.current) return;
          hasLoaded.current = true;
          setInitialLoading(false);
          setUpdating(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [canView, entity, search, user]);

  if (initialLoading) return <LoadingScreen label="Carregando auditoria..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader eyebrow="Segurança" title="Auditoria administrativa" subtitle="Histórico de alterações em usuários, equipamentos, catálogo e permissões." />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <Toolbar className="mb-4">
        <div className="grid w-full flex-1 gap-2 lg:grid-cols-[1fr_220px]">
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" size={16} /><Input className="pl-8" placeholder="Buscar no histórico" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">Todos os tipos</option>{Object.entries(entityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        </div>
        {updating && <LoaderCircle className="shrink-0 animate-spin text-[var(--muted-light)]" size={17} />}
      </Toolbar>

      <Card className={updating ? "overflow-hidden opacity-60 transition-opacity" : "overflow-hidden transition-opacity"}>
        <div className="divide-y divide-[var(--border-subtle)]">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]">{entityLabels[log.entity_type] || log.entity_type}</Badge>
                  <span className="text-xs font-medium text-[var(--muted-light)]">#{log.entity_id}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{log.summary}</p>
                <p className="mt-1 text-xs text-[var(--muted-light)]">{log.actor?.full_name || "Sistema"} · {log.action}</p>
              </div>
              <time className="shrink-0 text-xs text-[var(--muted)]">{formatDate(log.created_at)}</time>
            </div>
          ))}
        </div>
        {!logs.length && <EmptyState icon={<History size={18} />} title="Nenhum evento encontrado" description="As próximas alterações administrativas aparecerão aqui." />}
      </Card>
    </>
  );
}
