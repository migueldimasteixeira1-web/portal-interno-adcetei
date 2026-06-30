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
        "panel-flat group flex min-h-[168px] flex-col justify-between p-4 transition hover:border-[#1a5f9e] hover:shadow-sm",
        planned && "bg-[#fbfcfe]",
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md border",
            planned ? "border-[#d4dbe4] bg-[#f7f9fb] text-[#5c6b7e]" : "border-[#c5daf0] bg-[#f3f7fb] text-[#1a5f9e]",
          )}>
            <Icon size={19} />
          </span>
          <Badge className={planned ? "border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]" : "border border-[#a7d9cf] bg-[#edf7f5] text-[#0d5c4f]"}>
            {statusLabel(item.status)}
          </Badge>
        </div>
        <h2 className="mt-4 text-base font-semibold text-[#1a2332]">{item.label}</h2>
        <p className="mt-1.5 text-sm leading-6 text-[#5c6b7e]">{item.description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#e8edf2] pt-3 text-sm font-semibold text-[#1a5f9e]">
        <span>{planned ? "Ver planejamento" : "Acessar módulo"}</span>
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
