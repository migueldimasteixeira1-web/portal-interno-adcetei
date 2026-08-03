import Link from "next/link";
import { ReactNode } from "react";
import { Clock3, Computer, LoaderCircle, MonitorCog } from "lucide-react";
import { Button, buttonStyles, Card, DetailRow, Field, SectionHeader, Select } from "@/components/ui";
import { assetTypeLabels, formatDate, priorityLabels, priorityOptions, roleLabels, statusLabels } from "@/lib/format";
import type { AssetTicketOption, Ticket, User } from "@/lib/types";

export type TicketAction = {
  key: string;
  label: string;
  icon: ReactNode;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
};

type Props = {
  ticket: Ticket;
  staff: User[];
  assets: AssetTicketOption[];
  draft: Record<string, string>;
  overdue: boolean;
  isUserProfile: boolean;
  isFinalStatus: boolean;
  canChangeStatus: boolean;
  canEditAdministrativeFields: boolean;
  actions: TicketAction[];
  hasPendingChanges: boolean;
  saving: boolean;
  quickAction: string;
  remoteAccessHref?: string;
  onDraftChange: (draft: Record<string, string>) => void;
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
  actions,
  hasPendingChanges,
  saving,
  quickAction,
  remoteAccessHref,
  onDraftChange,
}: Props) {
  return (
    <aside className="space-y-4">
      <Card className="overflow-hidden xl:sticky xl:top-16">
        <SectionHeader
          title={canChangeStatus ? "Painel de atendimento" : "Dados do chamado"}
          description={canChangeStatus ? "Revise e confirme antes de salvar." : undefined}
        />
        <div className="space-y-3 p-4">
          {actions.length > 0 && (
            <div className="grid gap-2 border-b border-[var(--border-subtle)] pb-3">
              {actions.map((action) => (
                <div key={action.key}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving || !!quickAction || hasPendingChanges || action.disabled}
                    onClick={action.onClick}
                  >
                    {quickAction === action.key ? <LoaderCircle className="animate-spin" size={16} /> : action.icon}
                    {action.label}
                  </Button>
                  {action.hint && <p className="mt-1 text-xs text-[var(--muted-light)]">{action.hint}</p>}
                </div>
              ))}
              {hasPendingChanges && (
                <p className="text-xs text-[var(--muted-light)]">Salve ou desfaça as alterações pendentes antes de usar ações rápidas.</p>
              )}
            </div>
          )}
          {remoteAccessHref && (
            <div className="border-b border-[var(--border-subtle)] pb-3">
              <Link href={remoteAccessHref} className={buttonStyles({ variant: "secondary" })}>
                <MonitorCog size={16} />
                Abrir acesso remoto
              </Link>
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

          <div className="border-t border-[var(--border-subtle)] pt-2">
            <DetailRow label="Categoria" value={ticket.category} />
            <DetailRow label="Equipe" value={ticket.team} />
            <DetailRow label="Localização" value={ticket.location || "Não informada"} />
          </div>

          {ticket.asset && (
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]">
                  <Computer size={16} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">Equipamento vinculado</p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{ticket.asset.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {assetTypeLabels[ticket.asset.asset_type] || ticket.asset.asset_type}
                    {!isUserProfile && ticket.asset.manufacturer
                      ? ` · ${ticket.asset.manufacturer} ${ticket.asset.model || ""}`
                      : ""}
                  </p>
                  <p className="text-xs text-[var(--muted-light)]">
                    {!isUserProfile && `IP ${ticket.asset.ip_address || "não informado"} · `}
                    Patrimônio {ticket.asset.patrimony || "não informado"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border-subtle)] pt-2">
            <div className="mb-2 flex items-center gap-1.5">
              <Clock3 className={overdue ? "text-[var(--red-600)]" : "text-[var(--muted-light)]"} size={15} />
              <p className="text-sm font-semibold text-[var(--foreground)]">Prazos</p>
            </div>
            <DetailRow label="Última atualização" value={formatDate(ticket.updated_at)} />
            <DetailRow label="Prazo estimado" value={formatDate(ticket.due_at)} />
          </div>
        </div>
      </Card>
    </aside>
  );
}
