"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import {
  CURVAS_ANGULO_FIGURA_1,
  NIVEIS,
  NP_CONFIG,
  NivelProtecao,
  anguloProtecao,
  raioProtecaoAngulo,
  raioProtecaoEsferaRolante,
} from "@/lib/spda-norma";

type Props = {
  np?: string;
  alturaCaptor?: number;
  alturaEstrutura?: number;
  comprimento?: number;
  largura?: number;
};

function toNP(value?: string): NivelProtecao {
  return NIVEIS.includes(value as NivelProtecao) ? (value as NivelProtecao) : "III";
}

export default function GraficosProtecao({
  np = "III",
  alturaCaptor = 5,
  alturaEstrutura = 0,
  comprimento = 0,
  largura = 0,
}: Props) {
  const nivel = toNP(np);
  const H = Math.max(0, alturaCaptor || 0);
  const resAng = anguloProtecao(nivel, H);
  const raioAngulo = raioProtecaoAngulo(nivel, H);
  const raioEsfera = raioProtecaoEsferaRolante(nivel, H);
  const cfg = NP_CONFIG[nivel];
  const hEstrutura = Math.max(0, alturaEstrutura || 0);
  const cEstrutura = Math.max(0, comprimento || 0);
  const lEstrutura = Math.max(0, largura || 0);
  const perimetro = cEstrutura > 0 && lEstrutura > 0 ? 2 * (cEstrutura + lEstrutura) : 0;
  const descidasMinimas = perimetro > 0 ? Math.max(2, Math.ceil(perimetro / cfg.distanciaDescidaM)) : 0;

  const w = 760;
  const h = 300;
  const pad = 42;
  const hMax = 60;
  const aMax = 80;
  const x = (hm: number) => pad + (hm / hMax) * (w - pad * 2);
  const y = (ang: number) => h - pad - (ang / aMax) * (h - pad * 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Curva normativa do método do ângulo de proteção</CardTitle>
        <CardDescription>
          Figura 1 da ABNT NBR 5419-3:2026: curva gráfica digitalizada e interpolada por nível de proteção e altura H. H é medido do plano de referência até a ponta do captor; abaixo de 2 m o ângulo permanece constante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="rounded-xl border border-border bg-background-secondary p-3">
            <div className="text-xs text-foreground-muted">NP selecionado</div>
            <div className="text-2xl font-bold" style={{ color: cfg.cor }}>NP {nivel}</div>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-3">
            <div className="text-xs text-foreground-muted">H até a ponta do captor</div>
            <div className="text-2xl font-bold text-primary">{H.toFixed(2)} m</div>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-3">
            <div className="text-xs text-foreground-muted">Edificação</div>
            <div className="text-2xl font-bold text-primary">{hEstrutura.toFixed(2)} m</div>
            <div className="text-[11px] text-foreground-muted">{cEstrutura.toFixed(1)} × {lEstrutura.toFixed(1)} m</div>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-3">
            <div className="text-xs text-foreground-muted">Ângulo α</div>
            <div className="text-2xl font-bold text-primary">
              {resAng.aplicavel && resAng.anguloGraus !== null ? `${resAng.anguloGraus.toFixed(1)}°` : "N/A"}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-3">
            <div className="text-xs text-foreground-muted">Raio no plano de referência</div>
            <div className="text-2xl font-bold text-primary">
              {raioAngulo !== null ? `${raioAngulo.toFixed(2)} m` : "N/A"}
            </div>
          </div>
        </div>

        {!resAng.aplicavel && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30">
            {resAng.motivo} O sistema mantém os valores de esfera rolante e malha para dimensionamento.
          </div>
        )}

        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-foreground-muted">
          Verificação aplicada: a Tabela 2 remete o ângulo α à Figura 1; acima do fim da curva de cada NP o método do ângulo é bloqueado; e a altura H considerada é a distância do plano de referência até a ponta do captor. Como a norma fornece o ângulo em gráfico, os valores do sistema são pontos digitalizados com interpolação linear.
        </div>

        <div className="rounded-xl border border-border bg-background-secondary p-3 overflow-x-auto">
          <svg width={w} height={h} role="img" aria-label="Curva de ângulo de proteção por nível de proteção">
            <rect x={0} y={0} width={w} height={h} rx={14} fill="transparent" />
            {Array.from({ length: 7 }).map((_, i) => {
              const hv = i * 10;
              return (
                <g key={`gx-${hv}`}>
                  <line x1={x(hv)} x2={x(hv)} y1={pad} y2={h - pad} stroke="currentColor" opacity="0.12" />
                  <text x={x(hv)} y={h - 16} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">{hv}</text>
                </g>
              );
            })}
            {Array.from({ length: 9 }).map((_, i) => {
              const av = i * 10;
              return (
                <g key={`gy-${av}`}>
                  <line x1={pad} x2={w - pad} y1={y(av)} y2={y(av)} stroke="currentColor" opacity="0.12" />
                  <text x={18} y={y(av) + 3} fontSize="10" fill="currentColor" opacity="0.7">{av}</text>
                </g>
              );
            })}
            <text x={w / 2} y={h - 2} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">H (m)</text>
            <text x={5} y={18} fontSize="11" fill="currentColor" opacity="0.7">α°</text>

            {NIVEIS.map((n) => {
              const pontos = CURVAS_ANGULO_FIGURA_1[n].map(([hm, ang]) => `${x(hm)},${y(ang)}`).join(" ");
              const last = CURVAS_ANGULO_FIGURA_1[n][CURVAS_ANGULO_FIGURA_1[n].length - 1];
              return (
                <g key={n}>
                  <polyline points={pontos} fill="none" stroke={NP_CONFIG[n].cor} strokeWidth={n === nivel ? 3 : 1.8} />
                  {CURVAS_ANGULO_FIGURA_1[n].map(([hm, ang]) => (
                    <circle key={`${n}-${hm}`} cx={x(hm)} cy={y(ang)} r={n === nivel ? 4 : 3} fill={NP_CONFIG[n].cor} />
                  ))}
                  <text x={x(last[0]) + 8} y={y(last[1]) + 4} fontSize="11" fontWeight="700" fill={NP_CONFIG[n].cor}>NP {n}</text>
                </g>
              );
            })}

            {resAng.aplicavel && resAng.anguloGraus !== null && (
              <g>
                <line x1={x(H)} x2={x(H)} y1={pad} y2={h - pad} stroke={cfg.cor} strokeDasharray="5 4" opacity="0.7" />
                <circle cx={x(H)} cy={y(resAng.anguloGraus)} r={6} fill={cfg.cor} stroke="#fff" strokeWidth={2} />
              </g>
            )}
          </svg>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border border-border bg-background-secondary p-3">
            <div className="font-semibold text-foreground">Tabela 2</div>
            <div className="text-foreground-muted">Raio da esfera rolante: <b>{cfg.raioEsferaM} m</b></div>
            <div className="text-foreground-muted">Módulo máximo da malha: <b>{cfg.malhaM[0]} × {cfg.malhaM[1]} m</b></div>
            <div className="text-foreground-muted">Espaçamento descidas: <b>{cfg.distanciaDescidaM} m</b></div>
            {descidasMinimas > 0 && (
              <div className="text-foreground-muted">Descidas mínimas estimadas: <b>{descidasMinimas}</b></div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-3">
            <div className="font-semibold text-foreground">Esfera rolante</div>
            <div className="text-foreground-muted">Raio projetado para H: <b>{raioEsfera !== null ? `${raioEsfera.toFixed(2)} m` : "H maior que R"}</b></div>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary p-3">
            <div className="font-semibold text-foreground">Limite do método do ângulo</div>
            <div className="text-foreground-muted">NP {nivel}: até <b>{cfg.hMaxAnguloM} m</b>. Acima disso, usar esfera rolante ou malhas.</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
