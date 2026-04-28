"use client";
import { useMemo } from "react";

interface GraficosProtecaoProps {
  np: string;
  alturaCaptor: number;     // h₁ — altura do mastro acima da estrutura
  alturaEstrutura?: number; // H  — altura da edificação (plano de referência)
  comprimento?: number;     // L  — comprimento da edificação
  largura?: number;         // W  — largura da edificação
}

// NBR 5419-3:2026 Tabela A.1 — Ângulo de proteção α(h, NP)
const ANGULOS_TABELA: Record<string, Array<[number, number]>> = {
  "I":   [[2,25],[5,25],[10,20],[20,15],[30,10],[45,10],[60,10]],
  "II":  [[2,35],[5,30],[10,25],[20,20],[30,15],[45,10],[60,10]],
  "III": [[2,45],[5,40],[10,35],[20,30],[30,25],[45,20],[60,15]],
  "IV":  [[2,55],[5,50],[10,45],[20,40],[30,35],[45,30],[60,25]],
};

const RAIO_ESFERA: Record<string, number> = {"I":20,"II":30,"III":45,"IV":60};
const COR_NP: Record<string, string> = {
  "I":"#ef4444","II":"#f97316","III":"#eab308","IV":"#22c55e"
};
const ALL_NP = ["I","II","III","IV"];

function interpolar(tab: Array<[number,number]>, h: number): number {
  if (h <= tab[0][0]) return tab[0][1];
  const last = tab[tab.length-1];
  if (h >= last[0]) return last[1];
  for (let i=0; i<tab.length-1; i++) {
    const [h1,a1]=tab[i],[h2,a2]=tab[i+1];
    if (h>=h1 && h<=h2) return a1 + (h-h1)/(h2-h1)*(a2-a1);
  }
  return tab[0][1];
}

export default function GraficosProtecao({
  np, alturaCaptor, alturaEstrutura=0, comprimento=0, largura=0
}: GraficosProtecaoProps) {
  const tabela = ANGULOS_TABELA[np] || ANGULOS_TABELA["III"];
  const R = RAIO_ESFERA[np] || 45;
  const cor = COR_NP[np] || "#eab308";

  // h₁ = altura do captor (mastro acima da estrutura)
  const h1 = Math.max(0.5, Math.min(alturaCaptor, 60));
  // H  = altura da edificação
  const H  = Math.max(0, alturaEstrutura);
  // h₂ = altura total = H + h₁ (captor em relação ao solo/referência inferior)
  const h2 = H + h1;

  // Ângulos pela Tabela A.1
  const alpha1 = interpolar(tabela, h1);          // α₁ — ao plano do topo da estrutura
  const alpha2 = interpolar(tabela, h2);          // α₂ — ao solo (plano inferior)
  const a1r = alpha1 * Math.PI / 180;
  const a2r = alpha2 * Math.PI / 180;

  // Raios de proteção (ângulo de Boer)
  const r1 = h1 * Math.tan(a1r);                 // raio ao nível do topo da estrutura
  const r2 = h2 * Math.tan(a2r);                 // raio ao nível do solo

  // Raio esfera rolante
  const rEsfera1 = Math.sqrt(Math.max(0, R*R - (R-h1)*(R-h1)));
  const rEsfera2 = Math.sqrt(Math.max(0, R*R - (R-h2)*(R-h2)));

  // Verificação se a estrutura está protegida
  const semidiag = comprimento > 0 && largura > 0
    ? Math.sqrt((comprimento/2)**2 + (largura/2)**2)
    : 0;
  const estruturaProtegida = semidiag > 0 ? r1 >= semidiag : null;

  // ── DIAGRAMA 1: Curva α × h (Tabela A.1) — todas as NP ──────────────────
  const W1=520, H1=290;
  const PAD={top:35, right:90, bottom:50, left:55};
  const pw=W1-PAD.left-PAD.right, ph=H1-PAD.top-PAD.bottom;
  const hMax=60, angMax=70;
  const tx=(hv:number)=>PAD.left+(hv/hMax)*pw;
  const ty=(av:number)=>PAD.top+(1-av/angMax)*ph;

  const curves = useMemo(()=> ALL_NP.map(n=>{
    const pts:string[]=[];
    for(let hv=2; hv<=hMax; hv+=0.5){
      const av=interpolar(ANGULOS_TABELA[n]||ANGULOS_TABELA["III"],hv);
      pts.push(`${hv===2?"M":"L"}${tx(hv).toFixed(1)},${ty(av).toFixed(1)}`);
    }
    return {np:n,path:pts.join(" "),cor:COR_NP[n]};
  }), []);

  // Marcador do ponto atual (h1, alpha1)
  const dotX1 = tx(h1), dotY1 = ty(alpha1);
  // Se h2 > h1, também marca h2
  const dotX2 = tx(Math.min(h2,hMax)), dotY2 = ty(alpha2);

  // ── DIAGRAMA 2: Vista lateral — Cone de proteção ────────────────────────
  const W2=340, H2=300;
  const cx2=W2/2, base2=H2-40, topCaptor=40;
  const hPx=(base2-topCaptor);
  const scale=hPx/Math.max(h2,h1,1);
  // h1 em px acima do topo da estrutura
  const h1Px=h1*scale;
  const hPx2=H>0?H*scale:0;
  const captorAbsY=base2-hPx2-h1Px;
  const topoEstrY=base2-hPx2;
  const r1Px=h1Px*Math.tan(a1r);
  const r2Px=(H>0?h2:h1)*scale*Math.tan(H>0?a2r:a1r);

  // ── DIAGRAMA 3: Captor sobre estrutura α₁⇒h₁ e α₂⇒h₂ ───────────────────
  const W3=340, H3=300;
  const cx3=W3/2, ground3=H3-35;
  const scale3=H>0?(H3-80)/(h2+h1*0.5):(H3-80)/Math.max(h1*2,4);
  const h1Px3=h1*scale3;
  const hPx3=H*scale3;
  const captorY3=ground3-hPx3-h1Px3;
  const topoY3=ground3-hPx3;
  const rCone1Px=h1Px3*Math.tan(a1r);
  const rCone2Px=h2*scale3*Math.tan(a2r);

  const perimetro = comprimento>0&&largura>0 ? 2*(comprimento+largura) : 0;

  const tbl = [
    {label:"h₁ — Altura do captor", val:`${h1.toFixed(1)} m`},
    {label:"H — Altura da estrutura", val:`${H.toFixed(1)} m`},
    {label:"h₂ = H + h₁ (ref. solo)", val:`${h2.toFixed(1)} m`},
    {label:`α₁ — Ângulo NP ${np} (h₁)`, val:`${alpha1.toFixed(1)}°`},
    ...(H>0?[{label:`α₂ — Ângulo NP ${np} (h₂)`, val:`${alpha2.toFixed(1)}°`}]:[]),
    {label:"r₁ — Raio (topo estrutura)", val:`${r1.toFixed(2)} m`},
    ...(H>0?[{label:"r₂ — Raio (solo)", val:`${r2.toFixed(2)} m`}]:[]),
    {label:`R esfera rolante (NP ${np})`, val:`${R} m`},
    {label:"r₁ esfera rolante", val:`${rEsfera1.toFixed(2)} m`},
    ...(perimetro>0?[
      {label:"L × W (planta)", val:`${comprimento}×${largura} m`},
      {label:"Perímetro da estrutura", val:`${perimetro.toFixed(1)} m`},
      {label:"Semidiagonal", val:`${semidiag.toFixed(2)} m`},
      {label:"Cobertura pelo ângulo", val:estruturaProtegida?"✓ Protegida":"✗ Insuficiente",
        cor:estruturaProtegida?"#16a34a":"#dc2626"},
    ]:[]),
  ];

  const fmtLine=(pts:[number,number][])=>pts.map(([x,y],i)=>`${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <div className="space-y-5">

      {/* Tabela de resultados */}
      <div className="p-4 rounded-lg border border-border bg-background-secondary">
        <div className="text-xs font-semibold text-foreground-muted mb-2">Resumo do cálculo — NBR 5419-3:2026 Tabela A.1</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
          {tbl.map(({label,val,cor:c})=>(
            <div key={label} className="flex justify-between gap-2 text-xs border-b border-border/40 py-1">
              <span className="text-foreground-muted">{label}:</span>
              <span className="font-mono font-semibold" style={{color:c||"var(--color-primary)"}}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Diagrama 1: α × h */}
      <div>
        <div className="text-xs font-semibold text-foreground-muted mb-2 text-center">
          Gráfico 1 — Ângulo de proteção α × Altura h do captor (NBR 5419-3 Tabela A.1)
        </div>
        <div className="overflow-x-auto">
          <svg width={W1} height={H1} style={{display:"block",margin:"0 auto",background:"var(--color-background)"}}>
            {/* Grid */}
            {[0,10,20,30,40,50,60].map(hv=>(
              <g key={`vg${hv}`}>
                <line x1={tx(hv)} y1={PAD.top} x2={tx(hv)} y2={PAD.top+ph} stroke="#334155" strokeWidth={0.5} strokeDasharray="3,3"/>
                <text x={tx(hv)} y={PAD.top+ph+16} textAnchor="middle" fontSize={9} fill="#64748b">{hv}</text>
              </g>
            ))}
            {[0,10,20,30,40,50,60,70].map(av=>(
              <g key={`hg${av}`}>
                <line x1={PAD.left} y1={ty(av)} x2={PAD.left+pw} y2={ty(av)} stroke="#334155" strokeWidth={0.5} strokeDasharray="3,3"/>
                <text x={PAD.left-6} y={ty(av)+3} textAnchor="end" fontSize={9} fill="#64748b">{av}°</text>
              </g>
            ))}
            {/* Curvas */}
            {curves.map(({np:n,path,cor:c})=>(
              <g key={n}>
                <path d={path} fill="none" stroke={c} strokeWidth={2} strokeLinecap="round"/>
                <text x={tx(hMax)+5} y={ty(interpolar(ANGULOS_TABELA[n],hMax))+4} fontSize={10} fill={c} fontWeight="bold">NP {n}</text>
              </g>
            ))}
            {/* Marcadores h1, h2 */}
            <line x1={dotX1} y1={PAD.top} x2={dotX1} y2={PAD.top+ph} stroke={cor} strokeWidth={1.5} strokeDasharray="5,3"/>
            <circle cx={dotX1} cy={dotY1} r={5} fill={cor} stroke="white" strokeWidth={1.5}/>
            <text x={dotX1+4} y={dotY1-8} fontSize={9} fill={cor} fontWeight="bold">h₁={h1}m α₁={alpha1.toFixed(0)}°</text>
            {H>0&&h2<=hMax&&<>
              <line x1={dotX2} y1={PAD.top} x2={dotX2} y2={PAD.top+ph} stroke={cor} strokeWidth={1.5} strokeDasharray="3,5"/>
              <circle cx={dotX2} cy={dotY2} r={4} fill="transparent" stroke={cor} strokeWidth={2}/>
              <text x={dotX2+4} y={dotY2-8} fontSize={9} fill={cor} fontWeight="bold">h₂={h2}m α₂={alpha2.toFixed(0)}°</text>
            </>}
            {/* Eixos */}
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top+ph} stroke="#94a3b8" strokeWidth={1.5}/>
            <line x1={PAD.left} y1={PAD.top+ph} x2={PAD.left+pw} y2={PAD.top+ph} stroke="#94a3b8" strokeWidth={1.5}/>
            <text x={PAD.left+pw/2} y={H1-5} textAnchor="middle" fontSize={10} fill="#94a3b8">h — Altura do captor (m)</text>
            <text x={12} y={PAD.top+ph/2} textAnchor="middle" fontSize={10} fill="#94a3b8" transform={`rotate(-90,12,${PAD.top+ph/2})`}>α (graus)</text>
            <text x={W1/2} y={PAD.top-10} textAnchor="middle" fontSize={11} fill="#e2e8f0" fontWeight="bold">Ângulo de proteção α × Altura h</text>
          </svg>
        </div>
      </div>

      {/* Diagramas 2 e 3 lado a lado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Diagrama 2: Vista lateral — cone */}
        <div>
          <div className="text-xs font-semibold text-foreground-muted mb-2 text-center">
            Gráfico 2 — Vista lateral — Cone de proteção NP {np}
          </div>
          <svg width={W2} height={H2} style={{display:"block",margin:"0 auto",background:"var(--color-background)"}}>
            {/* Solo */}
            <line x1={20} y1={base2} x2={W2-20} y2={base2} stroke="#64748b" strokeWidth={2}/>
            <text x={W2/2} y={base2+14} textAnchor="middle" fontSize={9} fill="#64748b">Solo / Plano de referência</text>
            {/* Estrutura */}
            {H>0&&<>
              <rect x={cx2-r1Px*0.6} y={topoEstrY} width={r1Px*1.2} height={hPx2}
                fill="none" stroke="#475569" strokeWidth={1.5} strokeDasharray="4,3"/>
              <text x={cx2+r1Px*0.6+4} y={topoEstrY+hPx2/2} fontSize={9} fill="#94a3b8">H={H}m</text>
            </>}
            {/* Cone de proteção ao topo da estrutura */}
            <path d={fmtLine([[cx2-r1Px,H>0?topoEstrY:base2],[cx2,captorAbsY],[cx2+r1Px,H>0?topoEstrY:base2]])}
              fill={cor+"25"} stroke={cor} strokeWidth={1.5} strokeDasharray="6,3"/>
            {/* Cone ao solo */}
            {H>0&&<path d={fmtLine([[cx2-r2Px,base2],[cx2,captorAbsY],[cx2+r2Px,base2]])}
              fill="none" stroke={cor+"60"} strokeWidth={1} strokeDasharray="3,5"/>}
            {/* Mastro */}
            <line x1={cx2} y1={captorAbsY} x2={cx2} y2={H>0?topoEstrY:base2}
              stroke={cor} strokeWidth={3}/>
            {/* Captor (topo) */}
            <circle cx={cx2} cy={captorAbsY} r={6} fill={cor} stroke="white" strokeWidth={1.5}/>
            {/* Esfera rolante */}
            <circle cx={cx2} cy={captorAbsY+R*(hPx/Math.max(h2,1))} r={R*(hPx/Math.max(h2,1))}
              fill="none" stroke="#6366f180" strokeWidth={1} strokeDasharray="4,4"/>
            {/* Labels */}
            <text x={cx2+4} y={(captorAbsY+(H>0?topoEstrY:base2))/2} fontSize={9} fill="#94a3b8">h₁={h1}m</text>
            <text x={cx2+r1Px/2+4} y={(H>0?topoEstrY:base2)-5} fontSize={9} fill={cor}>r₁={r1.toFixed(1)}m</text>
            {H>0&&<text x={cx2+r2Px/2+4} y={base2-5} fontSize={9} fill={cor+"aa"}>r₂={r2.toFixed(1)}m</text>}
            <text x={W2/2} y={22} textAnchor="middle" fontSize={11} fill="#e2e8f0" fontWeight="bold">Vista Lateral</text>
          </svg>
        </div>

        {/* Diagrama 3: α₁⇒h₁ e α₂⇒h₂ */}
        <div>
          <div className="text-xs font-semibold text-foreground-muted mb-2 text-center">
            Gráfico 3 — Captor sobre estrutura: α₁⇒h₁ e α₂⇒h₂=H+h₁
          </div>
          <svg width={W3} height={H3} style={{display:"block",margin:"0 auto",background:"var(--color-background)"}}>
            {/* Solo */}
            <line x1={20} y1={ground3} x2={W3-20} y2={ground3} stroke="#64748b" strokeWidth={2}/>
            {/* Estrutura */}
            {H>0&&<>
              <rect x={cx3-Math.min(rCone1Px,cx3-10)} y={topoY3}
                width={Math.min(rCone1Px,cx3-10)*2} height={hPx3}
                fill="#1e293b" stroke="#475569" strokeWidth={1.5}/>
              <text x={cx3} y={topoY3+hPx3/2+4} textAnchor="middle" fontSize={9} fill="#94a3b8">H={H}m</text>
            </>}
            {/* Cone α₁ — do captor ao topo da estrutura */}
            <path d={fmtLine([[cx3-rCone1Px,H>0?topoY3:ground3],[cx3,captorY3],[cx3+rCone1Px,H>0?topoY3:ground3]])}
              fill={cor+"30"} stroke={cor} strokeWidth={2} strokeLinejoin="round"/>
            {/* Cone α₂ — do captor ao solo */}
            {H>0&&<path d={fmtLine([[cx3-rCone2Px,ground3],[cx3,captorY3],[cx3+rCone2Px,ground3]])}
              fill="none" stroke={cor+"55"} strokeWidth={1.5} strokeDasharray="5,4"/>}
            {/* Mastro */}
            <line x1={cx3} y1={captorY3} x2={cx3} y2={H>0?topoY3:ground3} stroke={cor} strokeWidth={3}/>
            <circle cx={cx3} cy={captorY3} r={6} fill={cor} stroke="white" strokeWidth={1.5}/>
            {/* Setas de ângulo */}
            <text x={cx3+8} y={captorY3+h1Px3/3} fontSize={9} fill={cor}>α₁={alpha1.toFixed(0)}°</text>
            {H>0&&<text x={cx3+8} y={captorY3+h1Px3*0.7} fontSize={9} fill={cor+"aa"}>α₂={alpha2.toFixed(0)}°</text>}
            {/* Cotas */}
            <line x1={cx3-rCone1Px-2} y1={H>0?topoY3:ground3} x2={cx3+rCone1Px+2} y2={H>0?topoY3:ground3}
              stroke={cor+"99"} strokeWidth={1}/>
            <text x={cx3} y={(H>0?topoY3:ground3)-5} textAnchor="middle" fontSize={9} fill={cor}>
              2r₁={`${(r1*2).toFixed(1)}m`}
            </text>
            {H>0&&<>
              <line x1={cx3-rCone2Px-2} y1={ground3-4} x2={cx3+rCone2Px+2} y2={ground3-4}
                stroke={cor+"55"} strokeWidth={1}/>
              <text x={cx3} y={ground3-8} textAnchor="middle" fontSize={9} fill={cor+"aa"}>
                2r₂={`${(r2*2).toFixed(1)}m`}
              </text>
            </>}
            <text x={W3/2} y={22} textAnchor="middle" fontSize={11} fill="#e2e8f0" fontWeight="bold">
              α₁⇒h₁ e α₂⇒h₂=H+h₁
            </text>
          </svg>
        </div>
      </div>

      <div className="text-[10px] text-foreground-muted text-center">
        Ângulos interpolados da Tabela A.1 da NBR 5419-3:2026.
        r = h × tan(α). h₂ = H + h₁ (captor referenciado ao solo).
        R (esfera): NP I=20m · NP II=30m · NP III=45m · NP IV=60m.
      </div>
    </div>
  );
}
