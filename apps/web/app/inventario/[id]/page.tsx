"use client";

import { ArrowLeft, Boxes } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Badge, Card, DetailRow, SectionHeader, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { assetStatusTone, formatDate, inventoryAssetStatusLabels } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { InventoryAsset, InventoryAssetCatalogRef } from "@/lib/types";

function catalogName(ref?: InventoryAssetCatalogRef | null) {
  return ref?.name || "Não informado";
}

function notesText(value: string) {
  return value.trim() || "Não informado";
}

export default function InventoryAssetDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canView = hasPermission(user, "inventory.view");
  const [asset, setAsset] = useState<InventoryAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    if (!canView) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        setAsset(await api.inventoryAsset(params.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar o equipamento.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [canView, params.id, user]);

  if (loading) return <LoadingScreen label="Carregando equipamento..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Inventário"
        title={asset?.display_name || "Equipamento"}
        subtitle={asset?.serial_number ? `Número de série: ${asset.serial_number}` : "Detalhe do equipamento cadastrado no inventário."}
        actions={<Link href="/inventario" className={buttonStyles({ variant: "secondary" })}><ArrowLeft size={16} />Voltar para inventário</Link>}
      />

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      {asset && (
        <div className="space-y-4">
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

          <Card className="overflow-hidden">
            <SectionHeader title="Dados principais" description="Campos do contrato atual do módulo de inventário." />
            <div className="grid gap-x-6 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <DetailRow label="Fornecedor" value={catalogName(asset.supplier)} />
              <DetailRow label="Tipo" value={catalogName(asset.equipment_type)} />
              <DetailRow label="Fabricante" value={catalogName(asset.manufacturer)} />
              <DetailRow label="Modelo" value={catalogName(asset.equipment_model)} />
              <DetailRow label="Setor atual" value={catalogName(asset.sector)} />
              <DetailRow label="Responsável atual" value={asset.assigned_user?.full_name || "Não vinculado"} />
              <DetailRow label="Data de recebimento" value={formatDate(asset.received_at, false)} />
              <DetailRow label="Data de envio/entrega" value={formatDate(asset.delivered_at, false)} />
              <DetailRow label="Observações" value={notesText(asset.notes)} className="sm:col-span-2 xl:col-span-3" />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader title="Histórico" description="Histórico de movimentações será exibido em uma próxima etapa." />
            <div className="flex items-center gap-3 p-4 text-sm text-[#5c6b7e]">
              <span className="grid h-9 w-9 place-items-center rounded-md border border-[#d4dbe4] bg-[#f7f9fb] text-[#5c6b7e]"><Boxes size={17} /></span>
              <span>Histórico de movimentações será exibido em uma próxima etapa.</span>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
