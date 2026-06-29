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
          action={<Badge className="border border-[#d4dbe4] bg-[#f0f3f7] text-[#5c6b7e]">Planejado</Badge>}
        />
        <div className="grid gap-3 p-4 md:grid-cols-3">
          {plannedItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-md border border-[#e8edf2] bg-[#f7f9fb] p-4">
                <span className="grid h-9 w-9 place-items-center rounded-md border border-[#d4dbe4] bg-white text-[#5c6b7e]">
                  <Icon size={18} />
                </span>
                <h2 className="mt-4 text-sm font-semibold text-[#1a2332]">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-[#5c6b7e]">{item.description}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-4 rounded-md border border-[#c5daf0] bg-[#f3f7fb] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#c5daf0] bg-white text-[#1a5f9e]">
            <Settings2 size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#164f84]">Próxima etapa</p>
            <p className="mt-1 text-sm leading-6 text-[#5c6b7e]">
              Definir fonte de dados, autenticação do serviço CUPS e limites de leitura antes de expor filas no portal.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
