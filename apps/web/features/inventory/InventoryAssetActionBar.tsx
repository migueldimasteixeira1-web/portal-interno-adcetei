import { ArrowLeft, PackageCheck, Send, Trash2, UserRound, Wrench } from "lucide-react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui";

type Props = {
  canMove: boolean;
  canEdit: boolean;
  canViewUsers: boolean;
  onAllocate: () => void;
  onChangeResponsible: () => void;
  onReturnToStock: () => void;
  onMaintenance: () => void;
  onDelete: () => void;
};

export default function InventoryAssetActionBar({
  canMove,
  canEdit,
  canViewUsers,
  onAllocate,
  onChangeResponsible,
  onReturnToStock,
  onMaintenance,
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
      {canMove && (
        <>
          <Button variant="secondary" onClick={onAllocate}>
            <Send size={16} />
            Enviar para setor
          </Button>
          <Button
            variant="secondary"
            disabled={!canViewUsers}
            title={!canViewUsers ? "Seu perfil não possui acesso à lista de usuários." : undefined}
            onClick={onChangeResponsible}
          >
            <UserRound size={16} />
            Trocar responsável
          </Button>
          <Button variant="secondary" onClick={onReturnToStock}>
            <PackageCheck size={16} />
            Devolver ao estoque
          </Button>
          <Button variant="secondary" onClick={onMaintenance}>
            <Wrench size={16} />
            Manutenção
          </Button>
        </>
      )}
      {canEdit && (
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
