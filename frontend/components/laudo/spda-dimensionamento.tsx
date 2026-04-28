"use client";
import GraficosProtecao from "@/components/laudo/graficos-protecao";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label, Badge } from "@/components/ui";
import { Ruler, Zap, Shield, ChevronDown, ChevronUp, Info } from "lucide-react";
import NumericInput from "@/components/ui/numeric-input";

// NBR 5419-3:2026 - Tabela 2 e 5 (source: norma, não internet)
const NP_CONFIG = {
  "I":   { esfera: 20, malha: "5×5",   distDesc: 10, angBoer: 25, cor: "text-red-500" },
  "II":  { esfera: 30, malha: "10×10", distDesc: 15, angBoer: 35, cor: "text-orange-500" },
  "III": { esfera: 45, malha: "15×15", distDesc: 20, angBoer: 45, cor: "text-yellow-500" },
  "IV":  { esfera: 60, malha: "20×20", distDesc: 25, angBoer: 55, cor: "text-green-500" },
} as const;

type NP = keyof typeof NP_CONFIG;

// Comparativo de sistemas - valores de mercado aproximados (não normativos)
const SISTEMAS_PDA = [
  {
    nome: "Franklin (Para-raios de haste)",
    descricao: "Para-raios tipo Franklin com haste elevada. Projeto e mão-de-obra especializada encarecem o sistema.",
    vantagens: ["Proteção pontual eficaz", "Boa para estruturas pontuais e torres", "Norma consolidada"],
    desvantagens: ["Custo mais alto por mastro e base reforçada", "Ângulo de proteção limitado por altura"],
    custo_ref: "R$ 18.000 – R$ 80.000",
    indicado: "Torres de telecomunicação, chaminés, edifícios altos",
    norma: "NBR 5419-3:2026, §5.2.3, Tabela A.1",
  },
  {
    nome: "Esfera Rolante",
    descricao: "Método geométrico para estruturas complexas. Custo intermediário entre Franklin e Faraday.",
    vantagens: ["Mais preciso para formas irregulares", "Menor número de captores que Faraday"],
    desvantagens: ["Requer projeto técnico detalhado", "Mais complexo de executar"],
    custo_ref: "R$ 8.000 – R$ 45.000",
    indicado: "Estruturas complexas, saliências, NP I e II",
    norma: "NBR 5419-3:2026, §5.2.2, Tabela 2",
  },
  {
    nome: "Gaiola de Faraday",
    descricao: "Malha de condutores sobre a cobertura. Solução mais econômica por usar condutores de cobre simples.",
    vantagens: ["Menor custo por m²", "Alta confiabilidade", "Manutenção simples", "Normativo NBR 5419-3"],
    desvantagens: ["Visualmente intrusivo", "Maior quantidade de material"],
    custo_ref: "R$ 3.500 – R$ 18.000",
    indicado: "Galpões industriais, residências, edificações simples",
    norma: "NBR 5419-3:2026, §5.2",
  },
];

export default function SpdaDimensionamento({ npRecomendado = "II" }: { npRecomendado?: string }) {
  const [np, setNp] = useState<NP>((npRecomendado as NP) in NP_CONFIG ? (npRecomendado as NP) : "II");
  const [perimetro, setPerimetro] = useState("");
  const [altura, setAltura] = useState("");
  const [resistencia, setResistencia] = useState("");
  const [continuidade, setContinuidade] = useState("");
  const [showMedicoes, setShowMedicoes] = useState(false);
  const [showComparativo, setShowComparativo] = useState(false);

  const cfg = NP_CONFIG[np as keyof typeof NP_CONFIG];
  const per = parseFloat(perimetro) || 0;
  const alt = parseFloat(altura) || 0;

  const nDescidas = per > 0 ? Math.max(2, Math.ceil(per / cfg.distDesc)) : null;
  // Distância de segurança simplificada — NBR 5419-3:2026, Equação (5): s = ki × (kc/km) × l
  const KI: Record<string, number> = { "I": 0.08, "II": 0.06, "III": 0.04, "IV": 0.02 };
  const dseg = alt > 0 && nDescidas
    ? parseFloat((KI[np] * (1 / (2 * nDescidas) / 1.0) * alt).toFixed(3))
    : null;

  return (
    <div className="space-y-4">
      {/* NP Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Dimensionamento SPDA
          </CardTitle>
          <CardDescription>NBR 5419-3:2026 — Parâmetros por Nível de Proteção</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nível de Proteção (NP) recomendado pela análise de risco</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {(Object.keys(NP_CONFIG) as NP[]).map(n => (
                <button key={n} type="button" onClick={() => setNp(n)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    np === n ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground-muted hover:border-border-secondary"
                  }`}>
                  NP {n}
                </button>
              ))}
            </div>
          </div>

          {/* Parâmetros normativos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Raio esfera rolante", value: `${cfg.esfera} m`, sub: "Tabela 2" },
              { label: "Malha captação", value: `${cfg.malha} m`, sub: "Tabela 2" },
              { label: "Dist. entre descidas", value: `${cfg.distDesc} m`, sub: "Tabela 5" },
              { label: "Ângulo de Boer", value: `${cfg.angBoer}°`, sub: "Tabela A.1" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="p-3 rounded-lg border border-border bg-background-secondary">
                <div className="text-xs text-foreground-muted">{label}</div>
                <div className="text-lg font-bold text-primary mt-1">{value}</div>
                <div className="text-[10px] text-foreground-muted">{sub}</div>
              </div>
            ))}
          </div>

          {/* Cálculo com perímetro */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Perímetro da estrutura (m)</Label>
              <NumericInput value={perimetro} onChange={setPerimetro} unidade="m" placeholder="ex: 120" />
              <p className="text-[10px] text-foreground-muted mt-1">Para planta retangular: P = 2×(L+W)</p>
            </div>
            <div>
              <Label>Altura da estrutura (m)</Label>
              <NumericInput value={altura} onChange={setAltura} unidade="m" placeholder="ex: 15" />
            </div>
          </div>

          {(nDescidas !== null || dseg !== null) && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
              <div className="text-sm font-medium text-primary">Resultado do dimensionamento</div>
              {nDescidas !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Ruler className="w-4 h-4 text-primary" />
                  <span>Número mínimo de descidas: <strong>{nDescidas} condutores</strong></span>
                </div>
              )}
              {dseg !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-primary" />
                  <span>Distância de segurança simplificada: <strong>{dseg} m</strong></span>
                </div>
              )}
              <p className="text-[10px] text-foreground-muted">
                * NBR 5419-3:2026 §5.4.3.1 e Equação (5). Para estruturas acima de 60 m, verificar proteção lateral (§5.3.2.14.2).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráficos de proteção */}
      <GraficosProtecao np={np} alturaCaptor={parseFloat(altura) || 5} />

      {/* Medições (opcional) */}
      <Card>
        <CardHeader>
          <button className="flex items-center justify-between w-full" type="button" onClick={() => setShowMedicoes(!showMedicoes)}>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4 text-primary" /> Medições de campo (opcional)
            </CardTitle>
            {showMedicoes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <CardDescription>
            Conforme NBR 5419-3:2026 §7.1.4 — medição de resistência de aterramento NÃO é requisito para eficácia do SPDA, porém pode ser registrada para documentação.
          </CardDescription>
        </CardHeader>
        {showMedicoes && (
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>NBR 5419-3:2026, §7.1.4: <em>"A medição da resistência de aterramento não é um requisito para verificar a eficácia de um SPDA."</em> Os campos abaixo são opcionais e apenas documentais.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Resistência de aterramento medida (Ω)</Label>
                <NumericInput value={resistencia} onChange={setResistencia} unidade="Ω" placeholder="ex: 4,5" />
                <p className="text-[10px] text-foreground-muted mt-1">Método: queda de potencial (NBR 15749)</p>
              </div>
              <div>
                <Label>Continuidade elétrica (Ω)</Label>
                <NumericInput value={continuidade} onChange={setContinuidade} unidade="Ω" placeholder="ex: 0,05" />
                <p className="text-[10px] text-foreground-muted mt-1">Entre pontos do SPDA (valores abaixo de 1 Ω são aceitáveis)</p>
              </div>
            </div>

            {/* Eletrodo de aterramento */}
            <div className="pt-2 border-t border-border">
              <div className="text-xs font-medium text-foreground-muted mb-2">Eletrodo de aterramento — §5.4.4</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Resistividade do solo ρ (Ω·m)</Label>
                  <NumericInput value={""} onChange={() => {}} unidade="Ω·m" placeholder="ex: 100" />
                  <p className="text-[10px] text-foreground-muted mt-1">
                    Comprimento mín. eletrodo tipo A: calculado via Tabela 8
                  </p>
                </div>
                <div className="flex items-end">
                  <div className="p-2 rounded border border-border bg-background-secondary text-xs w-full">
                    <div className="text-foreground-muted">Comprimento mín. l₁ (Tabela 8)</div>
                    <div className="font-bold text-primary mt-1">Use endpoint POST /spda/eletrodo-tipo-a</div>
                    <div className="text-[10px] text-foreground-muted">NBR 5419-3:2026 §5.4.4.1</div>
                  </div>
                </div>
              </div>
            </div>

            {resistencia && (
              <div className={`p-3 rounded-lg border text-sm ${
                parseFloat(resistencia) <= 10
                  ? "bg-green-50 border-green-200 text-green-800"
                  : parseFloat(resistencia) <= 25
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}>
                Resistência: <strong>{resistencia} Ω</strong> —{" "}
                {parseFloat(resistencia) <= 10 ? "✓ Adequada para a maioria das aplicações" :
                 parseFloat(resistencia) <= 25 ? "⚠ Aceitável — avaliar melhorias" :
                 "✗ Elevada — recomendado tratamento do solo ou eletrodos adicionais"}
                <span className="block text-[10px] mt-1 opacity-70">Referência informativa: IEEE Std 142 / ABNT NBR 15749. Não há valor normativo obrigatório na NBR 5419-3:2026.</span>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Comparativo de sistemas */}
      <Card>
        <CardHeader>
          <button className="flex items-center justify-between w-full" type="button" onClick={() => setShowComparativo(!showComparativo)}>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4 text-primary" /> Comparativo de sistemas PDA
            </CardTitle>
            {showComparativo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <CardDescription>Gaiola de Faraday × Franklin × Esfera Rolante — indicação técnica e referência de mercado</CardDescription>
        </CardHeader>
        {showComparativo && (
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {SISTEMAS_PDA.map((s) => (
                <div key={s.nome} className="p-4 rounded-lg border border-border space-y-3">
                  <div className="font-semibold text-sm">{s.nome}</div>
                  <p className="text-xs text-foreground-muted">{s.descricao}</p>

                  <div>
                    <div className="text-[10px] font-medium text-green-600 mb-1">✓ Vantagens</div>
                    {s.vantagens.map(v => <div key={v} className="text-xs text-foreground-muted">• {v}</div>)}
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-red-500 mb-1">✗ Limitações</div>
                    {s.desvantagens.map(v => <div key={v} className="text-xs text-foreground-muted">• {v}</div>)}
                  </div>
                  <div className="p-2 rounded bg-background-secondary">
                    <div className="text-[10px] text-foreground-muted">Referência de custo (mercado BR)</div>
                    <div className="text-sm font-semibold text-primary">{s.custo_ref}</div>
                    <div className="text-[10px] text-foreground-muted mt-1">{s.indicado}</div>
                  </div>
                  <div className="text-[10px] text-foreground-muted border-t border-border pt-2">{s.norma}</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-foreground-muted mt-3">
              * Os três métodos são reconhecidos pela NBR 5419-3:2026 (§5.2). A escolha deve considerar geometria da estrutura, nível de proteção exigido e custo-benefício. Custos são referências de mercado 2025 e podem variar por região.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}