"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "./ui";
import {
  actionLabelForUser,
  isNavItemActive,
  isNavPathActive,
  moduleLabelForUser,
  type PortalNavItem,
} from "@/lib/modules";
import type { User } from "@/lib/types";

interface NavCascadeItemProps {
  item: PortalNavItem;
  user: User;
  pathname: string;
  onNavigate: () => void;
}

export default function NavCascadeItem({ item, user, pathname, onNavigate }: NavCascadeItemProps) {
  const Icon = item.icon;
  const actions = item.actions ?? [];
  const hasActions = actions.length > 0;
  const active = isNavItemActive(pathname, item);
  const [expanded, setExpanded] = useState(active);

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);

  const linkClassName = cn(
    "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
    active ? "text-white" : "text-white/70 hover:text-white",
  );

  if (!hasActions) {
    return (
      <li>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            linkClassName,
            active ? "bg-white/12" : "hover:bg-white/6",
          )}
        >
          <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-white" : "text-white/55"} />
          <span className="min-w-0 flex-1 truncate">{moduleLabelForUser(item, user)}</span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-label={`${expanded ? "Recolher" : "Expandir"} ações de ${moduleLabelForUser(item, user)}`}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          "flex w-full items-center rounded-md text-left transition-colors",
          active ? "bg-white/12" : "hover:bg-white/6",
        )}
      >
        <span className={linkClassName}>
          <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-white" : "text-white/55"} />
          <span className="min-w-0 flex-1 truncate">{moduleLabelForUser(item, user)}</span>
        </span>
        <ChevronRight
          size={15}
          className={cn("mr-2 shrink-0 text-white/55 transition-transform", expanded && "rotate-90")}
          aria-hidden
        />
      </button>

      {expanded && (
        <ul role="menu" className="mt-0.5 space-y-0.5 border-l border-white/10 py-0.5 pl-2">
          {actions.map((action) => {
            const actionActive = isNavPathActive(pathname, action.href);
            return (
              <li key={action.href} role="none">
                <Link
                  href={action.href}
                  role="menuitem"
                  onClick={onNavigate}
                  aria-current={actionActive ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-2.5 py-2 text-sm transition-colors",
                    actionActive
                      ? "bg-white/12 font-semibold text-white"
                      : "text-white/70 hover:bg-white/6 hover:text-white",
                  )}
                >
                  {actionLabelForUser(action, user)}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
