"use client";

import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Button, buttonStyles } from "@/components/ui";
import { BulkScanCommonFields, BulkScanPreviewCard, BulkScanSerialPanel, type BulkScanDraft } from "@/features/inventory/BulkScanPanels";
import { activeCatalogItems, displaySerial, emptyInventoryCatalogs, normalizedSerial, todayInputValue } from "@/features/inventory/inventory-utils";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { InventoryBulkScanConfirm, InventoryBulkScanPayload, InventoryBulkScanPreview, InventoryCatalogs } from "@/lib/types";

export default function BulkInventoryAssetPage() {
  const { user } = useAuth();
  const canBulkScan = hasPermission(user, "inventory.bulk_scan");
  const inputRef = useRef<HTMLInputElement>(null);
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyInventoryCatalogs);
  const [draft, setDraft] = useState<BulkScanDraft>({
    supplier_id: "",
    equipment_type_id: "",
    manufacturer_id: "",
    equipment_model_id: "",
    received_at: todayInputValue(),
    specifications: "",
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
    () => activeCatalogItems(catalogs.models).filter((model) =>
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

  const updateDraft = (changes: Partial<BulkScanDraft>) => {
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
    specifications: draft.specifications.trim(),
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
        <BulkScanCommonFields draft={draft} catalogs={catalogs} filteredModels={filteredModels} onDraftChange={updateDraft} />
        <BulkScanSerialPanel
          inputRef={inputRef}
          serialInput={serialInput}
          serials={serials}
          onSerialInputChange={setSerialInput}
          onAddSerial={addSerial}
          onRemoveSerial={removeSerial}
        />
        {preview && <BulkScanPreviewCard preview={preview} />}
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
