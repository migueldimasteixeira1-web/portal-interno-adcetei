"use client";

import { ArrowLeft, ExternalLink, LoaderCircle, MonitorCog, RotateCcw, Square } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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

function openViewerTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function RemoteAccessSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canConnect = hasPermission(user, "remote_access.connect");
  const [session, setSession] = useState<RemoteAccessSession | null>(null);
  const [sessionUrl, setSessionUrl] = useState("");
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

  const launch = useCallback(
    async (openTab = false) => {
      if (launching) return;
      setLaunching(true);
      setError("");
      try {
        const result = await api.launchRemoteSession(sessionId);
        setSession(result.session);
        setSessionUrl(result.embed_url);
        setExpiresIn(result.expires_in_seconds);
        if (openTab && result.embed_url) openViewerTab(result.embed_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível gerar a URL do visualizador remoto.");
      } finally {
        setLaunching(false);
      }
    },
    [launching, sessionId],
  );

  const closeSession = async () => {
    setClosing(true);
    setError("");
    try {
      const result = await api.closeRemoteSession(sessionId);
      setSession(result);
      setSessionUrl("");
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
    void launch(true);
  }, [session, launch]);

  if (loading) return <LoadingScreen label="Preparando sessão remota..." />;
  if (!canConnect) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Acesso remoto"
        title={session?.device_name_snapshot || "Sessão de acesso remoto"}
        subtitle="O visualizador abre em nova aba no MeshCentral. A operação fica registrada na auditoria."
        actions={
          <Link href="/acesso-remoto" className={buttonStyles({ variant: "secondary" })}>
            <ArrowLeft size={16} />
            Voltar
          </Link>
        }
      />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      {session && (
        <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf2] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#1a2332]">Visualizador remoto</p>
                <p className="mt-0.5 text-xs text-[#5c6b7e]">Área de trabalho · nova aba MeshCentral</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusTone[session.status] || statusTone.authorized}>
                  {statusLabel[session.status] || session.status}
                </Badge>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={launching || session.status === "ended"}
                  onClick={() => (sessionUrl ? openViewerTab(sessionUrl) : void launch(true))}
                >
                  {launching ? <LoaderCircle className="animate-spin" size={15} /> : <ExternalLink size={15} />}
                  Abrir visualizador
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={launching || session.status === "ended"}
                  onClick={() => void launch(true)}
                >
                  {launching ? <LoaderCircle className="animate-spin" size={15} /> : <RotateCcw size={15} />}
                  Nova URL
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={closing || session.status === "ended"}
                  onClick={() => void closeSession()}
                >
                  {closing ? <LoaderCircle className="animate-spin" size={15} /> : <Square size={15} />}
                  Encerrar
                </Button>
              </div>
            </div>
            <div className="grid min-h-[320px] place-items-center bg-[#0f2d4a] p-8 text-center text-white">
              <div className="max-w-lg">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-white/10">
                  <MonitorCog size={22} />
                </div>
                <p className="mt-4 text-lg font-semibold">
                  {sessionUrl ? "Visualizador pronto" : launching ? "Gerando URL temporária..." : "URL ainda não gerada"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  Na aba do MeshCentral, clique em <strong>Conectar</strong> para iniciar a sessão de desktop.
                  O computador de destino pode solicitar permissão do usuário local.
                </p>
                {sessionUrl && (
                  <p className="mt-3 text-xs text-white/55">
                    Se a aba não abriu, use <strong>Abrir visualizador</strong>. Confirme que o certificado do
                    MeshCentral está instalado no navegador.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="h-fit p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#1a2332]">Dados da sessão</p>
              <Badge className={statusTone[session.status] || statusTone.authorized}>
                {statusLabel[session.status] || session.status}
              </Badge>
            </div>
            <div className="divide-y divide-[#e8edf2]">
              <DetailRow label="Computador" value={session.device_name_snapshot} />
              <DetailRow label="ID MeshCentral" value={<span className="break-all">{session.mesh_node_id}</span>} />
              <DetailRow label="Solicitado em" value={formatDate(session.requested_at)} />
              <DetailRow label="Aberto em" value={formatDate(session.opened_at)} />
              <DetailRow label="Chamado" value={session.ticket_id ? `#${session.ticket_id}` : "Não informado"} />
              <DetailRow
                label="Inventário"
                value={
                  session.asset
                    ? `#${session.asset.id} · ${session.asset.serial_number || session.asset.display_name}`
                    : "Não vinculado"
                }
              />
              <DetailRow
                label="URL temporária"
                value={expiresIn ? `Expira em aproximadamente ${Math.round(expiresIn / 60)} min` : "Ainda não gerada"}
              />
              <DetailRow label="Motivo" value={<span className="whitespace-pre-wrap leading-6">{session.reason}</span>} />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
