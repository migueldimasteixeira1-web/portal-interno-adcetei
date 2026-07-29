"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Hourglass, PlayCircle, RotateCcw, UserPlus, XCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button } from "@/components/ui";
import TicketCommentSection from "@/features/tickets/TicketCommentSection";
import {
  TicketChangesDialog,
  TicketCloseDialog,
  TicketReasonDialog,
  TicketResolveDialog,
} from "@/features/tickets/TicketConfirmDialogs";
import TicketDetailHeader from "@/features/tickets/TicketDetailHeader";
import TicketRequestCard from "@/features/tickets/TicketRequestCard";
import TicketSidePanel, { type TicketAction } from "@/features/tickets/TicketSidePanel";
import { api } from "@/lib/api";
import { priorityLabels } from "@/lib/format";
import type { Asset, Ticket, User } from "@/lib/types";

const REOPEN_WINDOW_DAYS = 7;

function canReopenTicket(ticket: Ticket): boolean {
  if (!["resolved", "closed", "cancelled"].includes(ticket.status)) return false;
  if (ticket.status === "resolved" || !ticket.closed_at) return true;
  const days = (Date.now() - new Date(ticket.closed_at).getTime()) / 86400000;
  return days <= REOPEN_WINDOW_DAYS;
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [waitDialogOpen, setWaitDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [resolutionMessage, setResolutionMessage] = useState("");
  const [resolveMessage, setResolveMessage] = useState("");
  const [waitReason, setWaitReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [quickAction, setQuickAction] = useState("");

  const load = async () => {
    try {
      const current = await api.ticket(params.id);
      setTicket(current);
      setDraft({
        priority: current.priority,
        assignee_id: current.assignee?.id ? String(current.assignee.id) : "",
        asset_id: current.asset?.id ? String(current.asset.id) : "",
        location: current.location || "",
      });
      if (user?.permissions.includes("tickets.triage")) {
        const [users, assetList] = await Promise.all([
          user.permissions.includes("users.view") ? api.users() : Promise.resolve([]),
          user.permissions.includes("assets.view") ? api.assets() : Promise.resolve([]),
        ]);
        setStaff(users.filter((item) => item.role !== "user"));
        setAssets(assetList);
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar chamado");
    }
  };

  useEffect(() => { if (user) void load(); }, [params.id, user?.id]);

  const canEditAdministrativeFields = !!user?.permissions.includes("tickets.triage");
  const canChangeStatus = canEditAdministrativeFields || user?.role === "technician";
  const canAddInternalNote = !!user?.permissions.includes("tickets.internal_notes");

  const changes = useMemo(() => {
    if (!ticket) return [];
    const list: Array<{ label: string; from: string; to: string; field: string }> = [];
    const assigneeName = (id: string) => staff.find((item) => String(item.id) === id)?.full_name || "Sem responsável";
    const assetName = (id: string) => assets.find((item) => String(item.id) === id)?.name || "Nenhum";
    if (canEditAdministrativeFields) {
      if (draft.priority && draft.priority !== ticket.priority) {
        list.push({
          label: "Prioridade",
          from: priorityLabels[ticket.priority] || ticket.priority,
          to: priorityLabels[draft.priority] || draft.priority,
          field: "priority",
        });
      }
      const oldAssignee = ticket.assignee?.id ? String(ticket.assignee.id) : "";
      if (draft.assignee_id !== oldAssignee) {
        list.push({
          label: "Responsável",
          from: assigneeName(oldAssignee),
          to: assigneeName(draft.assignee_id || ""),
          field: "assignee_id",
        });
      }
      const oldAsset = ticket.asset?.id ? String(ticket.asset.id) : "";
      if (draft.asset_id !== oldAsset) {
        list.push({
          label: "Equipamento",
          from: assetName(oldAsset),
          to: assetName(draft.asset_id || ""),
          field: "asset_id",
        });
      }
      if ((draft.location || "") !== (ticket.location || "")) {
        list.push({
          label: "Localização",
          from: ticket.location || "Não informada",
          to: draft.location || "Não informada",
          field: "location",
        });
      }
    }
    return list;
  }, [assets, canEditAdministrativeFields, draft, staff, ticket]);

  const saveChanges = async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      changes.forEach((change) => {
        if (change.field === "assignee_id" || change.field === "asset_id") {
          payload[change.field] = draft[change.field] ? Number(draft[change.field]) : null;
        } else {
          payload[change.field] = draft[change.field];
        }
      });
      if (payload.assignee_id && ticket.status === "new" && !payload.status) payload.status = "assigned";
      await api.updateTicket(ticket.id, payload);
      setConfirmOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const sendComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!ticket || !comment.trim()) return;
    setSaving(true);
    try {
      await api.addComment(ticket.id, comment, internal);
      setComment("");
      setInternal(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar mensagem");
    } finally {
      setSaving(false);
    }
  };

  const runQuickAction = async (payload: Record<string, unknown>, key: string) => {
    if (!ticket) return;
    setQuickAction(key);
    setError("");
    try {
      await api.updateTicket(ticket.id, payload);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o chamado");
    } finally {
      setQuickAction("");
    }
  };

  const closeTicket = async () => {
    const message = resolutionMessage.trim();
    if (!message) return;
    await runQuickAction({ status: "closed", resolution_message: message }, "close");
    setCloseConfirmOpen(false);
    setResolutionMessage("");
  };

  const resolveTicket = async () => {
    const message = resolveMessage.trim();
    if (!message) return;
    await runQuickAction({ status: "resolved", resolution_message: message }, "resolve");
    setResolveDialogOpen(false);
    setResolveMessage("");
  };

  const waitForRequester = async () => {
    if (!ticket) return;
    setQuickAction("wait");
    setError("");
    try {
      await api.updateTicket(ticket.id, { status: "waiting_requester" });
      const reason = waitReason.trim();
      if (reason) await api.addComment(ticket.id, reason, false);
      setWaitDialogOpen(false);
      setWaitReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o chamado");
    } finally {
      setQuickAction("");
    }
  };

  const cancelTicket = async () => {
    if (!ticket) return;
    setQuickAction("cancel");
    setError("");
    try {
      await api.updateTicket(ticket.id, { status: "cancelled" });
      const reason = cancelReason.trim();
      if (reason) await api.addComment(ticket.id, reason, false);
      setCancelDialogOpen(false);
      setCancelReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cancelar o chamado");
    } finally {
      setQuickAction("");
    }
  };

  if (!ticket || !user) {
    if (error) {
      return (
        <div className="mx-auto max-w-2xl py-12">
          <Alert tone="danger">{error}</Alert>
          <Button variant="secondary" className="mt-4" onClick={() => router.push("/chamados")}>
            <ArrowLeft size={16} /> Voltar aos chamados
          </Button>
        </div>
      );
    }
    return <LoadingScreen label="Abrindo chamado..." />;
  }

  const overdue =
    ticket.due_at &&
    new Date(ticket.due_at) < new Date() &&
    !["closed", "cancelled", "resolved", "waiting_requester"].includes(ticket.status);
  const isUserProfile = user.role === "user";
  const isFinalStatus = ticket.status === "closed" || ticket.status === "cancelled";
  const hasPendingChanges = changes.length > 0;
  const hasAssignee = Boolean(ticket.assignee);
  const isRequester = ticket.requester.id === user.id;
  const willReopenOnReply = isRequester && canReopenTicket(ticket);
  const formFieldLabels = Object.fromEntries(
    (ticket.form_schema_snapshot?.fields || []).map((field) => [field.key, field.label]),
  );

  const actions: TicketAction[] = [];
  if (canEditAdministrativeFields && !isFinalStatus && ticket.assignee?.id !== user.id) {
    actions.push({
      key: "assign",
      label: "Atribuir a mim",
      icon: <UserPlus size={16} />,
      onClick: () => void runQuickAction({ assignee_id: user.id }, "assign"),
    });
  }
  if (canChangeStatus && ticket.status === "assigned") {
    actions.push({
      key: "start",
      label: "Iniciar atendimento",
      icon: <PlayCircle size={16} />,
      onClick: () => void runQuickAction({ status: "in_progress" }, "start"),
    });
  }
  if (canChangeStatus && ["assigned", "in_progress"].includes(ticket.status)) {
    actions.push({
      key: "wait",
      label: "Aguardar solicitante",
      icon: <Hourglass size={16} />,
      onClick: () => setWaitDialogOpen(true),
    });
  }
  if (canChangeStatus && ticket.status === "waiting_requester") {
    actions.push({
      key: "resume",
      label: "Retomar atendimento",
      icon: <PlayCircle size={16} />,
      onClick: () => void runQuickAction({ status: "in_progress" }, "resume"),
    });
  }
  if (canChangeStatus && ["assigned", "in_progress", "waiting_requester"].includes(ticket.status)) {
    actions.push({
      key: "resolve",
      label: "Marcar como resolvido",
      icon: <ClipboardCheck size={16} />,
      disabled: !hasAssignee,
      hint: !hasAssignee ? "Atribua um responsável antes de resolver." : undefined,
      onClick: () => setResolveDialogOpen(true),
    });
    actions.push({
      key: "close",
      label: "Encerrar chamado",
      icon: <CheckCircle2 size={16} />,
      disabled: !hasAssignee,
      hint: !hasAssignee ? "Atribua um responsável antes de encerrar." : undefined,
      onClick: () => setCloseConfirmOpen(true),
    });
    actions.push({
      key: "cancel",
      label: "Cancelar chamado",
      icon: <XCircle size={16} />,
      onClick: () => setCancelDialogOpen(true),
    });
  }
  if (canChangeStatus && ticket.status === "resolved") {
    actions.push({
      key: "confirm_close",
      label: "Confirmar encerramento",
      icon: <CheckCircle2 size={16} />,
      onClick: () => void runQuickAction({ status: "closed" }, "confirm_close"),
    });
    actions.push({
      key: "reopen_resolved",
      label: "Reabrir chamado",
      icon: <RotateCcw size={16} />,
      onClick: () => void runQuickAction({ status: "assigned" }, "reopen_resolved"),
    });
  }
  if (canChangeStatus && ["closed", "cancelled"].includes(ticket.status) && canReopenTicket(ticket)) {
    actions.push({
      key: "reopen",
      label: "Reabrir chamado",
      icon: <RotateCcw size={16} />,
      onClick: () => void runQuickAction({ status: "assigned" }, "reopen"),
    });
  }

  return (
    <>
      <button
        onClick={() => router.push("/chamados")}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--primary)]"
      >
        <ArrowLeft size={16} /> Voltar aos chamados
      </button>

      <TicketDetailHeader
        ticket={ticket}
        isUserProfile={isUserProfile}
        overdue={!!overdue}
        canChangeStatus={canChangeStatus}
        isFinalStatus={isFinalStatus}
        changes={changes}
        onSaveClick={() => setConfirmOpen(true)}
      />

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {changes.length > 0 && (
        <Alert tone="warning" className="mb-4">
          <strong className="font-semibold">Alterações pendentes.</strong> Revise os campos e use &ldquo;Salvar alterações&rdquo; para confirmar.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <TicketRequestCard ticket={ticket} formFieldLabels={formFieldLabels} />
          <TicketCommentSection
            ticket={ticket}
            user={user}
            comment={comment}
            internal={internal}
            saving={saving}
            canAddInternalNote={canAddInternalNote}
            isUserProfile={isUserProfile}
            willReopenOnReply={willReopenOnReply}
            onCommentChange={setComment}
            onInternalChange={setInternal}
            onSubmit={sendComment}
          />
        </div>

        <TicketSidePanel
          ticket={ticket}
          staff={staff}
          assets={assets}
          draft={draft}
          overdue={!!overdue}
          isUserProfile={isUserProfile}
          isFinalStatus={isFinalStatus}
          canChangeStatus={canChangeStatus}
          canEditAdministrativeFields={canEditAdministrativeFields}
          actions={actions}
          hasPendingChanges={hasPendingChanges}
          saving={saving}
          quickAction={quickAction}
          onDraftChange={setDraft}
        />
      </div>

      <TicketChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        changes={changes}
        saving={saving}
        onConfirm={saveChanges}
      />
      <TicketCloseDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        ticket={ticket}
        resolutionMessage={resolutionMessage}
        quickAction={quickAction}
        onResolutionMessageChange={setResolutionMessage}
        onConfirm={closeTicket}
      />
      <TicketResolveDialog
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        ticket={ticket}
        resolutionMessage={resolveMessage}
        quickAction={quickAction}
        onResolutionMessageChange={setResolveMessage}
        onConfirm={resolveTicket}
      />
      <TicketReasonDialog
        open={waitDialogOpen}
        onOpenChange={setWaitDialogOpen}
        title="Aguardar retorno do solicitante?"
        description="O prazo do chamado é pausado enquanto ele estiver aguardando o solicitante."
        confirmLabel="Aguardar solicitante"
        placeholder="Ex.: Precisamos que o solicitante confirme o horário disponível para a visita técnica."
        reason={waitReason}
        loading={quickAction === "wait"}
        onReasonChange={setWaitReason}
        onConfirm={waitForRequester}
      />
      <TicketReasonDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancelar chamado?"
        description="O chamado será marcado como cancelado e pode ser reaberto em até 7 dias, se necessário."
        confirmLabel="Cancelar chamado"
        placeholder="Ex.: Solicitação duplicada do chamado #0123."
        reason={cancelReason}
        loading={quickAction === "cancel"}
        onReasonChange={setCancelReason}
        onConfirm={cancelTicket}
      />
    </>
  );
}
