import type { InventoryAssetCatalogRef, InventoryCatalogs, InventoryRetirementReason } from "@/lib/types";

export const emptyInventoryCatalogs: InventoryCatalogs = {
  suppliers: [],
  contracts: [],
  equipment_types: [],
  manufacturers: [],
  models: [],
  sectors: [],
};

export function todayInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function dateToPayload(value: string) {
  return value ? `${value}T12:00:00-03:00` : undefined;
}

export function activeCatalogItems<T extends { is_active: boolean; name: string }>(items: T[]) {
  return items.filter((item) => item.is_active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function activeByName<T extends { active?: boolean; is_active?: boolean; full_name?: string; name?: string }>(items: T[]) {
  return items
    .filter((item) => item.active ?? item.is_active ?? true)
    .sort((a, b) => (a.full_name || a.name || "").localeCompare(b.full_name || b.name || "", "pt-BR"));
}

export function catalogRefName(ref?: InventoryAssetCatalogRef | null, empty = "Não informado") {
  return ref?.name || empty;
}

export function notesText(value: string) {
  return value.trim() || "Não informado";
}

export function transitionLabel(fromValue: string, toValue: string) {
  return `${fromValue} → ${toValue}`;
}

export function userDisplayName(user?: { full_name: string } | null, empty = "Não vinculado") {
  return user?.full_name || empty;
}

export function displaySerial(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).join(" ");
}

export function normalizedSerial(value: string) {
  return displaySerial(value).toLocaleLowerCase("pt-BR");
}

export function manufacturerModel(asset: { manufacturer?: InventoryAssetCatalogRef | null; equipment_model?: InventoryAssetCatalogRef | null }) {
  const value = [asset.manufacturer?.name, asset.equipment_model?.name].filter(Boolean).join(" / ");
  return value || "Não informado";
}

export type MovementAction = "allocate" | "responsible" | "stock" | "maintenance";

export type MovementDraft = {
  sector_id: string;
  assigned_user_id: string;
  movement_date: string;
  notes: string;
};

export const movementActionTitle: Record<MovementAction, string> = {
  allocate: "Enviar para setor/responsável",
  responsible: "Trocar responsável",
  stock: "Devolver ao estoque",
  maintenance: "Enviar para manutenção",
};

export function emptyMovementDraft(): MovementDraft {
  return { sector_id: "", assigned_user_id: "", movement_date: todayInputValue(), notes: "" };
}

export const inventoryRetirementReasonOptions: Array<{ key: InventoryRetirementReason; label: string }> = [
  { key: "CONTRATO_ENCERRADO", label: "Contrato encerrado" },
  { key: "DEVOLVIDO_AO_FORNECEDOR", label: "Devolvido ao fornecedor" },
  { key: "DEFEITO_IRRECUPERAVEL", label: "Defeito sem recuperação" },
  { key: "DESCARTE", label: "Descarte" },
  { key: "SUBSTITUICAO", label: "Substituição" },
  { key: "PERDA", label: "Perda" },
  { key: "FURTO_ROUBO", label: "Furto/Roubo" },
  { key: "CORRECAO_ADMINISTRATIVA", label: "Correção administrativa" },
  { key: "OUTRO", label: "Outro" },
];

export type RetireDraft = {
  reason: InventoryRetirementReason | "";
  justification: string;
  movement_date: string;
  notes: string;
};

export function emptyRetireDraft(): RetireDraft {
  return { reason: "", justification: "", movement_date: todayInputValue(), notes: "" };
}

export function retirementReasonLabel(reason?: InventoryRetirementReason | null) {
  return inventoryRetirementReasonOptions.find((item) => item.key === reason)?.label || "Não informado";
}
