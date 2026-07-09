import { Alert, ConfirmDialog, Field, Input, Select } from "@/components/ui";
import type { InventoryCatalogItem, InventoryCatalogs } from "@/lib/types";
import {
  catalogTabMeta,
  sortByName,
  type CatalogTab,
  type ContractDraft,
  type ModelDraft,
  type SimpleDraft,
} from "./catalog-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  error: string;
  tab: CatalogTab;
  title: string;
  catalogs: InventoryCatalogs;
  simpleDraft: SimpleDraft;
  contractDraft: ContractDraft;
  modelDraft: ModelDraft;
  editingDefaultSector: boolean;
  onSimpleDraftChange: (draft: SimpleDraft) => void;
  onContractDraftChange: (draft: ContractDraft) => void;
  onModelDraftChange: (draft: ModelDraft) => void;
};

export default function CatalogFormDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  error,
  tab,
  title,
  catalogs,
  simpleDraft,
  contractDraft,
  modelDraft,
  editingDefaultSector,
  onSimpleDraftChange,
  onContractDraftChange,
  onModelDraftChange,
}: Props) {
  const tabMeta = catalogTabMeta(tab);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      loading={loading}
      title={title}
      description={
        tab === "sectors"
          ? "Setores desativados deixam de aparecer em novos cadastros. O setor ADCETEI permanece como estoque padrão do sistema."
          : "Cadastros desativados permanecem no histórico e deixam de ser usados em novos registros."
      }
      confirmLabel="Salvar"
    >
      {tab === "models" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fabricante" error={!modelDraft.manufacturer_id && error ? "Selecione o fabricante." : undefined}>
            <Select
              value={modelDraft.manufacturer_id}
              onChange={(e) => onModelDraftChange({ ...modelDraft, manufacturer_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {sortByName(
                catalogs.manufacturers.filter((item) => item.is_active || String(item.id) === modelDraft.manufacturer_id),
              ).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de equipamento" error={!modelDraft.equipment_type_id && error ? "Selecione o tipo." : undefined}>
            <Select
              value={modelDraft.equipment_type_id}
              onChange={(e) => onModelDraftChange({ ...modelDraft, equipment_type_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {sortByName(
                catalogs.equipment_types.filter((item) => item.is_active || String(item.id) === modelDraft.equipment_type_id),
              ).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nome do modelo">
              <Input
                value={modelDraft.name}
                onChange={(e) => onModelDraftChange({ ...modelDraft, name: e.target.value })}
                placeholder="Ex.: Latitude 3420"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332] sm:col-span-2">
            <input
              type="checkbox"
              checked={modelDraft.is_active}
              onChange={(e) => onModelDraftChange({ ...modelDraft, is_active: e.target.checked })}
            />
            Cadastro ativo
          </label>
        </div>
      ) : tab === "contracts" ? (
        <div className="grid gap-4">
          <Field label="Fornecedor" error={!contractDraft.supplier_id && error ? "Selecione o fornecedor." : undefined}>
            <Select value={contractDraft.supplier_id} onChange={(e) => onContractDraftChange({ ...contractDraft, supplier_id: e.target.value })}>
              <option value="">Selecione</option>
              {sortByName(catalogs.suppliers.filter((item) => item.is_active || String(item.id) === contractDraft.supplier_id)).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Contrato">
            <Input
              value={contractDraft.name}
              onChange={(e) => onContractDraftChange({ ...contractDraft, name: e.target.value })}
              placeholder="Ex.: Contrato nº 046/2026 - PMCF / IART"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332]">
            <input
              type="checkbox"
              checked={contractDraft.is_active}
              onChange={(e) => onContractDraftChange({ ...contractDraft, is_active: e.target.checked })}
            />
            Cadastro ativo
          </label>
        </div>
      ) : (
        <div className="grid gap-4">
          <Field label="Nome">
            <Input
              value={simpleDraft.name}
              onChange={(e) => onSimpleDraftChange({ ...simpleDraft, name: e.target.value })}
              placeholder={`Nome do ${tabMeta.label.slice(0, -1).toLowerCase()}`}
              disabled={editingDefaultSector}
            />
          </Field>
          {editingDefaultSector && (
            <Alert tone="info">O setor ADCETEI é o estoque padrão do sistema. O nome não pode ser alterado por aqui.</Alert>
          )}
          <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332]">
            <input
              type="checkbox"
              checked={simpleDraft.is_active}
              onChange={(e) => onSimpleDraftChange({ ...simpleDraft, is_active: e.target.checked })}
              disabled={editingDefaultSector}
            />
            Cadastro ativo
          </label>
        </div>
      )}
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
    </ConfirmDialog>
  );
}
