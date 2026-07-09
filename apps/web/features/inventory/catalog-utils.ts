import { Building2, Factory, FileText, Layers3, Landmark, Package, Truck } from "lucide-react";
import type { InventoryCatalogItem, InventoryCatalogs, InventoryContract, InventoryEquipmentModel, InventorySector } from "@/lib/types";

export const DEFAULT_INVENTORY_SECTOR = "ADCETEI";

export type CatalogTab = "secretariats" | "suppliers" | "contracts" | "equipment_types" | "manufacturers" | "models" | "sectors";
export type DeleteTarget = { tab: CatalogTab; item: InventoryCatalogItem | InventoryEquipmentModel | InventoryContract | InventorySector };

export type SimpleDraft = {
  name: string;
  is_active: boolean;
};

export type ModelDraft = SimpleDraft & {
  manufacturer_id: string;
  equipment_type_id: string;
};

export type ContractDraft = SimpleDraft & {
  supplier_id: string;
};

export type SectorDraft = SimpleDraft & {
  secretariat_id: string;
};

export const emptyCatalogs: InventoryCatalogs = {
  secretariats: [],
  suppliers: [],
  contracts: [],
  equipment_types: [],
  manufacturers: [],
  models: [],
  sectors: [],
};

export const emptySimpleDraft: SimpleDraft = { name: "", is_active: true };
export const emptyModelDraft: ModelDraft = { name: "", is_active: true, manufacturer_id: "", equipment_type_id: "" };
export const emptyContractDraft: ContractDraft = { name: "", is_active: true, supplier_id: "" };
export const emptySectorDraft: SectorDraft = { name: "", is_active: true, secretariat_id: "" };

export const catalogTabs: Array<{ id: CatalogTab; label: string; icon: typeof Truck }> = [
  { id: "secretariats", label: "Secretarias", icon: Landmark },
  { id: "suppliers", label: "Fornecedores", icon: Truck },
  { id: "contracts", label: "Contratos", icon: FileText },
  { id: "equipment_types", label: "Tipos de equipamento", icon: Layers3 },
  { id: "manufacturers", label: "Fabricantes", icon: Factory },
  { id: "models", label: "Modelos", icon: Package },
  { id: "sectors", label: "Setores", icon: Building2 },
];

export function isDefaultSector(name: string) {
  return name.trim().toLocaleUpperCase("pt-BR") === DEFAULT_INVENTORY_SECTOR;
}

export function activeBadgeClass(isActive: boolean) {
  return isActive
    ? "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]"
    : "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]";
}

export function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function catalogTabMeta(tab: CatalogTab) {
  return catalogTabs.find((item) => item.id === tab)!;
}

export function catalogDialogTitle(
  tab: CatalogTab,
  editingSimple: InventoryCatalogItem | null,
  editingModel: InventoryEquipmentModel | null,
) {
  const tabMeta = catalogTabMeta(tab);
  if (tab === "models") return editingModel ? "Editar modelo" : "Novo modelo";
  if (tab === "contracts") return editingSimple ? "Editar contrato" : "Novo contrato";
  if (tab === "secretariats") return editingSimple ? "Editar secretaria" : "Nova secretaria";
  return editingSimple
    ? `Editar ${tabMeta.label.slice(0, -1).toLowerCase()}`
    : `Novo ${tabMeta.label.slice(0, -1).toLowerCase()}`;
}
