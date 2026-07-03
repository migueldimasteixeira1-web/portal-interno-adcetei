"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Badge, Button, Card, Field, Input, SectionHeader, Select, Textarea, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { assetStatusTone } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { InventoryCatalogs, InventoryEquipmentModel, User } from "@/lib/types";

type Draft = {
  supplier_id: string;
  equipment_type_id: string;
  manufacturer_id: string;
  equipment_model_id: string;
  sector_id: string;
  assigned_user_id: string;
  serial_number: string;
  received_at: string;
  delivered_at: string;
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

function dateToPayload(value: string) {
  return value ? `${value}T12:00:00-03:00` : undefined;
}

function activeItems<T extends { is_active: boolean; name: string }>(items: T[]) {
  return items.filter((item) => item.is_active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export default function NewInventoryAssetPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = hasPermission(user, "inventory.create");
  const canViewUsers = hasPermission(user, "users.view");
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyCatalogs);
  const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<Draft>({
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

      <form onSubmit={submit} className="space-y-4">
        <Card className="overflow-hidden">
          <SectionHeader title="Identificação" description="Selecione os cadastros base e informe o número de série do equipamento." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Fornecedor">
              <Select value={draft.supplier_id} onChange={(event) => setDraft({ ...draft, supplier_id: event.target.value })}>
                <option value="">Selecione</option>
                {activeItems(catalogs.suppliers).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo de equipamento">
              <Select value={draft.equipment_type_id} onChange={(event) => setDraft({ ...draft, equipment_type_id: event.target.value })}>
                <option value="">Selecione</option>
                {activeItems(catalogs.equipment_types).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Fabricante">
              <Select value={draft.manufacturer_id} onChange={(event) => setDraft({ ...draft, manufacturer_id: event.target.value })}>
                <option value="">Selecione</option>
                {activeItems(catalogs.manufacturers).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Modelo" help={!draft.equipment_type_id || !draft.manufacturer_id ? "Selecione tipo e fabricante para filtrar os modelos." : undefined}>
              <Select value={draft.equipment_model_id} disabled={!draft.equipment_type_id || !draft.manufacturer_id} onChange={(event) => setDraft({ ...draft, equipment_model_id: event.target.value })}>
                <option value="">Selecione</option>
                {filteredModels.map((model: InventoryEquipmentModel) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </Select>
            </Field>
            <Field label="Número de série">
              <Input value={draft.serial_number} onChange={(event) => setDraft({ ...draft, serial_number: event.target.value })} placeholder="Informe o número de série" />
            </Field>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionHeader
            title="Alocação inicial"
            description="O status é calculado automaticamente pelo setor e responsável."
            action={<Badge className={assetStatusTone(predictedStatus)}>{willAllocate ? "Situação prevista: Alocado" : "Situação prevista: Estoque"}</Badge>}
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Setor">
              <Select value={draft.sector_id} onChange={(event) => setDraft({ ...draft, sector_id: event.target.value })}>
                <option value="">ADCETEI</option>
                {activeItems(catalogs.sectors).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            {canViewUsers && (
              <Field label="Responsável" help="Opcional. Use apenas usuário cadastrado no portal.">
                <Select value={draft.assigned_user_id} onChange={(event) => setDraft({ ...draft, assigned_user_id: event.target.value })}>
                  <option value="">Não vinculado</option>
                  {users.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.department}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Data de recebimento">
              <Input type="date" value={draft.received_at} onChange={(event) => setDraft({ ...draft, received_at: event.target.value })} />
            </Field>
            <Field label="Data de envio/entrega" help={willAllocate ? "Obrigatória para equipamento alocado." : "Opcional enquanto o equipamento permanecer em estoque."}>
              <Input type="date" value={draft.delivered_at} onChange={(event) => setDraft({ ...draft, delivered_at: event.target.value })} />
            </Field>
            <div className="sm:col-span-2 xl:col-span-3">
              <Field label="Observações">
                <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Informações complementares do recebimento ou cadastro." />
              </Field>
            </div>
          </div>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/inventario" className={buttonStyles({ variant: "secondary" })}>Cancelar</Link>
          <Button type="submit" disabled={saving || requiredMissing}><Save size={16} />{saving ? "Salvando..." : "Salvar equipamento"}</Button>
        </div>
      </form>
    </>
  );
}
