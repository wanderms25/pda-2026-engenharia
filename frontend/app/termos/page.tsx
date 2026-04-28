"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { FileText, ArrowLeft } from "lucide-react";

export default function TermosPage() {
  const hoje = new Date().toLocaleDateString("pt-BR", { day:"2-digit",month:"long",year:"numeric" });
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/cadastro" className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar ao cadastro
        </Link>
        <div>
          <Badge variant={"outline" as any} className="mb-2 gap-1"><FileText className="w-3 h-3" /> Legal</Badge>
          <h1 className="text-2xl font-bold">Termos de Uso — PDA NBR 5419</h1>
          <p className="text-xs text-foreground-muted mt-1">Última atualização: {hoje}</p>
        </div>
        <Card>
          <CardContent className="p-6 prose prose-sm max-w-none text-foreground-muted space-y-4 text-sm leading-relaxed">
            <h2 className="text-base font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p>Ao criar uma conta e utilizar o sistema PDA NBR 5419 ("Sistema"), o usuário ("Profissional") concorda integralmente com estes Termos de Uso. O acesso é restrito a profissionais habilitados perante o CREA, CAU ou CFT, devidamente registrados e com inscrição ativa em seu respectivo conselho de classe.</p>

            <h2 className="text-base font-semibold text-foreground">2. Natureza do Sistema e Responsabilidade Técnica</h2>
            <p>O Sistema é uma ferramenta de suporte ao cálculo e documentação técnica, elaborada com base na ABNT NBR 5419:2026 (Partes 1, 2, 3 e 4). Os resultados gerados (análises de risco, laudos, dimensionamentos) têm caráter auxiliar e <strong>não substituem o juízo técnico do profissional responsável</strong>.</p>
            <p>O Profissional que assina o laudo gerado pelo Sistema é integralmente responsável pela <strong>veracidade dos dados informados</strong>, pela <strong>conformidade com a norma vigente</strong> e pela <strong>adequação do projeto às condições reais da estrutura</strong>. A emissão de ART/RRT é de responsabilidade exclusiva do Profissional, conforme exigido pela NBR 5419-3:2026, §7.5.3.</p>

            <h2 className="text-base font-semibold text-foreground">3. Licença de Uso</h2>
            <p>É concedida ao Profissional uma licença pessoal, intransferível e não exclusiva para utilizar o Sistema durante o período de assinatura ativa. É vedado: (a) compartilhar credenciais de acesso; (b) reproduzir, modificar ou revender o Sistema ou qualquer parte dele; (c) utilizar o Sistema para fins ilícitos ou contrários à ética profissional.</p>

            <h2 className="text-base font-semibold text-foreground">4. Assinatura e Pagamento</h2>
            <p>O acesso ao Sistema está condicionado ao pagamento da assinatura mensal ou anual escolhida no cadastro. O cancelamento pode ser solicitado a qualquer momento; o acesso permanece ativo até o fim do período pago. Não há reembolso proporcional para cancelamentos antecipados.</p>

            <h2 className="text-base font-semibold text-foreground">5. Disponibilidade e Atualizações</h2>
            <p>O Sistema é fornecido "no estado em que se encontra". Nos comprometemos a manter disponibilidade de 99% ao mês (exceto manutenções programadas) e a atualizar os cálculos sempre que houver revisão normativa da NBR 5419. Atualizações serão comunicadas por e-mail com antecedência mínima de 15 dias.</p>

            <h2 className="text-base font-semibold text-foreground">6. Propriedade Intelectual</h2>
            <p>Os laudos e análises gerados a partir dos dados inseridos pelo Profissional pertencem ao próprio Profissional. O Sistema, seus algoritmos, interfaces e banco de dados normativos são propriedade do desenvolvedor e protegidos pela Lei nº 9.610/1998 (Lei de Direitos Autorais) e pela Lei nº 9.609/1998 (Lei de Software).</p>

            <h2 className="text-base font-semibold text-foreground">7. Limitação de Responsabilidade</h2>
            <p>Em nenhuma hipótese o desenvolvedor do Sistema será responsabilizado por danos diretos ou indiretos decorrentes do uso dos laudos gerados, incluindo falhas de proteção de estruturas, litígios com clientes ou penalidades impostas por órgãos fiscalizadores. A responsabilidade técnica e legal pelos documentos emitidos é exclusiva do Profissional signatário.</p>

            <h2 className="text-base font-semibold text-foreground">8. Alterações dos Termos</h2>
            <p>Estes Termos podem ser alterados com notificação prévia de 30 dias. A continuidade de uso após a notificação implica aceitação dos novos termos. Caso o Profissional não concorde com as alterações, poderá cancelar a assinatura sem ônus adicional.</p>

            <h2 className="text-base font-semibold text-foreground">9. Foro e Lei Aplicável</h2>
            <p>Estes Termos são regidos pela lei brasileira. As partes elegem o foro da comarca de domicílio do desenvolvedor para dirimir quaisquer controvérsias.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
