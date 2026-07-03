"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, Computer, LoaderCircle, LockKeyhole, MapPin, MessageSquareText, Save, Send, UserPlus, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import TicketTimeline from "@/components/TicketTimeline";
import UserAvatar from "@/components/UserAvatar";
import { PriorityChip, StatusChip } from "@/components/StatusChip";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Button, Card, ConfirmDialog, DetailRow, Field, SectionHeader, Select, Textarea, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { assetTypeLabels, catalogFieldLabels, formatDate, priorityLabels, priorityOptions, relativeTime, roleLabels, statusLabels } from "@/lib/format";
import type { Asset, Ticket, User } from "@/lib/types";

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
  const [resolutionMessage, setResolutionMessage] = useState("");
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
      if (draft.priority && draft.priority !== ticket.priority) list.push({ label: "Prioridade", from: priorityLabels[ticket.priority] || ticket.priority, to: priorityLabels[draft.priority] || draft.priority, field: "priority" });
      const oldAssignee = ticket.assignee?.id ? String(ticket.assignee.id) : "";
      if (draft.assignee_id !== oldAssignee) list.push({ label: "Responsável", from: assigneeName(oldAssignee), to: assigneeName(draft.assignee_id || ""), field: "assignee_id" });
      const oldAsset = ticket.asset?.id ? String(ticket.asset.id) : "";
      if (draft.asset_id !== oldAsset) list.push({ label: "Equipamento", from: assetName(oldAsset), to: assetName(draft.asset_id || ""), field: "asset_id" });
      if ((draft.location || "") !== (ticket.location || "")) list.push({ label: "Localização", from: ticket.location || "Não informada", to: draft.location || "Não informada", field: "location" });
    }
    return list;
  }, [assets, canChangeStatus, canEditAdministrativeFields, draft, staff, ticket]);

  const saveChanges = async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      changes.forEach((change) => {
        if (change.field === "assignee_id" || change.field === "asset_id") payload[change.field] = draft[change.field] ? Number(draft[change.field]) : null;
        else payload[change.field] = draft[change.field];
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

  if (!ticket || !user) {
    if (error) return (
      <div className="mx-auto max-w-2xl py-12">
        <Alert tone="danger">{error}</Alert>
        <Button variant="secondary" className="mt-4" onClick={() => router.push("/chamados")}><ArrowLeft size={16} /> Voltar aos chamados</Button>
      </div>
    );
    return <LoadingScreen label="Abrindo chamado..." />;
  }

  const overdue = ticket.due_at && new Date(ticket.due_at) < new Date() && !["closed", "cancelled"].includes(ticket.status);
  const isUserProfile = user.role === "user";
  const isFinalStatus = ticket.status === "closed" || ticket.status === "cancelled";
  const hasPendingChanges = changes.length > 0;
  const canQuickAssign = canEditAdministrativeFields && !isFinalStatus && ticket.assignee?.id !== user.id;
  const canQuickClose = canChangeStatus && !isFinalStatus;
  const canCloseNow = canQuickClose && Boolean(ticket.assignee);
  const formFieldLabels = Object.fromEntries(
    (ticket.form_schema_snapshot?.fields || []).map((field) => [field.key, field.label]),
  );

  return (
    <>
      <button onClick={() => router.push("/chamados")} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#5c6b7e] hover:text-[#1a5f9e]">
        <ArrowLeft size={16} /> Voltar aos chamados
      </button>

      <div className="mb-4 flex flex-col gap-3 border-b border-[#d4dbe4] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-[#8b97a8]">#{String(ticket.id).padStart(4, "0")}</span>
            <StatusChip status={ticket.status} />
            {!isUserProfile && <PriorityChip priority={ticket.priority} />}
            {overdue && <Badge className="border border-[#f5c2c2] bg-[#fef2f2] text-[#991b1b]">Prazo vencido</Badge>}
          </div>
          <h1 className="text-xl font-semibold text-[#1a2332] sm:text-2xl">{ticket.title}</h1>
          <p className="mt-1 text-sm text-[#5c6b7e]">Aberto por {ticket.requester.full_name} em {formatDate(ticket.created_at)}</p>
        </div>
        {canChangeStatus && (
          <Button
            className={cn(changes.length && "border-[#b45309] bg-[#b45309] hover:border-[#92400e] hover:bg-[#92400e]")}
            disabled={!changes.length || isFinalStatus}
            onClick={() => setConfirmOpen(true)}
          >
            <Save size={16} />
            {changes.length ? `Salvar ${changes.length} alteração(ões)` : "Sem alterações"}
          </Button>
        )}
      </div>

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {changes.length > 0 && (
        <Alert tone="warning" className="mb-4">
          <strong className="font-semibold">Alterações pendentes.</strong> Revise os campos e use &ldquo;Salvar alterações&rdquo; para confirmar.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <SectionHeader title="Solicitação original" description="Descrição enviada na abertura do chamado." />
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3 rounded-md border border-[#d4dbe4] bg-[#f7f9fb] p-3">
                <UserAvatar name={ticket.requester.full_name} />
                <div>
                  <p className="text-sm font-semibold text-[#1a2332]">{ticket.requester.full_name}</p>
                  <p className="text-xs text-[#8b97a8]">{ticket.requester.department} · {ticket.requester.secretariat}</p>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#1a2332]">{ticket.description}</p>
              {ticket.form_data && Object.keys(ticket.form_data).length > 0 && (
                <div className="mt-4 border-t border-[#e8edf2] pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8b97a8]">Informações do serviço</h3>
                  <dl className="mt-2 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                    {Object.entries(ticket.form_data).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs font-medium text-[#8b97a8]">{formFieldLabels[key] || catalogFieldLabels[key] || key}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[#1a2332]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#e8edf2] pt-3 text-xs text-[#8b97a8]">
                <span className="flex items-center gap-1.5"><UserRound size={14} />{ticket.requester.department}</span>
                <span className="flex items-center gap-1.5"><MapPin size={14} />{ticket.location || "Localização não informada"}</span>
                <span className="flex items-center gap-1.5"><CalendarClock size={14} />Aberto {relativeTime(ticket.created_at)}</span>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader title="Histórico do atendimento" description="Mensagens, notas internas e alterações administrativas." />
            <TicketTimeline comments={ticket.comments || []} currentUser={user} />
            <form onSubmit={sendComment} className="border-t border-[#e8edf2] bg-[#f7f9fb] p-4">
              {canAddInternalNote && (
                <div className="mb-3 inline-flex rounded-md border border-[#d4dbe4] bg-white p-0.5">
                  <button type="button" onClick={() => setInternal(false)} className={cn("rounded px-2.5 py-1 text-xs font-semibold transition", !internal ? "bg-[#f3f7fb] text-[#1a5f9e]" : "text-[#8b97a8] hover:text-[#1a2332]")}>
                    <MessageSquareText className="mr-1 inline" size={13} />Resposta pública
                  </button>
                  <button type="button" onClick={() => setInternal(true)} className={cn("rounded px-2.5 py-1 text-xs font-semibold transition", internal ? "bg-[#fffbeb] text-[#92400e]" : "text-[#8b97a8] hover:text-[#1a2332]")}>
                    <LockKeyhole className="mr-1 inline" size={13} />Nota interna
                  </button>
                </div>
              )}
              <Textarea
                aria-label={internal ? "Nota interna da equipe de TI" : "Resposta pública do chamado"}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={internal ? "Registre uma nota visível apenas para a equipe de TI." : "Escreva uma resposta para os participantes do chamado."}
                className={internal ? "border-[#fcd9a8] bg-[#fffbeb] focus:border-[#b45309] focus:ring-[#fffbeb]" : "bg-white"}
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#8b97a8]">
                  {internal ? "Esta nota não será exibida ao solicitante." : isUserProfile ? "Sua mensagem será enviada à equipe de TI." : "A resposta será visível ao solicitante."}
                </p>
                <Button disabled={saving || comment.trim().length < 2}>
                  <Send size={15} />
                  {saving ? "Enviando..." : internal ? "Adicionar nota" : "Enviar resposta"}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="overflow-hidden xl:sticky xl:top-16">
            <SectionHeader title={canChangeStatus ? "Painel de atendimento" : "Dados do chamado"} description={canChangeStatus ? "Revise e confirme antes de salvar." : undefined} />
            <div className="space-y-3 p-4">
              {(canQuickAssign || canQuickClose) && (
                <div className="grid gap-2 border-b border-[#e8edf2] pb-3">
                  {canQuickAssign && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving || !!quickAction || hasPendingChanges}
                      onClick={() => void runQuickAction({ assignee_id: user.id }, "assign")}
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
                      onClick={() => setCloseConfirmOpen(true)}
                    >
                      <CheckCircle2 size={16} />
                      Encerrar chamado
                    </Button>
                  )}
                  {hasPendingChanges && <p className="text-xs text-[#8b97a8]">Salve ou desfaça as alterações pendentes antes de usar ações rápidas.</p>}
                  {canQuickClose && !ticket.assignee && <p className="text-xs text-[#8b97a8]">Atribua um responsável antes de encerrar.</p>}
                </div>
              )}
              {canEditAdministrativeFields ? (
                <>
                  <DetailRow label="Status" value={statusLabels[ticket.status] || ticket.status} />
                  <Field label="Responsável"><Select disabled={isFinalStatus} value={draft.assignee_id || ""} onChange={(e) => setDraft((old) => ({ ...old, assignee_id: e.target.value }))}><option value="">Sem responsável</option>{staff.map((member) => <option key={member.id} value={String(member.id)}>{member.full_name} · {roleLabels[member.role]}</option>)}</Select></Field>
                  <Field label="Prioridade"><Select disabled={isFinalStatus} value={draft.priority || "medium"} onChange={(e) => setDraft((old) => ({ ...old, priority: e.target.value }))}>{priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
                  <Field label="Equipamento"><Select disabled={isFinalStatus} value={draft.asset_id || ""} onChange={(e) => setDraft((old) => ({ ...old, asset_id: e.target.value }))}><option value="">Nenhum equipamento</option>{assets.map((asset) => <option key={asset.id} value={String(asset.id)}>{asset.name} · {asset.patrimony || "sem patrimônio"}</option>)}</Select></Field>
                  <Field label="Localização"><Select disabled={isFinalStatus} value={draft.location || ""} onChange={(e) => setDraft((old) => ({ ...old, location: e.target.value }))}><option value="">Não informada</option><option value="SEDECON - SEGTEA">SEDECON - SEGTEA</option><option value="Administração - RH">Administração - RH</option><option value="Fazenda - Atendimento">Fazenda - Atendimento</option><option value="Oficina de TI">Oficina de TI</option><option value="Datacenter - Sede">Datacenter - Sede</option></Select></Field>
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
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#d4dbe4] bg-white text-[#5c6b7e]"><Computer size={16} /></span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8b97a8]">Equipamento vinculado</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#1a2332]">{ticket.asset.name}</p>
                      <p className="mt-0.5 text-xs text-[#5c6b7e]">
                        {assetTypeLabels[ticket.asset.asset_type] || ticket.asset.asset_type}
                        {!isUserProfile && ticket.asset.manufacturer ? ` · ${ticket.asset.manufacturer} ${ticket.asset.model || ""}` : ""}
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
      </div>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Confirmar alterações do chamado?" description="Revise o resumo abaixo. As mudanças serão registradas no histórico após a confirmação." confirmLabel="Confirmar e salvar" loading={saving} onConfirm={saveChanges}>
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
      <ConfirmDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen} title="Encerrar chamado?" description="Informe uma mensagem de encerramento para registrar o fechamento e orientar o solicitante." confirmLabel="Encerrar chamado" loading={quickAction === "close"} confirmDisabled={!ticket.assignee || resolutionMessage.trim().length < 2} onConfirm={closeTicket}>
        <Textarea
          aria-label="Mensagem de encerramento"
          value={resolutionMessage}
          onChange={(event) => setResolutionMessage(event.target.value)}
          placeholder="Ex.: Atendimento realizado, conexão normalizada e serviço validado com o setor."
          className="bg-white"
        />
        {!ticket.assignee && <Alert tone="warning" className="mt-3">Atribua um responsável antes de encerrar o chamado.</Alert>}
        {resolutionMessage.trim().length < 2 && <p className="mt-2 text-xs text-[#8b97a8]">A mensagem de encerramento é obrigatória.</p>}
      </ConfirmDialog>
    </>
  );
}
