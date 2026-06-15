"use client";

import { BookOpen, CircleOff, Layers3, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, SectionHeader, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { CatalogFormField, CatalogService } from "@/lib/types";

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
  icon: "support_agent",
  color: "#1f5eff",
  active: true,
  fields: [],
};

const emptyField: CatalogFormField = {
  key: "",
  label: "",
  type: "text",
  required: false,
  placeholder: "",
  options: [],
  max_length: 500,
};

export default function CatalogPage() {
  const { user } = useAuth();
  const canManage = user?.permissions?.includes("catalog.manage");
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<CatalogService | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogDraft>(emptyDraft);

  const load = async () => {
    try {
      setServices(await api.catalog(true));
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
    setError("");
    setDialogOpen(true);
  };

  const updateField = (index: number, patch: Partial<CatalogFormField>) => {
    setDraft((old) => ({
      ...old,
      fields: old.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field),
    }));
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
                      <div className="grid h-8 w-8 place-items-center rounded-md text-sm font-semibold text-white" style={{ backgroundColor: service.color }}>{service.name.charAt(0)}</div>
                      <div className="flex items-center gap-1">
                        <Badge className={service.active ? "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]" : "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]"}>{service.active ? "Ativo" : "Arquivado"}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(service)} aria-label={`Editar ${service.name}`}><Pencil size={15} /></Button>
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
          <Field label="Categoria"><Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Descrição"><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field></div>
          <Field label="Ícone interno"><Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} /></Field>
          <Field label="Cor"><Input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332]"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />Disponível para abertura</label>
        </div>

        <div className="mt-5 border-t border-[#e8edf2] pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-sm font-semibold text-[#1a2332]">Campos específicos</p><p className="text-xs text-[#5c6b7e]">A descrição geral continua obrigatória.</p></div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setDraft({ ...draft, fields: [...draft.fields, { ...emptyField }] })}><Plus size={14} />Adicionar campo</Button>
          </div>
          <div className="space-y-3">
            {draft.fields.map((field, index) => (
              <div key={index} className="rounded-md border border-[#d4dbe4] bg-[#f7f9fb] p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Identificador"><Input placeholder="ex.: software_name" value={field.key} onChange={(e) => updateField(index, { key: e.target.value.toLowerCase().replace(/\s+/g, "_") })} /></Field>
                  <Field label="Rótulo"><Input placeholder="Ex.: Nome do sistema" value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} /></Field>
                  <Field label="Tipo">
                    <Select value={field.type} onChange={(e) => updateField(index, { type: e.target.value as CatalogFormField["type"] })}>
                      <option value="text">Texto curto</option><option value="textarea">Texto longo</option><option value="email">E-mail</option><option value="date">Data</option><option value="select">Lista de opções</option>
                    </Select>
                  </Field>
                  <Field label="Limite de caracteres"><Input type="number" min={1} max={5000} value={field.max_length} onChange={(e) => updateField(index, { max_length: Number(e.target.value) || 500 })} /></Field>
                  <div className="sm:col-span-2"><Field label="Texto de ajuda"><Input value={field.placeholder} onChange={(e) => updateField(index, { placeholder: e.target.value })} /></Field></div>
                  {field.type === "select" && <div className="sm:col-span-2"><Field label="Opções" help="Separe por vírgula."><Input value={field.options.join(", ")} onChange={(e) => updateField(index, { options: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></Field></div>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-[#1a2332]"><input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} />Obrigatório</label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, fieldIndex) => fieldIndex !== index) })}><Trash2 size={14} />Remover campo</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      </ConfirmDialog>
    </>
  );
}
