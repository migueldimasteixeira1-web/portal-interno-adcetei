"use client";

import { Ban, CheckCircle2, Download, FileText, Plus, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { completeInstitutionalEmail } from "@/components/InstitutionalEmailInput";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, SectionHeader, Select, Textarea } from "@/components/ui";
import { UserFormDialog, type UserDraft } from "@/features/admin/UsersPanels";
import { activeCatalogItems, displaySerial, emptyInventoryCatalogs, normalizedSerial, todayInputValue } from "@/features/inventory/inventory-utils";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { InventoryAsset, InventoryCatalogs, InventoryDeliveryTerm, InventoryDeliveryTermPreview, User } from "@/lib/types";

type TermDraft = {
  term_number: string;
  contract_id: string;
  issued_at: string;
  recipient_user_id: string;
  recipient_registration: string;
  recipient_phone: string;
  adcetei_signer_name: string;
  adcetei_signer_title: string;
  item_observation: string;
};

const emptyTermDraft = (): TermDraft => ({
  term_number: "",
  contract_id: "",
  issued_at: todayInputValue(),
  recipient_user_id: "",
  recipient_registration: "",
  recipient_phone: "",
  adcetei_signer_name: "William Barreto Corrêa",
  adcetei_signer_title: "Coordenador Geral de Tecnologia da Informação",
  item_observation: "Equipamento locado",
});

const emptyUserDraft: UserDraft = {
  username: "",
  full_name: "",
  email: "",
  password: "TermoTemporario123",
  role: "user",
  secretariat: "",
  department_sector_id: "",
  department: "",
  registration: "",
  phone: "",
  active: false,
  email_verified: false,
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  emitted: "Emitido",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

type TermsView = "emit" | "pending" | "history";

function usernameFromEmail(email: string) {
  return completeInstitutionalEmail(email).split("@", 1)[0].replace(/[^A-Za-z0-9._-]/g, ".").slice(0, 100);
}

function destinationUnitFor(recipient: User | null) {
  const secretariat = recipient?.secretariat?.trim() || "Prefeitura de Cabo Frio";
  const destination = recipient?.department?.trim() || "";
  return destination ? `${secretariat} - ${destination}` : secretariat;
}

function termDownloadFilename(term: InventoryDeliveryTerm) {
  const clean = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._ -]+/g, "-").replace(/^[ .-]+|[ .-]+$/g, "");
  return `${clean(term.term_number) || term.id} - Termo de Recebimento - ${clean(term.recipient_name) || "Recebedor"}.docx`;
}

export default function InventoryDeliveryTermsPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "inventory.view");
  const canMove = hasPermission(user, "inventory.move");
  const canManageUsers = hasPermission(user, "users.manage");
  const inputRef = useRef<HTMLInputElement>(null);
  const [terms, setTerms] = useState<InventoryDeliveryTerm[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyInventoryCatalogs);
  const [draft, setDraft] = useState<TermDraft>(emptyTermDraft());
  const [serials, setSerials] = useState<string[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetResults, setAssetResults] = useState<InventoryAsset[]>([]);
  const [assetSearchLoading, setAssetSearchLoading] = useState(false);
  const [preview, setPreview] = useState<InventoryDeliveryTermPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [view, setView] = useState<TermsView>("emit");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userDraft, setUserDraft] = useState<UserDraft>(emptyUserDraft);
  const [deliverTerm, setDeliverTerm] = useState<InventoryDeliveryTerm | null>(null);
  const [deliverDate, setDeliverDate] = useState(todayInputValue());
  const [deliverNotes, setDeliverNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [termData, userData, catalogData, numberData] = await Promise.all([
      api.inventoryDeliveryTerms(),
      canMove || canManageUsers ? api.users() : Promise.resolve([]),
      api.inventoryCatalogs(),
      canMove ? api.nextInventoryDeliveryTermNumber() : Promise.resolve({ term_number: "" }),
    ]);
    setTerms(termData);
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
  }, [canManageUsers, canMove, canView, user]);

  useEffect(() => {
    if (!canMove || !serials.length) {
      setPreview(null);
      return;
    }
    let active = true;
    setPreviewLoading(true);
    api.previewInventoryDeliveryTerm({ serial_numbers: serials })
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
  }, [canMove, serials]);

  useEffect(() => {
    if (!canMove || assetSearch.trim().length < 2) {
      setAssetResults([]);
      setAssetSearchLoading(false);
      return;
    }
    let active = true;
    setAssetSearchLoading(true);
    const timer = setTimeout(() => {
      api.inventoryAssets({ search: assetSearch.trim(), status_filter: "stock", page_size: 8 })
        .then((data) => {
          if (!active) return;
          setAssetResults(data.items.filter((asset) => !serials.some((serial) => normalizedSerial(serial) === normalizedSerial(asset.serial_number))));
        })
        .catch(() => {
          if (active) setAssetResults([]);
        })
        .finally(() => {
          if (active) setAssetSearchLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [assetSearch, canMove, serials]);

  const selectedRecipient = useMemo(
    () => users.find((item) => String(item.id) === draft.recipient_user_id) || null,
    [draft.recipient_user_id, users],
  );
  const selectedContract = useMemo(
    () => catalogs.contracts.find((item) => String(item.id) === draft.contract_id) || null,
    [catalogs.contracts, draft.contract_id],
  );
  const contractText = selectedContract?.name || "";
  const destinationText = selectedRecipient ? destinationUnitFor(selectedRecipient) : "";

  const filteredUsers = useMemo(() => {
    const term = recipientSearch.trim().toLowerCase();
    if (!term) return users.slice(0, 20);
    return users.filter((item) => `${item.full_name} ${item.email} ${item.registration}`.toLowerCase().includes(term)).slice(0, 20);
  }, [recipientSearch, users]);

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
    setAssetResults([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const addAsset = (asset: InventoryAsset) => {
    addSerial(asset.serial_number);
  };

  const removeSerial = (serial: string) => {
    setSerials((current) => current.filter((item) => item !== serial));
    inputRef.current?.focus();
  };

  const selectRecipient = (recipient: User) => {
    setDraft((current) => ({
      ...current,
      recipient_user_id: String(recipient.id),
      recipient_registration: recipient.registration || current.recipient_registration,
      recipient_phone: recipient.phone || current.recipient_phone,
    }));
  };

  const selectContract = (contractId: string) => {
    setDraft((current) => ({
      ...current,
      contract_id: contractId,
    }));
  };

  const submitAssetSearch = () => {
    if (assetResults.length) addAsset(assetResults[0]);
    else addSerial(assetSearch);
  };

  const openUserCreate = () => {
    setUserDraft({
      ...emptyUserDraft,
      full_name: recipientSearch,
      username: usernameFromEmail(""),
    });
    setError("");
    setUserDialogOpen(true);
  };

  const saveUser = async () => {
    if (!userDraft.secretariat) {
      setError("Selecione uma secretaria cadastrada para o recebedor.");
      return;
    }
    if (!userDraft.department_sector_id) {
      setError("Selecione um setor cadastrado no inventário para o recebedor.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const email = completeInstitutionalEmail(userDraft.email);
      const created = await api.createUser({
        ...userDraft,
        department_sector_id: userDraft.department_sector_id ? Number(userDraft.department_sector_id) : null,
        username: userDraft.username || usernameFromEmail(email),
        email,
        active: false,
        email_verified: false,
        role: "user",
      });
      setUsers((current) => [...current, created].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR")));
      selectRecipient(created);
      setUserDialogOpen(false);
      setMessage("Recebedor cadastrado como usuário bloqueado para acesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar o recebedor.");
    } finally {
      setSaving(false);
    }
  };

  const canCreateTerm = Boolean(
    draft.term_number &&
    draft.issued_at &&
    contractText &&
    destinationText &&
    draft.recipient_user_id &&
    serials.length &&
    !preview?.invalid_count,
  );

  const pendingTerms = useMemo(() => terms.filter((term) => term.status === "emitted" || term.status === "draft"), [terms]);
  const visibleTerms = view === "pending" ? pendingTerms : terms;

  const createTerm = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreateTerm) {
      setError("Preencha os dados obrigatórios e leia pelo menos um número de série.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const term = await api.createInventoryDeliveryTerm({
        term_number: draft.term_number,
        contract_id: draft.contract_id ? Number(draft.contract_id) : null,
        contract_number: contractText,
        issued_at: draft.issued_at,
        destination_unit: destinationText,
        recipient_user_id: Number(draft.recipient_user_id),
        recipient_registration: draft.recipient_registration,
        recipient_phone: draft.recipient_phone,
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
      setMessage("Termo emitido. Baixe o DOCX para assinatura antes de confirmar a entrega.");
      setView("pending");
      api.nextInventoryDeliveryTermNumber()
        .then((data) => setDraft((current) => current.term_number ? current : { ...current, term_number: data.term_number }))
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível emitir o termo.");
    } finally {
      setSaving(false);
    }
  };

  const downloadTerm = async (term: InventoryDeliveryTerm) => {
    setSaving(true);
    setError("");
    try {
      await api.downloadInventoryDeliveryTerm(term.id, termDownloadFilename(term));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível baixar o termo.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelivery = async () => {
    if (!deliverTerm) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.confirmInventoryDeliveryTerm(deliverTerm.id, {
        movement_date: deliverDate,
        notes: deliverNotes,
      });
      setTerms((current) => current.map((item) => item.id === updated.id ? updated : item));
      setDeliverTerm(null);
      setDeliverNotes("");
      setDeliverDate(todayInputValue());
      setMessage("Entrega confirmada e inventário atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar a entrega.");
    } finally {
      setSaving(false);
    }
  };

  const cancelTerm = async (term: InventoryDeliveryTerm) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.cancelInventoryDeliveryTerm(term.id);
      setTerms((current) => current.map((item) => item.id === term.id ? { ...item, status: "cancelled" as const } : item));
      setMessage(`Termo ${term.term_number} cancelado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cancelar o termo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando termos..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Termos de recebimento"
        subtitle="Emita o termo oficial antes da instalação e atualize o inventário somente após a entrega assinada."
      />

      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && !userDialogOpen && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-5 flex flex-wrap gap-2">
        {canMove && <Button type="button" variant={view === "emit" ? "primary" : "secondary"} size="sm" onClick={() => setView("emit")}><FileText size={15} />Emitir</Button>}
        <Button type="button" variant={view === "pending" ? "primary" : "secondary"} size="sm" onClick={() => setView("pending")}><CheckCircle2 size={15} />Pendentes ({pendingTerms.length})</Button>
        <Button type="button" variant={view === "history" ? "primary" : "secondary"} size="sm" onClick={() => setView("history")}><Search size={15} />Histórico</Button>
      </div>

      {canMove && view === "emit" && (
        <form onSubmit={createTerm} className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <SectionHeader title="Dados básicos" />
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <Field label="Número do termo"><Input value={draft.term_number} onChange={(e) => setDraft({ ...draft, term_number: e.target.value })} placeholder="017/2026" /></Field>
                <Field label="Contrato">
                  <Select value={draft.contract_id} onChange={(e) => selectContract(e.target.value)}>
                    <option value="">Selecione</option>
                    {activeCatalogItems(catalogs.contracts).map((contract) => <option key={contract.id} value={contract.id}>{contract.name}</option>)}
                  </Select>
                </Field>
                <Field label="Data do termo"><Input type="date" value={draft.issued_at} onChange={(e) => setDraft({ ...draft, issued_at: e.target.value })} /></Field>
                <div className="sm:col-span-2">
                  <Alert tone="info">Destino: <strong>{destinationText || "selecione o recebedor"}</strong></Alert>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Observação na relação dos equipamentos"><Input value={draft.item_observation} onChange={(e) => setDraft({ ...draft, item_observation: e.target.value })} /></Field>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="Equipamentos" />
              <div className="space-y-3 p-4">
                <Field label="Buscar equipamento">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} />
                      <Input
                        ref={inputRef}
                        className="pl-8"
                        value={assetSearch}
                        onChange={(e) => setAssetSearch(e.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitAssetSearch();
                          }
                        }}
                        placeholder="Série, modelo ou tipo"
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={submitAssetSearch}><Plus size={15} />Adicionar</Button>
                  </div>
                </Field>
                {assetSearch.trim().length >= 2 && (
                  <div className="overflow-hidden rounded-md border border-[#e8edf2]">
                    {assetSearchLoading && <p className="px-3 py-2 text-sm text-[#5c6b7e]">Buscando...</p>}
                    {!assetSearchLoading && assetResults.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => addAsset(asset)}
                        className="block w-full border-b border-[#e8edf2] bg-white px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[#f7f9fb]"
                      >
                        <span className="font-semibold text-[#1a2332]">{asset.serial_number}</span>
                        <span className="mt-0.5 block text-xs text-[#5c6b7e]">{asset.display_name}</span>
                      </button>
                    ))}
                    {!assetSearchLoading && !assetResults.length && <p className="px-3 py-2 text-sm text-[#5c6b7e]">Nenhum equipamento em estoque encontrado.</p>}
                  </div>
                )}
                {serials.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {serials.map((serial) => (
                      <Badge key={serial} className="border border-[#c5daf0] bg-[#f3f7fb] text-[#164f84]">
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
                          <td><Badge className="border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]">OK</Badge></td>
                        </tr>
                      ))}
                      {preview?.errors.map((item) => (
                        <tr key={`${item.index}-${item.serial_number}`}>
                          <td className="font-mono text-xs">{item.serial_number || "-"}</td>
                          <td>{item.message}</td>
                          <td><Badge className="border border-[#f0c4c4] bg-[#fff4f4] text-[#9b1c1c]">Erro</Badge></td>
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
              <SectionHeader
                title="Responsável recebedor"
                action={canManageUsers ? <Button type="button" variant="secondary" size="sm" onClick={openUserCreate}><Plus size={14} />Cadastrar</Button> : undefined}
              />
              <div className="space-y-3 p-4">
                <Field label="Buscar recebedor">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} />
                    <Input className="pl-8" value={recipientSearch} onChange={(e) => setRecipientSearch(e.target.value)} placeholder="Nome, e-mail ou matrícula" />
                  </div>
                </Field>
                <div className="max-h-52 overflow-y-auto rounded-md border border-[#e8edf2]">
                  {filteredUsers.map((recipient) => (
                    <button
                      type="button"
                      key={recipient.id}
                      onClick={() => selectRecipient(recipient)}
                      className={`block w-full border-b border-[#e8edf2] px-3 py-2 text-left text-sm last:border-b-0 ${draft.recipient_user_id === String(recipient.id) ? "bg-[#f3f7fb]" : "bg-white hover:bg-[#f7f9fb]"}`}
                    >
                      <span className="font-semibold text-[#1a2332]">{recipient.full_name}</span>
                      <span className="mt-0.5 block text-xs text-[#5c6b7e]">{recipient.email} · {recipient.registration || "sem matrícula"}{!recipient.active ? " · conta bloqueada" : ""}</span>
                    </button>
                  ))}
                  {!filteredUsers.length && <EmptyState title="Nenhum usuário encontrado" description={canManageUsers ? "Cadastre o recebedor para usar no termo." : "Peça a um administrador para cadastrar o recebedor."} className="py-6" />}
                </div>
                {selectedRecipient && (
                  <Alert tone="info">
                    Selecionado: <strong>{selectedRecipient.full_name}</strong> ({selectedRecipient.email})
                  </Alert>
                )}
                {selectedContract && (
                  <Alert tone="info">Contrato definido: <strong>{selectedContract.name}</strong></Alert>
                )}
                <Field label="Matrícula no termo"><Input value={draft.recipient_registration} onChange={(e) => setDraft({ ...draft, recipient_registration: e.target.value })} /></Field>
                <Field label="Telefone no termo"><Input value={draft.recipient_phone} onChange={(e) => setDraft({ ...draft, recipient_phone: e.target.value })} /></Field>
                <Button className="w-full" disabled={saving || previewLoading || !canCreateTerm}><FileText size={16} />{saving ? "Emitindo..." : "Emitir termo"}</Button>
              </div>
            </Card>
          </div>
        </form>
      )}

      {view !== "emit" && (
      <Card className="overflow-hidden">
        <SectionHeader title={`${visibleTerms.length} termo(s)`} description="A confirmação de entrega aplica a alocação nos ativos do inventário." />
        <div className="overflow-x-auto soft-scrollbar">
          <table className="data-table min-w-[980px]">
            <thead><tr><th>Termo</th><th>Recebedor</th><th>Destino</th><th>Itens</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {visibleTerms.map((term) => (
                <tr key={term.id}>
                  <td><p className="font-semibold text-[#1a2332]">{term.term_number}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{formatDate(term.issued_at)}</p></td>
                  <td><p className="font-medium text-[#1a2332]">{term.recipient_name}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{term.recipient_email}</p></td>
                  <td><p className="font-medium text-[#1a2332]">{term.destination_unit}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{term.contract_number || "Sem contrato informado"}</p></td>
                  <td>{term.items.length}</td>
                  <td><Badge className={term.status === "delivered" ? "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]" : "border border-[#c5daf0] bg-[#f3f7fb] text-[#164f84]"}>{term.status === "delivered" && <CheckCircle2 size={13} />}{statusLabels[term.status]}</Badge></td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void downloadTerm(term)}><Download size={15} />DOCX</Button>
                      {canMove && term.status !== "delivered" && term.status !== "cancelled" && <Button type="button" variant="ghost" size="sm" onClick={() => setDeliverTerm(term)}><CheckCircle2 size={15} />Confirmar</Button>}
                      {canMove && term.status !== "delivered" && term.status !== "cancelled" && <Button type="button" variant="ghost" size="sm" onClick={() => void cancelTerm(term)}><Ban size={15} />Cancelar</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleTerms.length && <EmptyState icon={<FileText size={18} />} title="Nenhum termo encontrado" description="Os termos de recebimento aparecerão aqui." />}
      </Card>
      )}

      <UserFormDialog
        open={userDialogOpen}
        editing={null}
        draft={userDraft}
        saving={saving}
        error={error}
        secretariatOptions={activeCatalogItems(catalogs.secretariats)}
        sectorOptions={activeCatalogItems(catalogs.sectors)}
        onOpenChange={setUserDialogOpen}
        onConfirm={saveUser}
        onDraftChange={(next) => {
          const email = completeInstitutionalEmail(next.email);
          setUserDraft({ ...next, username: next.username || usernameFromEmail(email), active: false, email_verified: false, role: "user" });
        }}
      />

      <ConfirmDialog
        open={Boolean(deliverTerm)}
        onOpenChange={(open) => {
          if (!open) setDeliverTerm(null);
          setError("");
        }}
        onConfirm={confirmDelivery}
        loading={saving}
        title="Confirmar entrega"
        description={`Confirmar entrega do termo ${deliverTerm?.term_number || ""}? Esta ação atualiza setor e responsável dos equipamentos no inventário.`}
        confirmLabel="Confirmar entrega"
      >
        <div className="space-y-4">
          <Field label="Data da entrega"><Input type="date" value={deliverDate} onChange={(e) => setDeliverDate(e.target.value)} /></Field>
          <Field label="Observação da movimentação"><Textarea value={deliverNotes} onChange={(e) => setDeliverNotes(e.target.value)} placeholder="Ex.: Termo assinado e instalação concluída." /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </ConfirmDialog>
    </>
  );
}
