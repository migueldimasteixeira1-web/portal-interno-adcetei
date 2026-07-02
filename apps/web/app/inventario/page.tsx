"use client";

import { Boxes, CircleOff, Computer, Pencil, Plus, Search, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, SectionHeader, Select, Toolbar, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";
import { assetStatusLabels, assetStatusTone, assetTypeLabels, formatDate } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import type { Asset, User } from "@/lib/types";

type AssetDraft = Omit<Asset, "id" | "last_seen_at" | "assigned_user">;

const emptyDraft: AssetDraft = {
  name: "",
  asset_type: "computer",
  manufacturer: "",
  model: "",
  serial_number: "",
  patrimony: "",
  status: "active",
  location: "",
  ip_address: "",
  operating_system: "",
  assigned_user_id: null,
};

export default function InventoryPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "assets.view");
  const canManage = hasPermission(user, "assets.manage");
  const canCreateInventory = hasPermission(user, "inventory.create");
  const canViewUsers = hasPermission(user, "users.view");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<AssetDraft>(emptyDraft);

  const load = async () => {
    try {
      const [assetData, userData] = await Promise.all([
        api.assets(),
        canViewUsers ? api.users() : Promise.resolve([]),
      ]);
      setAssets(assetData);
      setUsers(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar inventário");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) void load();
    else if (user) setLoading(false);
  }, [canView, canViewUsers, user]);

  const filtered = useMemo(() => assets.filter((asset) => {
    const haystack = `${asset.name} ${asset.model} ${asset.patrimony} ${asset.ip_address} ${asset.location} ${asset.assigned_user?.full_name || ""}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (!type || asset.asset_type === type) && (!status || asset.status === status);
  }), [assets, search, type, status]);

  const counts = useMemo(() => ({
    active: assets.filter((asset) => asset.status === "active").length,
    maintenance: assets.filter((asset) => asset.status === "maintenance").length,
    stock: assets.filter((asset) => asset.status === "stock").length,
    retired: assets.filter((asset) => asset.status === "retired").length,
  }), [assets]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditing(asset);
    setDraft({
      name: asset.name,
      asset_type: asset.asset_type,
      manufacturer: asset.manufacturer,
      model: asset.model,
      serial_number: asset.serial_number,
      patrimony: asset.patrimony,
      status: asset.status,
      location: asset.location,
      ip_address: asset.ip_address,
      operating_system: asset.operating_system,
      assigned_user_id: asset.assigned_user_id || null,
    });
    setError("");
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editing) {
        await api.updateAsset(editing.id, draft);
        setMessage("Equipamento atualizado com sucesso.");
      } else {
        await api.createAsset(draft);
        setMessage("Equipamento cadastrado com sucesso.");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o equipamento");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando inventário..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Ativos de TI"
        title="Inventário"
        subtitle="Consulte equipamentos e mantenha responsáveis, localização e situação atualizados."
        actions={(canCreateInventory || canManage) ? (
          <div className="flex flex-wrap gap-2">
            {canCreateInventory && <Link href="/inventario/novo" className={buttonStyles()}><Plus size={16} />Novo equipamento</Link>}
            {canManage && <Button variant={canCreateInventory ? "secondary" : "primary"} onClick={openCreate}><Plus size={16} />Cadastro legado</Button>}
          </div>
        ) : undefined}
      />
      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && !dialogOpen && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Equipamentos" value={assets.length} icon={<Boxes size={17} />} hint="Total registrado" tone="blue" />
        <MetricCard label="Ativos" value={counts.active} icon={<Computer size={17} />} hint="Em operação" tone="green" />
        <MetricCard label="Em manutenção" value={counts.maintenance} icon={<Wrench size={17} />} hint="Aguardando reparo" tone="amber" />
        <MetricCard label="Em estoque" value={counts.stock} icon={<Boxes size={17} />} hint="Disponíveis na TI" tone="cyan" />
        <MetricCard label="Baixados" value={counts.retired} icon={<Boxes size={17} />} hint="Arquivados" tone="slate" />
      </div>

      <Toolbar className="mb-4">
        <div className="grid w-full gap-2 lg:grid-cols-[minmax(240px,1fr)_180px_180px]">
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} /><Input className="pl-8" placeholder="Buscar máquina, IP, patrimônio, usuário ou local" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">Todos os tipos</option>{Object.entries(assetTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option>{Object.entries(assetStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        </div>
      </Toolbar>

      <Card className="overflow-hidden">
        <SectionHeader title={`${filtered.length} equipamento(s)`} description="Equipamentos baixados permanecem no histórico e não aparecem como disponíveis." />
        <div className="overflow-x-auto soft-scrollbar">
          <table className="data-table min-w-[1050px]">
            <thead><tr><th>Equipamento</th><th>Tipo</th><th>Rede e patrimônio</th><th>Responsável</th><th>Localização</th><th>Status</th><th>Último registro</th>{canManage && <th>Ações</th>}</tr></thead>
            <tbody>
              {filtered.map((asset) => (
                <tr key={asset.id}>
                  <td><p className="font-semibold text-[#1a2332]">{asset.name}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{asset.manufacturer} {asset.model}</p></td>
                  <td className="text-[#5c6b7e]">{assetTypeLabels[asset.asset_type] || asset.asset_type}</td>
                  <td><p className="font-medium text-[#1a2332]">{asset.ip_address || "IP não informado"}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{asset.patrimony || "Sem patrimônio"}</p></td>
                  <td><p className="font-medium text-[#1a2332]">{asset.assigned_user?.full_name || "Não vinculado"}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{asset.assigned_user?.department || "—"}</p></td>
                  <td className="text-[#5c6b7e]">{asset.location || "Não informada"}</td>
                  <td><Badge className={assetStatusTone(asset.status)}>{assetStatusLabels[asset.status] || asset.status}</Badge></td>
                  <td className="text-[#5c6b7e]">{formatDate(asset.last_seen_at)}</td>
                  {canManage && <td><Button variant="ghost" size="sm" onClick={() => openEdit(asset)}><Pencil size={15} />Editar</Button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <EmptyState icon={<CircleOff size={18} />} title="Nenhum equipamento encontrado" description="Revise os filtros ou cadastre um novo equipamento." />}
      </Card>

      <ConfirmDialog open={dialogOpen} onOpenChange={setDialogOpen} onConfirm={save} loading={saving} title={editing ? "Editar equipamento" : "Cadastrar equipamento"} description="Para retirar um item de uso, altere o status para Baixado. O registro será preservado." confirmLabel="Salvar equipamento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da máquina ou equipamento"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Tipo"><Select value={draft.asset_type} onChange={(e) => setDraft({ ...draft, asset_type: e.target.value })}>{Object.entries(assetTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          <Field label="Fabricante"><Input value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} /></Field>
          <Field label="Modelo"><Input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></Field>
          <Field label="Número de série"><Input value={draft.serial_number} onChange={(e) => setDraft({ ...draft, serial_number: e.target.value })} /></Field>
          <Field label="Patrimônio"><Input value={draft.patrimony} onChange={(e) => setDraft({ ...draft, patrimony: e.target.value })} /></Field>
          <Field label="IP"><Input value={draft.ip_address} onChange={(e) => setDraft({ ...draft, ip_address: e.target.value })} /></Field>
          <Field label="Sistema operacional"><Input value={draft.operating_system} onChange={(e) => setDraft({ ...draft, operating_system: e.target.value })} /></Field>
          <Field label="Localização"><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></Field>
          <Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{Object.entries(assetStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          <div className="sm:col-span-2"><Field label="Usuário responsável" help={!canViewUsers ? "Seu perfil não possui acesso à lista de usuários." : undefined}><Select disabled={!canViewUsers} value={draft.assigned_user_id || ""} onChange={(e) => setDraft({ ...draft, assigned_user_id: e.target.value ? Number(e.target.value) : null })}><option value="">Não vinculado</option>{users.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.department}</option>)}</Select></Field></div>
        </div>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      </ConfirmDialog>
    </>
  );
}
