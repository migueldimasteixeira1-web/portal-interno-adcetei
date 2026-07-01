import {
  BookOpen,
  Boxes,
  ClipboardList,
  History,
  Home,
  Network,
  Settings2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role, User } from "./types";
import { hasPermission } from "./permissions";

export type PortalArea = "portal" | "modules" | "administration";
export type PortalModuleStatus = "available" | "planned";

export interface PortalNavAction {
  href: string;
  label: string;
  requesterLabel?: string;
}

export interface PortalNavItem {
  href: string;
  label: string;
  requesterLabel?: string;
  description?: string;
  icon: LucideIcon;
  area: PortalArea;
  status?: PortalModuleStatus;
  permission?: string;
  permissionsAny?: string[];
  roles?: Role[];
  actions?: PortalNavAction[];
}

export const portalHome: PortalNavItem = {
  href: "/dashboard",
  label: "Início",
  description: "Hub do Portal Interno ADCETEI",
  icon: Home,
  area: "portal",
  roles: ["admin", "helpdesk", "technician", "requester"],
};

export const portalModules: PortalNavItem[] = [
  {
    href: "/chamados",
    label: "Chamados Técnicos",
    requesterLabel: "Meus chamados",
    description: "Solicitações de suporte, triagem e acompanhamento técnico.",
    icon: ClipboardList,
    area: "modules",
    status: "available",
    roles: ["admin", "helpdesk", "technician", "requester"],
    actions: [
      { href: "/chamados", label: "Ver chamados", requesterLabel: "Meus chamados" },
      { href: "/chamados/novo", label: "Abrir chamado" },
    ],
  },
  {
    href: "/inventario",
    label: "Inventário",
    description: "Equipamentos, vínculos, localização e situação dos ativos.",
    icon: Boxes,
    area: "modules",
    status: "available",
    permission: "assets.view",
  },
  {
    href: "/administracao/usuarios",
    label: "Administração",
    description: "Contas, catálogo, perfis, permissões e auditoria do portal.",
    icon: Settings2,
    area: "administration",
    status: "available",
    permissionsAny: ["users.view", "catalog.manage", "roles.manage", "audit.view"],
  },
];

export const administrationNav: PortalNavItem[] = [
  { href: "/administracao/usuarios", label: "Usuários", icon: Users, area: "administration", permission: "users.view" },
  { href: "/administracao/catalogo", label: "Catálogo", icon: BookOpen, area: "administration", permission: "catalog.manage" },
  { href: "/administracao/perfis", label: "Perfis", icon: Network, area: "administration", permission: "roles.manage" },
  { href: "/administracao/auditoria", label: "Auditoria", icon: History, area: "administration", permission: "audit.view" },
];

export const portalNavSections = [
  { title: "Portal", items: [portalHome] },
  { title: "Módulos", items: portalModules.filter((item) => item.area === "modules") },
  { title: "Administração", items: administrationNav },
] as const;

export function canAccessNavItem(item: PortalNavItem, user?: User | null): boolean {
  if (!user) return false;
  if (item.permission) return hasPermission(user, item.permission);
  if (item.permissionsAny) return item.permissionsAny.some((permission) => hasPermission(user, permission));
  if (item.roles) return item.roles.includes(user.role);
  return true;
}

export function moduleLabelForUser(item: PortalNavItem, user?: User | null): string {
  return user?.role === "requester" && item.requesterLabel ? item.requesterLabel : item.label;
}

export function actionLabelForUser(action: PortalNavAction, user?: User | null): string {
  return user?.role === "requester" && action.requesterLabel ? action.requesterLabel : action.label;
}

export function isNavPathActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  if (href === "/chamados") return pathname === "/chamados" || /^\/chamados\/\d+/.test(pathname);
  if (href === "/chamados/novo") return pathname === "/chamados/novo";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavItemActive(pathname: string, item: PortalNavItem): boolean {
  if (item.actions?.length) {
    return item.actions.some((action) => isNavPathActive(pathname, action.href));
  }
  return isNavPathActive(pathname, item.href);
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Início",
  "/chamados": "Chamados",
  "/chamados/novo": "Abrir chamado",
  "/inventario": "Inventário",
  "/administracao/usuarios": "Administração · Usuários",
  "/administracao/catalogo": "Administração · Catálogo",
  "/administracao/perfis": "Administração · Perfis",
  "/administracao/auditoria": "Auditoria",
};

export function pageLabelForPath(pathname: string): string {
  if (pathname.startsWith("/chamados/") && pathname !== "/chamados/novo") {
    return "Detalhes do chamado";
  }
  return PAGE_TITLES[pathname] || "Portal Interno ADCETEI";
}
