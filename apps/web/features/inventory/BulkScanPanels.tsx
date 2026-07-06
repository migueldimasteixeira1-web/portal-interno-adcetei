import { Plus, Trash2 } from "lucide-react";
import { RefObject } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, SectionHeader, Select, Textarea } from "@/components/ui";
import type { InventoryCatalogs, InventoryEquipmentModel } from "@/lib/types";
import { activeCatalogItems } from "./inventory-utils";

export type BulkScanDraft = {
  supplier_id: string;
  equipment_type_id: string;
  manufacturer_id: string;
  equipment_model_id: string;
  received_at: string;
  notes: string;
};

type CommonFieldsProps = {
  draft: BulkScanDraft;
  catalogs: InventoryCatalogs;
  filteredModels: InventoryEquipmentModel[];
  onDraftChange: (changes: Partial<BulkScanDraft>) => void;
};

export function BulkScanCommonFields({ draft, catalogs, filteredModels, onDraftChange }: CommonFieldsProps) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader title="Dados comuns" description="Todos os equipamentos deste lote entrarão em estoque no setor ADCETEI." />
      <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Fornecedor">
          <Select value={draft.supplier_id} onChange={(event) => onDraftChange({ supplier_id: event.target.value })}>
            <option value="">Selecione</option>
            {activeCatalogItems(catalogs.suppliers).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de equipamento">
          <Select value={draft.equipment_type_id} onChange={(event) => onDraftChange({ equipment_type_id: event.target.value })}>
            <option value="">Selecione</option>
            {activeCatalogItems(catalogs.equipment_types).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fabricante">
          <Select value={draft.manufacturer_id} onChange={(event) => onDraftChange({ manufacturer_id: event.target.value })}>
            <option value="">Selecione</option>
            {activeCatalogItems(catalogs.manufacturers).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Modelo" help={!draft.equipment_type_id || !draft.manufacturer_id ? "Selecione tipo e fabricante para filtrar os modelos." : undefined}>
          <Select value={draft.equipment_model_id} disabled={!draft.equipment_type_id || !draft.manufacturer_id} onChange={(event) => onDraftChange({ equipment_model_id: event.target.value })}>
            <option value="">Selecione</option>
            {filteredModels.map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Data de recebimento">
          <Input type="date" value={draft.received_at} onChange={(event) => onDraftChange({ received_at: event.target.value })} />
        </Field>
        <div className="sm:col-span-2 xl:col-span-3">
          <Field label="Observação">
            <Textarea value={draft.notes} onChange={(event) => onDraftChange({ notes: event.target.value })} placeholder="Informações complementares da entrada do lote." />
          </Field>
        </div>
      </div>
    </Card>
  );
}

type SerialPanelProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  serialInput: string;
  serials: string[];
  onSerialInputChange: (value: string) => void;
  onAddSerial: (value: string) => void;
  onRemoveSerial: (serial: string) => void;
};

export function BulkScanSerialPanel({ inputRef, serialInput, serials, onSerialInputChange, onAddSerial, onRemoveSerial }: SerialPanelProps) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader
        title="Leitura dos números de série"
        description="Use o leitor como teclado ou digite a série e pressione Enter."
        action={<Badge className="border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[#164f84]">{serials.length} lido(s)</Badge>}
      />
      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={inputRef}
            className="h-11 w-full rounded-md border border-[#d4dbe4] bg-white px-3 text-base text-[#1a2332] outline-none transition placeholder:text-[#8b97a8] focus:border-[#1a5f9e] focus:ring-2 focus:ring-[#e8f1f9]"
            value={serialInput}
            autoFocus
            placeholder="Leia ou digite o número de série"
            onChange={(event) => onSerialInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddSerial(serialInput);
              }
            }}
          />
          <Button type="button" onClick={() => onAddSerial(serialInput)}><Plus size={16} />Adicionar</Button>
        </div>
        {serials.length ? (
          <div className="overflow-x-auto soft-scrollbar">
            <table className="data-table min-w-[520px]">
              <thead><tr><th>#</th><th>Número de série</th><th>Ações</th></tr></thead>
              <tbody>
                {serials.map((serial, index) => (
                  <tr key={`${serial}-${index}`}>
                    <td className="text-[#5c6b7e]">{index + 1}</td>
                    <td className="font-medium text-[#1a2332]">{serial}</td>
                    <td><Button type="button" variant="ghost" size="sm" onClick={() => onRemoveSerial(serial)}><Trash2 size={14} />Remover</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nenhum número de série lido" description="O lote só pode ser pré-validado depois de pelo menos uma leitura." />
        )}
      </div>
    </Card>
  );
}

type PreviewProps = {
  preview: {
    total: number;
    valid_count: number;
    invalid_count: number;
    errors: Array<{ index: number; serial_number: string; message: string; normalized_serial: string }>;
  };
};

export function BulkScanPreviewCard({ preview }: PreviewProps) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader title="Pré-validação" description="Revise os itens antes de confirmar a criação no estoque." />
      <div className="grid gap-2 p-4 sm:grid-cols-3">
        <div className="panel-flat p-3"><p className="text-xs text-[#5c6b7e]">Total enviado</p><p className="mt-1 text-xl font-semibold text-[#1a2332]">{preview.total}</p></div>
        <div className="panel-flat p-3"><p className="text-xs text-[#5c6b7e]">Válidos</p><p className="mt-1 text-xl font-semibold text-[#0d5c4f]">{preview.valid_count}</p></div>
        <div className="panel-flat p-3"><p className="text-xs text-[#5c6b7e]">Com erro</p><p className="mt-1 text-xl font-semibold text-[#991b1b]">{preview.invalid_count}</p></div>
      </div>
      {preview.errors.length > 0 && (
        <div className="border-t border-[#e8edf2] p-4">
          <p className="mb-2 text-sm font-semibold text-[#1a2332]">Pendências encontradas</p>
          <div className="overflow-x-auto soft-scrollbar">
            <table className="data-table min-w-[620px]">
              <thead><tr><th>Linha</th><th>Número de série</th><th>Erro</th></tr></thead>
              <tbody>
                {preview.errors.map((item) => (
                  <tr key={`${item.index}-${item.normalized_serial}`}>
                    <td className="text-[#5c6b7e]">{item.index}</td>
                    <td className="text-[#5c6b7e]">{item.serial_number || "Não informado"}</td>
                    <td className="text-[#991b1b]">{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
