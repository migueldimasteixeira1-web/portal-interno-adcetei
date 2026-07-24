"use client";

import { ArrowLeft, LoaderCircle, MonitorCog, Square, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Badge, Button, Card, DetailRow, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { RemoteAccessSession } from "@/lib/types";

const statusLabel: Record<string, string> = {
  authorized: "Autorizada",
  open: "Aberta",
  ended: "Encerrada",
  failed: "Falhou",
};

const statusTone: Record<string, string> = {
  authorized: "border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[#164f84]",
  open: "border border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[#0d5c4f]",
  ended: "border border-[#d4dbe4] bg-[#f7f9fb] text-[#5c6b7e]",
  failed: "border border-[var(--status-red-border)] bg-[var(--status-red-bg)] text-[#991b1b]",
};

export default function RemoteAccessSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canConnect = hasPermission(user, "remote_access.connect");
  const [session, setSession] = useState<RemoteAccessSession | null>(null);
  const [embedUrl, setEmbedUrl] = useState("");
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const launched = useRef(false);

  const sessionId = params.id;

  const loadSession = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.remoteSession(sessionId);
      setSession(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a sessão remota.");
    } finally {
      setLoading(false);
    }
  };

  const launch = async () => {
    if (launching) return;
    setLaunching(true);
    setError("");
    try {
      const result = await api.launchRemoteSession(sessionId);
      setSession(result.session);
      setEmbedUrl(result.embed_url);
      setExpiresIn(result.expires_in_seconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o visualizador remoto.");
    } finally {
      setLaunching(false);
    }
  };

  const closeSession = async () => {
    setClosing(true);
    setError("");
    try {
      const result = await api.closeRemoteSession(sessionId);
      setSession(result);
      setEmbedUrl("");
      router.push("/acesso-remoto");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível encerrar a sessão.");
    } finally {
      setClosing(false);
    }
  };

  useEffect(() => {
    if (!canConnect) {
      if (user) setLoading(false);
      return;
    }
    void loadSession();
  }, [canConnect, sessionId, user]);

  useEffect(() => {
    if (!session || launched.current || session.status === "ended") return;
    launched.current = true;
    void launch();
  }, [session]);

  if (loading) return <LoadingScreen label="Preparando sessão remota..." />;
  if (!canConnect) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Acesso remoto"
        title={session?.device_name_snapshot || "Sessão de acesso remoto"}
        subtitle="Visualizador integrado ao Portal. A operação fica registrada na auditoria administrativa."
        actions={<Link href="/acesso-remoto" className={buttonStyles({ variant: "secondary" })}><ArrowLeft size={16} />Voltar</Link>}
      />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      {session && (
        <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#e8edf2] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#1a2332]">Visualizador remoto</p>
                <p className="mt-0.5 text-xs text-[#5c6b7e]">Modo liberado: área de trabalho.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusTone[session.status] || statusTone.authorized}>{statusLabel[session.status] || session.status}</Badge>
                <Button type="button" variant="secondary" size="sm" disabled={launching || session.status === "ended"} onClick={() => void launch()}>
                  {launching ? <LoaderCircle className="animate-spin" size={15} /> : <RotateCcw size={15} />}Reabrir URL
                </Button>
                <Button type="button" variant="danger" size="sm" disabled={closing || session.status === "ended"} onClick={() => void closeSession()}>
                  {closing ? <LoaderCircle className="animate-spin" size={15} /> : <Square size={15} />}Encerrar
                </Button>
              </div>
            </div>
            <div className="bg-[#0a1f33] p-2">
              {embedUrl ? (
                <iframe
                  title={`Acesso remoto ${session.device_name_snapshot}`}
                  src={embedUrl}
                  className="h-[calc(100vh-260px)] min-h-[520px] w-full rounded-md border border-white/10 bg-white"
                  allow="clipboard-read; clipboard-write; fullscreen"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="grid h-[calc(100vh-260px)] min-h-[520px] place-items-center rounded-md border border-white/10 bg-[#0f2d4a] p-8 text-center text-white">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-white/10"><MonitorCog size={22} /></div>
                    <p className="mt-4 font-semibold">Visualizador ainda não carregado</p>
                    <p className="mt-1 max-w-md text-sm leading-6 text-white/70">Use “Reabrir URL” para solicitar uma nova URL temporária ao MeshCentral.</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="h-fit p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#1a2332]">Dados da sessão</p>
              <Badge className={statusTone[session.status] || statusTone.authorized}>{statusLabel[session.status] || session.status}</Badge>
            </div>
            <div className="divide-y divide-[#e8edf2]">
              <DetailRow label="Computador" value={session.device_name_snapshot} />
              <DetailRow label="ID MeshCentral" value={<span className="break-all">{session.mesh_node_id}</span>} />
              <DetailRow label="Solicitado em" value={formatDate(session.requested_at)} />
              <DetailRow label="Aberto em" value={formatDate(session.opened_at)} />
              <DetailRow label="Chamado" value={session.ticket_id ? `#${session.ticket_id}` : "Não informado"} />
              <DetailRow label="Inventário" value={session.asset ? `#${session.asset.id} · ${session.asset.serial_number || session.asset.display_name}` : "Não vinculado"} />
              <DetailRow label="URL temporária" value={expiresIn ? `Expira em aproximadamente ${Math.round(expiresIn / 60)} min` : "Ainda não gerada"} />
              <DetailRow label="Motivo" value={<span className="whitespace-pre-wrap leading-6">{session.reason}</span>} />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
