"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Button, Card, Field, Select, Textarea } from "@/components/ui";
import { DynamicCatalogField, NewTicketServicePicker } from "@/features/tickets/NewTicketPanels";
import { api } from "@/lib/api";
import { assetTypeLabels } from "@/lib/format";
import type { AssetTicketOption, CatalogService } from "@/lib/types";

export default function NewTicketPage() {
  const router = useRouter();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [assets, setAssets] = useState<AssetTicketOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [assetId, setAssetId] = useState("");
  const [location, setLocation] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.catalog(), api.assetTicketOptions()])
      .then(([serviceList, assetList]) => { setServices(serviceList); setAssets(assetList); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => services.find((service) => service.id === selectedId), [services, selectedId]);
  const dynamicFields = selected?.form_schema.fields || [];

  const selectService = (serviceId: number) => {
    setSelectedId(serviceId);
    setFormData({});
    setFieldErrors({});
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return setError("Escolha um serviço antes de continuar.");
    const nextErrors: Record<string, string> = {};
    if (description.trim().length < 5) nextErrors.description = "Descreva a solicitação com pelo menos 5 caracteres.";
    dynamicFields.forEach((field) => {
      if (field.required && !formData[field.key]?.trim()) nextErrors[field.key] = `Preencha ${field.label.toLowerCase()}.`;
    });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError("Revise os campos destacados antes de enviar.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const ticket = await api.createTicket({
        description,
        service_id: selected.id,
        asset_id: assetId ? Number(assetId) : null,
        location,
        form_data: formData,
      });
      router.push(`/chamados/${ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o chamado");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando catálogo de serviços..." />;

  if (selected) return (
    <>
      <PageHeader
        eyebrow="Nova solicitação · Etapa 2 de 2"
        title={selected.name}
        subtitle="Descreva a necessidade para que a equipe de TI possa realizar a triagem corretamente."
        actions={<Button variant="secondary" onClick={() => { setSelectedId(null); setFieldErrors({}); setError(""); }}><ArrowLeft size={16} /> Trocar serviço</Button>}
      />

      <div className="mb-4 flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-[var(--accent)]">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-[var(--status-green-border)] bg-[var(--status-green-bg)]"><Check size={13} /></span>
          Serviço escolhido
        </span>
        <span className="h-px flex-1 bg-[var(--border)]" />
        <span className="flex items-center gap-1.5 font-semibold text-[var(--primary)]">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-xs">2</span>
          Detalhes
        </span>
      </div>

      <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="p-4 sm:p-5">
          {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

          <div className="mb-5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">Serviço selecionado</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">{selected.name}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{selected.description}</p>
          </div>

          <div className="space-y-4">
            <Field
              id="ticket-description"
              label="Descrição da solicitação *"
              help="Informe o que aconteceu, quando começou e mensagens de erro. Quanto mais claro, mais rápida será a triagem."
              error={fieldErrors.description}
            >
              <Textarea
                required
                minLength={5}
                maxLength={10000}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (fieldErrors.description) {
                    setFieldErrors((current) => {
                      const next = { ...current };
                      delete next.description;
                      return next;
                    });
                  }
                }}
                placeholder="Ex.: Preciso instalar a impressora Brother na estação ADSEGTEA004. A impressora já está no setor e possui o IP 192.168.22.18."
              />
              <span className="block text-right text-xs text-[var(--muted-light)]">{description.length} caracteres</span>
            </Field>
            {dynamicFields.length > 0 && (
              <section className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] p-4" aria-labelledby="service-fields-title">
                <div className="mb-4">
                  <h2 id="service-fields-title" className="text-sm font-semibold text-[var(--foreground)]">Informações do serviço</h2>
                  <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">Campos definidos pelo catálogo para agilizar a triagem.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {dynamicFields.map((field) => (
                    <DynamicCatalogField
                      key={field.key}
                      field={field}
                      value={formData[field.key] || ""}
                      error={fieldErrors[field.key]}
                      onChange={(value) => {
                        setFormData((current) => ({ ...current, [field.key]: value }));
                        setFieldErrors((current) => {
                          if (!current[field.key]) return current;
                          const next = { ...current };
                          delete next[field.key];
                          return next;
                        });
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="ticket-asset" label="Equipamento relacionado" help="Opcional. São exibidos somente equipamentos disponíveis para o seu perfil.">
                <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                  <option value="">Não sei informar / não se aplica</option>
                  {assets.map((asset) => <option key={asset.id} value={String(asset.id)}>{asset.name} · {asset.patrimony || assetTypeLabels[asset.asset_type] || asset.asset_type}</option>)}
                </Select>
              </Field>
              <Field id="ticket-location" label="Localização ou setor" help="Ajuda a equipe a identificar o local do atendimento.">
                <Select value={location} onChange={(e) => setLocation(e.target.value)}>
                  <option value="">Selecionar, se aplicável</option>
                  <option value="SEDECON - SEGTEA">SEDECON - SEGTEA</option>
                  <option value="Administração - RH">Administração - RH</option>
                  <option value="Fazenda - Atendimento">Fazenda - Atendimento</option>
                  <option value="Oficina de TI">Oficina de TI</option>
                  <option value="Datacenter - Sede">Datacenter - Sede</option>
                </Select>
              </Field>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--muted-light)]">O título será definido automaticamente como &ldquo;{selected.name}&rdquo;.</p>
            <Button disabled={submitting || description.trim().length < 5}>
              {submitting ? "Enviando solicitação..." : "Enviar chamado"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">O que acontece depois?</h2>
            <ol className="mt-3 space-y-3">
              {[
                "O chamado entra na fila central da TI.",
                "A equipe avalia a prioridade e define um responsável.",
                "Você acompanha respostas e mudanças no histórico.",
              ].map((item, index) => (
                <li key={item} className="flex gap-2.5 text-sm leading-6 text-[var(--muted)]">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] text-[11px] font-semibold text-[var(--primary)]">{index + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </Card>
          <Alert tone="info"><strong className="font-semibold">Prioridade definida pela TI.</strong> Na abertura, você não precisa classificar urgência ou impacto.</Alert>
        </div>
      </form>
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Nova solicitação · Etapa 1 de 2"
        title="Escolha o serviço"
        subtitle="Selecione a opção que melhor representa o que você precisa. A equipe de TI poderá ajustar a classificação durante a triagem."
      />

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--primary)]">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-xs">1</span>
          Escolher serviço
        </span>
        <span className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-[var(--muted-light)]">Detalhes</span>
      </div>

      <NewTicketServicePicker search={search} services={services} onSearchChange={setSearch} onSelect={selectService} />
    </>
  );
}
