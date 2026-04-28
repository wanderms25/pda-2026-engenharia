"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Legend, Cell,
} from "recharts";

interface ComponenteRisco {
  RA: number; RB: number; RC: number; RM: number;
  RU: number; RV: number; RW: number; RZ: number;
}

interface GraficosAnaliseProps {
  R1: number;
  R3: number;
  componentes: ComponenteRisco;
  RT_R1?: number;
  RT_R3?: number;
}

const RT_R1 = 1e-5;
const RT_R3 = 1e-4;

function fmtCientifico(v: number): string {
  if (v === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const coef = (v / Math.pow(10, exp)).toFixed(2);
  return `${coef}×10^${exp}`;
}

function fmtShort(v: number): string {
  if (v === 0) return "0";
  return v.toExponential(1);
}

const CORES_COMPONENTES: Record<string, string> = {
  RA: "#6366f1", RB: "#f97316", RC: "#eab308",
  RM: "#22c55e", RU: "#06b6d4", RV: "#ec4899",
  RW: "#8b5cf6", RZ: "#f43f5e",
};

const DESC_COMPONENTES: Record<string, string> = {
  RA: "RA – Choque S1", RB: "RB – Dano físico S1",
  RC: "RC – Falha sistema S1", RM: "RM – Falha sistema S2",
  RU: "RU – Choque S3",  RV: "RV – Dano físico S3",
  RW: "RW – Falha sistema S3", RZ: "RZ – Falha sistema S4",
};

export default function GraficosAnalise({ R1, R3, componentes }: GraficosAnaliseProps) {
  // Bar chart data - componentes de risco
  const dadosBarras = Object.entries(componentes)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([key, val]) => ({
      nome: key,
      valor: val,
      descricao: DESC_COMPONENTES[key] || key,
      fill: CORES_COMPONENTES[key] || "#6366f1",
    }));

  // Gauge data for R1 vs RT
  const r1Pct = Math.min((R1 / RT_R1) * 100, 200);
  const r3Pct = Math.min((R3 / RT_R3) * 100, 200);

  const dadosGauge = [
    { subject: "R1", valor: R1, toleravel: RT_R1, pct: r1Pct, conforme: R1 <= RT_R1 },
    { subject: "R3", valor: R3, toleravel: RT_R3, pct: r3Pct, conforme: R3 <= RT_R3 },
  ];

  const radarData = Object.entries(componentes).map(([key, val]) => ({
    subject: key,
    valor: R1 > 0 ? (val / R1) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Resultado consolidado R1/R3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dadosGauge.map(({ subject, valor, toleravel, pct, conforme }) => (
          <div key={subject} className="p-4 rounded-lg border border-border bg-background-secondary space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{subject === "R1" ? "R1 — Risco de vida" : "R3 — Patrimônio cultural"}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                conforme ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>{conforme ? "CONFORME" : "NÃO CONFORME"}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-foreground-muted">
                <span>0</span><span>RT = {fmtCientifico(toleravel)}</span>
              </div>
              <div className="h-3 rounded-full bg-background-primary overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: conforme
                      ? "linear-gradient(90deg,#22c55e,#16a34a)"
                      : "linear-gradient(90deg,#f97316,#ef4444)"
                  }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-foreground-muted">Calculado: <strong className="text-foreground">{fmtCientifico(valor)}</strong></span>
                <span className="text-foreground-muted">{pct.toFixed(0)}% do limite</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart - componentes */}
      {dadosBarras.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Componentes de risco (R1)</div>
          <div className="text-xs text-foreground-muted">NBR 5419-2:2026, Tabela 6 — R1 = RA+RB+RC+RM+RU+RV+RW+RZ</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dadosBarras} layout="vertical" margin={{ left: 80, right: 40, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,140,0.15)" />
              <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="nome" width={30} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip
                formatter={(v: number, name: string, props: any) => [fmtCientifico(v), props.payload?.descricao || name]}
                contentStyle={{ fontSize: 11, background: "#1e2130", border: "1px solid #334155", borderRadius: 6 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <ReferenceLine x={RT_R1} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "RT", fontSize: 9, fill: "#ef4444" }} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {dadosBarras.map((entry) => (
                  <Cell key={entry.nome} fill={entry.fill} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Radar - distribuição dos componentes */}
      {radarData.some(d => d.valor > 0) && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Distribuição percentual dos componentes</div>
          <div className="text-xs text-foreground-muted">% da contribuição de cada fonte para o R1 total</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(120,120,140,0.2)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }}
                tickFormatter={v => `${v}%`} />
              <Radar name="% R1" dataKey="valor" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "% do R1"]}
                contentStyle={{ fontSize: 11, background: "#1e2130", border: "1px solid #334155", borderRadius: 6 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
