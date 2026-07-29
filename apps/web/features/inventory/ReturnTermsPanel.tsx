"use client";

import { Ban, CheckCircle2, Download, FileText, Plus, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, SectionHeader, Select, Textarea } from "@/components/ui";
import { activeCatalogItems, displaySerial, emptyInventoryCatalogs, normalizedSerial, todayInputValue } from "@/features/inventory/inventory-utils";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { InventoryAsset, InventoryCatalogs, InventoryDeliveryTerm, InventoryReturnTerm, InventoryReturnTermPreview, User } from "@/lib/types";

type TermDraft = {
  term_number: string;
  contract_id: string;
  related_delivery_term_id: string;
  issued_at: string;
  returner_user_id: string;
  returner_registration: string;
  returner_phone: string;
  adcetei_signer_name: string;
  adcetei_signer_title: string;
  item_observation: string;
};

const emptyTermDraft = (): TermDraft => ({
  term_number: "",
  contract_id: "",
  related_delivery_term_id: "",
  issued_at: todayInputValue(),
  returner_user_id: "",
  returner_registration: "",
  returner_phone: "",
  adcetei_signer_name: "William Barreto Corrêa",
  adcetei_signer_title: "Coordenador Geral de Tecnologia da Informação",
  item_observation: "Equipamento devolvido",
});

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  emitted: "Emitido",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

type TermsView = "emit" | "pending" | "history";

function returnerFields(returner: User) {
  return {
    returner_user_id: String(returner.id),
    returner_registration: returner.registration || "",
    returner_phone: returner.phone || "",
  };
}

function termDownloadFilename(term: InventoryReturnTerm) {
  const clean = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._ -]+/g, "-").replace(/^[ .-]+|[ .-]+$/g, "");
  return `${clean(term.term_number) || term.id} - Termo de Devolução - ${clean(term.returner_name) || "Devolvedor"}.docx`;
}

export default function ReturnTermsPanel() {
  const { user } = useAuth();
  const canView = hasPermission(user, "inventory.view");
  const canMove = hasPermission(user, "inventory.move");
  const inputRef = useRef<HTMLInputElement>(null);
  const [terms, setTerms] = useState<InventoryReturnTerm[]>([]);
  const [deliveryTerms, setDeliveryTerms] = useState<InventoryDeliveryTerm[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyInventoryCatalogs);
  const [draft, setDraft] = useState<TermDraft>(emptyTermDraft());
  const [serials, setSerials] = useState<string[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [returnerAssets, setReturnerAssets] = useState<InventoryAsset[]>([]);
  const [returnerAssetsLoading, setReturnerAssetsLoading] = useState(false);
  const [preview, setPreview] = useState<InventoryReturnTermPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [view, setView] = useState<TermsView>("emit");
  const [returnerSearch, setReturnerSearch] = useState("");
  const [confirmTerm, setConfirmTerm] = useState<InventoryReturnTerm | null>(null);
  const [confirmDate, setConfirmDate] = useState(todayInputValue());
  const [confirmNotes, setConfirmNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [termData, deliveryTermData, userData, catalogData, numberData] = await Promise.all([
      api.inventoryReturnTerms(),
      canMove ? api.inventoryDeliveryTerms() : Promise.resolve([]),
      canMove ? api.users() : Promise.resolve([]),
      api.inventoryCatalogs(),
      canMove ? api.nextInventoryReturnTermNumber() : Promise.resolve({ term_number: "" }),
    ]);
    setTerms(termData);
    setDeliveryTerms(deliveryTermData);
    setUsers(userData);
    setCatalogs(catalogData);
    setDraft((current) => current.term_number ? current : { ...current, term_number: numberData.term_number });
  };

  useEffect(() => {
    if (!canView) {
      if (user) setLoading(false);
      return;
    }
    if (!canMove) setView("history");
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar os termos."))
      .finally(() => setLoading(false));
  }, [canMove, canView, user]);

  useEffect(() => {
    if (!canMove || !serials.length || !draft.returner_user_id) {
      setPreview(null);
      return;
    }
    let active = true;
    setPreviewLoading(true);
    api.previewInventoryReturnTerm({ returner_user_id: Number(draft.returner_user_id), serial_numbers: serials })
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch(() => {
        if (active) setPreview(null);
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canMove, draft.returner_user_id, serials]);

  useEffect(() => {
    if (!canMove || !draft.returner_user_id) {
      setReturnerAssets([]);
      return;
    }
    let active = true;
    setReturnerAssetsLoading(true);
    const returnerId = Number(draft.returner_user_id);
    api.inventoryAssets({ status_filter: "allocated", page_size: 100 })
      .then((data) => {
        if (!active) return;
        setReturnerAssets(data.items.filter((asset) => asset.assigned_user_id === returnerId));
      })
      .catch(() => {
        if (active) setReturnerAssets([]);
      })
      .finally(() => {
        if (active) setReturnerAssetsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canMove, draft.returner_user_id]);

  const visibleReturnerAssets = useMemo(() => {
    const term = assetSearch.trim().toLowerCase();
    return returnerAssets
      .filter((asset) => !serials.some((serial) => normalizedSerial(serial) === normalizedSerial(asset.serial_number)))
      .filter((asset) => !term || `${asset.serial_number} ${asset.display_name}`.toLowerCase().includes(term));
  }, [assetSearch, returnerAssets, serials]);

  const selectedReturner = useMemo(
    () => users.find((item) => String(item.id) === draft.returner_user_id) || null,
    [draft.returner_user_id, users],
  );
  const selectedContract = useMemo(
    () => catalogs.contracts.find((item) => String(item.id) === draft.contract_id) || null,
    [catalogs.contracts, draft.contract_id],
  );
  const returnerDeliveryTerms = useMemo(
    () => deliveryTerms.filter((term) => String(term.recipient_user_id) === draft.returner_user_id),
    [deliveryTerms, draft.returner_user_id],
  );

  const filteredUsers = useMemo(() => {
    const term = returnerSearch.trim().toLowerCase();
    const base = term
      ? users.filter((item) => `${item.full_name} ${item.email} ${item.registration}`.toLowerCase().includes(term))
      : users;
    return base.slice(0, 20);
  }, [returnerSearch, users]);

  const addSerial = (value: string) => {
    const serial = displaySerial(value);
    if (!serial) {
      setError("Informe um número de série antes de adicionar.");
      return;
    }
    if (serials.some((item) => normalizedSerial(item) === normalizedSerial(serial))) {
      setError("Este número de série já foi lido neste termo.");
      setAssetSearch("");
      inputRef.current?.focus();
      return;
    }
    setError("");
    setSerials((current) => [...current, serial]);
    setAssetSearch("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const addAsset = (asset: InventoryAsset) => addSerial(asset.serial_number);

  const removeSerial = (serial: string) => {
    setSerials((current) => current.filter((item) => item !== serial));
    inputRef.current?.focus();
  };

  const selectReturner = (returner: User) => {
    setDraft((current) => ({
      ...current,
      ...returnerFields(returner),
      related_delivery_term_id: "",
    }));
    setSerials([]);
    setAssetSearch("");
  };

  const submitAssetSearch = () => {
    if (visibleReturnerAssets.length) addAsset(visibleReturnerAssets[0]);
    else addSerial(assetSearch);
  };

  const canCreateTerm = Boolean(
    draft.term_number &&
    draft.issued_at &&
    draft.returner_user_id &&
    serials.length &&
    !preview?.invalid_count,
  );

  const pendingTerms = useMemo(() => terms.filter((term) => term.status === "emitted" || term.status === "draft"), [terms]);
  const visibleTerms = view === "pending" ? pendingTerms : terms;

  const createTerm = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreateTerm) {
      setError("Selecione o devolvedor e leia pelo menos um número de série.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const term = await api.createInventoryReturnTerm({
        term_number: draft.term_number,
        contract_id: draft.contract_id ? Number(draft.contract_id) : null,
        contract_number: selectedContract?.name || "",
        related_delivery_term_id: draft.related_delivery_term_id ? Number(draft.related_delivery_term_id) : null,
        issued_at: draft.issued_at,
        returner_user_id: Number(draft.returner_user_id),
        returner_registration: draft.returner_registration,
        returner_phone: draft.returner_phone,
        adcetei_signer_name: draft.adcetei_signer_name,
        adcetei_signer_title: draft.adcetei_signer_title,
        item_observation: draft.item_observation,
        serial_numbers: serials,
        notes: "",
      });
      setTerms((current) => [term, ...current]);
      setDraft({ ...emptyTermDraft(), term_number: "" });
      setSerials([]);
      setPreview(null);
      setMessage("Termo emitido. Baixe o DOCX para assinatura antes de confirmar a devolução.");
      setView("pending");
      api.nextInventoryReturnTermNumber()
        .then((data) => setDraft((current) => current.term_number ? current : { ...current, term_number: data.term_number }))
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível emitir o termo.");
    } finally {
      setSaving(false);
    }
  };

  const downloadTerm = async (term: InventoryReturnTerm) => {
    setSaving(true);
    setError("");
    try {
      await api.downloadInventoryReturnTerm(term.id, termDownloadFilename(term));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível baixar o termo.");
    } finally {
      setSaving(false);
    }
  };

  const confirmReturn = async () => {
    if (!confirmTerm) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.confirmInventoryReturnTerm(confirmTerm.id, {
        movement_date: confirmDate,
        notes: confirmNotes,
      });
      setTerms((current) => current.map((item) => item.id === updated.id ? updated : item));
      setConfirmTerm(null);
      setConfirmNotes("");
      setConfirmDate(todayInputValue());
      setMessage("Devolução confirmada e inventário atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar a devolução.");
    } finally {
      setSaving(false);
    }
  };

  const cancelTerm = async (term: InventoryReturnTerm) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.cancelInventoryReturnTerm(term.id);
      setTerms((current) => current.map((item) => item.id === term.id ? { ...item, status: "cancelled" as const } : item));
      setMessage(`Termo ${term.term_number} cancelado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cancelar o termo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando termos..." />;
  if (!canView) return <EmptyState title="Sem acesso" description="Você não tem permissão para consultar termos de devolução." />;

  return (
    <>
      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-5 flex flex-wrap gap-2">
        {canMove && <Button type="button" variant={view === "emit" ? "primary" : "secondary"} size="sm" onClick={() => setView("emit")}><FileText size={15} />Emitir</Button>}
        <Button type="button" variant={view === "pending" ? "primary" : "secondary"} size="sm" onClick={() => setView("pending")}><CheckCircle2 size={15} />Pendentes ({pendingTerms.length})</Button>
        <Button type="button" variant={view === "history" ? "primary" : "secondary"} size="sm" onClick={() => setView("history")}><Search size={15} />Histórico</Button>
      </div>

      {canMove && view === "emit" && (
        <form onSubmit={createTerm} className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <SectionHeader title="Dados do termo" />
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <Field label="Número do termo"><Input value={draft.term_number} onChange={(e) => setDraft({ ...draft, term_number: e.target.value })} placeholder="001/2026" /></Field>
                <Field label="Data do termo"><Input type="date" value={draft.issued_at} onChange={(e) => setDraft({ ...draft, issued_at: e.target.value })} /></Field>
                <Field label="Contrato (opcional)" help="Deixe em branco para equipamento patrimoniado, sem vínculo de locação.">
                  <Select value={draft.contract_id} onChange={(e) => setDraft({ ...draft, contract_id: e.target.value })}>
                    <option value="">Nenhum</option>
                    {activeCatalogItems(catalogs.contracts).map((contract) => <option key={contract.id} value={contract.id}>{contract.name}</option>)}
                  </Select>
                </Field>
                <Field label="Termo de recebimento de referência (opcional)">
                  <Select
                    value={draft.related_delivery_term_id}
                    onChange={(e) => setDraft({ ...draft, related_delivery_term_id: e.target.value })}
                    disabled={!draft.returner_user_id}
                  >
                    <option value="">Nenhum</option>
                    {returnerDeliveryTerms.map((term) => <option key={term.id} value={term.id}>{term.term_number}</option>)}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Observação na relação dos equipamentos"><Input value={draft.item_observation} onChange={(e) => setDraft({ ...draft, item_observation: e.target.value })} /></Field>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="Equipamentos" description={!draft.returner_user_id ? "Selecione o devolvedor ao lado para ver os equipamentos vinculados a ele." : "Equipamentos alocados a este servidor. Clique para adicionar ao termo."} />
              <div className="space-y-3 p-4">
                <Field label="Filtrar por série, modelo ou tipo">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" size={16} />
                      <Input
                        ref={inputRef}
                        className="pl-8"
                        value={assetSearch}
                        disabled={!draft.returner_user_id}
                        onChange={(e) => setAssetSearch(e.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitAssetSearch();
                          }
                        }}
                        placeholder="Deixe em branco para ver todos"
                      />
                    </div>
                    <Button type="button" variant="secondary" disabled={!draft.returner_user_id || !visibleReturnerAssets.length} onClick={submitAssetSearch}><Plus size={15} />Adicionar</Button>
                  </div>
                </Field>
                {draft.returner_user_id && (
                  <div className="overflow-hidden rounded-md border border-[var(--border-subtle)]">
                    {returnerAssetsLoading && <p className="px-3 py-2 text-sm text-[var(--muted)]">Buscando equipamentos vinculados...</p>}
                    {!returnerAssetsLoading && visibleReturnerAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => addAsset(asset)}
                        className="block w-full border-b border-[var(--border-subtle)] bg-[var(--card)] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[var(--surface-subtle)]"
                      >
                        <span className="font-semibold text-[var(--foreground)]">{asset.serial_number}</span>
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">{asset.display_name}</span>
                      </button>
                    ))}
                    {!returnerAssetsLoading && !visibleReturnerAssets.length && (
                      <p className="px-3 py-2 text-sm text-[var(--muted)]">
                        {returnerAssets.length ? "Nenhum equipamento corresponde ao filtro." : "Nenhum equipamento alocado a este servidor."}
                      </p>
                    )}
                  </div>
                )}
                {serials.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {serials.map((serial) => (
                      <Badge key={serial} className="border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[var(--primary-hover)]">
                        {serial}
                        <button type="button" className="ml-1 font-bold" onClick={() => removeSerial(serial)} aria-label={`Remover ${serial}`}>x</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            {serials.length > 0 && (
              <Card className="overflow-hidden">
                <SectionHeader
                  title="Prévia dos itens"
                  description={previewLoading ? "Validando..." : `${preview?.valid_count || 0} válido(s), ${preview?.invalid_count || 0} com erro`}
                />
                <div className="overflow-x-auto soft-scrollbar">
                  <table className="data-table min-w-[720px]">
                    <thead><tr><th>Série</th><th>Equipamento</th><th>Status</th></tr></thead>
                    <tbody>
                      {preview?.valid_items.map((item) => (
                        <tr key={item.serial_number}>
                          <td className="font-mono text-xs">{item.serial_number}</td>
                          <td>{item.specification || [item.asset_type, item.manufacturer, item.model].filter(Boolean).join(" · ")}</td>
                          <td><Badge className="border border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[var(--status-green-text)]">OK</Badge></td>
                        </tr>
                      ))}
                      {preview?.errors.map((item) => (
                        <tr key={`${item.index}-${item.serial_number}`}>
                          <td className="font-mono text-xs">{item.serial_number || "-"}</td>
                          <td>{item.message}</td>
                          <td><Badge className="border border-[var(--status-red-border)] bg-[var(--status-red-bg)] text-[var(--status-red-text)]">Erro</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden">
              <SectionHeader title="Servidor devolvedor" description="Selecione primeiro: a busca de equipamentos usa este vínculo." />
              <div className="space-y-3 p-4">
                <Field label="Buscar servidor">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" size={16} />
                    <Input className="pl-8" value={returnerSearch} onChange={(e) => setReturnerSearch(e.target.value)} placeholder="Nome, e-mail ou matrícula" />
                  </div>
                </Field>
                <div className="max-h-52 overflow-y-auto rounded-md border border-[var(--border-subtle)]">
                  {filteredUsers.map((returner) => (
                    <button
                      type="button"
                      key={returner.id}
                      onClick={() => selectReturner(returner)}
                      className={`block w-full border-b border-[var(--border-subtle)] px-3 py-2 text-left text-sm last:border-b-0 ${draft.returner_user_id === String(returner.id) ? "bg-[var(--status-blue-bg)]" : "bg-[var(--card)] hover:bg-[var(--surface-subtle)]"}`}
                    >
                      <span className="font-semibold text-[var(--foreground)]">{returner.full_name}</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted-light)]">{returner.email} · {returner.registration || "sem matrícula"}</span>
                    </button>
                  ))}
                  {!filteredUsers.length && <EmptyState title="Nenhum servidor encontrado" className="py-6" />}
                </div>
                {selectedReturner && (
                  <Alert tone="info">
                    Selecionado: <strong>{selectedReturner.full_name}</strong> ({selectedReturner.email})
                  </Alert>
                )}
                <Field label="Matrícula no termo"><Input value={draft.returner_registration} onChange={(e) => setDraft({ ...draft, returner_registration: e.target.value })} /></Field>
                <Field label="Telefone no termo"><Input value={draft.returner_phone} onChange={(e) => setDraft({ ...draft, returner_phone: e.target.value })} /></Field>
                <Button className="w-full" disabled={saving || previewLoading || !canCreateTerm}><FileText size={16} />{saving ? "Emitindo..." : "Emitir termo"}</Button>
              </div>
            </Card>
          </div>
        </form>
      )}

      {view !== "emit" && (
      <Card className="overflow-hidden">
        <SectionHeader title={`${visibleTerms.length} termo(s)`} description="A confirmação de devolução aplica o retorno ao estoque nos ativos do inventário." />
        <div className="overflow-x-auto soft-scrollbar">
          <table className="data-table min-w-[980px]">
            <thead><tr><th>Termo</th><th>Devolvedor</th><th>Origem</th><th>Itens</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {visibleTerms.map((term) => (
                <tr key={term.id}>
                  <td><p className="font-semibold text-[var(--foreground)]">{term.term_number}</p><p className="mt-0.5 text-xs text-[var(--muted-light)]">{formatDate(term.issued_at)}</p></td>
                  <td><p className="font-medium text-[var(--foreground)]">{term.returner_name}</p><p className="mt-0.5 text-xs text-[var(--muted-light)]">{term.returner_email}</p></td>
                  <td><p className="font-medium text-[var(--foreground)]">{term.origin_unit}</p><p className="mt-0.5 text-xs text-[var(--muted-light)]">{term.contract_number || "Equipamento patrimoniado"}</p></td>
                  <td>{term.items.length}</td>
                  <td><Badge className={term.status === "confirmed" ? "border border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[var(--status-green-text)]" : "border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[var(--primary-hover)]"}>{term.status === "confirmed" && <CheckCircle2 size={13} />}{statusLabels[term.status]}</Badge></td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void downloadTerm(term)}><Download size={15} />DOCX</Button>
                      {canMove && term.status !== "confirmed" && term.status !== "cancelled" && <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmTerm(term)}><CheckCircle2 size={15} />Confirmar</Button>}
                      {canMove && term.status !== "confirmed" && term.status !== "cancelled" && <Button type="button" variant="ghost" size="sm" onClick={() => void cancelTerm(term)}><Ban size={15} />Cancelar</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleTerms.length && <EmptyState icon={<FileText size={18} />} title="Nenhum termo encontrado" description="Os termos de devolução aparecerão aqui." />}
      </Card>
      )}

      <ConfirmDialog
        open={Boolean(confirmTerm)}
        onOpenChange={(open) => {
          if (!open) setConfirmTerm(null);
          setError("");
        }}
        onConfirm={confirmReturn}
        loading={saving}
        title="Confirmar devolução"
        description={`Confirmar devolução do termo ${confirmTerm?.term_number || ""}? Esta ação retorna os equipamentos ao estoque no inventário.`}
        confirmLabel="Confirmar devolução"
      >
        <div className="space-y-4">
          <Field label="Data da devolução"><Input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} /></Field>
          <Field label="Observação da movimentação"><Textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} placeholder="Ex.: Termo assinado e equipamento conferido no recebimento." /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </ConfirmDialog>
    </>
  );
}
