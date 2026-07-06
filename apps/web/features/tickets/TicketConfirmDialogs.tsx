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
      <div className="divide-y divide-[#e8edf2] rounded-md border border-[#d4dbe4]">
        {changes.map((change) => (
          <div key={change.field} className="p-3 text-sm">
            <p className="font-semibold text-[#1a2332]">{change.label}</p>
            <p className="mt-1 text-[#5c6b7e]">
              <span className="line-through decoration-[#8b97a8]">{change.from}</span>
              <span className="mx-2 text-[#8b97a8]">→</span>
              <span className="font-medium text-[#1a5f9e]">{change.to}</span>
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
        className="bg-white"
      />
      {!ticket.assignee && <Alert tone="warning" className="mt-3">Atribua um responsável antes de encerrar o chamado.</Alert>}
      {resolutionMessage.trim().length < 2 && (
        <p className="mt-2 text-xs text-[#8b97a8]">A mensagem de encerramento é obrigatória.</p>
      )}
    </ConfirmDialog>
  );
}
