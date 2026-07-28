import { Alert, ConfirmDialog, Textarea } from "@/components/ui";
import type { TicketChange } from "./TicketDetailHeader";

type ChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: TicketChange[];
  saving: boolean;
  onConfirm: () => void;
};

export function TicketChangesDialog({ open, onOpenChange, changes, saving, onConfirm }: ChangesDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Confirmar alterações do chamado?"
      description="Revise o resumo abaixo. As mudanças serão registradas no histórico após a confirmação."
      confirmLabel="Confirmar e salvar"
      loading={saving}
      onConfirm={onConfirm}
    >
      <div className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border)]">
        {changes.map((change) => (
          <div key={change.field} className="p-3 text-sm">
            <p className="font-semibold text-[var(--foreground)]">{change.label}</p>
            <p className="mt-1 text-[var(--muted)]">
              <span className="line-through decoration-[var(--muted-light)]">{change.from}</span>
              <span className="mx-2 text-[var(--muted-light)]">→</span>
              <span className="font-medium text-[var(--primary)]">{change.to}</span>
            </p>
          </div>
        ))}
      </div>
    </ConfirmDialog>
  );
}

type CloseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: { assignee?: { full_name: string } | null };
  resolutionMessage: string;
  quickAction: string;
  onResolutionMessageChange: (value: string) => void;
  onConfirm: () => void;
};

export function TicketCloseDialog({
  open,
  onOpenChange,
  ticket,
  resolutionMessage,
  quickAction,
  onResolutionMessageChange,
  onConfirm,
}: CloseDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Encerrar chamado?"
      description="Informe uma mensagem de encerramento para registrar o fechamento e orientar o solicitante."
      confirmLabel="Encerrar chamado"
      loading={quickAction === "close"}
      confirmDisabled={!ticket.assignee || resolutionMessage.trim().length < 2}
      onConfirm={onConfirm}
    >
      <Textarea
        aria-label="Mensagem de encerramento"
        value={resolutionMessage}
        onChange={(event) => onResolutionMessageChange(event.target.value)}
        placeholder="Ex.: Atendimento realizado, conexão normalizada e serviço validado com o setor."
        className="bg-[var(--card)]"
      />
      {!ticket.assignee && <Alert tone="warning" className="mt-3">Atribua um responsável antes de encerrar o chamado.</Alert>}
      {resolutionMessage.trim().length < 2 && (
        <p className="mt-2 text-xs text-[var(--muted-light)]">A mensagem de encerramento é obrigatória.</p>
      )}
    </ConfirmDialog>
  );
}
