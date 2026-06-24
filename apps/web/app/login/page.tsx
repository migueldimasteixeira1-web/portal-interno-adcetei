"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Headphones, KeyRound, ShieldCheck, TicketCheck } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, Field, Input } from "@/components/ui";
import { SESSION_MESSAGE_KEY } from "@/lib/api";

const demoUsers = [
  ["kathlelyn.abreu@sedec.cabofrio.rj.gov.br", "Servidor"],
  ["maiana.ignacio@adcetei.cabofrio.rj.gov.br", "Helpdesk"],
  ["lucas.martins@adcetei.cabofrio.rj.gov.br", "Técnico"],
  ["admin@adcetei.cabofrio.rj.gov.br", "Administrador"],
];
const showDemoUsers = process.env.NEXT_PUBLIC_SHOW_DEMO_USERS !== "false";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState(showDemoUsers ? demoUsers[0][0] : "");
  const [password, setPassword] = useState(showDemoUsers ? "123456" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    const message = sessionStorage.getItem(SESSION_MESSAGE_KEY);
    if (message) {
      setSessionMessage(message);
      sessionStorage.removeItem(SESSION_MESSAGE_KEY);
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-6 sm:px-6">
      <div className="grid w-full max-w-[940px] overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-[var(--shadow-md)] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden min-h-[610px] flex-col justify-between overflow-hidden bg-[var(--navy-900)] p-8 text-white md:flex">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/8" />
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/8" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md border border-white/15 bg-white/8">
                <Building2 size={22} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Prefeitura de Cabo Frio</p>
                <p className="mt-0.5 text-sm font-semibold">Administração pública municipal</p>
              </div>
            </div>

            <div className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Acesso interno</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight">Portal Interno ADCETEI</h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-white/70">
                Ambiente único para solicitações, atendimento técnico e acompanhamento dos serviços de tecnologia da Prefeitura.
              </p>
            </div>

            <div className="mt-9 space-y-3 border-t border-white/10 pt-6">
              {[
                { icon: TicketCheck, text: "Solicitações organizadas pelo catálogo de serviços" },
                { icon: Headphones, text: "Acompanhamento direto com a equipe de atendimento" },
                { icon: ShieldCheck, text: "Acesso controlado por perfil e histórico auditável" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-sm text-white/72">
                  <item.icon size={17} className="shrink-0 text-cyan-200" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative border-t border-white/10 pt-5">
            <p className="text-xs font-semibold text-white/70">ADCETEI · Tecnologia da Informação</p>
            <p className="mt-1 text-xs text-white/45">Uso exclusivo de servidores e equipes autorizadas.</p>
          </div>
        </aside>

        <section className="p-5 sm:p-8 md:p-10">
          <div className="mb-7 flex items-center gap-3 md:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--navy-900)] text-white"><Building2 size={20} /></span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Portal Interno ADCETEI</p>
              <p className="text-xs text-[var(--muted)]">Prefeitura de Cabo Frio</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Identificação</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Entre no portal</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use seu e-mail institucional verificado e sua senha local para acessar o ambiente interno.</p>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {sessionMessage && <Alert tone="warning">{sessionMessage}</Alert>}
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="E-mail institucional">
              <Input type="email" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="email" autoFocus />
            </Field>
            <Field label="Senha">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <Button className="w-full" disabled={loading}>
              <KeyRound size={16} />
              {loading ? "Validando acesso..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-[var(--muted)]">
            Ainda não tem acesso?{" "}
            <Link href="/criar-conta" className="font-semibold text-[var(--primary)] hover:underline">
              Criar conta
            </Link>
          </div>

          {showDemoUsers && <div className="mt-7 border-t border-[var(--border-subtle)] pt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--muted)]">Acessos de demonstração</p>
              <span className="rounded border border-[var(--status-amber-border)] bg-[var(--status-amber-bg)] px-2 py-0.5 text-[10px] font-semibold text-[#92400e]">Ambiente local</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demoUsers.map(([user, label]) => (
                <button
                  key={user}
                  type="button"
                  className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-left text-xs font-medium text-[var(--muted)] transition hover:border-[var(--primary)] hover:bg-[var(--blue-50)] hover:text-[var(--primary)]"
                  onClick={() => {
                    setUsername(user);
                    setPassword(user.startsWith("admin@") ? "admin123" : "123456");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>}
        </section>
      </div>
    </main>
  );
}
