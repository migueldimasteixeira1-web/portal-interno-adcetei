import { Pencil, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { InventoryCatalogItem, InventoryContract, InventorySector } from "@/lib/types";
import { activeBadgeClass, isDefaultSector, type CatalogTab } from "./catalog-utils";

type Props = {
  tab: CatalogTab;
  items: InventoryCatalogItem[];
  supplierNameById?: Map<number, string>;
  secretariatNameById?: Map<number, string>;
  onEdit: (item: InventoryCatalogItem) => void;
  onDelete: (item: InventoryCatalogItem) => void;
};

export default function CatalogSimpleTable({ tab, items, supplierNameById, secretariatNameById, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto soft-scrollbar">
      <table className="data-table min-w-[720px]">
        <thead>
          <tr>
            {tab === "sectors" ? <th>Secretaria</th> : <th>Nome</th>}
            {tab === "sectors" && <th>Setor</th>}
            <th>Status</th>
            {tab === "contracts" && <th>Fornecedor</th>}
            {tab === "sectors" && <th>Observação</th>}
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {tab === "sectors" ? (
                <>
                  <td className="font-semibold text-[var(--foreground)]">{secretariatNameById?.get((item as InventorySector).secretariat_id || 0) || "Secretaria não vinculada"}</td>
                  <td className="text-[var(--muted)]">{item.name}</td>
                </>
              ) : (
                <td className="font-semibold text-[var(--foreground)]">{item.name}</td>
              )}
              <td>
                <Badge className={activeBadgeClass(item.is_active)}>{item.is_active ? "Ativo" : "Inativo"}</Badge>
              </td>
              {tab === "contracts" && (
                <td className="text-[var(--muted)]">{supplierNameById?.get((item as InventoryContract).supplier_id) || "Fornecedor não informado"}</td>
              )}
              {tab === "sectors" && (
                <td className="text-[var(--muted)]">
                  {isDefaultSector(item.name) ? (
                    <Badge className="border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[var(--primary-hover)]">Padrão do sistema</Badge>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`}>
                    <Pencil size={15} />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={tab === "sectors" && isDefaultSector(item.name)}
                    onClick={() => onDelete(item)}
                    aria-label={`Excluir ${item.name}`}
                  >
                    <Trash2 size={15} />
                    Excluir
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
