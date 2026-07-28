import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import CatalogIcon from "@/components/CatalogIcon";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, Select, Textarea } from "@/components/ui";
import type { CatalogFormField, CatalogOptions, CatalogService } from "@/lib/types";

export type ServiceCatalogDraft = {
  name: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  active: boolean;
  fields: CatalogFormField[];
};

type GridProps = {
  services: CatalogService[];
  onEdit: (service: CatalogService) => void;
  onDelete: (service: CatalogService) => void;
};

export function ServiceCatalogGrid({ services, onEdit, onDelete }: GridProps) {
  const categories = Array.from(new Set(services.map((service) => service.category)));

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const categoryServices = services.filter((service) => service.category === category);
        return (
          <div key={category} className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card)]">
            <div className="border-b border-[var(--border-subtle)] px-4 py-3">
              <h3 className="font-semibold text-[var(--foreground)]">{category}</h3>
              <p className="text-xs text-[var(--muted)]">{categoryServices.length} serviço(s) nesta categoria.</p>
            </div>
            <div className="divide-y divide-[var(--border-subtle)] md:grid md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
              {categoryServices.map((service) => (
                <article key={service.id} className="border-b border-[var(--border-subtle)] p-4 md:border-b-0 md:border-r">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]">
                      <CatalogIcon name={service.icon} size={16} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge className={service.active ? "border border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[var(--status-green-text)]" : "border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"}>{service.active ? "Ativo" : "Arquivado"}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(service)} aria-label={`Editar ${service.name}`}><Pencil size={15} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(service)} aria-label={`Excluir ${service.name}`}><Trash2 size={15} /></Button>
                    </div>
                  </div>
                  <h4 className="font-semibold text-[var(--foreground)]">{service.name}</h4>
                  <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{service.description}</p>
                  <div className="mt-3 border-t border-[var(--border-subtle)] pt-2">
                    <p className="text-[11px] font-medium text-[var(--muted-light)]">Campos do formulário</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(service.form_schema.fields || []).map((field) => <span key={field.key} className="rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--muted)]">{field.label}{field.required ? " *" : ""}</span>)}
                      {!service.form_schema.fields?.length && <span className="text-xs text-[var(--muted-light)]">Somente descrição geral</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type FormDialogProps = {
  open: boolean;
  editing: CatalogService | null;
  draft: ServiceCatalogDraft;
  options: CatalogOptions;
  selectedFieldKey: string;
  saving: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onDraftChange: (draft: ServiceCatalogDraft) => void;
  onSelectedFieldKeyChange: (key: string) => void;
  onAddPredefinedField: () => void;
  onMoveField: (index: number, direction: -1 | 1) => void;
  onUpdateFieldRequired: (index: number, required: boolean) => void;
  onRemoveField: (index: number) => void;
};

export function ServiceCatalogFormDialog({
  open,
  editing,
  draft,
  options,
  selectedFieldKey,
  saving,
  error,
  onOpenChange,
  onConfirm,
  onDraftChange,
  onSelectedFieldKeyChange,
  onAddPredefinedField,
  onMoveField,
  onUpdateFieldRequired,
  onRemoveField,
}: FormDialogProps) {
  const categoryOptions = Array.from(new Set([...options.categories, draft.category].filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const iconOptions = [...options.icons];
  if (draft.icon && !iconOptions.some((item) => item.key === draft.icon)) {
    iconOptions.push({ key: draft.icon, label: `${draft.icon} (legado)` });
  }
  const availableFields = options.fields.filter((field) => !draft.fields.some((item) => item.key === field.key));

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      loading={saving}
      title={editing ? "Editar serviço" : "Criar serviço"}
      description="Serviços usados em chamados antigos serão preservados pelo histórico. Para retirar uma opção, marque como inativa."
      confirmLabel="Salvar serviço"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome"><Input value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} /></Field>
        <Field label="Categoria">
          <Select value={draft.category} onChange={(e) => onDraftChange({ ...draft, category: e.target.value })}>
            <option value="">Selecione</option>
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2"><Field label="Descrição"><Textarea value={draft.description} onChange={(e) => onDraftChange({ ...draft, description: e.target.value })} /></Field></div>
        <Field label="Ícone">
          <div className="flex gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]"><CatalogIcon name={draft.icon} size={17} /></span>
            <Select value={draft.icon} onChange={(e) => onDraftChange({ ...draft, icon: e.target.value })}>
              {iconOptions.map((icon) => <option key={icon.key} value={icon.key}>{icon.label}</option>)}
            </Select>
          </div>
        </Field>
        <Field label="Cor"><Input type="color" value={draft.color} onChange={(e) => onDraftChange({ ...draft, color: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"><input type="checkbox" checked={draft.active} onChange={(e) => onDraftChange({ ...draft, active: e.target.checked })} />Disponível para abertura</label>
      </div>

      <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div><p className="text-sm font-semibold text-[var(--foreground)]">Campos específicos</p><p className="text-xs text-[var(--muted)]">A descrição geral continua obrigatória.</p></div>
          <div className="flex gap-2">
            <Select value={selectedFieldKey} onChange={(e) => onSelectedFieldKeyChange(e.target.value)} className="w-56">
              <option value="">Selecionar campo</option>
              {availableFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
            </Select>
            <Button type="button" variant="secondary" size="sm" disabled={!selectedFieldKey} onClick={onAddPredefinedField}><Plus size={14} />Adicionar</Button>
          </div>
        </div>
        <div className="space-y-3">
          {draft.fields.map((field, index) => (
            <div key={index} className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{field.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{field.placeholder || field.help || "Campo predefinido do catálogo."}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge className="border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]">{field.key}</Badge>
                    <Badge className="border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]">{field.type}</Badge>
                    {!options.fields.some((item) => item.key === field.key) && <Badge className="border border-[var(--status-amber-border)] bg-[var(--status-amber-bg)] text-[var(--status-amber-text)]">Legado</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => onMoveField(index, -1)}><ArrowUp size={14} />Subir</Button>
                  <Button type="button" variant="ghost" size="sm" disabled={index === draft.fields.length - 1} onClick={() => onMoveField(index, 1)}><ArrowDown size={14} />Descer</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveField(index)}><Trash2 size={14} />Remover</Button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-[var(--foreground)]"><input type="checkbox" checked={field.required} onChange={(e) => onUpdateFieldRequired(index, e.target.checked)} />Obrigatório</label>
                {field.type === "select" && !!field.options.length && <span className="text-xs text-[var(--muted-light)]">Opções: {field.options.join(", ")}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
    </ConfirmDialog>
  );
}
