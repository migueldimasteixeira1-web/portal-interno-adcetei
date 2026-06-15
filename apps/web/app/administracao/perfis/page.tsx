"use client";

import { KeyRound, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AccessDenied from "@/components/AccessDenied";
import LoadingScreen from "@/components/LoadingScreen";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Badge, Button, Card, Field, Input, SectionHeader, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { PermissionDefinition, RoleConfig } from "@/lib/types";

export default function RolesPage() {
  const { user, refreshUser } = useAuth();
  const canManage = user?.permissions?.includes("roles.manage");
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [roleData, permissionData] = await Promise.all([api.roles(), api.permissions()]);
      setRoles(roleData);
      setPermissions(permissionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar perfis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) void load();
    else if (user) setLoading(false);
  }, [canManage, user]);

  const groups = useMemo(() => Array.from(new Set(permissions.map((item) => item.group))), [permissions]);

  const updateRole = (role: string, patch: Partial<RoleConfig>) => {
    setRoles((old) => old.map((item) => item.role === role ? { ...item, ...patch } : item));
  };

  const togglePermission = (role: RoleConfig, permission: string) => {
    if (role.role === "admin") return;
    const selected = role.permissions.includes(permission)
      ? role.permissions.filter((item) => item !== permission)
      : [...role.permissions, permission];
    updateRole(role.role, { permissions: selected });
  };

  const save = async (role: RoleConfig) => {
    setSaving(role.role);
    setError("");
    setMessage("");
    try {
      const updated = await api.updateRole(role.role, {
        description: role.description,
        ldap_group: role.ldap_group,
        permissions: role.permissions,
      });
      updateRole(role.role, updated);
      setMessage(`Perfil ${role.label} atualizado.`);
      if (role.role === user?.role) await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o perfil");
    } finally {
      setSaving("");
    }
  };

  if (loading) return <LoadingScreen label="Carregando perfis e permissões..." />;
  if (!canManage) return <AccessDenied />;

  return (
    <>
      <PageHeader eyebrow="Segurança" title="Perfis e permissões" subtitle="Defina o que cada perfil pode fazer e qual grupo do Active Directory concede o acesso." />
      {message && <Alert tone="success" className="mb-4">{message}</Alert>}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <Alert tone="warning" className="mb-4">Alterações atingem todos os usuários daquele perfil. Permitir “Ver todos os chamados” para Solicitante expõe chamados de outros servidores.</Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        {roles.map((role) => (
          <Card key={role.role} className="overflow-hidden">
            <SectionHeader
              title={role.label}
              description={role.role === "admin" ? "O administrador mantém acesso completo para evitar bloqueio do sistema." : "Permissões aplicadas no backend e na interface."}
              action={<Badge className="border border-[#c5daf0] bg-[#f3f7fb] text-[#164f84]"><ShieldCheck size={13} />{role.permissions.length} permissões</Badge>}
            />
            <div className="space-y-4 p-4">
              <Field label="Descrição"><Textarea className="min-h-20" value={role.description} onChange={(e) => updateRole(role.role, { description: e.target.value })} /></Field>
              <Field label="Grupo no Active Directory" help={role.role === "requester" ? "Deixe vazio: usuários sem grupo técnico serão solicitantes." : "Use o CN exato do grupo, por exemplo GG_TI_HELPDESK."}>
                <Input value={role.ldap_group} onChange={(e) => updateRole(role.role, { ldap_group: e.target.value })} />
              </Field>
              <div>
                <p className="mb-2 text-sm font-semibold text-[#1a2332]">Permissões</p>
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div key={group}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8b97a8]">{group}</p>
                      <div className="grid gap-1.5">
                        {permissions.filter((item) => item.group === group).map((permission) => (
                          <label key={permission.key} className="flex items-start gap-2 rounded-md border border-[#e8edf2] px-3 py-2 text-sm text-[#1a2332]">
                            <input type="checkbox" className="mt-0.5" disabled={role.role === "admin"} checked={role.role === "admin" || role.permissions.includes(permission.key)} onChange={() => togglePermission(role, permission.key)} />
                            <span>{permission.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end border-t border-[#e8edf2] pt-4">
                <Button onClick={() => save(role)} disabled={saving === role.role}><Save size={15} />{saving === role.role ? "Salvando..." : "Salvar perfil"}</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 text-[#1a5f9e]" size={18} />
          <div><p className="font-semibold text-[#1a2332]">Regra do LDAP</p><p className="mt-1 text-sm leading-6 text-[#5c6b7e]">No próximo login, o portal lê os grupos do usuário e aplica o perfil correspondente. Contas LDAP não têm senha nem perfil editados manualmente no portal.</p></div>
        </div>
      </Card>
    </>
  );
}
