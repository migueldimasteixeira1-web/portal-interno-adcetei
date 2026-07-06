"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, buttonStyles } from "@/components/ui";
import NewInventoryAssetForm, { type NewAssetDraft } from "@/features/inventory/NewInventoryAssetForm";
import { activeCatalogItems, dateToPayload, emptyInventoryCatalogs, todayInputValue } from "@/features/inventory/inventory-utils";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { InventoryCatalogs, User } from "@/lib/types";

export default function NewInventoryAssetPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = hasPermission(user, "inventory.create");
  const canViewUsers = hasPermission(user, "users.view");
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyInventoryCatalogs);
  const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<NewAssetDraft>({
    supplier_id: "",
    equipment_type_id: "",
    manufacturer_id: "",
    equipment_model_id: "",
    sector_id: "",
    assigned_user_id: "",
    serial_number: "",
    received_at: todayInputValue(),
    delivered_at: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    if (!canCreate) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const [catalogData, userData] = await Promise.all([
          api.inventoryCatalogs(),
          canViewUsers ? api.users() : Promise.resolve([]),
        ]);
        const defaultSector = catalogData.sectors.find((item) => item.name.toLocaleLowerCase("pt-BR") === "adcetei");
        setCatalogs(catalogData);
        setUsers(userData);
        setDraft((current) => ({ ...current, sector_id: current.sector_id || (defaultSector ? String(defaultSector.id) : "") }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar os cadastros do inventário.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [canCreate, canViewUsers, user]);

  const selectedSector = catalogs.sectors.find((item) => String(item.id) === draft.sector_id);
  const isDefaultSector = !selectedSector || selectedSector.name.toLocaleLowerCase("pt-BR") === "adcetei";
  const willAllocate = !isDefaultSector || Boolean(draft.assigned_user_id);
  const predictedStatus = willAllocate ? "allocated" : "stock";
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

  const requiredMissing = !draft.supplier_id || !draft.equipment_type_id || !draft.manufacturer_id || !draft.equipment_model_id || !draft.serial_number.trim() || !draft.received_at || (willAllocate && !draft.delivered_at);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (requiredMissing) {
      setError("Preencha os campos obrigatórios antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      await api.createInventoryAsset({
        supplier_id: Number(draft.supplier_id),
        equipment_type_id: Number(draft.equipment_type_id),
        manufacturer_id: Number(draft.manufacturer_id),
        equipment_model_id: Number(draft.equipment_model_id),
        sector_id: draft.sector_id ? Number(draft.sector_id) : null,
        assigned_user_id: draft.assigned_user_id ? Number(draft.assigned_user_id) : null,
        serial_number: draft.serial_number.trim(),
        received_at: dateToPayload(draft.received_at) || "",
        delivered_at: dateToPayload(draft.delivered_at) || null,
        notes: draft.notes.trim(),
      });
      setMessage("Equipamento cadastrado com sucesso.");
      router.push("/inventario");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar o equipamento.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando cadastro de equipamento..." />;
  if (!canCreate) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Inventário"
        title="Novo equipamento"
        subtitle="Cadastro individual usando os catálogos base e o número de série como identificação principal."
        actions={<Link href="/inventario" className={buttonStyles({ variant: "secondary" })}><ArrowLeft size={16} />Voltar</Link>}
      />

      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <NewInventoryAssetForm
        draft={draft}
        catalogs={catalogs}
        users={users}
        filteredModels={filteredModels}
        canViewUsers={canViewUsers}
        willAllocate={willAllocate}
        predictedStatus={predictedStatus}
        saving={saving}
        requiredMissing={requiredMissing}
        onDraftChange={(changes) => setDraft((current) => ({ ...current, ...changes }))}
        onSubmit={submit}
      />
    </>
  );
}
