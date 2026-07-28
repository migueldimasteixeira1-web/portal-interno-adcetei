"use client";

import Link from "next/link";
import { ArrowRight, FileText, GitBranch, ListChecks, PenLine } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, SectionHeader, buttonStyles } from "@/components/ui";

const plannedItems = [
  { title: "Formalizações internas", description: "Registro de memorandos, encaminhamentos e solicitações formais entre áreas.", icon: FileText },
  { title: "Fluxos de aprovação", description: "Trilhas de revisão, ciência e encaminhamento administrativo.", icon: GitBranch },
  { title: "Histórico rastreável", description: "Consulta organizada de registros e anexos por setor, período e responsável.", icon: ListChecks },
];

export default function MemorandosPage() {
  return (
    <>
      <PageHeader
        eyebrow="Módulo planejado"
        title="Memorandos"
        subtitle="Espaço reservado para formalizações internas e registros administrativos do Portal Interno ADCETEI."
        actions={<Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>Voltar ao hub <ArrowRight size={15} /></Link>}
      />

      <Card className="overflow-hidden">
        <SectionHeader
          title="Memorandos e formalizações"
          description="Este módulo ainda não possui backend ativo."
          action={<Badge className="border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]">Planejado</Badge>}
        />
        <div className="grid gap-3 p-4 md:grid-cols-3">
          {plannedItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
                <span className="grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]">
                  <Icon size={18} />
                </span>
                <h2 className="mt-4 text-sm font-semibold text-[var(--foreground)]">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-4 rounded-md border border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--status-blue-border)] bg-[var(--card)] text-[var(--primary)]">
            <PenLine size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--primary-hover)]">Próxima etapa</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Definir tipos de documento, permissões de tramitação e modelo de auditoria antes de conectar persistência.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
