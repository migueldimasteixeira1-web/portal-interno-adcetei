"use client";

import { BookOpen, CircleOff, Layers3, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import { Alert, Button, Card, ConfirmDialog, EmptyState } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ServiceCatalogFormDialog, ServiceCatalogGrid, type ServiceCatalogDraft } from "@/features/admin/ServiceCatalogPanels";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { CatalogOptions, CatalogService } from "@/lib/types";

const emptyDraft: ServiceCatalogDraft = {
  name: "",
  category: "",
  description: "",
  icon: "Headphones",
  color: "#1f5eff",
  active: true,
  fields: [],
};

const emptyOptions: CatalogOptions = {
  categories: [],
  icons: [],
  fields: [],
};

export default function CatalogPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = hasPermission(user, "catalog.manage");
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CatalogService | null>(null);
  const [deleting, setDeleting] = useState<CatalogService | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ServiceCatalogDraft>(emptyDraft);
  const [options, setOptions] = useState<CatalogOptions>(emptyOptions);
  const [selectedFieldKey, setSelectedFieldKey] = useState("");

  const load = async () => {
    try {
      const [serviceData, optionData] = await Promise.all([api.catalog(true), api.catalogOptions()]);
      setServices(serviceData);
      setOptions(optionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar catálogo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) void load();
    else if (user) setLoading(false);
  }, [canManage, user]);

  const categories = useMemo(() => Array.from(new Set(services.map((service) => service.category))), [services]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setSelectedFieldKey("");
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (service: CatalogService) => {
    setEditing(service);
    setDraft({
      name: service.name,
      category: service.category,
      description: service.description,
      icon: service.icon,
      color: service.color,
      active: service.active,
      fields: service.form_schema.fields || [],
    });
    setSelectedFieldKey("");
    setError("");
    setDialogOpen(true);
  };

  const updateFieldRequired = (index: number, required: boolean) => {
    setDraft((old) => ({
      ...old,
      fields: old.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, required } : field),
    }));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.fields.length) return;
    const nextFields = [...draft.fields];
    [nextFields[index], nextFields[nextIndex]] = [nextFields[nextIndex], nextFields[index]];
    setDraft({ ...draft, fields: nextFields });
  };

  const addPredefinedField = () => {
    const field = options.fields.find((item) => item.key === selectedFieldKey);
    if (!field) return;
    if (draft.fields.some((item) => item.key === field.key)) {
      setError("Este campo já foi adicionado ao serviço.");
      return;
    }
    setDraft({ ...draft, fields: [...draft.fields, { ...field }] });
    setSelectedFieldKey("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: draft.name,
        category: draft.category,
        description: draft.description,
        icon: draft.icon,
        color: draft.color,
        active: draft.active,
        form_schema: { fields: draft.fields },
      };
      if (editing) {
        await api.updateCatalogService(editing.id, payload);
        toast("Serviço atualizado com sucesso.");
      } else {
        await api.createCatalogService(payload);
        toast("Serviço criado com sucesso.");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o serviço");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!deleting) return;
    setSaving(true);
    setError("");
    try {
      await api.deleteCatalogService(deleting.id);
      setDeleting(null);
      toast("Serviço excluído com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o serviço");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando catálogo de serviços..." />;
  if (!canManage) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Catálogo de serviços"
        subtitle="Crie serviços, organize categorias e defina os campos apresentados na abertura do chamado."
        actions={<Button onClick={openCreate}><Plus size={16} />Novo serviço</Button>}
      />
      {error && !dialogOpen && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <MetricCard label="Serviços cadastrados" value={services.length} icon={<BookOpen size={17} />} hint="Total do catálogo" tone="blue" />
        <MetricCard label="Serviços ativos" value={services.filter((service) => service.active).length} icon={<BookOpen size={17} />} hint="Disponíveis para abertura" tone="green" />
        <MetricCard label="Categorias" value={categories.length} icon={<Layers3 size={17} />} hint="Organização do catálogo" tone="cyan" />
      </div>

      {categories.length ? (
        <ServiceCatalogGrid services={services} onEdit={openEdit} onDelete={setDeleting} />
      ) : (
        <Card><EmptyState icon={<CircleOff size={18} />} title="Catálogo vazio" description="Crie o primeiro serviço para permitir a abertura de chamados." /></Card>
      )}

      <ServiceCatalogFormDialog
        open={dialogOpen}
        editing={editing}
        draft={draft}
        options={options}
        selectedFieldKey={selectedFieldKey}
        saving={saving}
        error={error}
        onOpenChange={setDialogOpen}
        onConfirm={save}
        onDraftChange={setDraft}
        onSelectedFieldKeyChange={setSelectedFieldKey}
        onAddPredefinedField={addPredefinedField}
        onMoveField={moveField}
        onUpdateFieldRequired={updateFieldRequired}
        onRemoveField={(index) => setDraft({ ...draft, fields: draft.fields.filter((_, fieldIndex) => fieldIndex !== index) })}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
          setError("");
        }}
        onConfirm={deleteSelected}
        loading={saving}
        title="Excluir serviço"
        description={`Excluir ${deleting?.name || "este serviço"} permanentemente? Serviços já usados em chamados não podem ser excluídos.`}
        confirmLabel="Excluir serviço"
      >
        {error && <Alert tone="danger">{error}</Alert>}
      </ConfirmDialog>
    </>
  );
}
