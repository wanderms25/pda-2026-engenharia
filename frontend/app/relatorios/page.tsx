"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Badge } from "@/components/ui";
import { FileText, ShieldCheck, ClipboardList, Download, ArrowRight } from "lucide-react";

const RELATORIOS = [
  {
    id: "analise",
    titulo: "Laudo de Análise de Risco",
    descricao: "PDF técnico conforme NBR 5419-2:2026. Inclui memória de cálculo, R1/R3, recomendação de NP e responsável técnico.",
    norma: "NBR 5419-2:2026",
    icon: ShieldCheck,
    href: "/analise-risco",
    cta: "Gerar pela Análise de Risco",
    cor: "text-primary",
  },
  {
    id: "inspecao",
    titulo: "Laudo de Inspeção de SPDA",
    descricao: "PDF de inspeção com checklist normativo de 30 itens (NBR 5419-3 §7), plano de remediação e fotos.",
    norma: "NBR 5419-3:2026 §7",
    icon: ClipboardList,
    href: "/laudo",
    cta: "Gerar pelo Laudo de Inspeção",
    cor: "text-primary",
  },
];

export default function RelatoriosPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Badge variant={"outline" as any} className="mb-2 gap-1">
          <FileText className="w-3 h-3" /> Relatórios
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Relatórios PDF</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Laudos técnicos conforme ABNT NBR 5419:2026 com assinatura do responsável e logo da empresa.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {RELATORIOS.map(({ id, titulo, descricao, norma, icon: Icon, href, cta, cor }) => (
          <Card key={id} className="card-glass flex flex-col">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className={`w-5 h-5 ${cor}`} />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base leading-tight">{titulo}</CardTitle>
                  <Badge variant={"outline" as any} className="mt-1.5 text-[10px]">{norma}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <CardDescription className="text-xs leading-relaxed">{descricao}</CardDescription>
              <div className="mt-auto">
                <Button asChild className="w-full">
                  <Link href={href} className="flex items-center justify-center gap-2">
                    <Download className="w-4 h-4 shrink-0" />
                    <span>{cta}</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-foreground-muted">
            <strong>Como gerar:</strong> Acesse a página correspondente, preencha os dados do projeto e clique em "Gerar PDF". O laudo é gerado com os dados do profissional logado (nome, registro, empresa e logo).
          </p>
          <p className="text-xs text-foreground-muted mt-2">
            Para que o <strong>nome, CREA/CAU/CFT e logo</strong> apareçam corretamente, certifique-se de preencher seu perfil em{" "}
            <Link href="/perfil" className="text-primary hover:underline">Configurações → Perfil</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
