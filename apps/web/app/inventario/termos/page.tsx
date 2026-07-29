"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui";
import DeliveryTermsPanel from "@/features/inventory/DeliveryTermsPanel";
import ReturnTermsPanel from "@/features/inventory/ReturnTermsPanel";

type TermsKind = "delivery" | "return";

export default function InventoryTermsPage() {
  const [kind, setKind] = useState<TermsKind>("delivery");

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

      {kind === "delivery" ? <DeliveryTermsPanel /> : <ReturnTermsPanel />}
    </>
  );
}
