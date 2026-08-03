import { Alert, ConfirmDialog, Field, Input, Textarea } from "@/components/ui";
import { type MovementAction, type MovementDraft, movementActionTitle } from "./inventory-utils";

type Props = {
  open: boolean;
  action: MovementAction | null;
  draft: MovementDraft;
  saving: boolean;
  requiredMissing: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onDraftChange: (draft: MovementDraft) => void;
};

export default function InventoryMovementDialog({
  open,
  action,
  draft,
  saving,
  requiredMissing,
  onOpenChange,
  onConfirm,
  onDraftChange,
}: Props) {
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
