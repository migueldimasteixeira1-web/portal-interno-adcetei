"use client";

import { FormEvent, useState } from "react";
import { Building2, MailCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";

const institutionalEmailPattern = /^[^@\s]+@[a-z0-9-]+\.cabofrio\.rj\.gov\.br$/;
const emailHelp = "Use seu e-mail institucional no formato nome@secretaria.cabofrio.rj.gov.br.";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const emailError = normalizedEmail && !institutionalEmailPattern.test(normalizedEmail)
    ? "E-mails @cabofrio.rj.gov.br ainda não estão no padrão exigido."
    : "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (emailError) {
      setError(`${emailHelp} E-mails @cabofrio.rj.gov.br ainda não estão no padrão exigido.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await api.register({ full_name: fullName, email: normalizedEmail, password });
      router.replace(`/verifique-email?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar sua conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-6 sm:px-6">
      <section className="w-full max-w-[520px] rounded-lg border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--navy-900)] text-white"><Building2 size={20} /></span>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Portal Interno ADCETEI</p>
            <p className="text-xs text-[var(--muted)]">Cadastro institucional</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Criar conta</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Acesse com seu e-mail da secretaria</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{emailHelp}</p>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Nome completo">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required autoFocus />
          </Field>
          <Field label="E-mail institucional" help={!emailError ? emailHelp : undefined} error={emailError}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="Senha" help="Use pelo menos 10 caracteres.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
          </Field>
          <Field label="Confirmar senha">
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
          </Field>
          <Button className="w-full" disabled={loading || Boolean(emailError)}>
            <UserPlus size={16} />
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">Voltar ao login</Link>
          <span className="inline-flex items-center gap-1.5 text-[var(--muted)]"><MailCheck size={15} />Verificação obrigatória</span>
        </div>
      </section>
    </main>
  );
}
