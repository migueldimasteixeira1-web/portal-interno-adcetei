"use client";

import { CircleOff, Pencil, Search, ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import AccessDenied from "@/components/AccessDenied";
import UserAvatar from "@/components/UserAvatar";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, SectionHeader, Select, Toolbar } from "@/components/ui";
import { api } from "@/lib/api";
import { roleLabels } from "@/lib/format";
import type { Role, User } from "@/lib/types";

type UserDraft = {
  username: string;
  full_name: string;
  email: string;
  password: string;
  role: Role;
  secretariat: string;
  department: string;
  phone: string;
  active: boolean;
};

const emptyDraft: UserDraft = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  role: "requester",
  secretariat: "Prefeitura de Cabo Frio",
  department: "",
  phone: "",
  active: true,
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);

  const canView = user?.permissions?.includes("users.view");
  const canManage = user?.permissions?.includes("users.manage");

  const load = async () => {
    try {
      setUsers(await api.users());
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
      department: item.department,
      phone: item.phone,
      active: item.active,
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
        const payload: Record<string, unknown> = {
          full_name: draft.full_name,
          email: draft.email,
          secretariat: draft.secretariat,
          department: draft.department,
          phone: draft.phone,
          active: draft.active,
        };
        if (editing.source === "local") {
          payload.role = draft.role;
          if (draft.password) payload.password = draft.password;
        }
        await api.updateUser(editing.id, payload);
        setMessage("Usuário atualizado com sucesso.");
      } else {
        await api.createUser(draft);
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

  if (loading) return <LoadingScreen label="Carregando usuários..." />;
  if (!canView) return <AccessDenied />;

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Usuários e acessos"
        subtitle="Gerencie contas locais, bloqueios e perfis. Usuários LDAP recebem o perfil conforme o grupo configurado."
        actions={canManage ? <Button onClick={openCreate}><UserPlus size={16} />Novo usuário local</Button> : undefined}
      />
      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && !dialogOpen && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <MetricCard label="Usuários cadastrados" value={users.length} icon={<Users size={17} />} hint="Contas locais e de diretório" tone="blue" />
        <MetricCard label="Contas ativas" value={users.filter((item) => item.active).length} icon={<UserCheck size={17} />} hint="Acesso permitido" tone="green" />
        <MetricCard label="Equipe de TI" value={users.filter((item) => item.role !== "requester").length} icon={<ShieldCheck size={17} />} hint="Administração e atendimento" tone="indigo" />
      </div>

      <Toolbar className="mb-4">
        <div className="grid w-full gap-2 lg:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} />
            <Input aria-label="Buscar usuários" className="pl-8" placeholder="Buscar por nome, usuário, e-mail ou setor" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Filtrar por perfil" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todos os perfis</option>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
      </Toolbar>

      <Card className="overflow-hidden">
        <SectionHeader title={`${filtered.length} usuário(s)`} description="Contas não são excluídas: desative o acesso para preservar o histórico." />
        <div className="overflow-x-auto soft-scrollbar">
          <table className="data-table min-w-[940px]">
            <thead><tr><th>Usuário</th><th>Perfil</th><th>Lotação</th><th>Origem</th><th>Status</th>{canManage && <th>Ações</th>}</tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td><div className="flex items-center gap-2.5"><UserAvatar name={item.full_name} /><div><p className="font-semibold text-[#1a2332]">{item.full_name}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{item.username} · {item.email}</p></div></div></td>
                  <td><Badge className="border border-[#c5daf0] bg-[#f3f7fb] text-[#164f84]">{roleLabels[item.role]}</Badge></td>
                  <td><p className="font-medium text-[#1a2332]">{item.department}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{item.secretariat}</p></td>
                  <td className="text-[#5c6b7e]">{item.source === "ldap" ? "Active Directory" : "Cadastro local"}</td>
                  <td><Badge className={item.active ? "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]" : "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]"}>{item.active ? "Ativo" : "Bloqueado"}</Badge></td>
                  {canManage && <td><Button variant="ghost" size="sm" onClick={() => openEdit(item)}><Pencil size={15} />Editar</Button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <EmptyState icon={<CircleOff size={18} />} title="Nenhum usuário encontrado" description="Revise os filtros ou busque por outro usuário." />}
      </Card>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={save}
        loading={saving}
        title={editing ? "Editar usuário" : "Criar usuário local"}
        description={editing?.source === "ldap" ? "Dados de diretório podem ser atualizados novamente no próximo login. Perfil e senha são controlados pelo AD." : "Preencha os dados e confirme para salvar."}
        confirmLabel="Salvar usuário"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Usuário"><Input disabled={!!editing} value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></Field>
          <Field label="Nome completo"><Input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></Field>
          <Field label="E-mail"><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
          <Field label="Perfil">
            <Select disabled={editing?.source === "ldap"} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Secretaria"><Input value={draft.secretariat} onChange={(e) => setDraft({ ...draft, secretariat: e.target.value })} /></Field>
          <Field label="Setor"><Input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
          {editing?.source !== "ldap" && <Field label={editing ? "Nova senha (opcional)" : "Senha"} help="Mínimo de 10 caracteres."><Input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></Field>}
          <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332]"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />Conta ativa</label>
        </div>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      </ConfirmDialog>
    </>
  );
}
