"use client";

import { CircleOff, LoaderCircle, MonitorCog, Play, Search, ShieldCheck, Wifi, WifiOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ListPagination from "@/components/ListPagination";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, SectionHeader, Select, Textarea, Toolbar } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { openRemoteViewerTabFromGesture, storeRemoteSessionLaunch } from "@/lib/remote-session-storage";
import type { RemoteAccessDevice } from "@/lib/types";

type FilterState = {
  search: string;
  status: string;
};

type Props = {
  devices: RemoteAccessDevice[];
  total: number;
  page: number;
  totalPages: number;
  updating: boolean;
  hasFilters: boolean;
  filters: FilterState;
  canConnect: boolean;
  defaultTicketId?: string;
  defaultAssetId?: string;
  onFiltersChange: (changes: Partial<FilterState>) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onError: (message: string) => void;
};

function statusBadge(device: RemoteAccessDevice) {
  return device.online
    ? <Badge className="border border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[var(--teal-600)]"><Wifi size={13} />Online</Badge>
    : <Badge className="border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]"><WifiOff size={13} />Offline</Badge>;
}

function nodeLabel(nodeId: string) {
  if (nodeId.length <= 18) return nodeId;
  return `${nodeId.slice(0, 8)}…${nodeId.slice(-6)}`;
}

export default function RemoteAccessPanels({
  devices,
  total,
  page,
  totalPages,
  updating,
  hasFilters,
  filters,
  canConnect,
  defaultTicketId,
  defaultAssetId,
  onFiltersChange,
  onClearFilters,
  onPageChange,
  onError,
}: Props) {
  const router = useRouter();
  const [selectedDevice, setSelectedDevice] = useState<RemoteAccessDevice | null>(null);
  const [reason, setReason] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [creating, setCreating] = useState(false);
  const autoOpenHandled = useRef(false);
  const selectedAssetId = selectedDevice?.asset?.id ? String(selectedDevice.asset.id) : "";

  const confirmDisabled = useMemo(() => reason.trim().length < 10, [reason]);

  const openDialog = (device: RemoteAccessDevice) => {
    setSelectedDevice(device);
    setReason("");
    setTicketId(defaultTicketId || "");
    setAssetId(device.asset?.id ? String(device.asset.id) : defaultAssetId || "");
  };

  useEffect(() => {
    if (autoOpenHandled.current || !defaultAssetId || !canConnect || !devices.length) return;
    autoOpenHandled.current = true;
    const matches = devices.filter((device) => String(device.asset?.id ?? "") === defaultAssetId);
    if (matches.length === 1 && matches[0].online) openDialog(matches[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, defaultAssetId, canConnect]);

  const createSession = async () => {
    if (!selectedDevice) return;
    const viewerTab = window.open("about:blank", "_blank");
    setCreating(true);
    onError("");
    try {
      const result = await api.connectRemoteSession({
        node_id: selectedDevice.node_id,
        reason: reason.trim(),
        ticket_id: ticketId ? Number(ticketId) : null,
        asset_id: assetId ? Number(assetId) : null,
        access_mode: "desktop",
      });
      storeRemoteSessionLaunch(result.session.id, result.embed_url, result.expires_in_seconds);
      openRemoteViewerTabFromGesture(result.embed_url, viewerTab);
      setSelectedDevice(null);
      router.push(`/acesso-remoto/sessoes/${result.session.id}`);
    } catch (err) {
      viewerTab?.close();
      onError(err instanceof Error ? err.message : "Não foi possível iniciar a sessão remota.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Toolbar className="mb-4">
        <div className="grid w-full gap-2 md:grid-cols-[minmax(240px,1fr)_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" size={16} />
            <Input
              aria-label="Buscar computadores"
              className="pl-8"
              placeholder="Buscar por nome, grupo, IP ou sistema"
              value={filters.search}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
            />
          </div>
          <Select aria-label="Filtrar por conexão" value={filters.status} onChange={(event) => onFiltersChange({ status: event.target.value })}>
            <option value="">Todos os status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </Select>
          {hasFilters && <Button type="button" variant="ghost" onClick={onClearFilters} aria-label="Limpar filtros"><X size={16} /></Button>}
        </div>
      </Toolbar>

      <Card className="relative overflow-hidden" aria-busy={updating}>
        {updating && (
          <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-[var(--status-blue-border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--primary-hover)] shadow-sm">
            <LoaderCircle className="animate-spin" size={13} /> Atualizando
          </div>
        )}
        <SectionHeader
          title={`${total} ${total === 1 ? "computador encontrado" : "computadores encontrados"}`}
          description={hasFilters ? "Resultado dos filtros aplicados no MeshCentral." : "Computadores gerenciados pelo MeshCentral."}
        />
        <div className="overflow-x-auto soft-scrollbar">
          <table className="data-table min-w-[1080px]">
            <thead>
              <tr>
                <th>Computador</th>
                <th>Status</th>
                <th>Grupo</th>
                <th>IP</th>
                <th>Sistema</th>
                <th>Inventário</th>
                <th>Última comunicação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.node_id}>
                  <td>
                    <p className="font-semibold text-[var(--foreground)]">{device.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted-light)]">ID {nodeLabel(device.node_id)}</p>
                  </td>
                  <td>{statusBadge(device)}</td>
                  <td className="text-[var(--muted)]">{device.group_name || device.group_id || "Não informado"}</td>
                  <td className="text-[var(--muted)]">{device.ip_address || "—"}</td>
                  <td className="text-[var(--muted)]">{device.operating_system || "—"}</td>
                  <td>
                    {device.asset ? (
                      <div>
                        <p className="font-medium text-[var(--foreground)]">#{device.asset.id} · {device.asset.serial_number || "Sem série"}</p>
                        <p className="mt-0.5 max-w-[260px] truncate text-xs text-[var(--muted-light)]">{device.asset.display_name}</p>
                      </div>
                    ) : (
                      <span className="text-[var(--muted-light)]">Não vinculado</span>
                    )}
                  </td>
                  <td className="text-[var(--muted)]">{formatDate(device.last_seen_at)}</td>
                  <td>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canConnect || !device.online}
                      onClick={() => openDialog(device)}
                      title={!device.online ? "Computador offline" : "Abrir acesso remoto"}
                    >
                      <Play size={15} />Acessar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!devices.length && (
          <EmptyState
            icon={<CircleOff size={18} />}
            title={hasFilters ? "Nenhum computador corresponde aos filtros" : "Nenhum computador retornado pelo MeshCentral"}
            description={hasFilters ? "Revise a busca ou limpe os filtros." : "Confira se o Mesh Bridge está conectado à VM do MeshCentral."}
            action={hasFilters ? <Button variant="secondary" onClick={onClearFilters}>Limpar filtros</Button> : undefined}
          />
        )}
        <ListPagination page={page} totalPages={totalPages} total={total} updating={updating} hasFilters={hasFilters} onPageChange={onPageChange} />
      </Card>

      <ConfirmDialog
        open={Boolean(selectedDevice)}
        title="Autorizar acesso remoto"
        description={selectedDevice ? `A sessão será registrada para ${selectedDevice.name}.` : undefined}
        confirmLabel="Conectar"
        loading={creating}
        confirmDisabled={confirmDisabled}
        onOpenChange={(open) => !open && setSelectedDevice(null)}
        onConfirm={() => void createSession()}
      >
        <div className="space-y-4">
          {selectedDevice && (
            <Alert tone="info">
              <div className="space-y-1">
                <p className="font-semibold">{selectedDevice.name}</p>
                <p className="text-xs">O Portal vai liberar somente a visualização de área de trabalho. Terminal, arquivos e administração ficam fora deste MVP.</p>
              </div>
            </Alert>
          )}
          <Field label="Motivo do acesso" help="Descreva o atendimento ou a correção. Mínimo de 10 caracteres.">
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: Atender chamado de falha no sistema de protocolo." />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Chamado relacionado" help="Opcional. Informe somente o número.">
              <Input type="number" min="1" value={ticketId} onChange={(event) => setTicketId(event.target.value)} placeholder="Ex.: 1248" />
            </Field>
            <Field label="Equipamento no inventário" help={selectedAssetId ? "Preenchido pelo vínculo existente." : "Opcional. Pode ser vinculado depois."}>
              <Input type="number" min="1" value={assetId} onChange={(event) => setAssetId(event.target.value)} placeholder="ID do inventário" />
            </Field>
          </div>
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3 text-xs leading-5 text-[var(--muted)]">
            <p className="flex items-center gap-2 font-semibold text-[var(--foreground)]"><ShieldCheck size={14} />Registro obrigatório</p>
            <p className="mt-1">A autorização, abertura e encerramento da sessão ficam na auditoria administrativa do Portal.</p>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
