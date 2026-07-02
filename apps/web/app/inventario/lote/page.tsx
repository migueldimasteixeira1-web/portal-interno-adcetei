"use client";

import { ArrowLeft, CheckCircle2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, SectionHeader, Select, Textarea, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { InventoryBulkScanConfirm, InventoryBulkScanPayload, InventoryBulkScanPreview, InventoryCatalogs, InventoryEquipmentModel } from "@/lib/types";

type Draft = {
  supplier_id: string;
  equipment_type_id: string;
  manufacturer_id: string;
  equipment_model_id: string;
  received_at: string;
  notes: string;
};

const emptyCatalogs: InventoryCatalogs = {
  suppliers: [],
  equipment_types: [],
  manufacturers: [],
  models: [],
  sectors: [],
};

function todayInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function activeItems<T extends { is_active: boolean; name: string }>(items: T[]) {
  return items.filter((item) => item.is_active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function displaySerial(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).join(" ");
}

function normalizedSerial(value: string) {
  return displaySerial(value).toLocaleLowerCase("pt-BR");
}

export default function BulkInventoryAssetPage() {
  const { user } = useAuth();
  const canBulkScan = hasPermission(user, "inventory.bulk_scan");
  const inputRef = useRef<HTMLInputElement>(null);
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyCatalogs);
  const [draft, setDraft] = useState<Draft>({
    supplier_id: "",
    equipment_type_id: "",
    manufacturer_id: "",
    equipment_model_id: "",
    received_at: todayInputValue(),
    notes: "",
  });
  const [serialInput, setSerialInput] = useState("");
  const [serials, setSerials] = useState<string[]>([]);
  const [preview, setPreview] = useState<InventoryBulkScanPreview | null>(null);
  const [result, setResult] = useState<InventoryBulkScanConfirm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    if (!canBulkScan) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        setCatalogs(await api.inventoryCatalogs());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar os cadastros do inventário.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [canBulkScan, user]);

  const filteredModels = useMemo(
    () => activeItems(catalogs.models).filter((model) =>
      (!draft.manufacturer_id || String(model.manufacturer_id) === draft.manufacturer_id) &&
      (!draft.equipment_type_id || String(model.equipment_type_id) === draft.equipment_type_id)
    ),
    [catalogs.models, draft.equipment_type_id, draft.manufacturer_id],
  );

  useEffect(() => {
    if (!draft.equipment_model_id) return;
    const selected = catalogs.models.find((model) => String(model.id) === draft.equipment_model_id);
    if (!selected || !filteredModels.some((model) => model.id === selected.id)) {
      setDraft((current) => ({ ...current, equipment_model_id: "" }));
    }
  }, [catalogs.models, draft.equipment_model_id, filteredModels]);

  const resetValidation = () => {
    setPreview(null);
    setResult(null);
    setMessage("");
  };

  const updateDraft = (changes: Partial<Draft>) => {
    resetValidation();
    setDraft((current) => ({ ...current, ...changes }));
  };

  const addSerial = (value: string) => {
    const serial = displaySerial(value);
    if (!serial) {
      setError("Informe um número de série antes de adicionar.");
      return;
    }
    if (serials.some((item) => normalizedSerial(item) === normalizedSerial(serial))) {
      setError("Este número de série já foi lido neste lote.");
      setSerialInput("");
      inputRef.current?.focus();
      return;
    }
    resetValidation();
    setError("");
    setSerials((current) => [...current, serial]);
    setSerialInput("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeSerial = (serial: string) => {
    resetValidation();
    setSerials((current) => current.filter((item) => item !== serial));
    inputRef.current?.focus();
  };

  const payload = (): InventoryBulkScanPayload => ({
    supplier_id: Number(draft.supplier_id),
    equipment_type_id: Number(draft.equipment_type_id),
    manufacturer_id: Number(draft.manufacturer_id),
    equipment_model_id: Number(draft.equipment_model_id),
    received_at: draft.received_at,
    serial_numbers: serials,
    notes: draft.notes.trim(),
  });

  const requiredMissing = !draft.supplier_id || !draft.equipment_type_id || !draft.manufacturer_id || !draft.equipment_model_id || !draft.received_at || serials.length === 0;
  const canConfirm = Boolean(preview && preview.invalid_count === 0 && preview.valid_count > 0);

  const runPreview = async () => {
    setError("");
    setMessage("");
    if (requiredMissing) {
      setError("Preencha os dados comuns e leia pelo menos um número de série.");
      return;
    }
    setSaving(true);
    try {
      const data = await api.previewInventoryBulkScan(payload());
      setPreview(data);
      setMessage(data.invalid_count ? "Pré-validação concluída com pendências." : "Pré-validação concluída sem erros.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível pré-validar o lote.");
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (!canConfirm) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const data = await api.confirmInventoryBulkScan(payload());
      setResult(data);
      setMessage(`${data.created_count} equipamento(s) criado(s) em estoque.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar o lote.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando entrada em lote..." />;
  if (!canBulkScan) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Inventário"
        title="Entrada em lote"
        subtitle="Cadastre vários equipamentos iguais pela leitura ou digitação dos números de série."
        actions={<Link href="/inventario" className={buttonStyles({ variant: "secondary" })}><ArrowLeft size={16} />Voltar</Link>}
      />

      {message && <Alert tone={preview?.invalid_count ? "warning" : "success"} className="mb-4">{message}</Alert>}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <SectionHeader title="Dados comuns" description="Todos os equipamentos deste lote entrarão em estoque no setor ADCETEI." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Fornecedor">
              <Select value={draft.supplier_id} onChange={(event) => updateDraft({ supplier_id: event.target.value })}>
                <option value="">Selecione</option>
                {activeItems(catalogs.suppliers).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo de equipamento">
              <Select value={draft.equipment_type_id} onChange={(event) => updateDraft({ equipment_type_id: event.target.value })}>
                <option value="">Selecione</option>
                {activeItems(catalogs.equipment_types).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Fabricante">
              <Select value={draft.manufacturer_id} onChange={(event) => updateDraft({ manufacturer_id: event.target.value })}>
                <option value="">Selecione</option>
                {activeItems(catalogs.manufacturers).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Modelo" help={!draft.equipment_type_id || !draft.manufacturer_id ? "Selecione tipo e fabricante para filtrar os modelos." : undefined}>
              <Select value={draft.equipment_model_id} disabled={!draft.equipment_type_id || !draft.manufacturer_id} onChange={(event) => updateDraft({ equipment_model_id: event.target.value })}>
                <option value="">Selecione</option>
                {filteredModels.map((model: InventoryEquipmentModel) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </Select>
            </Field>
            <Field label="Data de recebimento">
              <Input type="date" value={draft.received_at} onChange={(event) => updateDraft({ received_at: event.target.value })} />
            </Field>
            <div className="sm:col-span-2 xl:col-span-3">
              <Field label="Observação">
                <Textarea value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} placeholder="Informações complementares da entrada do lote." />
              </Field>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader
            title="Leitura dos números de série"
            description="Use o leitor como teclado ou digite a série e pressione Enter."
            action={<Badge className="border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[#164f84]">{serials.length} lido(s)</Badge>}
          />
          <div className="space-y-4 p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                ref={inputRef}
                className="h-11 w-full rounded-md border border-[#d4dbe4] bg-white px-3 text-base text-[#1a2332] outline-none transition placeholder:text-[#8b97a8] focus:border-[#1a5f9e] focus:ring-2 focus:ring-[#e8f1f9]"
                value={serialInput}
                autoFocus
                placeholder="Leia ou digite o número de série"
                onChange={(event) => setSerialInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addSerial(serialInput);
                  }
                }}
              />
              <Button type="button" onClick={() => addSerial(serialInput)}><Plus size={16} />Adicionar</Button>
            </div>

            {serials.length ? (
              <div className="overflow-x-auto soft-scrollbar">
                <table className="data-table min-w-[520px]">
                  <thead><tr><th>#</th><th>Número de série</th><th>Ações</th></tr></thead>
                  <tbody>
                    {serials.map((serial, index) => (
                      <tr key={`${serial}-${index}`}>
                        <td className="text-[#5c6b7e]">{index + 1}</td>
                        <td className="font-medium text-[#1a2332]">{serial}</td>
                        <td><Button type="button" variant="ghost" size="sm" onClick={() => removeSerial(serial)}><Trash2 size={14} />Remover</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="Nenhum número de série lido" description="O lote só pode ser pré-validado depois de pelo menos uma leitura." />}
          </div>
        </Card>

        {preview && (
          <Card className="overflow-hidden">
            <SectionHeader title="Pré-validação" description="Revise os itens antes de confirmar a criação no estoque." />
            <div className="grid gap-2 p-4 sm:grid-cols-3">
              <div className="panel-flat p-3"><p className="text-xs text-[#5c6b7e]">Total enviado</p><p className="mt-1 text-xl font-semibold text-[#1a2332]">{preview.total}</p></div>
              <div className="panel-flat p-3"><p className="text-xs text-[#5c6b7e]">Válidos</p><p className="mt-1 text-xl font-semibold text-[#0d5c4f]">{preview.valid_count}</p></div>
              <div className="panel-flat p-3"><p className="text-xs text-[#5c6b7e]">Com erro</p><p className="mt-1 text-xl font-semibold text-[#991b1b]">{preview.invalid_count}</p></div>
            </div>
            {preview.errors.length > 0 && (
              <div className="border-t border-[#e8edf2] p-4">
                <p className="mb-2 text-sm font-semibold text-[#1a2332]">Pendências encontradas</p>
                <div className="overflow-x-auto soft-scrollbar">
                  <table className="data-table min-w-[620px]">
                    <thead><tr><th>Linha</th><th>Número de série</th><th>Erro</th></tr></thead>
                    <tbody>
                      {preview.errors.map((item) => (
                        <tr key={`${item.index}-${item.normalized_serial}`}>
                          <td className="text-[#5c6b7e]">{item.index}</td>
                          <td className="text-[#5c6b7e]">{item.serial_number || "Não informado"}</td>
                          <td className="text-[#991b1b]">{item.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        )}

        {result && (
          <Alert tone="success">
            <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} />{result.created_count} equipamento(s) criado(s) como estoque ADCETEI.</span>
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/inventario" className={buttonStyles({ variant: "secondary" })}>Voltar para inventário</Link>
          <Button type="button" variant="secondary" disabled={saving || requiredMissing} onClick={runPreview}>{saving ? "Validando..." : "Pré-validar lote"}</Button>
          <Button type="button" disabled={saving || !canConfirm} onClick={confirm}>{saving ? "Salvando..." : "Confirmar entrada"}</Button>
        </div>
      </div>
    </>
  );
}
