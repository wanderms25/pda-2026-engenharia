"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from "@/components/ui";
import type { ResultadoRemediacao, AcaoCorretiva } from "@/lib/api";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  BookOpen,
  DollarSign,
  Target,
} from "lucide-react";

interface Props {
  resultado: ResultadoRemediacao;
}

export function PlanoRemediacao({ resultado }: Props) {
  // Caso: 100% conforme
  if (resultado.ja_conforme_100) {
    return (
      <Card className="border-success/50 bg-success/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-8 h-8 text-success shrink-0" />
            <div>
              <CardTitle className="text-success">
                Laudo 100% conforme
              </CardTitle>
              <CardDescription className="mt-1">
                Todos os itens do checklist foram avaliados como conformes ou
                não se aplicam. Nenhuma ação corretiva é necessária.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Caso: há não-conformidades
  const percentual = resultado.percentual_conformidade;
  const corPercentual =
    percentual >= 90
      ? "text-success"
      : percentual >= 70
        ? "text-warning"
        : "text-danger";

  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <Card className="border-warning/50 bg-warning/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <Target className="w-8 h-8 text-warning shrink-0" />
            <div className="flex-1">
              <CardTitle className="text-warning">
                Caminho para 100% de conformidade
              </CardTitle>
              <CardDescription className="mt-1">
                {resultado.nao_conformes} não-conformidade(s) identificada(s).
                Abaixo está o plano de ação corretiva ordenado por prioridade,
                com citação normativa e prazo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Conformidade atual"
              value={`${percentual.toFixed(0)}%`}
              className={corPercentual}
            />
            <StatCard
              label="Conformes"
              value={String(resultado.conformes)}
              className="text-success"
            />
            <StatCard
              label="Não conformes"
              value={String(resultado.nao_conformes)}
              className="text-danger"
            />
            <StatCard
              label="Ações necessárias"
              value={String(resultado.acoes.length)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ações agrupadas por prioridade */}
      {resultado.acoes_por_prioridade.IMEDIATO?.length > 0 && (
        <GrupoAcoes
          titulo="Ações IMEDIATAS"
          icone={<AlertCircle className="w-5 h-5 text-danger" />}
          descricao="Corrigir antes de liberar a instalação — compromete segurança à vida ou eficácia do SPDA"
          acoes={resultado.acoes_por_prioridade.IMEDIATO}
          cor="danger"
        />
      )}

      {resultado.acoes_por_prioridade.CURTO_PRAZO?.length > 0 && (
        <GrupoAcoes
          titulo="Ações de CURTO PRAZO"
          icone={<Clock className="w-5 h-5 text-warning" />}
          descricao="Corrigir em até 30 dias — impacto significativo na conformidade"
          acoes={resultado.acoes_por_prioridade.CURTO_PRAZO}
          cor="warning"
        />
      )}

      {resultado.acoes_por_prioridade.PREVENTIVO?.length > 0 && (
        <GrupoAcoes
          titulo="Ações PREVENTIVAS"
          icone={<Zap className="w-5 h-5 text-primary" />}
          descricao="Incluir na próxima manutenção programada"
          acoes={resultado.acoes_por_prioridade.PREVENTIVO}
          cor="default"
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${className}`}>{value}</div>
    </div>
  );
}

function GrupoAcoes({
  titulo,
  icone,
  descricao,
  acoes,
  cor,
}: {
  titulo: string;
  icone: React.ReactNode;
  descricao: string;
  acoes: AcaoCorretiva[];
  cor: "danger" | "warning" | "default";
}) {
  const bgClass =
    cor === "danger"
      ? "border-danger/30"
      : cor === "warning"
        ? "border-warning/30"
        : "border-primary/30";

  return (
    <Card className={bgClass}>
      <CardHeader>
        <div className="flex items-start gap-3">
          {icone}
          <div>
            <CardTitle className="text-base">{titulo}</CardTitle>
            <CardDescription className="mt-1">{descricao}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {acoes.map((acao, i) => (
          <div key={acao.codigo_item}><AcaoCard numero={i + 1} acao={acao} /></div>
        ))}
      </CardContent>
    </Card>
  );
}

function AcaoCard({ numero, acao }: { numero: number; acao: AcaoCorretiva }) {
  const custoConfig = {
    BAIXO: { label: "Custo baixo", variant: "success" as const },
    MEDIO: { label: "Custo médio", variant: "warning" as const },
    ALTO: { label: "Custo alto", variant: "danger" as const },
  };
  const custo = custoConfig[acao.custo_relativo as keyof typeof custoConfig];

  return (
    <div className="rounded-md border bg-card p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
          {numero}
        </div>
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="font-mono text-xs text-muted-foreground">
                {acao.codigo_item}
              </div>
              <div className="font-medium text-sm">
                {acao.descricao_nao_conformidade}
              </div>
            </div>
            {custo && <Badge variant={custo.variant}>{custo.label}</Badge>}
          </div>
          {/* Ação */}
          <div className="rounded-md bg-muted/50 p-2 text-xs">
            <div className="font-semibold mb-1">Ação recomendada:</div>
            <p className="text-muted-foreground">{acao.acao_recomendada}</p>
          </div>
          {/* Footer com metadata */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="flex items-center gap-1 text-primary">
              <BookOpen className="w-3 h-3" />
              {acao.referencia_norma}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {acao.prazo}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}