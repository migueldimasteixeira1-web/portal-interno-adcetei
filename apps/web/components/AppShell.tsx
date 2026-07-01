"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { ReactNode, useState } from "react";
import { useAuth } from "./AuthProvider";
import LoadingScreen from "./LoadingScreen";
import NavCascadeItem from "./NavCascadeItem";
import UserAvatar from "./UserAvatar";
import { Button, cn } from "./ui";
import { roleLabels } from "@/lib/format";
import { canAccessNavItem, pageLabelForPath, portalNavSections } from "@/lib/modules";
import { publicRoutes } from "@/lib/routes";

const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV || "local";
const environmentLabel = appEnvironment === "production"
  ? ""
  : appEnvironment === "staging"
    ? "Homologação"
    : "Ambiente local";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (publicRoutes.includes(pathname)) return <>{children}</>;
  if (loading || !user) return <LoadingScreen label="Validando seu acesso..." />;

  const sections = portalNavSections
    .map((section) => ({ ...section, items: section.items.filter((item) => canAccessNavItem(item, user)) }))
    .filter((section) => section.items.length > 0);
  const currentLabel = pageLabelForPath(pathname);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[240px] -translate-x-full flex-col border-r border-[#0a1f33] bg-[#0f2d4a] text-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        open && "translate-x-0",
      )}>
        <div className="border-b border-white/10 px-4 py-4">
          <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-bold tracking-wide text-white">
              TI
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">Portal Interno ADCETEI</p>
              <p className="truncate text-[11px] text-white/60">Prefeitura de Cabo Frio</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 soft-scrollbar" aria-label="Navegação principal">
          {sections.map((section) => (
            <div key={section.title} className="mb-4 last:mb-0">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">{section.title}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <NavCascadeItem
                    key={item.href}
                    item={item}
                    user={user}
                    pathname={pathname}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="rounded-md bg-white/6 p-2.5">
            <div className="flex items-center gap-2.5">
              <UserAvatar name={user.full_name} size="sm" variant="sidebar" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{user.full_name}</p>
                <p className="truncate text-[11px] text-white/55">{roleLabels[user.role]}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start px-1.5 text-white/65 hover:bg-white/8 hover:text-white"
              onClick={logout}
            >
              <LogOut size={15} /> Encerrar sessão
            </Button>
          </div>
        </div>
      </aside>

      {open && <button className="fixed inset-0 z-30 bg-[#0a1f33]/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu" />}

      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#d4dbe4] bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-[#5c6b7e] hover:bg-[#e8edf2] lg:hidden" aria-label="Abrir menu">
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#1a2332]">{currentLabel}</p>
              <p className="hidden truncate text-xs text-[#8b97a8] sm:block">{user.department} · {user.secretariat}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {environmentLabel && <span className="hidden items-center gap-1.5 rounded-md border border-[#a7d9cf] bg-[#edf7f5] px-2 py-1 text-[11px] font-semibold text-[#0d5c4f] sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0d7a6a]" />
              {environmentLabel}
            </span>}
            <UserAvatar name={user.full_name} size="sm" className="hidden sm:flex" />
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:py-6">{children}</div>
      </main>
    </div>
  );
}
