"use client";

import Link from "next/link";
import { ArrowRight, Boxes, KeyRound, Network, ServerCog } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, SectionHeader, buttonStyles } from "@/components/ui";

const plannedItems = [
  { title: "Catálogo interno", description: "Acesso organizado a ferramentas, sistemas e recursos mantidos pela ADCETEI.", icon: Boxes },
  { title: "VMs e ambientes", description: "Registro futuro de máquinas virtuais, ambientes de teste e responsabilidades.", icon: ServerCog },
  { title: "Acessos e integrações", description: "Solicitações e documentação operacional para serviços internos.", icon: KeyRound },
];

export default function InternalServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Módulo planejado"
        title="Serviços Internos"
        subtitle="Área reservada para catálogo de ferramentas internas, VMs e serviços operacionais do Portal Interno ADCETEI."
        actions={<Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>Voltar ao hub <ArrowRight size={15} /></Link>}
      />

      <Card className="overflow-hidden">
        <SectionHeader
          title="Serviços e ambientes internos"
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
            <Network size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--primary-hover)]">Próxima etapa</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Separar quais serviços serão apenas catálogo, quais exigem solicitação e quais precisam de integração direta.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
