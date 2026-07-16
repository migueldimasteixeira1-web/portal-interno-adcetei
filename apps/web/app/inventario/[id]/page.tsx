"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, ConfirmDialog } from "@/components/ui";
import InventoryAssetActionBar from "@/features/inventory/InventoryAssetActionBar";
import { InventoryAssetDetailsCard, InventoryAssetSummaryCard, InventoryMovementTable } from "@/features/inventory/InventoryAssetDetailCards";
import InventoryMovementDialog from "@/features/inventory/InventoryMovementDialog";
import InventoryRetireDialog from "@/features/inventory/InventoryRetireDialog";
import {
  activeByName,
  emptyInventoryCatalogs,
  emptyMovementDraft,
  emptyRetireDraft,
  type MovementAction,
  type MovementDraft,
  type RetireDraft,
} from "@/features/inventory/inventory-utils";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { InventoryAsset, InventoryCatalogs, InventoryMovement, User } from "@/lib/types";

export default function InventoryAssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canView = hasPermission(user, "inventory.view");
  const canEdit = hasPermission(user, "inventory.edit");
  const canMove = hasPermission(user, "inventory.move");
  const canViewUsers = hasPermission(user, "users.view");
  const [asset, setAsset] = useState<InventoryAsset | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyInventoryCatalogs);
  const [users, setUsers] = useState<User[]>([]);
  const [activeAction, setActiveAction] = useState<MovementAction | null>(null);
  const [retireOpen, setRetireOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState<MovementDraft>(emptyMovementDraft());
  const [retireDraft, setRetireDraft] = useState<RetireDraft>(emptyRetireDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [assetData, movementData, catalogData, userData] = await Promise.all([
        api.inventoryAsset(params.id),
        api.inventoryAssetMovements(params.id),
        canMove ? api.inventoryCatalogs() : Promise.resolve(emptyInventoryCatalogs),
        canMove && canViewUsers ? api.users() : Promise.resolve([]),
      ]);
      setAsset(assetData);
      setMovements(movementData);
      setCatalogs(catalogData);
      setUsers(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o equipamento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (!canView) setLoading(false);
    else void load();
  }, [canMove, canView, canViewUsers, params.id, user]);

  const openAction = (action: MovementAction) => {
    setError("");
    setMessage("");
    setActiveAction(action);
    setDraft({
      sector_id: action === "move" && asset?.sector_id ? String(asset.sector_id) : "",
      assigned_user_id: action === "move" && asset?.assigned_user_id ? String(asset.assigned_user_id) : "",
      movement_date: emptyMovementDraft().movement_date,
      notes: "",
    });
  };

  const requiredMissing =
    !draft.movement_date ||
    (activeAction === "move" && !draft.sector_id);

  const retireRequiredMissing = !retireDraft.reason || !retireDraft.movement_date || !retireDraft.justification.trim();
  const retireJustificationTooShort = retireDraft.justification.trim().length > 0 && retireDraft.justification.trim().length < 10;
  const isRetired = asset?.status === "retired";

  const submitAction = async () => {
    if (!activeAction || requiredMissing) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (activeAction === "move") {
        await api.allocateInventoryAsset(params.id, {
          sector_id: Number(draft.sector_id),
          assigned_user_id: draft.assigned_user_id ? Number(draft.assigned_user_id) : null,
          movement_date: draft.movement_date,
          notes: draft.notes.trim(),
        });
      } else if (activeAction === "stock") {
        await api.returnInventoryAssetToStock(params.id, {
          movement_date: draft.movement_date,
          notes: draft.notes.trim(),
        });
      } else {
        await api.sendInventoryAssetToMaintenance(params.id, {
          movement_date: draft.movement_date,
          notes: draft.notes.trim(),
        });
      }
      setActiveAction(null);
      setMessage("Movimentação registrada com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a movimentação.");
    } finally {
      setSaving(false);
    }
  };

  const submitRetire = async () => {
    if (retireRequiredMissing || retireJustificationTooShort || !retireDraft.reason) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.retireInventoryAsset(params.id, {
        reason: retireDraft.reason,
        justification: retireDraft.justification.trim(),
        movement_date: retireDraft.movement_date,
        notes: retireDraft.notes.trim(),
      });
      setRetireOpen(false);
      setRetireDraft(emptyRetireDraft());
      setMessage("Equipamento baixado com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível dar baixa neste equipamento.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAsset = async () => {
    if (!asset) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.deleteInventoryAsset(params.id);
      router.push("/inventario");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o equipamento.");
      setDeleteOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando equipamento..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Inventário"
        title={asset?.display_name || "Equipamento"}
        subtitle={asset?.serial_number ? `Número de série: ${asset.serial_number}` : "Detalhe do equipamento cadastrado no inventário."}
        actions={
          asset ? (
            <InventoryAssetActionBar
              canMove={canMove}
              canEdit={canEdit}
              isRetired={isRetired}
              onMove={() => openAction("move")}
              onReturnToStock={() => openAction("stock")}
              onMaintenance={() => openAction("maintenance")}
              onRetire={() => {
                setError("");
                setMessage("");
                setRetireDraft(emptyRetireDraft());
                setRetireOpen(true);
              }}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : undefined
        }
      />

      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {asset?.status === "retired" && (
        <Alert tone="warning" className="mb-4">
          Este equipamento está baixado e não pode ser movimentado. O registro permanece disponível para consulta, histórico e auditoria.
        </Alert>
      )}

      {asset && (
        <div className="space-y-4">
          <InventoryAssetSummaryCard asset={asset} />
          <InventoryAssetDetailsCard asset={asset} />
          <InventoryMovementTable movements={movements} />
        </div>
      )}

      <InventoryMovementDialog
        open={Boolean(activeAction)}
        action={activeAction}
        draft={draft}
        saving={saving}
        canViewUsers={canViewUsers}
        requiredMissing={requiredMissing}
        sectorOptions={activeByName(catalogs.sectors)}
        userOptions={activeByName(users)}
        onOpenChange={(open) => !open && setActiveAction(null)}
        onConfirm={submitAction}
        onDraftChange={setDraft}
      />

      <InventoryRetireDialog
        open={retireOpen}
        draft={retireDraft}
        saving={saving}
        isAdmin={user?.role === "admin"}
        requiredMissing={retireRequiredMissing}
        justificationTooShort={retireJustificationTooShort}
        onOpenChange={setRetireOpen}
        onConfirm={submitRetire}
        onDraftChange={setRetireDraft}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={deleteAsset}
        loading={saving}
        title="Excluir equipamento"
        description={`Excluir ${asset?.serial_number || "este equipamento"} permanentemente? Equipamentos vinculados a chamados não podem ser excluídos.`}
        confirmLabel="Excluir equipamento"
      />
    </>
  );
}
