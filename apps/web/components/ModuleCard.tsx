import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, cn } from "@/components/ui";
import type { PortalNavItem } from "@/lib/modules";

function statusLabel(status?: PortalNavItem["status"]) {
  return status === "planned" ? "Planejado" : "Disponível";
}

export default function ModuleCard({ item }: { item: PortalNavItem }) {
  const Icon = item.icon;
  const planned = item.status === "planned";

  return (
    <Link
      href={item.href}
      className={cn(
        "panel-flat group flex min-h-[168px] flex-col justify-between p-4 transition hover:border-[var(--primary)] hover:shadow-sm",
        planned && "bg-[#fbfcfe]",
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md border",
            planned ? "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]" : "border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[var(--primary)]",
          )}>
            <Icon size={19} />
          </span>
          <Badge className={planned ? "border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]" : "border border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[var(--status-green-text)]"}>
            {statusLabel(item.status)}
          </Badge>
        </div>
        <h2 className="mt-4 text-base font-semibold text-[var(--foreground)]">{item.label}</h2>
        <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-sm font-semibold text-[var(--primary)]">
        <span>{planned ? "Ver planejamento" : "Acessar módulo"}</span>
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
