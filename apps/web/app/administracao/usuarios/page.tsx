"use client";

import { CircleOff, MailCheck, UserCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import { useAuth } from "@/components/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import { Alert, Button, Card, ConfirmDialog, EmptyState, SectionHeader } from "@/components/ui";
import { UserFormDialog, UsersTable, type UserDraft } from "@/features/admin/UsersPanels";
import { completeInstitutionalEmail } from "@/components/InstitutionalEmailInput";
import { activeCatalogItems, emptyInventoryCatalogs } from "@/features/inventory/inventory-utils";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import type { InventoryCatalogs, User } from "@/lib/types";

const emptyDraft: UserDraft = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  role: "user",
  secretariat: "",
  department_sector_id: "",
  department: "",
  registration: "",
  phone: "",
  active: true,
  email_verified: true,
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>(emptyInventoryCatalogs);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);

  const canView = hasPermission(user, "users.view");
  const canManage = hasPermission(user, "users.manage");

  const load = async () => {
    try {
      const [userData, catalogData] = await Promise.all([
        api.users(),
        canManage ? api.inventoryCatalogs() : Promise.resolve(emptyInventoryCatalogs),
      ]);
      setUsers(userData);
      setCatalogs(catalogData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) void load();
    else if (user) setLoading(false);
  }, [canView, user]);

  const filtered = useMemo(() => users.filter((item) => {
    const haystack = `${item.full_name} ${item.email} ${item.username} ${item.department}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (!role || item.role === role);
  }), [users, search, role]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (item: User) => {
    setEditing(item);
    setDraft({
      username: item.username,
      full_name: item.full_name,
      email: item.email,
      password: "",
      role: item.role,
      secretariat: item.secretariat,
      department_sector_id: item.department_sector_id ? String(item.department_sector_id) : "",
      department: item.department,
      registration: item.registration,
      phone: item.phone,
      active: item.active,
      email_verified: Boolean(item.email_verified_at),
    });
    setError("");
    setDialogOpen(true);
  };

  const save = async () => {
    if (!draft.secretariat) {
      setError("Selecione uma secretaria cadastrada.");
      return;
    }
    if (!draft.department_sector_id) {
      setError("Selecione um setor cadastrado no inventário.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          username: draft.username,
          full_name: draft.full_name,
          email: completeInstitutionalEmail(draft.email),
          secretariat: draft.secretariat,
          department_sector_id: draft.department_sector_id ? Number(draft.department_sector_id) : null,
          department: draft.department,
          registration: draft.registration,
          phone: draft.phone,
          active: draft.active,
          email_verified: draft.email_verified,
        };
        payload.role = draft.role;
        if (draft.password) payload.password = draft.password;
        await api.updateUser(editing.id, payload);
        setMessage("Usuário atualizado com sucesso.");
      } else {
        await api.createUser({
          ...draft,
          department_sector_id: draft.department_sector_id ? Number(draft.department_sector_id) : null,
          email: completeInstitutionalEmail(draft.email),
        });
        setMessage("Usuário local criado com sucesso.");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o usuário");
    } finally {
      setSaving(false);
    }
  };

  const resendVerification = async (item: User) => {
    setError("");
    setMessage("");
    try {
      await api.resendUserVerification(item.id);
      setMessage("Verificação reenviada para o e-mail institucional.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reenviar a verificação");
    }
  };

  const deleteSelected = async () => {
    if (!deleting) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.deleteUser(deleting.id);
      setDeleting(null);
      setMessage("Usuário excluído com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o usuário");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Carregando usuários..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Usuários e acessos"
        subtitle="Gerencie contas locais, bloqueios, verificação de e-mail e perfis atribuídos manualmente."
        actions={canManage ? <Button onClick={openCreate}><UserPlus size={16} />Novo usuário</Button> : undefined}
      />
      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && !dialogOpen && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <MetricCard label="Usuários cadastrados" value={users.length} icon={<Users size={17} />} hint="Contas locais do portal" tone="blue" />
        <MetricCard label="Contas ativas" value={users.filter((item) => item.active).length} icon={<UserCheck size={17} />} hint="Acesso permitido" tone="green" />
        <MetricCard label="E-mails verificados" value={users.filter((item) => item.email_verified_at).length} icon={<MailCheck size={17} />} hint="Prontos para login" tone="indigo" />
      </div>

      <Card className="overflow-hidden">
        <SectionHeader title={`${filtered.length} usuário(s)`} description="Exclusão é permitida apenas para contas sem histórico vinculado." />
        <UsersTable
          users={filtered}
          canManage={canManage}
          search={search}
          role={role}
          onSearchChange={setSearch}
          onRoleChange={setRole}
          onEdit={openEdit}
          onDelete={setDeleting}
          onResendVerification={resendVerification}
        />
        {!filtered.length && <EmptyState icon={<CircleOff size={18} />} title="Nenhum usuário encontrado" description="Revise os filtros ou busque por outro usuário." />}
      </Card>

      <UserFormDialog
        open={dialogOpen}
        editing={editing}
        draft={draft}
        saving={saving}
        error={error}
        secretariatOptions={activeCatalogItems(catalogs.secretariats)}
        sectorOptions={activeCatalogItems(catalogs.sectors)}
        onOpenChange={setDialogOpen}
        onConfirm={save}
        onDraftChange={setDraft}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
          setError("");
        }}
        onConfirm={deleteSelected}
        loading={saving}
        title="Excluir usuário"
        description={`Excluir ${deleting?.full_name || "este usuário"} permanentemente? Se houver histórico vinculado, o sistema vai bloquear a exclusão.`}
        confirmLabel="Excluir usuário"
      >
        {error && <Alert tone="danger">{error}</Alert>}
      </ConfirmDialog>
    </>
  );
}
