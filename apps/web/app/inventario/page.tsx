"use client";

import { Boxes, CircleOff, Eye, PackageCheck, Plus, Search, UserCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Card, EmptyState, Input, SectionHeader, Select, Toolbar, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { assetStatusTone, formatDate, inventoryAssetStatusLabels } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { InventoryAsset, InventoryAssetCatalogRef, InventoryAssetStatus } from "@/lib/types";

const emptyCounts: Record<InventoryAssetStatus, number> = {
  stock: 0,
  allocated: 0,
  maintenance: 0,
  retired: 0,
};

function catalogName(ref?: InventoryAssetCatalogRef | null) {
  return ref?.name || "Não informado";
}

function manufacturerModel(asset: InventoryAsset) {
  const value = [asset.manufacturer?.name, asset.equipment_model?.name].filter(Boolean).join(" / ");
  return value || "Não informado";
}

function assetSearchText(asset: InventoryAsset) {
  return [
    asset.serial_number,
    asset.display_name,
    asset.supplier?.name,
    asset.equipment_type?.name,
    asset.manufacturer?.name,
    asset.equipment_model?.name,
    asset.sector?.name,
    asset.assigned_user?.full_name,
    inventoryAssetStatusLabels[asset.status],
  ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
}

function uniqueNames(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export default function InventoryPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "inventory.view");
  const canCreate = hasPermission(user, "inventory.create");
  const canBulkScan = hasPermission(user, "inventory.bulk_scan");
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const assetData = await api.inventoryAssets();
      setAssets(assetData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar inventário");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) void load();
    else if (user) setLoading(false);
  }, [canView, user]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return assets.filter((asset) => (
      (!normalizedSearch || assetSearchText(asset).includes(normalizedSearch)) &&
      (!typeFilter || asset.equipment_type?.name === typeFilter) &&
      (!statusFilter || asset.status === statusFilter) &&
      (!sectorFilter || asset.sector?.name === sectorFilter)
    ));
  }, [assets, search, sectorFilter, statusFilter, typeFilter]);

  const counts = useMemo(() => assets.reduce<Record<InventoryAssetStatus, number>>((acc, asset) => {
    acc[asset.status] += 1;
    return acc;
  }, { ...emptyCounts }), [assets]);

  const typeOptions = useMemo(() => uniqueNames(assets.map((asset) => asset.equipment_type?.name)), [assets]);
  const sectorOptions = useMemo(() => uniqueNames(assets.map((asset) => asset.sector?.name)), [assets]);

  if (loading) return <LoadingScreen label="Carregando inventário..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Inventário"
        title="Inventário"
        subtitle="Consulte equipamentos por número de série, vínculo atual, setor e situação operacional."
        actions={(canCreate || canBulkScan) ? (
          <div className="flex flex-wrap gap-2">
            {canBulkScan && <Link href="/inventario/lote" className={buttonStyles({ variant: "secondary" })}><Plus size={16} />Entrada em lote</Link>}
            {canCreate && <Link href="/inventario/novo" className={buttonStyles()}><Plus size={16} />Novo equipamento</Link>}
          </div>
        ) : undefined}
      />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Equipamentos" value={assets.length} icon={<Boxes size={17} />} hint="Total registrado" tone="blue" />
        <MetricCard label="Em estoque" value={counts.stock} icon={<PackageCheck size={17} />} hint="Disponíveis para alocação" tone="cyan" />
        <MetricCard label="Alocados" value={counts.allocated} icon={<UserCheck size={17} />} hint="Vinculados a setor ou responsável" tone="green" />
        <MetricCard label="Em manutenção" value={counts.maintenance} icon={<Wrench size={17} />} hint="Aguardando reparo" tone="amber" />
        <MetricCard label="Baixados" value={counts.retired} icon={<Boxes size={17} />} hint="Arquivados" tone="slate" />
      </div>

      <Toolbar className="mb-4">
        <div className="grid w-full gap-2 xl:grid-cols-[minmax(240px,1fr)_180px_180px_180px]">
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} /><Input className="pl-8" placeholder="Buscar série, tipo, modelo, setor ou responsável" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">Todos os tipos</option>{typeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">Todos os status</option>{Object.entries(inventoryAssetStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <Select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}><option value="">Todos os setores</option>{sectorOptions.map((value) => <option key={value} value={value}>{value}</option>)}</Select>
        </div>
      </Toolbar>

      <Card className="overflow-hidden">
        <SectionHeader title={`${filtered.length} equipamento(s)`} description="A listagem usa o contrato novo do módulo de inventário." />
        <div className="overflow-x-auto soft-scrollbar">
          <table className="data-table min-w-[1180px]">
            <thead><tr><th>Número de série</th><th>Tipo</th><th>Fabricante / modelo</th><th>Fornecedor</th><th>Setor</th><th>Responsável</th><th>Status</th><th>Recebimento</th><th>Envio</th><th>Ações</th></tr></thead>
            <tbody>
              {filtered.map((asset) => (
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
        {!filtered.length && <EmptyState icon={<CircleOff size={18} />} title="Nenhum equipamento encontrado" description="Revise os filtros ou cadastre um novo equipamento." />}
      </Card>
    </>
  );
}
