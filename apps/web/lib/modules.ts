import {
  BookOpen,
  Boxes,
  ClipboardList,
  FileText,
  History,
  Home,
  MessageCircle,
  MonitorCog,
  Network,
  Printer,
  ServerCog,
  Settings2,
  TableProperties,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role, User } from "./types";
import { hasPermission } from "./permissions";

export type PortalArea = "portal" | "modules" | "administration";
export type PortalModuleStatus = "available" | "planned";

export interface PortalNavItem {
  href: string;
  label: string;
  userLabel?: string;
  description?: string;
  icon: LucideIcon;
  area: PortalArea;
  status?: PortalModuleStatus;
  permission?: string;
  permissionsAny?: string[];
  roles?: Role[];
}

export const portalHome: PortalNavItem = {
  href: "/dashboard",
  label: "Início",
  description: "Hub do Portal Interno ADCETEI",
  icon: Home,
  area: "portal",
  roles: ["admin", "technician", "user"],
};

export const portalModules: PortalNavItem[] = [
  {
    href: "/chamados",
    label: "Chamados Técnicos",
    userLabel: "Meus chamados",
    description: "Solicitações de suporte, triagem e acompanhamento técnico.",
    icon: ClipboardList,
    area: "modules",
    status: "available",
    roles: ["admin", "technician", "user"],
  },
  {
    href: "/mensagens",
    label: "Mensagens",
    description: "Converse diretamente com outros servidores do portal.",
    icon: MessageCircle,
    area: "modules",
    status: "available",
    roles: ["admin", "technician", "user"],
  },
  {
    href: "/inventario",
    label: "Inventário",
    description: "Equipamentos, vínculos, localização e situação dos ativos.",
    icon: Boxes,
    area: "modules",
    status: "available",
    permission: "inventory.view",
  },
  {
    href: "/inventario/termos",
    label: "Termos de Recebimento",
    description: "Emissão do termo oficial e confirmação de entrega antes de alocar ativos.",
    icon: FileText,
    area: "modules",
    status: "available",
    permission: "inventory.move",
  },
  {
    href: "/acesso-remoto",
    label: "Acesso Remoto",
    description: "Conecte em computadores gerenciados pelo MeshCentral com autorização e auditoria.",
    icon: MonitorCog,
    area: "modules",
    status: "available",
    permission: "remote_access.view",
  },
  {
    href: "/memorandos",
    label: "Memorandos",
    description: "Formalizações internas, encaminhamentos e registros administrativos.",
    icon: FileText,
    area: "modules",
    status: "planned",
    roles: ["admin", "technician", "user"],
  },
  {
    href: "/impressoras",
    label: "Impressoras",
    description: "Integração planejada com CUPS, filas e recursos de impressão.",
    icon: Printer,
    area: "modules",
    status: "planned",
    roles: ["admin", "technician", "user"],
  },
  {
    href: "/servicos-internos",
    label: "Serviços Internos",
    description: "Catálogo de ferramentas, VMs e serviços operacionais da ADCETEI.",
    icon: ServerCog,
    area: "modules",
    status: "planned",
    roles: ["admin", "technician", "user"],
  },
  {
    href: "/administracao/usuarios",
    label: "Administração",
    description: "Contas, catálogo, perfis, permissões e auditoria do portal.",
    icon: Settings2,
    area: "administration",
    status: "available",
    permissionsAny: ["users.view", "inventory.manage_catalogs", "catalog.manage", "roles.manage", "audit.view"],
  },
];

export const administrationNav: PortalNavItem[] = [
  { href: "/administracao/usuarios", label: "Usuários", icon: Users, area: "administration", permission: "users.view" },
  { href: "/administracao/base-cadastros", label: "Base de cadastros", icon: TableProperties, area: "administration", permission: "inventory.manage_catalogs" },
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
  return user?.role === "user" && item.userLabel ? item.userLabel : item.label;
}

export function isNavItemActive(pathname: string, item: PortalNavItem): boolean {
  if (item.href === "/dashboard") return pathname === item.href;
  if (item.href === "/chamados") {
    return pathname === "/chamados" || pathname === "/chamados/novo" || /^\/chamados\/\d+/.test(pathname);
  }
  if (item.href === "/acesso-remoto") return pathname === item.href || pathname.startsWith(`${item.href}/`);
  if (item.href === "/inventario") {
    return pathname === "/inventario" || ["/inventario/novo", "/inventario/lote"].includes(pathname) || /^\/inventario\/\d+/.test(pathname);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Início",
  "/mensagens": "Mensagens",
  "/chamados": "Chamados",
  "/chamados/novo": "Abrir chamado",
  "/inventario": "Inventário",
  "/inventario/termos": "Termos de Recebimento",
  "/inventario/novo": "Inventário · Novo equipamento",
  "/inventario/lote": "Inventário · Entrada em lote",
  "/acesso-remoto": "Acesso Remoto",
  "/inventario/cadastros": "Administração · Base de cadastros",
  "/memorandos": "Memorandos",
  "/impressoras": "Impressoras",
  "/servicos-internos": "Serviços Internos",
  "/administracao/usuarios": "Administração · Usuários",
  "/administracao/base-cadastros": "Administração · Base de cadastros",
  "/administracao/catalogo": "Administração · Catálogo",
  "/administracao/perfis": "Administração · Perfis",
  "/administracao/auditoria": "Auditoria",
};

export function pageLabelForPath(pathname: string): string {
  if (pathname.startsWith("/chamados/") && pathname !== "/chamados/novo") {
    return "Detalhes do chamado";
  }
  if (pathname.startsWith("/acesso-remoto/sessoes/")) {
    return "Sessão de acesso remoto";
  }
  if (pathname.startsWith("/inventario/") && pathname !== "/inventario/novo" && pathname !== "/inventario/lote" && pathname !== "/inventario/cadastros" && pathname !== "/inventario/termos") {
    return "Detalhes do equipamento";
  }
  return PAGE_TITLES[pathname] || "Portal Interno ADCETEI";
}
