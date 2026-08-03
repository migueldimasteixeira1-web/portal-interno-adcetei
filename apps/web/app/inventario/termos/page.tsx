"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import SearchParamsSuspense from "@/components/SearchParamsSuspense";
import { Button } from "@/components/ui";
import DeliveryTermsPanel from "@/features/inventory/DeliveryTermsPanel";
import ReturnTermsPanel from "@/features/inventory/ReturnTermsPanel";

type TermsKind = "delivery" | "return";

function InventoryTermsContent() {
  const searchParams = useSearchParams();
  const initialKind = searchParams.get("tab") === "return" ? "return" : "delivery";
  const assetIdParam = searchParams.get("asset_id");
  const initialAssetId = assetIdParam ? Number(assetIdParam) : undefined;
  const [kind, setKind] = useState<TermsKind>(initialKind);

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Termos"
        subtitle="Emita o termo oficial antes de alocar ou devolver um equipamento, e atualize o inventário somente após a assinatura confirmada."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Button type="button" variant={kind === "delivery" ? "primary" : "secondary"} onClick={() => setKind("delivery")}>
          Recebimento
        </Button>
        <Button type="button" variant={kind === "return" ? "primary" : "secondary"} onClick={() => setKind("return")}>
          Devolução
        </Button>
      </div>

      {kind === "delivery" ? (
        <DeliveryTermsPanel initialAssetId={kind === initialKind ? initialAssetId : undefined} />
      ) : (
        <ReturnTermsPanel initialAssetId={kind === initialKind ? initialAssetId : undefined} />
      )}
    </>
  );
}

export default function InventoryTermsPage() {
  return (
    <SearchParamsSuspense>
      <InventoryTermsContent />
    </SearchParamsSuspense>
  );
}
