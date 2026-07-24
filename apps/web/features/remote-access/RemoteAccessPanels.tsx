"use client";

import { CircleOff, LoaderCircle, MonitorCog, Play, Search, ShieldCheck, Wifi, WifiOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ListPagination from "@/components/ListPagination";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, SectionHeader, Select, Textarea, Toolbar } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
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
  onFiltersChange: (changes: Partial<FilterState>) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onError: (message: string) => void;
};

function statusBadge(device: RemoteAccessDevice) {
  return device.online
    ? <Badge className="border border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[var(--teal-600)]"><Wifi size={13} />Online</Badge>
    : <Badge className="border border-[#d4dbe4] bg-[#f7f9fb] text-[#5c6b7e]"><WifiOff size={13} />Offline</Badge>;
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
  const selectedAssetId = selectedDevice?.asset?.id ? String(selectedDevice.asset.id) : "";

  const confirmDisabled = useMemo(() => reason.trim().length < 10, [reason]);

  const openDialog = (device: RemoteAccessDevice) => {
    setSelectedDevice(device);
    setReason("");
    setTicketId("");
    setAssetId(device.asset?.id ? String(device.asset.id) : "");
  };

  const createSession = async () => {
    if (!selectedDevice) return;
    setCreating(true);
    onError("");
    try {
      const session = await api.createRemoteSession({
        node_id: selectedDevice.node_id,
        reason: reason.trim(),
        ticket_id: ticketId ? Number(ticketId) : null,
        asset_id: assetId ? Number(assetId) : null,
        access_mode: "desktop",
      });
      setSelectedDevice(null);
      router.push(`/acesso-remoto/sessoes/${session.id}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Não foi possível criar a sessão remota.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Toolbar className="mb-4">
        <div className="grid w-full gap-2 md:grid-cols-[minmax(240px,1fr)_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} />
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
          <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-[#c5daf0] bg-white px-2.5 py-1 text-xs font-medium text-[#164f84] shadow-sm">
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
                    <p className="font-semibold text-[#1a2332]">{device.name}</p>
                    <p className="mt-0.5 text-xs text-[#8b97a8]">ID {nodeLabel(device.node_id)}</p>
                  </td>
                  <td>{statusBadge(device)}</td>
                  <td className="text-[#5c6b7e]">{device.group_name || device.group_id || "Não informado"}</td>
                  <td className="text-[#5c6b7e]">{device.ip_address || "—"}</td>
                  <td className="text-[#5c6b7e]">{device.operating_system || "—"}</td>
                  <td>
                    {device.asset ? (
                      <div>
                        <p className="font-medium text-[#1a2332]">#{device.asset.id} · {device.asset.serial_number || "Sem série"}</p>
                        <p className="mt-0.5 max-w-[260px] truncate text-xs text-[#8b97a8]">{device.asset.display_name}</p>
                      </div>
                    ) : (
                      <span className="text-[#8b97a8]">Não vinculado</span>
                    )}
                  </td>
                  <td className="text-[#5c6b7e]">{formatDate(device.last_seen_at)}</td>
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
        confirmLabel="Criar sessão"
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
          <div className="rounded-md border border-[#e8edf2] bg-[#f7f9fb] p-3 text-xs leading-5 text-[#5c6b7e]">
            <p className="flex items-center gap-2 font-semibold text-[#1a2332]"><ShieldCheck size={14} />Registro obrigatório</p>
            <p className="mt-1">A autorização, abertura e encerramento da sessão ficam na auditoria administrativa do Portal.</p>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
