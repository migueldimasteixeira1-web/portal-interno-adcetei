import { Save } from "lucide-react";
import Link from "next/link";
import { Badge, Button, Card, Field, Input, SectionHeader, Select, Textarea, buttonStyles } from "@/components/ui";
import { assetStatusTone } from "@/lib/format";
import type { InventoryCatalogs, InventoryEquipmentModel, User } from "@/lib/types";
import { activeCatalogItems } from "./inventory-utils";

export type NewAssetDraft = {
  supplier_id: string;
  equipment_type_id: string;
  manufacturer_id: string;
  equipment_model_id: string;
  sector_id: string;
  assigned_user_id: string;
  serial_number: string;
  specifications: string;
  received_at: string;
  delivered_at: string;
  notes: string;
};

type Props = {
  draft: NewAssetDraft;
  catalogs: InventoryCatalogs;
  users: User[];
  filteredModels: InventoryEquipmentModel[];
  canViewUsers: boolean;
  willAllocate: boolean;
  predictedStatus: string;
  saving: boolean;
  requiredMissing: boolean;
  onDraftChange: (changes: Partial<NewAssetDraft>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function NewInventoryAssetForm({
  draft,
  catalogs,
  users,
  filteredModels,
  canViewUsers,
  willAllocate,
  predictedStatus,
  saving,
  requiredMissing,
  onDraftChange,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="overflow-hidden">
        <SectionHeader title="Identificação" description="Selecione os cadastros base e informe o número de série do equipamento." />
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Fornecedor">
            <Select value={draft.supplier_id} onChange={(event) => onDraftChange({ supplier_id: event.target.value })}>
              <option value="">Selecione</option>
              {activeCatalogItems(catalogs.suppliers).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Tipo de equipamento">
            <Select value={draft.equipment_type_id} onChange={(event) => onDraftChange({ equipment_type_id: event.target.value })}>
              <option value="">Selecione</option>
              {activeCatalogItems(catalogs.equipment_types).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Fabricante">
            <Select value={draft.manufacturer_id} onChange={(event) => onDraftChange({ manufacturer_id: event.target.value })}>
              <option value="">Selecione</option>
              {activeCatalogItems(catalogs.manufacturers).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Modelo" help={!draft.equipment_type_id || !draft.manufacturer_id ? "Selecione tipo e fabricante para filtrar os modelos." : undefined}>
            <Select value={draft.equipment_model_id} disabled={!draft.equipment_type_id || !draft.manufacturer_id} onChange={(event) => onDraftChange({ equipment_model_id: event.target.value })}>
              <option value="">Selecione</option>
              {filteredModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </Select>
          </Field>
          <Field label="Número de série">
            <Input value={draft.serial_number} onChange={(event) => onDraftChange({ serial_number: event.target.value })} placeholder="Informe o número de série" />
          </Field>
          <div className="sm:col-span-2 xl:col-span-3">
            <Field label="Especificações">
              <Textarea value={draft.specifications} onChange={(event) => onDraftChange({ specifications: event.target.value })} placeholder="Ex.: Processador i5, 16 GB RAM, SSD 256 GB." />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <SectionHeader
          title="Alocação inicial"
          description="O status é calculado automaticamente pelo setor e responsável."
          action={<Badge className={assetStatusTone(predictedStatus)}>{willAllocate ? "Situação prevista: Alocado" : "Situação prevista: Estoque"}</Badge>}
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Setor">
            <Select value={draft.sector_id} onChange={(event) => onDraftChange({ sector_id: event.target.value })}>
              <option value="">ADCETEI</option>
              {activeCatalogItems(catalogs.sectors).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          {canViewUsers && (
            <Field label="Responsável" help="Opcional. Use apenas usuário cadastrado no portal.">
              <Select value={draft.assigned_user_id} onChange={(event) => onDraftChange({ assigned_user_id: event.target.value })}>
                <option value="">Não vinculado</option>
                {users.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.department}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Data de recebimento">
            <Input type="date" value={draft.received_at} onChange={(event) => onDraftChange({ received_at: event.target.value })} />
          </Field>
          <Field label="Data de envio/entrega" help={willAllocate ? "Obrigatória para equipamento alocado." : "Opcional enquanto o equipamento permanecer em estoque."}>
            <Input type="date" value={draft.delivered_at} onChange={(event) => onDraftChange({ delivered_at: event.target.value })} />
          </Field>
          <div className="sm:col-span-2 xl:col-span-3">
            <Field label="Observações">
              <Textarea value={draft.notes} onChange={(event) => onDraftChange({ notes: event.target.value })} placeholder="Informações complementares do recebimento ou cadastro." />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/inventario" className={buttonStyles({ variant: "secondary" })}>Cancelar</Link>
        <Button type="submit" disabled={saving || requiredMissing}><Save size={16} />{saving ? "Salvando..." : "Salvar equipamento"}</Button>
      </div>
    </form>
  );
}
