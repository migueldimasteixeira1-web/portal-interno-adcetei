import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "./ui";

export default function AccessDenied() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]">
          <ShieldOff size={20} />
        </div>
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Acesso restrito</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Seu perfil não possui permissão para acessar esta área do portal.</p>
        <Link href="/dashboard" className={`${buttonStyles({ variant: "secondary" })} mt-5`}>Voltar ao início</Link>
      </div>
    </div>
  );
}
