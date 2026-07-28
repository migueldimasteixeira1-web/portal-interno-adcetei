import { CircleOff, Eye, FileSpreadsheet, LoaderCircle, Search, X } from "lucide-react";
import Link from "next/link";
import ListPagination from "@/components/ListPagination";
import { Badge, Button, Card, EmptyState, Input, SectionHeader, Select, Toolbar, buttonStyles } from "@/components/ui";
import { assetStatusTone, formatDate, inventoryAssetStatusLabels } from "@/lib/format";
import type { InventoryAsset, InventoryCatalogs } from "@/lib/types";
import { activeCatalogItems, catalogRefName, manufacturerModel } from "./inventory-utils";

type FilterState = {
  search: string;
  typeFilter: string;
  statusFilter: string;
  secretariatFilter: string;
  sectorFilter: string;
};

type Props = {
  assets: InventoryAsset[];
  total: number;
  page: number;
  totalPages: number;
  updating: boolean;
  hasFilters: boolean;
  catalogs: InventoryCatalogs;
  filters: FilterState;
  onFiltersChange: (changes: Partial<FilterState>) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  canExport: boolean;
  exporting: boolean;
  onExport: () => void;
};

export default function InventoryAssetsTable({
  assets,
  total,
  page,
  totalPages,
  updating,
  hasFilters,
  catalogs,
  filters,
  onFiltersChange,
  onClearFilters,
  onPageChange,
  canExport,
  exporting,
  onExport,
}: Props) {
  const typeOptions = activeCatalogItems(catalogs.equipment_types);
  const secretariatOptions = activeCatalogItems(catalogs.secretariats);
  const sectorOptions = activeCatalogItems(
    catalogs.sectors.filter((item) => !filters.secretariatFilter || String(item.secretariat_id) === filters.secretariatFilter),
  );

  return (
    <>
      <Toolbar className="mb-4">
        <div className="grid w-full gap-2 xl:grid-cols-[minmax(220px,1fr)_170px_170px_190px_170px_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" size={16} />
            <Input
              aria-label="Buscar equipamentos"
              className="pl-8"
              placeholder="Buscar série, tipo, modelo, setor ou responsável"
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
            />
          </div>
          <Select aria-label="Filtrar por tipo" value={filters.typeFilter} onChange={(e) => onFiltersChange({ typeFilter: e.target.value })}>
            <option value="">Todos os tipos</option>
            {typeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Select aria-label="Filtrar por status" value={filters.statusFilter} onChange={(e) => onFiltersChange({ statusFilter: e.target.value })}>
            <option value="">Todos os status</option>
            {Object.entries(inventoryAssetStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select aria-label="Filtrar por secretaria" value={filters.secretariatFilter} onChange={(e) => onFiltersChange({ secretariatFilter: e.target.value })}>
            <option value="">Todas as secretarias</option>
            {secretariatOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Select aria-label="Filtrar por setor" value={filters.sectorFilter} disabled={!filters.secretariatFilter} onChange={(e) => onFiltersChange({ sectorFilter: e.target.value })}>
            <option value="">Todos os setores</option>
            {sectorOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={onClearFilters} aria-label="Limpar filtros"><X size={16} /></Button>
          )}
          {canExport && (
            <Button type="button" variant="secondary" disabled={exporting} onClick={onExport}>
              {exporting ? <LoaderCircle className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
              {exporting ? "Exportando..." : "Exportar"}
            </Button>
          )}
        </div>
      </Toolbar>

      <Card className="relative overflow-hidden" aria-busy={updating}>
        {updating && (
          <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-[var(--status-blue-border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--primary-hover)] shadow-sm">
            <LoaderCircle className="animate-spin" size={13} /> Atualizando
          </div>
        )}
        <SectionHeader
          title={`${total} ${total === 1 ? "equipamento encontrado" : "equipamentos encontrados"}`}
          description={hasFilters ? "Resultado dos filtros aplicados." : "Equipamentos ordenados pelo cadastro mais recente."}
        />
        <div className="overflow-x-auto soft-scrollbar">
          <table className="data-table min-w-[1180px]">
            <thead><tr><th>Número de série</th><th>Tipo</th><th>Fabricante / modelo</th><th>Fornecedor</th><th>Secretaria / setor</th><th>Responsável</th><th>Status</th><th>Recebimento</th><th>Envio</th><th>Ações</th></tr></thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td><p className="font-semibold text-[var(--foreground)]">{asset.serial_number || "Não informado"}</p><p className="mt-0.5 text-xs text-[var(--muted-light)]">{asset.display_name || "Equipamento sem descrição"}</p></td>
                  <td className="text-[var(--muted)]">{catalogRefName(asset.equipment_type)}</td>
                  <td className="text-[var(--muted)]">{manufacturerModel(asset)}</td>
                  <td className="text-[var(--muted)]">{catalogRefName(asset.supplier)}</td>
                  <td><p className="font-medium text-[var(--foreground)]">{asset.sector?.secretariat?.name || "Não informado"}</p><p className="mt-0.5 text-xs text-[var(--muted-light)]">{catalogRefName(asset.sector)}</p></td>
                  <td><p className="font-medium text-[var(--foreground)]">{asset.assigned_user?.full_name || "Não vinculado"}</p><p className="mt-0.5 text-xs text-[var(--muted-light)]">{asset.assigned_user ? `${asset.assigned_user.secretariat} - ${asset.assigned_user.department}` : "—"}</p></td>
                  <td><Badge className={assetStatusTone(asset.status)}>{inventoryAssetStatusLabels[asset.status] || asset.status}</Badge></td>
                  <td className="text-[var(--muted)]">{formatDate(asset.received_at, false)}</td>
                  <td className="text-[var(--muted)]">{formatDate(asset.delivered_at, false)}</td>
                  <td>
                    <Link href={`/inventario/${asset.id}`} className={buttonStyles({ variant: "ghost", size: "sm" })} aria-label={`Ver detalhes de ${asset.serial_number || "equipamento"}`}>
                      <Eye size={15} />
                      Detalhes
                    </Link>
                  </td>
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
            action={hasFilters ? <Button variant="secondary" onClick={onClearFilters}>Limpar filtros</Button> : undefined}
          />
        )}
        <ListPagination page={page} totalPages={totalPages} total={total} updating={updating} hasFilters={hasFilters} onPageChange={onPageChange} />
      </Card>
    </>
  );
}
