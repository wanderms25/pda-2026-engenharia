"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from "@/components/ui";
import { formatRisco } from "@/lib/utils";
import type { RecomendacaoOut } from "@/lib/api";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  ArrowRight,
  BookOpen,
  Target,
  Wand2,
} from "lucide-react";

interface Props {
  recomendacao: RecomendacaoOut;
  onAplicarSugestao?: (config: RecomendacaoOut["config_recomendada"]) => void;
}

export function CaminhoParaConformidade({ recomendacao, onAplicarSugestao }: Props) {
  const r = recomendacao;

  // Caso 1: já está conforme — mensagem positiva
  if (r.ja_conforme) {
    return (
      <Card className="border-success/50 bg-success/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-8 h-8 text-success shrink-0" />
            <div>
              <CardTitle className="text-success">
                Estrutura 100% conforme com a NBR 5419-2:2026
              </CardTitle>
              <CardDescription className="mt-1">
                Os riscos calculados estão dentro dos limites toleráveis da
                Tabela 4. Nenhuma medida adicional é necessária.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-card p-4 text-sm">
            <p className="font-medium mb-2">Recomendação para manutenção:</p>
            {r.passos.map((p, i) => (
              <p key={i} className="text-muted-foreground">
                {p.acao} — {p.referencia_norma}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Caso 2: não está conforme, mas existe solução
  if (r.config_recomendada && !r.alerta_nao_conforme) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <Sparkles className="w-8 h-8 text-primary shrink-0" />
            <div className="flex-1">
              <CardTitle className="text-primary">
                Caminho para 100% de conformidade
              </CardTitle>
              <CardDescription className="mt-1">
                Configuração mínima identificada automaticamente pelo sistema
                para trazer R ≤ R<sub>T</sub>. Abaixo estão os passos
                acionáveis com citação normativa.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Antes × Depois */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border bg-card p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-danger" />
                Cenário atual
              </div>
              <div className="text-xl font-mono mt-1 text-danger">
                R1 = {formatRisco(r.R1_antes)}
              </div>
              <div className="text-xs text-muted-foreground">
                R<sub>T</sub> = {formatRisco(1e-5)}
              </div>
            </div>
            <div className="rounded-md border bg-card p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-success" />
                Após aplicar recomendação
              </div>
              <div className="text-xl font-mono mt-1 text-success">
                R1 = {formatRisco(r.R1_depois)}
              </div>
              <div className="text-xs text-success flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Redução de {r.reducao_R1.toFixed(0)}×
              </div>
            </div>
          </div>

          {/* Configuração recomendada */}
          <div className="rounded-md border-2 border-primary/50 bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Target className="w-3 h-3" />
                  Configuração mínima recomendada
                </div>
                <div className="font-medium">
                  {r.config_recomendada.descricao}
                </div>
              </div>
              {onAplicarSugestao && (
                <Button
                  size="sm"
                  onClick={() => onAplicarSugestao(r.config_recomendada)}
                >
                  <Wand2 className="w-4 h-4" /> Aplicar
                </Button>
              )}
            </div>
          </div>

          {/* Passos detalhados */}
          <div>
            <div className="text-sm font-semibold mb-2">
              Passos para aplicar ({r.passos.length})
            </div>
            <div className="space-y-2">
              {r.passos.map((p, i) => (
                <div key={i}><PassoCard numero={i + 1} passo={p} /></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Caso 3: nenhuma solução padrão atingiu conformidade (alerta)
  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-8 h-8 text-warning shrink-0" />
          <div>
            <CardTitle className="text-warning">
              Cenário requer avaliação especial
            </CardTitle>
            <CardDescription className="mt-1">
              {r.alerta_nao_conforme}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {r.passos.map((p, i) => (
            <div key={i}><PassoCard numero={i + 1} passo={p} /></div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PassoCard({
  numero,
  passo,
}: {
  numero: number;
  passo: RecomendacaoOut["passos"][0];
}) {
  const prioridadeConfig = {
    1: { label: "CRÍTICO", variant: "danger" as const },
    2: { label: "NECESSÁRIO", variant: "warning" as const },
    3: { label: "SUGERIDO", variant: "outline" as const },
  };
  const config = prioridadeConfig[passo.prioridade as 1 | 2 | 3];

  return (
    <div className="rounded-md border bg-card p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
          {numero}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{passo.acao}</span>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {passo.justificativa}
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-primary">
              <BookOpen className="w-3 h-3" />
              {passo.referencia_norma}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <ArrowRight className="w-3 h-3" />
              {passo.impacto_estimado}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}