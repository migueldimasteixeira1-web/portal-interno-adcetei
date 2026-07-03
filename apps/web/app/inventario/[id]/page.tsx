"use client";

import { ArrowLeft, Boxes, PackageCheck, Send, UserRound, Wrench } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { Alert, Badge, Button, Card, ConfirmDialog, DetailRow, EmptyState, Field, Input, SectionHeader, Select, Textarea, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { assetStatusTone, formatDate, inventoryAssetStatusLabels, inventoryMovementActionLabels } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { InventoryAsset, InventoryAssetCatalogRef, InventoryCatalogs, InventoryMovement, User } from "@/lib/types";

type MovementAction = "allocate" | "responsible" | "stock" | "maintenance";

type MovementDraft = {
  sector_id: string;
  assigned_user_id: string;
  movement_date: string;
  notes: string;
};

const emptyCatalogs: InventoryCatalogs = {
  suppliers: [],
  equipment_types: [],
  manufacturers: [],
  models: [],
  sectors: [],
};

function catalogName(ref?: InventoryAssetCatalogRef | null) {
  return ref?.name || "Não informado";
}

function notesText(value: string) {
  return value.trim() || "Não informado";
}

function todayInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function activeByName<T extends { active?: boolean; is_active?: boolean; full_name?: string; name?: string }>(items: T[]) {
  return items
    .filter((item) => item.active ?? item.is_active ?? true)
    .sort((a, b) => (a.full_name || a.name || "").localeCompare(b.full_name || b.name || "", "pt-BR"));
}

function refName(ref?: InventoryAssetCatalogRef | null, empty = "Não informado") {
  return ref?.name || empty;
}

function userName(user?: { full_name: string } | null, empty = "Não vinculado") {
  return user?.full_name || empty;
}

function transitionLabel(fromValue: string, toValue: string) {
  return `${fromValue} → ${toValue}`;
}

export default function InventoryAssetDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canView = hasPermission(user, "inventory.view");
  const canMove = hasPermission(user, "inventory.move");
  const canViewUsers = hasPermission(user, "users.view");
  const [asset, setAsset] = useState<InventoryAsset | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyCatalogs);
  const [users, setUsers] = useState<User[]>([]);
  const [activeAction, setActiveAction] = useState<MovementAction | null>(null);
  const [draft, setDraft] = useState<MovementDraft>({ sector_id: "", assigned_user_id: "", movement_date: todayInputValue(), notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [assetData, movementData, catalogData, userData] = await Promise.all([
        api.inventoryAsset(params.id),
        api.inventoryAssetMovements(params.id),
        canMove ? api.inventoryCatalogs() : Promise.resolve(emptyCatalogs),
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
      sector_id: action === "allocate" && asset?.sector_id ? String(asset.sector_id) : "",
      assigned_user_id: (action === "allocate" || action === "responsible") && asset?.assigned_user_id ? String(asset.assigned_user_id) : "",
      movement_date: todayInputValue(),
      notes: "",
    });
  };

  const actionTitle = {
    allocate: "Enviar para setor/responsável",
    responsible: "Trocar responsável",
    stock: "Devolver ao estoque",
    maintenance: "Enviar para manutenção",
  }[activeAction || "allocate"];

  const requiredMissing = !draft.movement_date ||
    (activeAction === "allocate" && !draft.sector_id) ||
    (activeAction === "responsible" && !draft.assigned_user_id);

  const submitAction = async () => {
    if (!activeAction || requiredMissing) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (activeAction === "allocate") {
        await api.allocateInventoryAsset(params.id, {
          sector_id: Number(draft.sector_id),
          assigned_user_id: draft.assigned_user_id ? Number(draft.assigned_user_id) : null,
          movement_date: draft.movement_date,
          notes: draft.notes.trim(),
        });
      } else if (activeAction === "responsible") {
        await api.changeInventoryAssetResponsible(params.id, {
          assigned_user_id: Number(draft.assigned_user_id),
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

  const actionButtons = canMove && asset ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => openAction("allocate")}><Send size={16} />Enviar para setor</Button>
      <Button variant="secondary" disabled={!canViewUsers} title={!canViewUsers ? "Seu perfil não possui acesso à lista de usuários." : undefined} onClick={() => openAction("responsible")}><UserRound size={16} />Trocar responsável</Button>
      <Button variant="secondary" onClick={() => openAction("stock")}><PackageCheck size={16} />Devolver ao estoque</Button>
      <Button variant="secondary" onClick={() => openAction("maintenance")}><Wrench size={16} />Manutenção</Button>
      <Link href="/inventario" className={buttonStyles({ variant: "secondary" })}><ArrowLeft size={16} />Voltar</Link>
    </div>
  ) : <Link href="/inventario" className={buttonStyles({ variant: "secondary" })}><ArrowLeft size={16} />Voltar para inventário</Link>;

  const sectorOptions = activeByName(catalogs.sectors);
  const userOptions = activeByName(users);

  if (loading) return <LoadingScreen label="Carregando equipamento..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Inventário"
        title={asset?.display_name || "Equipamento"}
        subtitle={asset?.serial_number ? `Número de série: ${asset.serial_number}` : "Detalhe do equipamento cadastrado no inventário."}
        actions={actionButtons}
      />

      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
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
            <SectionHeader title="Histórico" description="Movimentações registram data operacional, ator e mudanças de setor, responsável e status." />
            {movements.length ? (
              <div className="overflow-x-auto soft-scrollbar">
                <table className="data-table min-w-[1080px]">
                  <thead><tr><th>Data operacional</th><th>Ação</th><th>Setor</th><th>Responsável</th><th>Status</th><th>Ator</th><th>Observação</th></tr></thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="text-[#5c6b7e]">{formatDate(movement.movement_date, false)}</td>
                        <td><Badge className={assetStatusTone(movement.to_status)}>{inventoryMovementActionLabels[movement.action] || movement.action}</Badge><p className="mt-0.5 text-xs text-[#8b97a8]">Registrado {formatDate(movement.created_at)}</p></td>
                        <td className="text-[#5c6b7e]">{transitionLabel(refName(movement.from_sector, "Sem setor"), refName(movement.to_sector, "Sem setor"))}</td>
                        <td className="text-[#5c6b7e]">{transitionLabel(userName(movement.from_user), userName(movement.to_user))}</td>
                        <td className="text-[#5c6b7e]">{transitionLabel(movement.from_status ? inventoryAssetStatusLabels[movement.from_status] || movement.from_status : "Sem status", inventoryAssetStatusLabels[movement.to_status] || movement.to_status)}</td>
                        <td className="text-[#5c6b7e]">{userName(movement.actor, "Não informado")}</td>
                        <td className="text-[#5c6b7e]">{notesText(movement.notes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={<Boxes size={18} />} title="Nenhuma movimentação registrada." description="As próximas ações operacionais aparecerão aqui." />}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(activeAction)}
        onOpenChange={(open) => !open && setActiveAction(null)}
        onConfirm={submitAction}
        loading={saving}
        title={actionTitle}
        description="Informe a data operacional e uma observação curta para manter o histórico auditável."
        confirmLabel="Registrar movimentação"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {activeAction === "allocate" && (
            <>
              <Field label="Setor destino">
                <Select value={draft.sector_id} onChange={(event) => setDraft({ ...draft, sector_id: event.target.value })}>
                  <option value="">Selecione</option>
                  {sectorOptions.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
                </Select>
              </Field>
              <Field label="Responsável" help={!canViewUsers ? "Seu perfil não possui acesso à lista de usuários." : "Opcional. Use apenas usuário cadastrado no portal."}>
                <Select disabled={!canViewUsers} value={draft.assigned_user_id} onChange={(event) => setDraft({ ...draft, assigned_user_id: event.target.value })}>
                  <option value="">Não vinculado</option>
                  {userOptions.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.department}</option>)}
                </Select>
              </Field>
            </>
          )}
          {activeAction === "responsible" && (
            <div className="sm:col-span-2">
              <Field label="Novo responsável" help="Use apenas usuário cadastrado no portal.">
                <Select value={draft.assigned_user_id} onChange={(event) => setDraft({ ...draft, assigned_user_id: event.target.value })}>
                  <option value="">Selecione</option>
                  {userOptions.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.department}</option>)}
                </Select>
              </Field>
            </div>
          )}
          <Field label="Data da movimentação">
            <Input type="date" value={draft.movement_date} onChange={(event) => setDraft({ ...draft, movement_date: event.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observação">
              <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Motivo ou contexto da movimentação." />
            </Field>
          </div>
          {requiredMissing && <Alert tone="warning" className="sm:col-span-2">Preencha os campos obrigatórios antes de registrar.</Alert>}
        </div>
      </ConfirmDialog>
    </>
  );
}
