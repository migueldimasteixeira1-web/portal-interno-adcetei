import { MailCheck, MailWarning, Pencil, RefreshCcw, Search, Trash2 } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, Select, Toolbar } from "@/components/ui";
import { InstitutionalEmailInput } from "@/components/InstitutionalEmailInput";
import { roleLabels } from "@/lib/format";
import type { InventoryCatalogItem, Role, User } from "@/lib/types";

export type UserDraft = {
  username: string;
  full_name: string;
  email: string;
  password: string;
  role: Role;
  secretariat: string;
  department_sector_id: string;
  department: string;
  registration: string;
  phone: string;
  active: boolean;
  email_verified: boolean;
};

type TableProps = {
  users: User[];
  canManage: boolean;
  search: string;
  role: string;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onResendVerification: (user: User) => void;
};

export function UsersTable({ users, canManage, search, role, onSearchChange, onRoleChange, onEdit, onDelete, onResendVerification }: TableProps) {
  return (
    <>
      <Toolbar className="mb-4">
        <div className="grid w-full gap-2 lg:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b97a8]" size={16} />
            <Input aria-label="Buscar usuários" className="pl-8" placeholder="Buscar por nome, usuário, e-mail ou setor" value={search} onChange={(e) => onSearchChange(e.target.value)} />
          </div>
          <Select aria-label="Filtrar por perfil" value={role} onChange={(e) => onRoleChange(e.target.value)}>
            <option value="">Todos os perfis</option>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
      </Toolbar>

      <div className="overflow-x-auto soft-scrollbar">
        <table className="data-table min-w-[940px]">
          <thead><tr><th>Usuário</th><th>Perfil</th><th>Lotação</th><th>Verificação</th><th>Status</th>{canManage && <th>Ações</th>}</tr></thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td><div className="flex items-center gap-2.5"><UserAvatar name={item.full_name} /><div><p className="font-semibold text-[#1a2332]">{item.full_name}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{item.username} · {item.email}</p></div></div></td>
                <td><Badge className="border border-[#c5daf0] bg-[#f3f7fb] text-[#164f84]">{roleLabels[item.role]}</Badge></td>
                <td><p className="font-medium text-[#1a2332]">{item.department}</p><p className="mt-0.5 text-xs text-[#8b97a8]">{item.secretariat}</p></td>
                <td><Badge className={item.email_verified_at ? "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]" : "border border-[#fcd9a8] bg-[#fffbeb] text-[#92400e]"}>{item.email_verified_at ? <MailCheck size={13} /> : <MailWarning size={13} />}{item.email_verified_at ? "Verificado" : "Pendente"}</Badge></td>
                <td><Badge className={item.active ? "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]" : "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]"}>{item.active ? "Ativo" : "Bloqueado"}</Badge></td>
                {canManage && (
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item)}><Pencil size={15} />Editar</Button>
                      {!item.email_verified_at && <Button variant="ghost" size="sm" onClick={() => onResendVerification(item)}><RefreshCcw size={15} />Reenviar</Button>}
                      <Button variant="ghost" size="sm" onClick={() => onDelete(item)}><Trash2 size={15} />Excluir</Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type FormDialogProps = {
  open: boolean;
  editing: User | null;
  draft: UserDraft;
  saving: boolean;
  error: string;
  sectorOptions?: InventoryCatalogItem[];
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onDraftChange: (draft: UserDraft) => void;
};

export function UserFormDialog({ open, editing, draft, saving, error, sectorOptions = [], onOpenChange, onConfirm, onDraftChange }: FormDialogProps) {
  const selectSector = (sectorId: string) => {
    const sector = sectorOptions.find((item) => String(item.id) === sectorId);
    onDraftChange({ ...draft, department_sector_id: sectorId, department: sector?.name || draft.department });
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      loading={saving}
      title={editing ? "Editar usuário" : "Criar usuário"}
      description="Perfis de Técnico e Administrador são atribuídos manualmente por administradores."
      confirmLabel="Salvar usuário"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Usuário"><Input value={draft.username} onChange={(e) => onDraftChange({ ...draft, username: e.target.value })} /></Field>
        <Field label="Nome completo"><Input value={draft.full_name} onChange={(e) => onDraftChange({ ...draft, full_name: e.target.value })} /></Field>
        <Field label="E-mail"><InstitutionalEmailInput value={draft.email} onChangeValue={(email) => onDraftChange({ ...draft, email })} /></Field>
        <Field label="Perfil">
          <Select value={draft.role} onChange={(e) => onDraftChange({ ...draft, role: e.target.value as Role })}>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Secretaria"><Input value={draft.secretariat} onChange={(e) => onDraftChange({ ...draft, secretariat: e.target.value })} /></Field>
        <Field label="Setor">
          <Select value={draft.department_sector_id} onChange={(e) => selectSector(e.target.value)}>
            <option value="">Setor textual/manual</option>
            {sectorOptions.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
          </Select>
        </Field>
        {!draft.department_sector_id && <Field label="Setor textual"><Input value={draft.department} onChange={(e) => onDraftChange({ ...draft, department: e.target.value })} /></Field>}
        <Field label="Matrícula"><Input value={draft.registration} onChange={(e) => onDraftChange({ ...draft, registration: e.target.value })} /></Field>
        <Field label="Telefone"><Input value={draft.phone} onChange={(e) => onDraftChange({ ...draft, phone: e.target.value })} /></Field>
        <Field label={editing ? "Nova senha (opcional)" : "Senha"} help="Mínimo de 10 caracteres."><Input type="password" value={draft.password} onChange={(e) => onDraftChange({ ...draft, password: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332]"><input type="checkbox" checked={draft.active} onChange={(e) => onDraftChange({ ...draft, active: e.target.checked })} />Conta ativa</label>
        <label className="flex items-center gap-2 text-sm font-medium text-[#1a2332]"><input type="checkbox" checked={draft.email_verified} onChange={(e) => onDraftChange({ ...draft, email_verified: e.target.checked })} />E-mail verificado</label>
      </div>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
    </ConfirmDialog>
  );
}
