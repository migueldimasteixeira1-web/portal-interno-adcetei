"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Boxes, ClipboardList, Search, Users as UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import { cn } from "./ui";
import { api } from "@/lib/api";
import { canAccessNavItem, portalNavSections } from "@/lib/modules";
import { hasPermission } from "@/lib/permissions";

type ResultItem = {
  key: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: typeof Search;
  group: "Navegação" | "Chamados" | "Inventário" | "Usuários";
};

const GROUP_ORDER: ResultItem["group"][] = ["Navegação", "Chamados", "Inventário", "Usuários"];

export default function CommandPalette() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [ticketResults, setTicketResults] = useState<ResultItem[]>([]);
  const [assetResults, setAssetResults] = useState<ResultItem[]>([]);
  const [userResults, setUserResults] = useState<ResultItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const canSearchTickets = hasPermission(user, "tickets.view_all");
  const canSearchAssets = hasPermission(user, "inventory.view") || hasPermission(user, "assets.view");
  const canSearchUsers = hasPermission(user, "users.view");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setTicketResults([]);
      setAssetResults([]);
      setUserResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open || debouncedQuery.length < 2) {
      setTicketResults([]);
      setAssetResults([]);
      setUserResults([]);
      return;
    }
    let cancelled = false;

    if (canSearchTickets) {
      void api
        .tickets({ search: debouncedQuery, page_size: 5 })
        .then((page) => {
          if (cancelled) return;
          setTicketResults(
            page.items.map((ticket) => ({
              key: `ticket-${ticket.id}`,
              label: `#${ticket.id} · ${ticket.title}`,
              sublabel: ticket.requester?.full_name,
              href: `/chamados/${ticket.id}`,
              icon: ClipboardList,
              group: "Chamados" as const,
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setTicketResults([]);
        });
    }

    if (canSearchAssets) {
      void api
        .inventoryAssets({ search: debouncedQuery, page_size: 5 })
        .then((page) => {
          if (cancelled) return;
          setAssetResults(
            page.items.map((asset) => ({
              key: `asset-${asset.id}`,
              label: asset.display_name,
              sublabel: asset.serial_number,
              href: `/inventario/${asset.id}`,
              icon: Boxes,
              group: "Inventário" as const,
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setAssetResults([]);
        });
    }

    if (canSearchUsers) {
      void api
        .users({ search: debouncedQuery })
        .then((users) => {
          if (cancelled) return;
          setUserResults(
            users.slice(0, 5).map((item) => ({
              key: `user-${item.id}`,
              label: item.full_name,
              sublabel: item.email,
              href: "/administracao/usuarios",
              icon: UsersIcon,
              group: "Usuários" as const,
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setUserResults([]);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open, canSearchTickets, canSearchAssets, canSearchUsers]);

  const navResults: ResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = portalNavSections.flatMap((section) => section.items).filter((item) => canAccessNavItem(item, user));
    const filtered = q
      ? visible.filter((item) => item.label.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q))
      : visible;
    return filtered.slice(0, q ? 8 : 6).map((item) => ({
      key: `nav-${item.href}`,
      label: item.label,
      sublabel: item.description,
      href: item.href,
      icon: item.icon,
      group: "Navegação" as const,
    }));
  }, [query, user]);

  const allResults = useMemo(
    () => [...navResults, ...ticketResults, ...assetResults, ...userResults],
    [navResults, ticketResults, assetResults, userResults],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [allResults.length]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        aria-label="Busca rápida"
      >
        <Search size={14} />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden rounded border border-[var(--border)] bg-[var(--card)] px-1 py-0.5 text-[10px] font-semibold sm:inline">⌘K</kbd>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--navy-950)]/50" />
          <Dialog.Content
            className="fixed left-1/2 top-[12%] z-50 w-[92vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)] outline-none"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, allResults.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const target = allResults[activeIndex];
                if (target) go(target.href);
              }
            }}
          >
            <Dialog.Title className="sr-only">Busca rápida</Dialog.Title>
            <Dialog.Description className="sr-only">
              Busque módulos do portal, chamados, equipamentos do inventário e usuários.
            </Dialog.Description>
            <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 py-3">
              <Search size={17} className="shrink-0 text-[var(--muted-light)]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar módulos, chamados, inventário, usuários..."
                className="h-6 w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)]"
              />
              <kbd className="hidden shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted-light)] sm:inline">Esc</kbd>
            </div>
            <div className="soft-scrollbar max-h-[60vh] overflow-y-auto p-2">
              {allResults.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-[var(--muted-light)]">
                  {query.trim().length >= 2 ? "Nada encontrado." : "Digite para buscar em todo o portal."}
                </p>
              )}
              {GROUP_ORDER.map((group) => {
                const items = allResults.filter((item) => item.group === group);
                if (!items.length) return null;
                return (
                  <div key={group} className="mb-2 last:mb-0">
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-light)]">{group}</p>
                    {items.map((item) => {
                      const globalIndex = allResults.indexOf(item);
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          onClick={() => go(item.href)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                            globalIndex === activeIndex
                              ? "bg-[var(--status-blue-bg)] text-[var(--primary-hover)]"
                              : "text-[var(--foreground)] hover:bg-[var(--border-subtle)]",
                          )}
                        >
                          <Icon size={16} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.sublabel && <span className="shrink-0 max-w-[40%] truncate text-xs text-[var(--muted-light)]">{item.sublabel}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
