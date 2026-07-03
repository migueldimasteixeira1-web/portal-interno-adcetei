"use client";

import { ArrowDown, ArrowUp, BookOpen, CircleOff, Layers3, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import CatalogIcon from "@/components/CatalogIcon";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, SectionHeader, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { CatalogFormField, CatalogOptions, CatalogService } from "@/lib/types";

type CatalogDraft = {
  name: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  active: boolean;
  fields: CatalogFormField[];
};

const emptyDraft: CatalogDraft = {
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
  const canManage = hasPermission(user, "catalog.manage");
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<CatalogService | null>(null);
  const [deleting, setDeleting] = useState<CatalogService | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogDraft>(emptyDraft);
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
    setMessage("");
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
        setMessage("Serviço atualizado com sucesso.");
      } else {
        await api.createCatalogService(payload);
        setMessage("Serviço criado com sucesso.");
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
    setMessage("");
    try {
      await api.deleteCatalogService(deleting.id);
      setDeleting(null);
      setMessage("Serviço excluído com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o serviço");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando catálogo de serviços..." />;
  if (!canManage) return <AccessDenied />;

  const categoryOptions = Array.from(new Set([...options.categories, ...services.map((service) => service.category), draft.category].filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const iconOptions = [...options.icons];
  if (draft.icon && !iconOptions.some((item) => item.key === draft.icon)) {
    iconOptions.push({ key: draft.icon, label: `${draft.icon} (legado)` });
  }
  const availableFields = options.fields.filter((field) => !draft.fields.some((item) => item.key === field.key));

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Catálogo de serviços"
        subtitle="Crie serviços, organize categorias e defina os campos apresentados na abertura do chamado."
        actions={<Button onClick={openCreate}><Plus size={16} />Novo serviço</Button>}
      />
      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && !dialogOpen && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <MetricCard label="Serviços cadastrados" value={services.length} icon={<BookOpen size={17} />} hint="Total do catálogo" tone="blue" />
        <MetricCard label="Serviços ativos" value={services.filter((service) => service.active).length} icon={<BookOpen size={17} />} hint="Disponíveis para abertura" tone="green" />
        <MetricCard label="Categorias" value={categories.length} icon={<Layers3 size={17} />} hint="Organização do catálogo" tone="cyan" />
      </div>

      <div className="space-y-4">
        {categories.map((category) => {
          const categoryServices = services.filter((service) => service.category === category);
          return (
            <Card key={category} className="overflow-hidden">
              <SectionHeader title={category} description={`${categoryServices.length} serviço(s) nesta categoria.`} />
              <div className="divide-y divide-[#e8edf2] md:grid md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
                {categoryServices.map((service) => (
                  <article key={service.id} className="border-b border-[#e8edf2] p-4 md:border-b-0 md:border-r">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-md border border-[#d4dbe4] bg-[#f7f9fb] text-[#5c6b7e]">
                        <CatalogIcon name={service.icon} size={16} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className={service.active ? "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]" : "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]"}>{service.active ? "Ativo" : "Arquivado"}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(service)} aria-label={`Editar ${service.name}`}><Pencil size={15} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(service)} aria-label={`Excluir ${service.name}`}><Trash2 size={15} /></Button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-[#1a2332]">{service.name}</h3>
                    <p className="mt-1 text-sm leading-5 text-[#5c6b7e]">{service.description}</p>
                    <div className="mt-3 border-t border-[#e8edf2] pt-2">
                      <p className="text-[11px] font-medium text-[#8b97a8]">Campos do formulário</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(service.form_schema.fields || []).map((field) => <span key={field.key} className="rounded border border-[#d4dbe4] bg-[#f7f9fb] px-1.5 py-0.5 text-[11px] font-medium text-[#5c6b7e]">{field.label}{field.required ? " *" : ""}</span>)}
                        {!service.form_schema.fields?.length && <span className="text-xs text-[#8b97a8]">Somente descrição geral</span>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </Card>
          );
        })}
        {!categories.length && <Card><EmptyState icon={<CircleOff size={18} />} title="Catálogo vazio" description="Crie o primeiro serviço para permitir a abertura de chamados." /></Card>}
      </div>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={save}
        loading={saving}
        title={editing ? "Editar serviço" : "Criar serviço"}
        description="Serviços usados em chamados antigos serão preservados pelo histórico. Para retirar uma opção, marque como inativa."
        confirmLabel="Salvar serviço"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Categoria">
            <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <option value="">Selecione</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2"><Field label="Descrição"><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field></div>
          <Field label="Ícone">
            <div className="flex gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#d4dbe4] bg-[#f7f9fb] text-[#5c6b7e]"><CatalogIcon name={draft.icon} size={17} /></span>
              <Select value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })}>
                {iconOptions.map((icon) => <option key={icon.key} value={icon.key}>{icon.label}</option>)}
              </Select>
            </div>
          </Field>
          <Field label="Cor"><Input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332]"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />Disponível para abertura</label>
        </div>

        <div className="mt-5 border-t border-[#e8edf2] pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-sm font-semibold text-[#1a2332]">Campos específicos</p><p className="text-xs text-[#5c6b7e]">A descrição geral continua obrigatória.</p></div>
            <div className="flex gap-2">
              <Select value={selectedFieldKey} onChange={(e) => setSelectedFieldKey(e.target.value)} className="w-56">
                <option value="">Selecionar campo</option>
                {availableFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
              </Select>
              <Button type="button" variant="secondary" size="sm" disabled={!selectedFieldKey} onClick={addPredefinedField}><Plus size={14} />Adicionar</Button>
            </div>
          </div>
          <div className="space-y-3">
            {draft.fields.map((field, index) => (
              <div key={index} className="rounded-md border border-[#d4dbe4] bg-[#f7f9fb] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#1a2332]">{field.label}</p>
                    <p className="mt-0.5 text-xs text-[#5c6b7e]">{field.placeholder || field.help || "Campo predefinido do catálogo."}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge className="border border-[#d4dbe4] bg-white text-[#5c6b7e]">{field.key}</Badge>
                      <Badge className="border border-[#d4dbe4] bg-white text-[#5c6b7e]">{field.type}</Badge>
                      {!options.fields.some((item) => item.key === field.key) && <Badge className="border border-[#fcd9a8] bg-[#fffbeb] text-[#92400e]">Legado</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => moveField(index, -1)}><ArrowUp size={14} />Subir</Button>
                    <Button type="button" variant="ghost" size="sm" disabled={index === draft.fields.length - 1} onClick={() => moveField(index, 1)}><ArrowDown size={14} />Descer</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, fieldIndex) => fieldIndex !== index) })}><Trash2 size={14} />Remover</Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-[#1a2332]"><input type="checkbox" checked={field.required} onChange={(e) => updateFieldRequired(index, e.target.checked)} />Obrigatório</label>
                  {field.type === "select" && !!field.options.length && <span className="text-xs text-[#8b97a8]">Opções: {field.options.join(", ")}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      </ConfirmDialog>

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
