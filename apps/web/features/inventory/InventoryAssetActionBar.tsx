import { ArrowLeft, Archive, PackageCheck, Send, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui";

type Props = {
  canMove: boolean;
  canEdit: boolean;
  isRetired: boolean;
  onMove: () => void;
  onReturnToStock: () => void;
  onMaintenance: () => void;
  onRetire: () => void;
  onDelete: () => void;
};

export default function InventoryAssetActionBar({
  canMove,
  canEdit,
  isRetired,
  onMove,
  onReturnToStock,
  onMaintenance,
  onRetire,
  onDelete,
}: Props) {
  if (!canMove && !canEdit) {
    return (
      <Link href="/inventario" className={buttonStyles({ variant: "secondary" })}>
        <ArrowLeft size={16} />
        Voltar para inventário
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canMove && !isRetired && (
        <>
          <Button variant="secondary" onClick={onMove}>
            <Send size={16} />
            Movimentar
          </Button>
          <Button variant="secondary" onClick={onReturnToStock}>
            <PackageCheck size={16} />
            Devolver ao estoque
          </Button>
          <Button variant="secondary" onClick={onMaintenance}>
            <Wrench size={16} />
            Manutenção
          </Button>
          <Button variant="danger" onClick={onRetire}>
            <Archive size={16} />
            Dar baixa
          </Button>
        </>
      )}
      {canEdit && !isRetired && (
        <Button variant="danger" onClick={onDelete}>
          <Trash2 size={16} />
          Excluir
        </Button>
      )}
      <Link href="/inventario" className={buttonStyles({ variant: "secondary" })}>
        <ArrowLeft size={16} />
        Voltar
      </Link>
    </div>
  );
}
