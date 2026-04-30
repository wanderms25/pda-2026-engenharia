"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from "@/components/ui";
import NumericInput from "@/components/ui/numeric-input";
import GraficosProtecao from "@/components/laudo/graficos-protecao";
import {
  NIVEIS,
  NP_CONFIG,
  NivelProtecao,
  anguloProtecao,
  numeroMinimoDescidas,
  raioProtecaoAngulo,
  raioProtecaoEsferaRolante,
} from "@/lib/spda-norma";
import { AlertTriangle, CheckCircle2, Ruler, Shield, Zap } from "lucide-react";

function toNP(value?: string): NivelProtecao {
  return NIVEIS.includes(value as NivelProtecao) ? (value as NivelProtecao) : "II";
}

export default function SpdaDimensionamento({ npRecomendado = "II" }: { npRecomendado?: string }) {
  const [np, setNp] = useState<NivelProtecao>(toNP(npRecomendado));
  const [comprimento, setComprimento] = useState("30");
  const [largura, setLargura] = useState("18");
  const [alturaReferencia, setAlturaReferencia] = useState("8");
  const [comprimentoL, setComprimentoL] = useState("8");
  const [meio, setMeio] = useState<"ar" | "solido">("ar");
  const [temAnel, setTemAnel] = useState(false);

  const L = Number.parseFloat(comprimento) || 0;
  const W = Number.parseFloat(largura) || 0;
  const H = Number.parseFloat(alturaReferencia) || 0;
  const l = Number.parseFloat(comprimentoL) || H || 0;
  const cfg = NP_CONFIG[np];
  const perimetro = 2 * (L + W);
  const nDescidas = numeroMinimoDescidas(np, L, W);
  const angulo = anguloProtecao(np, H);
  const raioAngulo = raioProtecaoAngulo(np, H);
  const raioEsfera = raioProtecaoEsferaRolante(np, H);

  const ki = { I: 0.08, II: 0.06, III: 0.04, IV: 0.04 }[np];
  const km = meio === "ar" ? 1 : 0.5;
  const kc = nDescidas <= 1 ? 1 : temAnel ? 0.66 / (2 * nDescidas) : 1 / (2 * nDescidas);
  const distanciaSeguranca = ki * (kc / km) * l;

  const resumo = useMemo(() => [
    { label: "Raio da esfera rolante", value: `${cfg.raioEsferaM} m`, sub: "Tabela 2" },
    { label: "Módulo máximo da malha", value: `${cfg.malhaM[0]} × ${cfg.malhaM[1]} m`, sub: "Tabela 2" },
    { label: "Espaçamento entre descidas", value: `${cfg.distanciaDescidaM} m`, sub: "Tabela 5" },
    { label: "Ângulo de proteção", value: angulo.aplicavel && angulo.anguloGraus !== null ? `${angulo.anguloGraus.toFixed(1)}°` : "Não aplicável", sub: "Figura 1" },
  ], [cfg, angulo]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Dimensionamento normativo do SPDA
          </CardTitle>
          <CardDescription>
            Parâmetros de captação, descidas e distância de segurança conforme ABNT NBR 5419-3:2026.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>Nível de Proteção do SPDA</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {NIVEIS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNp(n)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    np === n ? "text-white border-transparent" : "border-border text-foreground-muted hover:border-border-secondary"
                  }`}
                  style={np === n ? { background: NP_CONFIG[n].cor } : undefined}
                >
                  NP {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {resumo.map((item) => (
              <div key={item.label} className="p-3 rounded-xl border border-border bg-background-secondary">
                <div className="text-xs text-foreground-muted">{item.label}</div>
                <div className="text-lg font-bold mt-1" style={{ color: cfg.cor }}>{item.value}</div>
                <div className="text-[10px] text-foreground-muted">{item.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Comprimento da estrutura</Label>
              <NumericInput value={comprimento} onChange={setComprimento} unidade="m" placeholder="ex: 30" />
            </div>
            <div>
              <Label>Largura da estrutura</Label>
              <NumericInput value={largura} onChange={setLargura} unidade="m" placeholder="ex: 18" />
            </div>
            <div>
              <Label>H até a ponta do captor</Label>
              <NumericInput value={alturaReferencia} onChange={setAlturaReferencia} unidade="m" placeholder="ex: 8" />
              <p className="text-[10px] text-foreground-muted mt-1">Altura do plano de referência até a ponta do captor.</p>
            </div>
            <div>
              <Label>Comprimento l para s</Label>
              <NumericInput value={comprimentoL} onChange={setComprimentoL} unidade="m" placeholder="ex: 8" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-background-secondary p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <Ruler className="w-4 h-4 text-primary" /> Descidas
              </div>
              <div className="text-sm text-foreground-muted">Perímetro calculado</div>
              <div className="text-2xl font-bold text-primary">{perimetro.toFixed(2)} m</div>
              <div className="text-sm text-foreground-muted mt-2">Número mínimo de condutores</div>
              <div className="text-2xl font-bold text-primary">{nDescidas}</div>
              <p className="text-[11px] text-foreground-muted mt-2">
                Mínimo de dois condutores e distribuição preferencialmente uniforme no perímetro.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background-secondary p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <Zap className="w-4 h-4 text-primary" /> Distância de segurança
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={meio === "ar"} onChange={() => setMeio("ar")} className="accent-primary" /> Ar
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={meio === "solido"} onChange={() => setMeio("solido")} className="accent-primary" /> Sólido
                </label>
                <label className="col-span-2 flex items-center gap-2 mt-1">
                  <input type="checkbox" checked={temAnel} onChange={(e) => setTemAnel(e.target.checked)} className="accent-primary" /> considerar anel intermediário
                </label>
              </div>
              <div className="text-sm text-foreground-muted mt-3">s = ki × (kc / km) × l</div>
              <div className="text-2xl font-bold text-primary">{distanciaSeguranca.toFixed(3)} m</div>
              <div className="text-[11px] text-foreground-muted mt-2">ki={ki}; kc={kc.toFixed(4)}; km={km}; l={l.toFixed(2)} m</div>
            </div>

            <div className="rounded-xl border border-border bg-background-secondary p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                {angulo.aplicavel ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                Método do ângulo
              </div>
              {angulo.aplicavel && angulo.anguloGraus !== null ? (
                <>
                  <div className="text-sm text-foreground-muted">Raio pelo ângulo de proteção</div>
                  <div className="text-2xl font-bold text-primary">{raioAngulo?.toFixed(2)} m</div>
                  <div className="text-sm text-foreground-muted mt-2">Raio auxiliar pela esfera rolante para H</div>
                  <div className="text-xl font-bold text-primary">{raioEsfera !== null ? `${raioEsfera.toFixed(2)} m` : "H > R"}</div>
                </>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-300">{angulo.motivo}</p>
              )}
              <Badge variant="outline" className="mt-3">Figura 1 e Tabela 2</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <GraficosProtecao np={np} alturaCaptor={H || 2} />
    </div>
  );
}
