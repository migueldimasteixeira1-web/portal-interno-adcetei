"use client";

import { AlertTriangle, CheckCircle2, Printer, RefreshCcw, Server, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Button, Card, EmptyState, SectionHeader, cn } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { PrinterHealth, PrinterJob, Printer as PrinterType } from "@/lib/types";

function healthTone(health: PrinterHealth | null) {
  if (!health?.enabled) return "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]";
  if (health.available) return "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]";
  return "border border-[#fcd9a8] bg-[#fffbeb] text-[#92400e]";
}

function statusTone(printer: PrinterType) {
  if (!printer.enabled || printer.status === "disabled" || printer.status === "stopped") {
    return "border border-[#f5c2c2] bg-[#fef2f2] text-[#991b1b]";
  }
  if (!printer.accepting_jobs) return "border border-[#fcd9a8] bg-[#fffbeb] text-[#92400e]";
  return "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]";
}

function formatBytes(value?: number | null) {
  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function PrintersPage() {
  const { user } = useAuth();
  const canView = user?.permissions?.includes("printers.view");
  const canViewJobs = user?.permissions?.includes("printers.jobs.view");
  const [health, setHealth] = useState<PrinterHealth | null>(null);
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [jobs, setJobs] = useState<PrinterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [jobsError, setJobsError] = useState("");

  const load = async (silent = false) => {
    if (!canView) {
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    setJobsError("");
    try {
      const nextHealth = await api.printersHealth();
      setHealth(nextHealth);
      if (nextHealth.available) {
        const printerData = await api.printers();
        setPrinters(printerData.printers);
        if (canViewJobs) {
          try {
            const jobData = await api.printerJobs();
            setJobs(jobData.jobs);
          } catch (err) {
            setJobs([]);
            setJobsError(err instanceof Error ? err.message : "Não foi possível carregar os jobs pendentes.");
          }
        } else {
          setJobs([]);
        }
      } else {
        setPrinters([]);
        setJobs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar o CUPS.");
      setPrinters([]);
      setJobs([]);
      if (err instanceof ApiError && err.status === 403) return;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, [canView, canViewJobs]);

  const summary = useMemo(() => {
    const available = printers.filter((item) => item.enabled && item.accepting_jobs).length;
    const unavailable = printers.length - available;
    const defaultPrinter = printers.find((item) => item.is_default);
    return { available, unavailable, defaultPrinter };
  }, [printers]);

  if (loading) return <LoadingScreen label="Consultando CUPS local..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Módulo operacional"
        title="Impressoras / CUPS"
        subtitle="Consulta ao CUPS local da máquina onde o backend FastAPI está rodando. Em Docker, localhost representa o container, não automaticamente o host."
        actions={<Button onClick={() => void load(true)} disabled={refreshing}><RefreshCcw size={16} /> {refreshing ? "Atualizando..." : "Atualizar"}</Button>}
      />

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <Card className="mb-4 overflow-hidden">
        <SectionHeader
          title="Conexão com CUPS"
          description="Este MVP usa comandos locais como lpstat. A integração remote_ipp está reservada para o PrintServer."
          action={<Badge className={healthTone(health)}>{health?.available ? "Acessível" : health?.enabled ? "Indisponível" : "Desabilitado"}</Badge>}
        />
        <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_220px_180px]">
          <div className="flex items-start gap-3">
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md border", healthTone(health))}>
              {health?.available ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
            </span>
            <div>
              <p className="text-sm font-semibold text-[#1a2332]">{health?.message || "Status do CUPS não disponível."}</p>
              <p className="mt-1 text-sm leading-6 text-[#5c6b7e]">Servidor: {health?.server || "local"} · backend: {health?.backend || "local_commands"}</p>
            </div>
          </div>
          <div className="rounded-md border border-[#e8edf2] bg-[#f7f9fb] p-3">
            <p className="text-xs font-medium text-[#5c6b7e]">Última consulta</p>
            <p className="mt-1 text-sm font-semibold text-[#1a2332]">{formatDate(health?.checked_at)}</p>
          </div>
          <div className="rounded-md border border-[#e8edf2] bg-[#f7f9fb] p-3">
            <p className="text-xs font-medium text-[#5c6b7e]">Modo</p>
            <p className="mt-1 text-sm font-semibold text-[#1a2332]">CUPS local</p>
          </div>
        </div>
      </Card>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Impressoras" value={printers.length} icon={<Printer size={17} />} hint="Detectadas pelo CUPS" tone="blue" />
        <MetricCard label="Disponíveis" value={summary.available} icon={<CheckCircle2 size={17} />} hint="Habilitadas e aceitando jobs" tone="green" />
        <MetricCard label="Atenção" value={summary.unavailable} icon={<AlertTriangle size={17} />} hint="Paradas ou sem aceitar jobs" tone={summary.unavailable ? "amber" : "slate"} />
        <MetricCard label="Jobs pendentes" value={canViewJobs ? jobs.length : "—"} icon={<Server size={17} />} hint={canViewJobs ? "Não concluídos" : "Sem permissão"} tone="cyan" />
      </div>

      <Card className="overflow-hidden">
        <SectionHeader
          title="Impressoras"
          description={summary.defaultPrinter ? `Padrão do sistema: ${summary.defaultPrinter.name}` : "Status retornado pelo CUPS local."}
        />
        {health && !health.available ? (
          <EmptyState
            icon={<Printer size={18} />}
            title="CUPS local indisponível"
            description={health.message || "Instale ou inicie o CUPS nesta máquina para listar impressoras reais."}
          />
        ) : printers.length ? (
          <div className="overflow-x-auto soft-scrollbar">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Impressora</th>
                  <th>Status</th>
                  <th>Recebendo jobs</th>
                  <th>URI do dispositivo</th>
                  <th>Jobs</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {printers.map((printer) => (
                  <tr key={printer.name}>
                    <td>
                      <div className="font-semibold text-[#1a2332]">{printer.name}</div>
                      {printer.is_default && <div className="mt-1 text-xs text-[#1a5f9e]">Impressora padrão</div>}
                    </td>
                    <td><Badge className={statusTone(printer)}>{printer.status_label}</Badge></td>
                    <td className="text-[#5c6b7e]">{printer.accepting_jobs ? "Sim" : "Não"}</td>
                    <td className="max-w-[340px] truncate text-[#5c6b7e]" title={printer.device_uri}>{printer.device_uri || "—"}</td>
                    <td className="font-semibold tabular-nums text-[#1a2332]">{printer.jobs_count}</td>
                    <td className="text-[#5c6b7e]">{formatDate(printer.last_checked_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Printer size={18} />}
            title="Nenhuma impressora encontrada"
            description="O CUPS local respondeu, mas não retornou impressoras configuradas."
          />
        )}
      </Card>

      <Card className="mt-4 overflow-hidden">
        <SectionHeader
          title="Jobs pendentes"
          description="Saída normalizada de lpstat -W not-completed -o."
          action={!canViewJobs ? <Badge className="border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]">Sem permissão</Badge> : undefined}
        />
        {jobsError && <Alert tone="warning" className="m-4">{jobsError}</Alert>}
        {!canViewJobs ? (
          <EmptyState
            icon={<Server size={18} />}
            title="Consulta de jobs restrita"
            description="Seu perfil não possui permissão para visualizar jobs pendentes."
          />
        ) : jobs.length ? (
          <div className="overflow-x-auto soft-scrollbar">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Impressora</th>
                  <th>Usuário</th>
                  <th>Tamanho</th>
                  <th>Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="font-semibold text-[#1a2332]">{job.id}</td>
                    <td className="text-[#5c6b7e]">{job.printer_name}</td>
                    <td className="text-[#5c6b7e]">{job.owner || "—"}</td>
                    <td className="text-[#5c6b7e]">{formatBytes(job.size_bytes)}</td>
                    <td className="text-[#5c6b7e]">{job.submitted_at || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Server size={18} />}
            title="Nenhum job pendente"
            description="Não há trabalhos de impressão não concluídos no CUPS local."
          />
        )}
      </Card>
    </>
  );
}
