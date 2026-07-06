import { Pencil, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { InventoryEquipmentModel } from "@/lib/types";
import { activeBadgeClass } from "./catalog-utils";

type Props = {
  items: InventoryEquipmentModel[];
  manufacturerNameById: Map<number, string>;
  equipmentTypeNameById: Map<number, string>;
  onEdit: (item: InventoryEquipmentModel) => void;
  onDelete: (item: InventoryEquipmentModel) => void;
};

export default function CatalogModelsTable({
  items,
  manufacturerNameById,
  equipmentTypeNameById,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto soft-scrollbar">
      <table className="data-table min-w-[920px]">
        <thead>
          <tr>
            <th>Modelo</th>
            <th>Fabricante</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((model) => (
            <tr key={model.id}>
              <td className="font-semibold text-[#1a2332]">{model.name}</td>
              <td className="text-[#5c6b7e]">{manufacturerNameById.get(model.manufacturer_id) || "—"}</td>
              <td className="text-[#5c6b7e]">{equipmentTypeNameById.get(model.equipment_type_id) || "—"}</td>
              <td>
                <Badge className={activeBadgeClass(model.is_active)}>{model.is_active ? "Ativo" : "Inativo"}</Badge>
              </td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(model)} aria-label={`Editar ${model.name}`}>
                    <Pencil size={15} />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(model)} aria-label={`Excluir ${model.name}`}>
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
