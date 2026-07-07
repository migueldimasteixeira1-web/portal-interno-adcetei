"use client";

import { Boxes, PackageCheck, Plus, Settings2, UserCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import { Alert, buttonStyles } from "@/components/ui";
import InventoryAssetsTable from "@/features/inventory/InventoryAssetsTable";
import { emptyInventoryCatalogs } from "@/features/inventory/inventory-utils";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { InventoryAsset, InventoryCatalogs } from "@/lib/types";

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
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyInventoryCatalogs);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    void api.inventoryCatalogs().then(setCatalogs).catch(() => setCatalogs(emptyInventoryCatalogs));
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
  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setSectorFilter("");
    void load({ search: "", typeFilter: "", statusFilter: "", sectorFilter: "" }, 1);
  };

  const exportSpreadsheet = async () => {
    setExporting(true);
    setError("");
    try {
      await api.exportInventorySpreadsheet({
        search: appliedFilters.search || undefined,
        status_filter: appliedFilters.statusFilter || undefined,
        equipment_type_id: appliedFilters.typeFilter || undefined,
        sector_id: appliedFilters.sectorFilter || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível exportar o inventário.");
    } finally {
      setExporting(false);
    }
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

      <InventoryAssetsTable
        assets={assets}
        total={total}
        page={page}
        totalPages={totalPages}
        updating={updating}
        hasFilters={hasFilters}
        catalogs={catalogs}
        filters={{ search, typeFilter, statusFilter, sectorFilter }}
        onFiltersChange={(changes) => {
          if ("search" in changes) setSearch(changes.search ?? "");
          if ("typeFilter" in changes) setTypeFilter(changes.typeFilter ?? "");
          if ("statusFilter" in changes) setStatusFilter(changes.statusFilter ?? "");
          if ("sectorFilter" in changes) setSectorFilter(changes.sectorFilter ?? "");
        }}
        onClearFilters={clearFilters}
        onPageChange={(nextPage) => void load(appliedFilters, nextPage)}
        canExport={canView}
        exporting={exporting}
        onExport={() => void exportSpreadsheet()}
      />
    </>
  );
}
