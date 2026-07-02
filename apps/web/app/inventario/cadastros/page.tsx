"use client";

import { ArrowLeft, Building2, CircleOff, Factory, Layers3, Package, Pencil, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, SectionHeader, Select, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { InventoryCatalogItem, InventoryCatalogs, InventoryEquipmentModel } from "@/lib/types";

const DEFAULT_INVENTORY_SECTOR = "ADCETEI";

type CatalogTab = "suppliers" | "equipment_types" | "manufacturers" | "models" | "sectors";

type SimpleDraft = {
  name: string;
  is_active: boolean;
};

type ModelDraft = SimpleDraft & {
  manufacturer_id: string;
  equipment_type_id: string;
};

const emptyCatalogs: InventoryCatalogs = {
  suppliers: [],
  equipment_types: [],
  manufacturers: [],
  models: [],
  sectors: [],
};

const emptySimpleDraft: SimpleDraft = { name: "", is_active: true };
const emptyModelDraft: ModelDraft = { name: "", is_active: true, manufacturer_id: "", equipment_type_id: "" };

const tabs: Array<{ id: CatalogTab; label: string; icon: typeof Truck }> = [
  { id: "suppliers", label: "Fornecedores", icon: Truck },
  { id: "equipment_types", label: "Tipos de equipamento", icon: Layers3 },
  { id: "manufacturers", label: "Fabricantes", icon: Factory },
  { id: "models", label: "Modelos", icon: Package },
  { id: "sectors", label: "Setores", icon: Building2 },
];

function isDefaultSector(name: string) {
  return name.trim().toLocaleUpperCase("pt-BR") === DEFAULT_INVENTORY_SECTOR;
}

function activeBadge(isActive: boolean) {
  return isActive
    ? "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]"
    : "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]";
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export default function InventoryCatalogsPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "inventory.manage_catalogs");
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyCatalogs);
  const [tab, setTab] = useState<CatalogTab>("suppliers");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSimple, setEditingSimple] = useState<InventoryCatalogItem | null>(null);
  const [editingModel, setEditingModel] = useState<InventoryEquipmentModel | null>(null);
  const [simpleDraft, setSimpleDraft] = useState<SimpleDraft>(emptySimpleDraft);
  const [modelDraft, setModelDraft] = useState<ModelDraft>(emptyModelDraft);

  const load = async () => {
    try {
      setCatalogs(await api.inventoryCatalogs());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar cadastros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) void load();
    else if (user) setLoading(false);
  }, [canManage, user]);

  const currentItems = useMemo(() => {
    const items = catalogs[tab];
    return sortByName(items);
  }, [catalogs, tab]);

  const manufacturerNameById = useMemo(() => new Map(catalogs.manufacturers.map((item) => [item.id, item.name])), [catalogs.manufacturers]);
  const equipmentTypeNameById = useMemo(() => new Map(catalogs.equipment_types.map((item) => [item.id, item.name])), [catalogs.equipment_types]);

  const tabMeta = tabs.find((item) => item.id === tab)!;

  const openCreate = () => {
    setEditingSimple(null);
    setEditingModel(null);
    setSimpleDraft(emptySimpleDraft);
    setModelDraft(emptyModelDraft);
    setError("");
    setDialogOpen(true);
  };

  const openEditSimple = (item: InventoryCatalogItem) => {
    setEditingSimple(item);
    setEditingModel(null);
    setSimpleDraft({ name: item.name, is_active: item.is_active });
    setError("");
    setDialogOpen(true);
  };

  const openEditModel = (item: InventoryEquipmentModel) => {
    setEditingModel(item);
    setEditingSimple(null);
    setModelDraft({
      name: item.name,
      is_active: item.is_active,
      manufacturer_id: String(item.manufacturer_id),
      equipment_type_id: String(item.equipment_type_id),
    });
    setError("");
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingSimple(null);
    setEditingModel(null);
    setSimpleDraft(emptySimpleDraft);
    setModelDraft(emptyModelDraft);
    setError("");
  };

  const saveSimple = async () => {
    const name = simpleDraft.name.trim();
    if (!name) {
      setError("Informe o nome do cadastro.");
      return;
    }
    if (tab === "sectors" && editingSimple && isDefaultSector(editingSimple.name) && !simpleDraft.is_active) {
      setError("O setor ADCETEI é o padrão do sistema e deve permanecer ativo.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = { name, is_active: simpleDraft.is_active };
      if (tab === "suppliers") {
        if (editingSimple) await api.updateInventorySupplier(editingSimple.id, payload);
        else await api.createInventorySupplier(payload);
      } else if (tab === "equipment_types") {
        if (editingSimple) await api.updateInventoryEquipmentType(editingSimple.id, payload);
        else await api.createInventoryEquipmentType(payload);
      } else if (tab === "manufacturers") {
        if (editingSimple) await api.updateInventoryManufacturer(editingSimple.id, payload);
        else await api.createInventoryManufacturer(payload);
      } else if (tab === "sectors") {
        if (editingSimple) await api.updateInventorySector(editingSimple.id, payload);
        else await api.createInventorySector(payload);
      }
      setMessage(editingSimple ? "Cadastro atualizado com sucesso." : "Cadastro criado com sucesso.");
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o cadastro");
    } finally {
      setSaving(false);
    }
  };

  const saveModel = async () => {
    const name = modelDraft.name.trim();
    if (!name) {
      setError("Informe o nome do modelo.");
      return;
    }
    if (!modelDraft.manufacturer_id) {
      setError("Selecione o fabricante.");
      return;
    }
    if (!modelDraft.equipment_type_id) {
      setError("Selecione o tipo de equipamento.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name,
        is_active: modelDraft.is_active,
        manufacturer_id: Number(modelDraft.manufacturer_id),
        equipment_type_id: Number(modelDraft.equipment_type_id),
      };
      if (editingModel) await api.updateInventoryModel(editingModel.id, payload);
      else await api.createInventoryModel(payload);
      setMessage(editingModel ? "Modelo atualizado com sucesso." : "Modelo criado com sucesso.");
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o modelo");
    } finally {
      setSaving(false);
    }
  };

  const save = () => (tab === "models" ? saveModel() : saveSimple());

  if (loading) return <LoadingScreen label="Carregando cadastros do inventário..." />;
  if (!canManage) return <AccessDenied />;

  const editingDefaultSector = tab === "sectors" && editingSimple ? isDefaultSector(editingSimple.name) : false;
  const dialogTitle = tab === "models"
    ? (editingModel ? "Editar modelo" : "Novo modelo")
    : (editingSimple ? `Editar ${tabMeta.label.slice(0, -1).toLowerCase()}` : `Novo ${tabMeta.label.slice(0, -1).toLowerCase()}`);

  return (
    <>
      <PageHeader
        eyebrow="Inventário"
        title="Cadastros base"
        subtitle="Gerencie fornecedores, tipos, fabricantes, modelos e setores usados pelo módulo de inventário."
        actions={(
          <Link href="/inventario" className={buttonStyles({ variant: "secondary" })}>
            <ArrowLeft size={16} />
            Voltar ao inventário
          </Link>
        )}
      />
      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && !dialogOpen && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { setTab(item.id); setMessage(""); setError(""); }}
              className={buttonStyles({ variant: active ? "primary" : "secondary", size: "sm" })}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <SectionHeader
          title={tabMeta.label}
          description={`${currentItems.length} registro(s). Use desativação em vez de exclusão.`}
          action={<Button size="sm" onClick={openCreate}><Plus size={15} />Novo cadastro</Button>}
        />

        {tab === "models" ? (
          <div className="overflow-x-auto soft-scrollbar">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Fabricante</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => {
                  const model = item as InventoryEquipmentModel;
                  return (
                    <tr key={model.id}>
                      <td className="font-semibold text-[#1a2332]">{model.name}</td>
                      <td className="text-[#5c6b7e]">{manufacturerNameById.get(model.manufacturer_id) || "—"}</td>
                      <td className="text-[#5c6b7e]">{equipmentTypeNameById.get(model.equipment_type_id) || "—"}</td>
                      <td><Badge className={activeBadge(model.is_active)}>{model.is_active ? "Ativo" : "Inativo"}</Badge></td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => openEditModel(model)} aria-label={`Editar ${model.name}`}>
                          <Pencil size={15} />
                          Editar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto soft-scrollbar">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Status</th>
                  {tab === "sectors" && <th>Observação</th>}
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold text-[#1a2332]">{item.name}</td>
                    <td><Badge className={activeBadge(item.is_active)}>{item.is_active ? "Ativo" : "Inativo"}</Badge></td>
                    {tab === "sectors" && (
                      <td className="text-[#5c6b7e]">
                        {isDefaultSector(item.name) ? <Badge className="border border-[#c5daf0] bg-[#f3f7fb] text-[#164f84]">Padrão do sistema</Badge> : "—"}
                      </td>
                    )}
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => openEditSimple(item)} aria-label={`Editar ${item.name}`}>
                        <Pencil size={15} />
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!currentItems.length && (
          <EmptyState
            icon={<CircleOff size={18} />}
            title={`Nenhum cadastro em ${tabMeta.label.toLowerCase()}`}
            description="Crie o primeiro registro para usar nos fluxos de inventário."
          />
        )}
      </Card>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
        onConfirm={save}
        loading={saving}
        title={dialogTitle}
        description={tab === "sectors"
          ? "Setores desativados deixam de aparecer em novos cadastros. O setor ADCETEI permanece como estoque padrão do sistema."
          : "Cadastros desativados permanecem no histórico e deixam de ser usados em novos registros."}
        confirmLabel="Salvar"
      >
        {tab === "models" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fabricante" error={!modelDraft.manufacturer_id && error ? "Selecione o fabricante." : undefined}>
              <Select value={modelDraft.manufacturer_id} onChange={(e) => setModelDraft({ ...modelDraft, manufacturer_id: e.target.value })}>
                <option value="">Selecione</option>
                {sortByName(catalogs.manufacturers.filter((item) => item.is_active || String(item.id) === modelDraft.manufacturer_id)).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de equipamento" error={!modelDraft.equipment_type_id && error ? "Selecione o tipo." : undefined}>
              <Select value={modelDraft.equipment_type_id} onChange={(e) => setModelDraft({ ...modelDraft, equipment_type_id: e.target.value })}>
                <option value="">Selecione</option>
                {sortByName(catalogs.equipment_types.filter((item) => item.is_active || String(item.id) === modelDraft.equipment_type_id)).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Nome do modelo">
                <Input value={modelDraft.name} onChange={(e) => setModelDraft({ ...modelDraft, name: e.target.value })} placeholder="Ex.: Latitude 3420" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332] sm:col-span-2">
              <input type="checkbox" checked={modelDraft.is_active} onChange={(e) => setModelDraft({ ...modelDraft, is_active: e.target.checked })} />
              Cadastro ativo
            </label>
          </div>
        ) : (
          <div className="grid gap-4">
            <Field label="Nome">
              <Input
                value={simpleDraft.name}
                onChange={(e) => setSimpleDraft({ ...simpleDraft, name: e.target.value })}
                placeholder={`Nome do ${tabMeta.label.slice(0, -1).toLowerCase()}`}
                disabled={editingDefaultSector}
              />
            </Field>
            {editingDefaultSector && (
              <Alert tone="info">O setor ADCETEI é o estoque padrão do sistema. O nome não pode ser alterado por aqui.</Alert>
            )}
            <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332]">
              <input
                type="checkbox"
                checked={simpleDraft.is_active}
                onChange={(e) => setSimpleDraft({ ...simpleDraft, is_active: e.target.checked })}
                disabled={editingDefaultSector}
              />
              Cadastro ativo
            </label>
          </div>
        )}
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      </ConfirmDialog>
    </>
  );
}
