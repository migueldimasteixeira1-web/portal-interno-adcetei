"use client";

import { Boxes, ChevronLeft, ChevronRight, CircleOff, Eye, LoaderCircle, PackageCheck, Plus, Search, Settings2, UserCheck, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Button, Card, EmptyState, Input, SectionHeader, Select, Toolbar, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { assetStatusTone, formatDate, inventoryAssetStatusLabels } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { InventoryAsset, InventoryAssetCatalogRef, InventoryCatalogs } from "@/lib/types";

const emptyCatalogs: InventoryCatalogs = {
  suppliers: [],
  equipment_types: [],
  manufacturers: [],
  models: [],
  sectors: [],
};

function catalogName(ref?: InventoryAssetCatalogRef | null) {
  return ref?.name || "Não informado";
}

function manufacturerModel(asset: InventoryAsset) {
  const value = [asset.manufacturer?.name, asset.equipment_model?.name].filter(Boolean).join(" / ");
  return value || "Não informado";
}

function activeCatalogOptions(items: Array<{ id: number; name: string; is_active?: boolean }>) {
  return items.filter((item) => item.is_active !== false).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export default function InventoryPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "inventory.view");
  const canCreate = hasPermission(user, "inventory.create");
  const canBulkScan = hasPermission(user, "inventory.bulk_scan");
  const canManageCatalogs = hasPermission(user, "inventory.manage_catalogs");
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", typeFilter: "", statusFilter: "", sectorFilter: "" });
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState({ stock: 0, allocated: 0, maintenance: 0, retired: 0 });
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyCatalogs);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const hasLoaded = useRef(false);

  const load = async (
    filters: { search: string; typeFilter: string; statusFilter: string; sectorFilter: string },
    requestedPage = 1,
  ) => {
    const requestId = ++requestSequence.current;
    if (hasLoaded.current) setUpdating(true);
    else setInitialLoading(true);
    try {
      const result = await api.inventoryAssets({
        search: filters.search || undefined,
        status_filter: filters.statusFilter || undefined,
        equipment_type_id: filters.typeFilter || undefined,
        sector_id: filters.sectorFilter || undefined,
        page: requestedPage,
        page_size: 20,
      });
      if (requestId !== requestSequence.current) return;
      setAssets(result.items);
      setTotal(result.total);
      setPage(result.page);
      setSummary(result.summary);
      setAppliedFilters(filters);
      setError("");
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar inventário");
    } finally {
      if (requestId === requestSequence.current) {
        hasLoaded.current = true;
        setInitialLoading(false);
        setUpdating(false);
      }
    }
  };

  useEffect(() => {
    if (!canView) {
      if (user) setInitialLoading(false);
      return;
    }
    void api.inventoryCatalogs().then(setCatalogs).catch(() => setCatalogs(emptyCatalogs));
    void load({ search: "", typeFilter: "", statusFilter: "", sectorFilter: "" }, 1);
  }, [canView, user]);

  useEffect(() => {
    if (!canView || !hasLoaded.current) return;
    if (
      search === appliedFilters.search &&
      typeFilter === appliedFilters.typeFilter &&
      statusFilter === appliedFilters.statusFilter &&
      sectorFilter === appliedFilters.sectorFilter
    ) return;
    const timer = setTimeout(() => {
      void load({ search, typeFilter, statusFilter, sectorFilter }, 1);
    }, 250);
    return () => clearTimeout(timer);
  }, [canView, search, typeFilter, statusFilter, sectorFilter, appliedFilters]);

  const hasFilters = !!(appliedFilters.search || appliedFilters.typeFilter || appliedFilters.statusFilter || appliedFilters.sectorFilter);
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const typeOptions = activeCatalogOptions(catalogs.equipment_types);
  const sectorOptions = activeCatalogOptions(catalogs.sectors);
  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setSectorFilter("");
    void load({ search: "", typeFilter: "", statusFilter: "", sectorFilter: "" }, 1);
  };

  if (initialLoading) return <LoadingScreen label="Carregando inventário..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Inventário"
        title="Inventário"
        subtitle="Consulte equipamentos por número de série, vínculo atual, setor e situação operacional."
        actions={(canCreate || canBulkScan || canManageCatalogs) ? (
          <div className="flex flex-wrap gap-2">
            {canManageCatalogs && <Link href="/inventario/cadastros" className={buttonStyles({ variant: "secondary" })}><Settings2 size={16} />Cadastros</Link>}
            {canBulkScan && <Link href="/inventario/lote" className={buttonStyles({ variant: "secondary" })}><Plus size={16} />Entrada em lote</Link>}
            {canCreate && <Link href="/inventario/novo" className={buttonStyles()}><Plus size={16} />Novo equipamento</Link>}
          </div>
        ) : undefined}
      />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Equipamentos" value={total} icon={<Boxes size={17} />} hint="Total encontrado" tone="blue" />
        <MetricCard label="Em estoque" value={summary.stock} icon={<PackageCheck size={17} />} hint="Disponíveis para alocação" tone="cyan" />
        <MetricCard label="Alocados" value={summary.allocated} icon={<UserCheck size={17} />} hint="Vinculados a setor ou responsável" tone="green" />
        <MetricCard label="Em manutenção" value={summary.maintenance} icon={<Wrench size={17} />} hint="Aguardando reparo" tone="amber" />
        <MetricCard label="Baixados" value={summary.retired} icon={<Boxes size={17} />} hint="Arquivados" tone="slate" />
      </div>

      <Toolbar className="mb-4">
        <div className="grid w-full gap-2 xl:grid-cols-[minmax(240px,1fr)_180px_180px_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} />
            <Input aria-label="Buscar equipamentos" className="pl-8" placeholder="Buscar série, tipo, modelo, setor ou responsável" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Filtrar por tipo" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Todos os tipos</option>
            {typeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Select aria-label="Filtrar por status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(inventoryAssetStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select aria-label="Filtrar por setor" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
            <option value="">Todos os setores</option>
            {sectorOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={clearFilters} aria-label="Limpar filtros"><X size={16} /></Button>
          )}
        </div>
      </Toolbar>

      <Card className="relative overflow-hidden" aria-busy={updating}>
        {updating && (
          <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-[#c5daf0] bg-white px-2.5 py-1 text-xs font-medium text-[#164f84] shadow-sm">
            <LoaderCircle className="animate-spin" size={13} /> Atualizando
          </div>
        )}
        <SectionHeader
          title={`${total} ${total === 1 ? "equipamento encontrado" : "equipamentos encontrados"}`}
          description={hasFilters ? "Resultado dos filtros aplicados." : "Equipamentos ordenados pelo cadastro mais recente."}
        />
        <div className="overflow-x-auto soft-scrollbar">
          <table className="data-table min-w-[1180px]">
            <thead><tr><th>Número de série</th><th>Tipo</th><th>Fabricante / modelo</th><th>Fornecedor</th><th>Setor</th><th>Responsável</th><th>Status</th><th>Recebimento</th><th>Envio</th><th>Ações</th></tr></thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td><p className="font-semibold text-[#1a2332]">{asset.serial_number || "Não informado"}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{asset.display_name || "Equipamento sem descrição"}</p></td>
                  <td className="text-[#5c6b7e]">{catalogName(asset.equipment_type)}</td>
                  <td className="text-[#5c6b7e]">{manufacturerModel(asset)}</td>
                  <td className="text-[#5c6b7e]">{catalogName(asset.supplier)}</td>
                  <td className="text-[#5c6b7e]">{catalogName(asset.sector)}</td>
                  <td><p className="font-medium text-[#1a2332]">{asset.assigned_user?.full_name || "Não vinculado"}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{asset.assigned_user?.department || "—"}</p></td>
                  <td><Badge className={assetStatusTone(asset.status)}>{inventoryAssetStatusLabels[asset.status] || asset.status}</Badge></td>
                  <td className="text-[#5c6b7e]">{formatDate(asset.received_at, false)}</td>
                  <td className="text-[#5c6b7e]">{formatDate(asset.delivered_at, false)}</td>
                  <td><Link href={`/inventario/${asset.id}`} className={buttonStyles({ variant: "ghost", size: "sm" })}><Eye size={15} />Ver detalhes</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!assets.length && (
          <EmptyState
            icon={<CircleOff size={18} />}
            title={hasFilters ? "Nenhum equipamento corresponde aos filtros" : "Nenhum equipamento encontrado"}
            description={hasFilters ? "Revise os termos ou limpe os filtros para ampliar a busca." : "Cadastre um novo equipamento para iniciar o inventário."}
            action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button> : undefined}
          />
        )}
        {(total > 0 || hasFilters) && (
          <div className="flex flex-col gap-3 border-t border-[#e8edf2] bg-[#f7f9fb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#5c6b7e]">
              Página <strong className="text-[#1a2332]">{page}</strong> de <strong className="text-[#1a2332]">{totalPages}</strong>
              <span className="ml-1">· {total} registro(s) no total</span>
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={updating || page <= 1} onClick={() => void load(appliedFilters, page - 1)}>
                <ChevronLeft size={15} /> Anterior
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={updating || page >= totalPages} onClick={() => void load(appliedFilters, page + 1)}>
                Próxima <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
