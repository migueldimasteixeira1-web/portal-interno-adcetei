"use client";

import { ArrowLeft, CircleOff, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Button, Card, ConfirmDialog, EmptyState, SectionHeader, buttonStyles } from "@/components/ui";
import CatalogFormDialog from "@/features/inventory/CatalogFormDialog";
import CatalogModelsTable from "@/features/inventory/CatalogModelsTable";
import CatalogSimpleTable from "@/features/inventory/CatalogSimpleTable";
import CatalogTabs from "@/features/inventory/CatalogTabs";
import {
  catalogDialogTitle,
  catalogTabMeta,
  emptyCatalogs,
  emptyContractDraft,
  emptyModelDraft,
  emptySimpleDraft,
  isDefaultSector,
  sortByName,
  type CatalogTab,
  type ContractDraft,
  type DeleteTarget,
  type ModelDraft,
  type SimpleDraft,
} from "@/features/inventory/catalog-utils";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { InventoryCatalogItem, InventoryCatalogs, InventoryContract, InventoryEquipmentModel } from "@/lib/types";

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
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [editingSimple, setEditingSimple] = useState<InventoryCatalogItem | null>(null);
  const [editingModel, setEditingModel] = useState<InventoryEquipmentModel | null>(null);
  const [simpleDraft, setSimpleDraft] = useState<SimpleDraft>(emptySimpleDraft);
  const [contractDraft, setContractDraft] = useState<ContractDraft>(emptyContractDraft);
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

  const currentItems = useMemo(() => sortByName(catalogs[tab]), [catalogs, tab]);
  const manufacturerNameById = useMemo(() => new Map(catalogs.manufacturers.map((item) => [item.id, item.name])), [catalogs.manufacturers]);
  const equipmentTypeNameById = useMemo(() => new Map(catalogs.equipment_types.map((item) => [item.id, item.name])), [catalogs.equipment_types]);
  const supplierNameById = useMemo(() => new Map(catalogs.suppliers.map((item) => [item.id, item.name])), [catalogs.suppliers]);
  const tabMeta = catalogTabMeta(tab);

  const openCreate = () => {
    setEditingSimple(null);
    setEditingModel(null);
    setSimpleDraft(emptySimpleDraft);
    setContractDraft(emptyContractDraft);
    setModelDraft(emptyModelDraft);
    setError("");
    setDialogOpen(true);
  };

  const openEditSimple = (item: InventoryCatalogItem) => {
    setEditingSimple(item);
    setEditingModel(null);
    if (tab === "contracts") {
      const contract = item as InventoryContract;
      setContractDraft({ name: contract.name, is_active: contract.is_active, supplier_id: String(contract.supplier_id) });
    } else {
      setSimpleDraft({ name: item.name, is_active: item.is_active });
    }
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
    setContractDraft(emptyContractDraft);
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

  const saveContract = async () => {
    const name = contractDraft.name.trim();
    if (!name) {
      setError("Informe o contrato.");
      return;
    }
    if (!contractDraft.supplier_id) {
      setError("Selecione o fornecedor.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = { name, is_active: contractDraft.is_active, supplier_id: Number(contractDraft.supplier_id) };
      if (editingSimple) await api.updateInventoryContract(editingSimple.id, payload);
      else await api.createInventoryContract(payload);
      setMessage(editingSimple ? "Contrato atualizado com sucesso." : "Contrato criado com sucesso.");
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o contrato");
    } finally {
      setSaving(false);
    }
  };

  const save = () => (tab === "models" ? saveModel() : tab === "contracts" ? saveContract() : saveSimple());

  const deleteSelected = async () => {
    if (!deleting) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const id = deleting.item.id;
      if (deleting.tab === "suppliers") await api.deleteInventorySupplier(id);
      else if (deleting.tab === "contracts") await api.deleteInventoryContract(id);
      else if (deleting.tab === "equipment_types") await api.deleteInventoryEquipmentType(id);
      else if (deleting.tab === "manufacturers") await api.deleteInventoryManufacturer(id);
      else if (deleting.tab === "models") await api.deleteInventoryModel(id);
      else await api.deleteInventorySector(id);
      setDeleting(null);
      setMessage("Cadastro excluído com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o cadastro");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando cadastros do inventário..." />;
  if (!canManage) return <AccessDenied />;

  const editingDefaultSector = tab === "sectors" && editingSimple ? isDefaultSector(editingSimple.name) : false;

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

      <CatalogTabs
        tab={tab}
        onTabChange={(nextTab) => {
          setTab(nextTab);
          setMessage("");
          setError("");
        }}
      />

      <Card className="overflow-hidden">
        <SectionHeader
          title={tabMeta.label}
          description={`${currentItems.length} registro(s). Exclusão é permitida apenas sem vínculos.`}
          action={<Button size="sm" onClick={openCreate}><Plus size={15} />Novo cadastro</Button>}
        />

        {tab === "models" ? (
          <CatalogModelsTable
            items={currentItems as InventoryEquipmentModel[]}
            manufacturerNameById={manufacturerNameById}
            equipmentTypeNameById={equipmentTypeNameById}
            onEdit={openEditModel}
            onDelete={(item) => setDeleting({ tab: "models", item })}
          />
        ) : (
          <CatalogSimpleTable
            tab={tab}
            items={currentItems as InventoryCatalogItem[]}
            supplierNameById={supplierNameById}
            onEdit={openEditSimple}
            onDelete={(item) => setDeleting({ tab, item })}
          />
        )}

        {!currentItems.length && (
          <EmptyState
            icon={<CircleOff size={18} />}
            title={`Nenhum cadastro em ${tabMeta.label.toLowerCase()}`}
            description="Crie o primeiro registro para usar nos fluxos de inventário."
          />
        )}
      </Card>

      <CatalogFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
        onConfirm={save}
        loading={saving}
        error={error}
        tab={tab}
        title={catalogDialogTitle(tab, editingSimple, editingModel)}
        catalogs={catalogs}
        simpleDraft={simpleDraft}
        contractDraft={contractDraft}
        modelDraft={modelDraft}
        editingDefaultSector={editingDefaultSector}
        onSimpleDraftChange={setSimpleDraft}
        onContractDraftChange={setContractDraft}
        onModelDraftChange={setModelDraft}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
          setError("");
        }}
        onConfirm={deleteSelected}
        loading={saving}
        title="Excluir cadastro"
        description={`Excluir ${deleting?.item.name || "este cadastro"} permanentemente? Cadastros com vínculos no inventário não podem ser excluídos.`}
        confirmLabel="Excluir cadastro"
      >
        {error && <Alert tone="danger">{error}</Alert>}
      </ConfirmDialog>
    </>
  );
}
