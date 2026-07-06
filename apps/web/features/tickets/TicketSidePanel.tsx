import { CheckCircle2, Clock3, Computer, LoaderCircle, UserPlus } from "lucide-react";
import { Button, Card, DetailRow, Field, SectionHeader, Select } from "@/components/ui";
import { assetTypeLabels, formatDate, priorityLabels, priorityOptions, roleLabels, statusLabels } from "@/lib/format";
import type { Asset, Ticket, User } from "@/lib/types";

type Props = {
  ticket: Ticket;
  staff: User[];
  assets: Asset[];
  draft: Record<string, string>;
  overdue: boolean;
  isUserProfile: boolean;
  isFinalStatus: boolean;
  canChangeStatus: boolean;
  canEditAdministrativeFields: boolean;
  canQuickAssign: boolean;
  canQuickClose: boolean;
  canCloseNow: boolean;
  hasPendingChanges: boolean;
  saving: boolean;
  quickAction: string;
  onDraftChange: (draft: Record<string, string>) => void;
  onQuickAssign: () => void;
  onQuickClose: () => void;
};

export default function TicketSidePanel({
  ticket,
  staff,
  assets,
  draft,
  overdue,
  isUserProfile,
  isFinalStatus,
  canChangeStatus,
  canEditAdministrativeFields,
  canQuickAssign,
  canQuickClose,
  canCloseNow,
  hasPendingChanges,
  saving,
  quickAction,
  onDraftChange,
  onQuickAssign,
  onQuickClose,
}: Props) {
  return (
    <aside className="space-y-4">
      <Card className="overflow-hidden xl:sticky xl:top-16">
        <SectionHeader
          title={canChangeStatus ? "Painel de atendimento" : "Dados do chamado"}
          description={canChangeStatus ? "Revise e confirme antes de salvar." : undefined}
        />
        <div className="space-y-3 p-4">
          {(canQuickAssign || canQuickClose) && (
            <div className="grid gap-2 border-b border-[#e8edf2] pb-3">
              {canQuickAssign && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving || !!quickAction || hasPendingChanges}
                  onClick={onQuickAssign}
                >
                  {quickAction === "assign" ? <LoaderCircle className="animate-spin" size={16} /> : <UserPlus size={16} />}
                  Atribuir a mim
                </Button>
              )}
              {canQuickClose && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving || !!quickAction || hasPendingChanges || !canCloseNow}
                  onClick={onQuickClose}
                >
                  <CheckCircle2 size={16} />
                  Encerrar chamado
                </Button>
              )}
              {hasPendingChanges && (
                <p className="text-xs text-[#8b97a8]">Salve ou desfaça as alterações pendentes antes de usar ações rápidas.</p>
              )}
              {canQuickClose && !ticket.assignee && (
                <p className="text-xs text-[#8b97a8]">Atribua um responsável antes de encerrar.</p>
              )}
            </div>
          )}
          {canEditAdministrativeFields ? (
            <>
              <DetailRow label="Status" value={statusLabels[ticket.status] || ticket.status} />
              <Field label="Responsável">
                <Select
                  disabled={isFinalStatus}
                  value={draft.assignee_id || ""}
                  onChange={(e) => onDraftChange({ ...draft, assignee_id: e.target.value })}
                >
                  <option value="">Sem responsável</option>
                  {staff.map((member) => (
                    <option key={member.id} value={String(member.id)}>
                      {member.full_name} · {roleLabels[member.role]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Prioridade">
                <Select
                  disabled={isFinalStatus}
                  value={draft.priority || "medium"}
                  onChange={(e) => onDraftChange({ ...draft, priority: e.target.value })}
                >
                  {priorityOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Equipamento">
                <Select
                  disabled={isFinalStatus}
                  value={draft.asset_id || ""}
                  onChange={(e) => onDraftChange({ ...draft, asset_id: e.target.value })}
                >
                  <option value="">Nenhum equipamento</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={String(asset.id)}>
                      {asset.name} · {asset.patrimony || "sem patrimônio"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Localização">
                <Select
                  disabled={isFinalStatus}
                  value={draft.location || ""}
                  onChange={(e) => onDraftChange({ ...draft, location: e.target.value })}
                >
                  <option value="">Não informada</option>
                  <option value="SEDECON - SEGTEA">SEDECON - SEGTEA</option>
                  <option value="Administração - RH">Administração - RH</option>
                  <option value="Fazenda - Atendimento">Fazenda - Atendimento</option>
                  <option value="Oficina de TI">Oficina de TI</option>
                  <option value="Datacenter - Sede">Datacenter - Sede</option>
                </Select>
              </Field>
            </>
          ) : canChangeStatus ? (
            <>
              <DetailRow label="Status" value={statusLabels[ticket.status] || ticket.status} />
              <DetailRow label="Responsável" value={ticket.assignee?.full_name || "Aguardando atribuição"} />
              <DetailRow label="Prioridade" value={priorityLabels[ticket.priority] || ticket.priority} />
            </>
          ) : (
            <>
              <DetailRow label="Status" value={statusLabels[ticket.status] || ticket.status} />
              <DetailRow label="Responsável" value={ticket.assignee?.full_name || "Aguardando atribuição"} />
              <DetailRow label="Prioridade" value="Definida pela equipe de TI" />
            </>
          )}

          <div className="border-t border-[#e8edf2] pt-2">
            <DetailRow label="Categoria" value={ticket.category} />
            <DetailRow label="Equipe" value={ticket.team} />
            <DetailRow label="Localização" value={ticket.location || "Não informada"} />
          </div>

          {ticket.asset && (
            <div className="rounded-md border border-[#d4dbe4] bg-[#f7f9fb] p-3">
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#d4dbe4] bg-white text-[#5c6b7e]">
                  <Computer size={16} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8b97a8]">Equipamento vinculado</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#1a2332]">{ticket.asset.name}</p>
                  <p className="mt-0.5 text-xs text-[#5c6b7e]">
                    {assetTypeLabels[ticket.asset.asset_type] || ticket.asset.asset_type}
                    {!isUserProfile && ticket.asset.manufacturer
                      ? ` · ${ticket.asset.manufacturer} ${ticket.asset.model || ""}`
                      : ""}
                  </p>
                  <p className="text-xs text-[#8b97a8]">
                    {!isUserProfile && `IP ${ticket.asset.ip_address || "não informado"} · `}
                    Patrimônio {ticket.asset.patrimony || "não informado"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-[#e8edf2] pt-2">
            <div className="mb-2 flex items-center gap-1.5">
              <Clock3 className={overdue ? "text-[#b91c1c]" : "text-[#8b97a8]"} size={15} />
              <p className="text-sm font-semibold text-[#1a2332]">Prazos</p>
            </div>
            <DetailRow label="Última atualização" value={formatDate(ticket.updated_at)} />
            <DetailRow label="Prazo estimado" value={formatDate(ticket.due_at)} />
          </div>
        </div>
      </Card>
    </aside>
  );
}
