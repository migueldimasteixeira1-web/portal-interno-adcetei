import { Alert, ConfirmDialog, Field, Input, Select, Textarea } from "@/components/ui";
import { type RetireDraft, inventoryRetirementReasonOptions } from "./inventory-utils";

type Props = {
  open: boolean;
  draft: RetireDraft;
  saving: boolean;
  isAdmin: boolean;
  requiredMissing: boolean;
  justificationTooShort: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onDraftChange: (draft: RetireDraft) => void;
};

export default function InventoryRetireDialog({
  open,
  draft,
  saving,
  isAdmin,
  requiredMissing,
  justificationTooShort,
  onOpenChange,
  onConfirm,
  onDraftChange,
}: Props) {
  const reasonOptions = inventoryRetirementReasonOptions.filter(
    (item) => isAdmin || item.key !== "CORRECAO_ADMINISTRATIVA",
  );

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      loading={saving}
      title="Dar baixa no equipamento"
      description="Esta ação remove o equipamento do inventário ativo, mas mantém o registro, histórico e auditoria. Confirme somente se a baixa for definitiva."
      confirmLabel="Confirmar baixa"
    >
      <div className="grid gap-4">
        <Alert tone="warning">
          Esta ação retira o equipamento do inventário ativo, mas mantém seu histórico. Confirme somente se a baixa for definitiva.
        </Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Motivo da baixa">
            <Select value={draft.reason} onChange={(event) => onDraftChange({ ...draft, reason: event.target.value as RetireDraft["reason"] })}>
              <option value="">Selecione</option>
              {reasonOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data da baixa">
            <Input type="date" value={draft.movement_date} onChange={(event) => onDraftChange({ ...draft, movement_date: event.target.value })} />
          </Field>
        </div>
        <Field label="Justificativa" help="Mínimo de 10 caracteres. Descreva por que o equipamento sai do inventário ativo.">
          <Textarea
            value={draft.justification}
            onChange={(event) => onDraftChange({ ...draft, justification: event.target.value })}
            placeholder="Ex.: Equipamento com placa-mãe queimada, sem viabilidade de reparo."
            rows={4}
          />
        </Field>
        <Field label="Observações" help="Opcional. Complementos operacionais da baixa.">
          <Textarea
            value={draft.notes}
            onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })}
            placeholder="Informações adicionais, se necessário."
            rows={2}
          />
        </Field>
        {requiredMissing && <Alert tone="warning">Selecione o motivo, a data e preencha a justificativa antes de confirmar.</Alert>}
        {!requiredMissing && justificationTooShort && <Alert tone="warning">A justificativa deve ter pelo menos 10 caracteres.</Alert>}
      </div>
    </ConfirmDialog>
  );
}
