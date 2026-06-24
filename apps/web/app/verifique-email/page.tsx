"use client";

import { FormEvent, useState } from "react";
import { Suspense } from "react";
import { MailCheck, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";

function CheckEmailContent() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [message, setMessage] = useState("Enviamos um link de verificação para seu e-mail institucional.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resend = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api.resendVerification(email.trim().toLowerCase());
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reenviar a verificação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-6 sm:px-6">
      <section className="w-full max-w-[500px] rounded-lg border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-[#edf7f5] text-[#0d5c4f]"><MailCheck size={24} /></div>
        <h1 className="mt-5 text-2xl font-semibold text-[var(--foreground)]">Verifique seu e-mail</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Confirme o link recebido para liberar o acesso ao Portal Interno ADCETEI.
        </p>
        <div className="mt-5 space-y-4">
          {message && <Alert tone="success">{message}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
          <form onSubmit={resend} className="space-y-4">
            <Field label="E-mail institucional">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            <Button className="w-full" variant="secondary" disabled={loading}>
              <RefreshCcw size={16} />
              {loading ? "Reenviando..." : "Reenviar verificação"}
            </Button>
          </form>
          <Link href="/login" className="block text-center text-sm font-semibold text-[var(--primary)] hover:underline">Voltar ao login</Link>
        </div>
      </section>
    </main>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailContent />
    </Suspense>
  );
}
