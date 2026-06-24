"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import { AlertCircle, CheckCircle2, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, buttonStyles } from "@/components/ui";
import { api } from "@/lib/api";

function ConfirmEmailContent() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirmando seu e-mail institucional...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Link de verificação inválido ou expirado.");
      return;
    }
    api.verifyEmail(token)
      .then((result) => {
        setStatus("success");
        setMessage(result.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Link de verificação inválido ou expirado.");
      });
  }, [token]);

  const Icon = status === "success" ? CheckCircle2 : AlertCircle;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-6 sm:px-6">
      <section className="w-full max-w-[500px] rounded-lg border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <div className={status === "success" ? "grid h-12 w-12 place-items-center rounded-md bg-[#edf7f5] text-[#0d5c4f]" : "grid h-12 w-12 place-items-center rounded-md bg-[#fffbeb] text-[#92400e]"}>
          <Icon size={24} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-[var(--foreground)]">
          {status === "success" ? "E-mail confirmado" : status === "loading" ? "Confirmando e-mail" : "Não foi possível confirmar"}
        </h1>
        <div className="mt-5">
          <Alert tone={status === "success" ? "success" : status === "loading" ? "info" : "warning"}>{message}</Alert>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {status === "error" && (
            <Link href="/verifique-email" className={buttonStyles({ variant: "secondary", className: "w-full" })}>
              <RefreshCcw size={16} />Reenviar verificação
            </Link>
          )}
          <Link href="/login" className="inline-flex h-9 w-full items-center justify-center rounded-md border border-[#164f84] bg-[#1a5f9e] px-4 text-sm font-semibold text-white hover:bg-[#164f84]">
            Ir para o login
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
