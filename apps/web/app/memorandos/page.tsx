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
            <PenLine size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#164f84]">Próxima etapa</p>
            <p className="mt-1 text-sm leading-6 text-[#5c6b7e]">
              Definir tipos de documento, permissões de tramitação e modelo de auditoria antes de conectar persistência.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
