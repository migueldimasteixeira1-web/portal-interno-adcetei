import { Boxes } from "lucide-react";
import { Badge, Card, DetailRow, EmptyState, SectionHeader } from "@/components/ui";
import { assetStatusTone, formatDate, inventoryAssetStatusLabels, inventoryMovementActionLabels } from "@/lib/format";
import type { InventoryAsset, InventoryMovement } from "@/lib/types";
import { catalogRefName, notesText, retirementReasonLabel, transitionLabel, userDisplayName } from "./inventory-utils";

type SummaryProps = { asset: InventoryAsset };

export function InventoryAssetSummaryCard({ asset }: SummaryProps) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader
        title="Resumo"
        description="Identificação e situação atual do equipamento."
        action={<Badge className={assetStatusTone(asset.status)}>{inventoryAssetStatusLabels[asset.status] || asset.status}</Badge>}
      />
      <div className="grid gap-x-6 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <DetailRow label="Display name" value={asset.display_name || "Não informado"} />
        <DetailRow label="Número de série" value={asset.serial_number || "Não informado"} />
        <DetailRow label="Status" value={inventoryAssetStatusLabels[asset.status] || asset.status} />
      </div>
    </Card>
  );
}

export function InventoryAssetDetailsCard({ asset }: SummaryProps) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader title="Dados principais" description="Campos do contrato atual do módulo de inventário." />
      <div className="grid gap-x-6 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <DetailRow label="Fornecedor" value={catalogRefName(asset.supplier)} />
        <DetailRow label="Tipo" value={catalogRefName(asset.equipment_type)} />
        <DetailRow label="Fabricante" value={catalogRefName(asset.manufacturer)} />
        <DetailRow label="Modelo" value={catalogRefName(asset.equipment_model)} />
        <DetailRow label="Setor atual" value={catalogRefName(asset.sector)} />
        <DetailRow label="Responsável atual" value={asset.assigned_user?.full_name || "Não vinculado"} />
        <DetailRow label="Data de recebimento" value={formatDate(asset.received_at, false)} />
        <DetailRow label="Data de envio/entrega" value={formatDate(asset.delivered_at, false)} />
        {asset.status === "retired" && (
          <>
            <DetailRow label="Motivo da baixa" value={retirementReasonLabel(asset.retirement_reason)} />
            <DetailRow label="Data da baixa" value={formatDate(asset.retired_at, false)} />
            <DetailRow label="Baixado por" value={userDisplayName(asset.retired_by, "Não informado")} />
            <DetailRow label="Justificativa da baixa" value={notesText(asset.retirement_justification || "")} className="sm:col-span-2 xl:col-span-3" />
            {asset.retirement_notes?.trim() && (
              <DetailRow label="Observações da baixa" value={notesText(asset.retirement_notes)} className="sm:col-span-2 xl:col-span-3" />
            )}
          </>
        )}
        <DetailRow label="Observações" value={notesText(asset.notes)} className="sm:col-span-2 xl:col-span-3" />
      </div>
    </Card>
  );
}

type MovementsProps = { movements: InventoryMovement[] };

export function InventoryMovementTable({ movements }: MovementsProps) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader title="Histórico" description="Movimentações registram data operacional, ator e mudanças de setor, responsável e status." />
      {movements.length ? (
        <div className="overflow-x-auto soft-scrollbar">
          <table className="data-table min-w-[1080px]">
            <thead>
              <tr>
                <th>Data operacional</th>
                <th>Ação</th>
                <th>Setor</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Ator</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="text-[#5c6b7e]">{formatDate(movement.movement_date, false)}</td>
                  <td>
                    <Badge className={assetStatusTone(movement.to_status)}>{inventoryMovementActionLabels[movement.action] || movement.action}</Badge>
                    <p className="mt-0.5 text-xs text-[#8b97a8]">Registrado {formatDate(movement.created_at)}</p>
                  </td>
                  <td className="text-[#5c6b7e]">
                    {transitionLabel(catalogRefName(movement.from_sector, "Sem setor"), catalogRefName(movement.to_sector, "Sem setor"))}
                  </td>
                  <td className="text-[#5c6b7e]">
                    {transitionLabel(userDisplayName(movement.from_user), userDisplayName(movement.to_user))}
                  </td>
                  <td className="text-[#5c6b7e]">
                    {transitionLabel(
                      movement.from_status ? inventoryAssetStatusLabels[movement.from_status] || movement.from_status : "Sem status",
                      inventoryAssetStatusLabels[movement.to_status] || movement.to_status,
                    )}
                  </td>
                  <td className="text-[#5c6b7e]">{userDisplayName(movement.actor, "Não informado")}</td>
                  <td className="text-[#5c6b7e]">{notesText(movement.notes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<Boxes size={18} />} title="Nenhuma movimentação registrada." description="As próximas ações operacionais aparecerão aqui." />
      )}
    </Card>
  );
}
