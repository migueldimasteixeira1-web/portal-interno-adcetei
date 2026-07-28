"use client";

import Link from "next/link";
import { ArrowRight, ChartNoAxesColumn, Printer, Server, Settings2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, SectionHeader, buttonStyles } from "@/components/ui";

const plannedItems = [
  { title: "Filas CUPS", description: "Visão centralizada das filas, status e disponibilidade dos recursos de impressão.", icon: Printer },
  { title: "Servidores de impressão", description: "Mapeamento dos servidores, drivers, modelos e vínculos com setores.", icon: Server },
  { title: "Indicadores de uso", description: "Painéis futuros para volume, erros recorrentes e pontos de atenção.", icon: ChartNoAxesColumn },
];

export default function PrintersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Módulo planejado"
        title="Impressoras / CUPS"
        subtitle="Área reservada para integração com filas de impressão, servidores CUPS e gestão operacional de impressoras."
        actions={<Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>Voltar ao hub <ArrowRight size={15} /></Link>}
      />

      <Card className="overflow-hidden">
        <SectionHeader
          title="Gestão de impressão"
          description="Este módulo ainda não possui integração ativa com CUPS."
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
            <Settings2 size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--primary-hover)]">Próxima etapa</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Definir fonte de dados, autenticação do serviço CUPS e limites de leitura antes de expor filas no portal.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
