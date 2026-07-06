import { ArrowRight, Info, Search } from "lucide-react";
import CatalogIcon from "@/components/CatalogIcon";
import { Card, EmptyState, Field, Input, Select, Textarea } from "@/components/ui";
import type { CatalogFormField, CatalogService } from "@/lib/types";

export function DynamicCatalogField({
  field,
  value,
  error,
  onChange,
}: {
  field: CatalogFormField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  const fieldId = `catalog-field-${field.key}`;
  const wrapperClass = field.type === "textarea" ? "md:col-span-2" : "";

  if (field.type === "textarea") {
    return (
      <div className={wrapperClass}>
        <Field id={fieldId} label={label} error={error}>
          <Textarea
            required={field.required}
            maxLength={field.max_length}
            placeholder={field.placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <Field id={fieldId} label={label} error={error}>
        <Select required={field.required} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Selecione uma opção</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </Select>
      </Field>
    );
  }

  return (
    <Field id={fieldId} label={label} error={error}>
      <Input
        type={field.type}
        required={field.required}
        maxLength={field.max_length}
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

type PickerProps = {
  search: string;
  services: CatalogService[];
  onSearchChange: (value: string) => void;
  onSelect: (serviceId: number) => void;
};

export function NewTicketServicePicker({ search, services, onSearchChange, onSelect }: PickerProps) {
  const filteredServices = services.filter((service) => `${service.name} ${service.category} ${service.description}`.toLowerCase().includes(search.toLowerCase()));
  const categories = Array.from(new Set(filteredServices.map((service) => service.category)));

  return (
    <>
      <div className="mb-4 max-w-lg">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} />
          <Input aria-label="Buscar serviço" className="pl-8" placeholder="Buscar serviço, categoria ou palavra-chave" value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <section key={category} aria-labelledby={`category-${category}`}>
            <div className="mb-2 flex items-center gap-3">
              <h2 id={`category-${category}`} className="text-sm font-semibold text-[#1a2332]">{category}</h2>
              <span className="h-px flex-1 bg-[#d4dbe4]" />
              <span className="text-xs text-[#8b97a8]">{filteredServices.filter((service) => service.category === category).length} serviço(s)</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filteredServices.filter((service) => service.category === category).map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onSelect(service.id)}
                  className="panel-flat flex items-start gap-3 p-3.5 text-left transition hover:border-[#1a5f9e] focus-visible:border-[#1a5f9e]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#d4dbe4] bg-[#f7f9fb] text-[#5c6b7e]">
                    <CatalogIcon name={service.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[#1a2332]">{service.name}</h3>
                    <p className="mt-1 text-sm leading-5 text-[#5c6b7e]">{service.description}</p>
                  </div>
                  <ArrowRight className="mt-0.5 shrink-0 text-[#8b97a8]" size={16} />
                </button>
              ))}
            </div>
          </section>
        ))}
        {!filteredServices.length && (
          <Card><EmptyState icon={<Info size={18} />} title="Nenhum serviço encontrado" description="Tente buscar por outro termo ou navegue pelas categorias disponíveis." /></Card>
        )}
      </div>
    </>
  );
}
