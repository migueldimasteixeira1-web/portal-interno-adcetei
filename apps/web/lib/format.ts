export const roleLabels: Record<string, string> = {
  admin: "Administrador",
  technician: "Técnico",
  user: "Usuário",
};

export const statusLabels: Record<string, string> = {
  new: "Novo",
  assigned: "Atribuído",
  closed: "Fechado",
  cancelled: "Cancelado",
};

export const statusOptions = [
  ["new", "Novo"],
  ["assigned", "Atribuído"],
  ["closed", "Fechado"],
  ["cancelled", "Cancelado"],
] as const;

export const technicianStatusOptions = [
  ["assigned", "Atribuído"],
  ["closed", "Fechado"],
  ["cancelled", "Cancelado"],
] as const;

export const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const priorityOptions = [
  ["low", "Baixa"],
  ["medium", "Média"],
  ["high", "Alta"],
  ["critical", "Crítica"],
] as const;

export const assetStatusLabels: Record<string, string> = {
  active: "Ativo",
  allocated: "Alocado",
  maintenance: "Em manutenção",
  stock: "Estoque",
  retired: "Baixado",
};

export const inventoryAssetStatusLabels: Record<string, string> = {
  stock: "Estoque",
  allocated: "Alocado",
  maintenance: "Em manutenção",
  retired: "Baixado",
};

export const inventoryMovementActionLabels: Record<string, string> = {
  created: "Cadastro",
  updated: "Atualização",
  allocated: "Envio/Alocação",
  responsible_changed: "Troca de responsável",
  returned_to_stock: "Devolução ao estoque",
  maintenance: "Manutenção",
  retired: "Baixa",
};

export const assetTypeLabels: Record<string, string> = {
  computer: "Computador",
  notebook: "Notebook",
  monitor: "Monitor",
  printer: "Impressora",
  network: "Rede",
};

export const catalogFieldLabels: Record<string, string> = {
  local: "Local",
  location: "Localização",
  computer: "Computador",
  printer_model: "Modelo da impressora",
  printer_ip: "IP da impressora",
  email_account: "Conta de e-mail",
  error_message: "Mensagem de erro",
  person_name: "Nome da pessoa",
  cpf: "CPF",
  requested_action: "Ação solicitada",
  authorization: "Autorização",
  username: "Nome de usuário",
  department: "Setor",
  symptoms: "Sintomas",
  started_at: "Início do problema",
  scope: "Abrangência",
  responsible_user: "Usuário responsável",
  network_point: "Ponto de rede",
  software_name: "Nome do sistema",
  license: "Licença",
  details: "Detalhes",
};

export function assetStatusTone(status: string): string {
  const map: Record<string, string> = {
    active: "border border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[#0d5c4f]",
    allocated: "border border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[#0d5c4f]",
    maintenance: "border border-[var(--status-amber-border)] bg-[var(--status-amber-bg)] text-[#92400e]",
    stock: "border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[#164f84]",
    retired: "border border-[var(--border)] bg-[#f0f3f7] text-[var(--muted)]",
  };
  return map[status] || "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]";
}

export function statusTone(status: string): string {
  const map: Record<string, string> = {
    new: "border border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
    assigned: "border border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
    closed: "border border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]",
    cancelled: "border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  };
  return map[status] || "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]";
}

export function priorityTone(priority: string): string {
  const map: Record<string, string> = {
    low: "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]",
    medium: "border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[#164f84]",
    high: "border border-[var(--status-amber-border)] bg-[var(--status-amber-bg)] text-[#92400e]",
    critical: "border border-[var(--status-red-border)] bg-[var(--status-red-bg)] text-[#991b1b]",
  };
  return map[priority] || "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]";
}

export function formatDate(value?: string | null, withTime = true): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export function relativeTime(value?: string | null): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const future = diff < 0;
  const minutes = Math.floor(Math.abs(diff) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return future ? `em ${minutes} min` : `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return future ? `em ${hours}h` : `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return future ? `em ${days}d` : `há ${days}d`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
