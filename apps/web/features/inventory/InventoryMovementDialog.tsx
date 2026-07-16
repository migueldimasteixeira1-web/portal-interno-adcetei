import { Alert, ConfirmDialog, Field, Input, Select, Textarea } from "@/components/ui";
import type { InventorySector, User } from "@/lib/types";
import { sectorWithSecretariat, type MovementAction, type MovementDraft, movementActionTitle } from "./inventory-utils";

type Props = {
  open: boolean;
  action: MovementAction | null;
  draft: MovementDraft;
  saving: boolean;
  canViewUsers: boolean;
  requiredMissing: boolean;
  sectorOptions: InventorySector[];
  userOptions: User[];
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onDraftChange: (draft: MovementDraft) => void;
};

export default function InventoryMovementDialog({
  open,
  action,
  draft,
  saving,
  canViewUsers,
  requiredMissing,
  sectorOptions,
  userOptions,
  onOpenChange,
  onConfirm,
  onDraftChange,
}: Props) {
  const selectedSectorId = Number(draft.sector_id || 0);
  const responsibleOptions = userOptions.filter((item) => !selectedSectorId || item.department_sector_id === selectedSectorId);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      loading={saving}
      title={action ? movementActionTitle[action] : ""}
      description="Informe a data operacional e uma observação curta para manter o histórico auditável."
      confirmLabel="Registrar movimentação"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {action === "move" && (
          <>
            <Field label="Setor destino">
              <Select value={draft.sector_id} onChange={(event) => onDraftChange({ ...draft, sector_id: event.target.value, assigned_user_id: "" })}>
                <option value="">Selecione</option>
                {sectorOptions.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sectorWithSecretariat(sector)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Responsável" help={!canViewUsers ? "Seu perfil não possui acesso à lista de usuários." : "Opcional. Lista limitada ao setor selecionado."}>
              <Select disabled={!canViewUsers || !draft.sector_id} value={draft.assigned_user_id} onChange={(event) => onDraftChange({ ...draft, assigned_user_id: event.target.value })}>
                <option value="">Não vinculado</option>
                {responsibleOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name} · {item.department}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <Field label="Data da movimentação">
          <Input type="date" value={draft.movement_date} onChange={(event) => onDraftChange({ ...draft, movement_date: event.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Observação">
            <Textarea value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} placeholder="Motivo ou contexto da movimentação." />
          </Field>
        </div>
        {requiredMissing && <Alert tone="warning" className="sm:col-span-2">Preencha os campos obrigatórios antes de registrar.</Alert>}
      </div>
    </ConfirmDialog>
  );
}
