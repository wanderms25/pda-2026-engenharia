"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { Shield, ArrowLeft } from "lucide-react";

export default function PrivacidadePage() {
  const hoje = new Date().toLocaleDateString("pt-BR", { day:"2-digit",month:"long",year:"numeric" });
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/cadastro" className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar ao cadastro
        </Link>
        <div>
          <Badge variant={"outline" as any} className="mb-2 gap-1"><Shield className="w-3 h-3" /> LGPD</Badge>
          <h1 className="text-2xl font-bold">Política de Privacidade — PDA NBR 5419</h1>
          <p className="text-xs text-foreground-muted mt-1">Última atualização: {hoje} · Em conformidade com a Lei nº 13.709/2018 (LGPD)</p>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4 text-sm leading-relaxed text-foreground-muted">
            <h2 className="text-base font-semibold text-foreground">1. Controlador dos Dados</h2>
            <p>O controlador dos dados pessoais tratados nesta plataforma é o desenvolvedor do Sistema PDA NBR 5419, nos termos do Art. 5º, VI da LGPD. Para exercer seus direitos ou contatar o Encarregado de Proteção de Dados (DPO), utilize o e-mail disponível na plataforma.</p>

            <h2 className="text-base font-semibold text-foreground">2. Dados Coletados e Finalidade</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse mt-2">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-3 text-foreground font-medium">Dado</th>
                  <th className="text-left py-1.5 pr-3 text-foreground font-medium">Finalidade</th>
                  <th className="text-left py-1.5 text-foreground font-medium">Base Legal (LGPD)</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Nome completo","Identificação no laudo técnico","Art. 7º, V — execução de contrato"],
                    ["E-mail","Autenticação e comunicações","Art. 7º, V — execução de contrato"],
                    ["Número de registro (CREA/CAU/CFT)","Validação profissional e assinatura de laudos","Art. 7º, V — execução de contrato"],
                    ["CPF/CNPJ","Faturamento e emissão de NF","Art. 7º, V — execução de contrato"],
                    ["Endereço","Faturamento","Art. 7º, V — execução de contrato"],
                    ["Telefone","Contato de suporte","Art. 7º, I — consentimento"],
                    ["Logo da empresa","Personalização do laudo PDF","Art. 7º, I — consentimento"],
                    ["Dados dos projetos (obras, clientes)","Geração dos laudos técnicos","Art. 7º, V — execução de contrato"],
                    ["Logs de acesso (IP, timestamp)","Segurança e auditoria","Art. 7º, IX — legítimo interesse"],
                  ].map(([dado,finalidade,base]) => (
                    <tr key={dado}><td className="py-1.5 pr-3">{dado}</td><td className="pr-3">{finalidade}</td><td>{base}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-base font-semibold text-foreground">3. Compartilhamento de Dados</h2>
            <p>Seus dados <strong>não são vendidos ou cedidos a terceiros para fins comerciais</strong>. Compartilhamos apenas com: (a) prestadores de serviço de infraestrutura (hospedagem, banco de dados) vinculados por contratos de confidencialidade compatíveis com a LGPD; (b) BrasilAPI (apenas CNPJ/CEP, sem dados pessoais) para consultas de endereço; (c) autoridades, quando exigido por lei.</p>

            <h2 className="text-base font-semibold text-foreground">4. Retenção e Exclusão</h2>
            <p>Os dados são mantidos pelo prazo de vigência da assinatura acrescido de 5 anos (prazo de prescrição de ações contratuais — Art. 206, §5º, I do Código Civil). Após cancelamento, os dados são anonimizados em até 90 dias, exceto quando há obrigação legal de guarda. Laudos emitidos são retidos conforme exigência de rastreabilidade da NBR 5419-3:2026 §7.5.3.</p>

            <h2 className="text-base font-semibold text-foreground">5. Seus Direitos (Art. 18 da LGPD)</h2>
            <ul className="list-disc list-inside space-y-1">
              {["Confirmação e acesso aos dados tratados","Correção de dados incompletos ou incorretos","Anonimização, bloqueio ou eliminação de dados desnecessários","Portabilidade dos dados a outro fornecedor","Eliminação dos dados tratados com consentimento","Revogação do consentimento a qualquer momento","Oposição ao tratamento em caso de descumprimento da LGPD","Solicitação de revisão de decisões automatizadas"].map(d => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p>Para exercer qualquer direito, envie solicitação ao e-mail do DPO. Respondemos em até 15 dias úteis.</p>

            <h2 className="text-base font-semibold text-foreground">6. Segurança</h2>
            <p>Adotamos as seguintes medidas técnicas e organizacionais: senhas armazenadas com bcrypt (fator 12); comunicação exclusivamente via HTTPS/TLS; tokens JWT com expiração de 8h; acesso ao banco de dados restrito à rede interna; backups criptografados; logs de auditoria; controle de acesso por perfil (RBAC).</p>

            <h2 className="text-base font-semibold text-foreground">7. Cookies</h2>
            <p>Utilizamos apenas cookies estritamente necessários para autenticação (JWT em memória, sem cookie persistente) e preferências de interface. Não utilizamos cookies de rastreamento ou publicidade.</p>

            <h2 className="text-base font-semibold text-foreground">8. Alterações desta Política</h2>
            <p>Notificaremos alterações relevantes por e-mail com antecedência mínima de 30 dias. A versão vigente estará sempre disponível em /privacidade.</p>

            <h2 className="text-base font-semibold text-foreground">9. Contato — Encarregado (DPO)</h2>
            <p>Para questões sobre proteção de dados, entre em contato pelo e-mail disponível na plataforma ou pela página de suporte. Também é possível registrar reclamação junto à ANPD (Autoridade Nacional de Proteção de Dados) em <a href="https://www.gov.br/anpd" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a>.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
