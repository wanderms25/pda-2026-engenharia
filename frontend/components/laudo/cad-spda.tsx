"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button, Label, Input } from "@/components/ui";
import { Square, Circle, Minus, Triangle, ZoomIn, ZoomOut, RotateCcw, Download, Eraser, Pencil, Ruler, Settings } from "lucide-react";

// ── NBR 5419-3:2026 Tabela A.1 — Ângulo de proteção α(h, NP) ─────────────────
// O ângulo depende TANTO da altura h quanto do Nível de Proteção (NP).
// NP também define o raio da esfera rolante R.
const ANGULO_POR_ALTURA_NP: Record<string, (h:number)=>number> = {
  "I":   (h)=> h<=2?31 : h<=5?46 : h<=10?44 : h<=20?37 : h<=30?32 : 28,
  "II":  (h)=> h<=2?45 : h<=5?38 : h<=10?31 : h<=20?24 : 18,
  "III": (h)=> h<=2?50 : h<=5?43 : h<=10?37 : h<=20?28 : h<=30?23 : 18,
  "IV":  (h)=> h<=2?55 : h<=5?50 : h<=10?45 : h<=20?40 : h<=30?35 : 25,
};
// Raio da esfera rolante por NP (§5.2.2 Tabela 2)
const RAIO_ESFERA: Record<string,number> = { "I":20, "II":30, "III":45, "IV":60 };
// Espaçamento da malha Faraday por NP (§5.2.1 Tabela 1)
const MALHA_FARADAY: Record<string,number> = { "I":5, "II":10, "III":15, "IV":20 };
// Distância entre descidas por NP (§5.3.2)
const DIST_DESCIDAS: Record<string,number> = { "I":10, "II":15, "III":20, "IV":25 };

const COR_NP: Record<string,string> = { "I":"#ef4444","II":"#f97316","III":"#eab308","IV":"#22c55e" };
const CAPTORES = [
  { id:"franklin", nome:"Franklin (haste)", desc:"Ângulo por NBR 5419-3 Tab. A.1" },
  { id:"esfera",   nome:"Esfera Rolante",   desc:"Raio R por NP (Tab. 2)" },
  { id:"faraday",  nome:"Faraday (malha)",  desc:"Malha por NP (Tab. 1)" },
];

const ESCALA = 8; // px/m

type Ferramenta = "parede"|"linha"|"rect"|"circulo"|"triangulo"|"captor"|"borracha";
type TipoCaptor = "franklin"|"esfera"|"faraday";

interface Pt { x:number; y:number; }
interface Obj {
  id:string; tipo:"parede"|"linha"|"rect"|"circulo"|"triangulo"|"captor";
  pts:Pt[]; cor:string; esp:number;
  captor_tipo?:TipoCaptor; h_mastro?:number; h_struct?:number; np?:string;
  fechado?:boolean;
}

const snap = (p:Pt,g=0.5):Pt => ({x:Math.round(p.x/g)*g, y:Math.round(p.y/g)*g});
const toCv = (p:Pt,off:Pt,z:number):Pt => ({x:p.x*ESCALA*z+off.x, y:p.y*ESCALA*z+off.y});
const frCv = (cx:number,cy:number,off:Pt,z:number):Pt => ({x:(cx-off.x)/(ESCALA*z), y:(cy-off.y)/(ESCALA*z)});
const dist = (a:Pt,b:Pt) => Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2);

export default function CadSPDA() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool]   = useState<Ferramenta>("parede");
  const [np, setNp]       = useState("III");
  const [cor, setCor]     = useState("#94a3b8");
  const [esp, setEsp]     = useState(2);
  const [tipo, setTipo]   = useState<TipoCaptor>("franklin");
  const [hM, setHM]       = useState(6);   // altura mastro
  const [hS, setHS]       = useState(0);   // altura estrutura
  const [objetos, setObj] = useState<Obj[]>([]);
  const [building, setBld] = useState<Pt[]>([]);
  const [cursor, setCursor] = useState<Pt|null>(null);
  const [zoom, setZoom]   = useState(1);
  const [off, setOff]     = useState<Pt>({x:60,y:60});
  const [panStart, setPan] = useState<{mouse:Pt,off:Pt}|null>(null);
  const [showGrid, setGrid]  = useState(true);
  const [showDim, setDim]  = useState(true);
  const [showProt, setProt] = useState(true);
  // Structure dimensions for perimeter calc
  const [structL, setStructL] = useState(20);
  const [structW, setStructW] = useState(15);

  // Normative calculations
  const hTotal = hM + hS;
  const anguloFn = ANGULO_POR_ALTURA_NP[np] || ANGULO_POR_ALTURA_NP["III"];
  const angulo = anguloFn(hTotal);
  const anguloRad = angulo * Math.PI / 180;
  const raioBoer = hM * Math.tan(anguloRad);       // raio no nível do topo da estrutura
  const raioSolo = hTotal * Math.tan(anguloRad);   // raio ao nível do solo
  const R = RAIO_ESFERA[np];
  const raioEsfera = Math.sqrt(Math.max(0, R*R - (R-hM)*(R-hM)));
  const malha = MALHA_FARADAY[np];
  const perimetroStruct = 2*(structL+structW);
  const numDescidas = Math.max(2, Math.ceil(perimetroStruct / DIST_DESCIDAS[np]));

  // Perimeter from drawn walls
  const perimetroDesenho = objetos
    .filter(o => o.tipo==="parede"||o.tipo==="linha")
    .reduce((acc,o)=>{
      for(let i=0;i<o.pts.length-1;i++) acc+=dist(o.pts[i],o.pts[i+1]);
      return acc;
    },0);

  const draw = useCallback(()=>{
    const cv = cvRef.current; if(!cv) return;
    const ctx = cv.getContext("2d"); if(!ctx) return;
    const W=cv.width, H=cv.height;
    ctx.clearRect(0,0,W,H);

    // Background
    ctx.fillStyle="#0d1117"; ctx.fillRect(0,0,W,H);

    // Grid
    if(showGrid){
      const step=ESCALA*zoom;
      ctx.strokeStyle="rgba(148,163,184,0.08)"; ctx.lineWidth=0.5;
      for(let x=off.x%step;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=off.y%step;y<H;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      const step5=step*5;
      ctx.strokeStyle="rgba(148,163,184,0.18)";
      for(let x=off.x%step5;x<W;x+=step5){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=off.y%step5;y<H;y+=step5){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    }

    // Origin
    const o0=toCv({x:0,y:0},off,zoom);
    ctx.fillStyle="#6366f1"; ctx.fillRect(o0.x-2,o0.y-2,5,5);
    ctx.font="9px monospace"; ctx.fillStyle="#6366f180"; ctx.fillText("0,0",o0.x+5,o0.y+4);

    // Scale bar
    const sBar=5*ESCALA*zoom;
    ctx.strokeStyle="#475569"; ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(20,H-20);ctx.lineTo(20+sBar,H-20);ctx.stroke();
    ctx.beginPath();ctx.moveTo(20,H-16);ctx.lineTo(20,H-24);ctx.stroke();
    ctx.beginPath();ctx.moveTo(20+sBar,H-16);ctx.lineTo(20+sBar,H-24);ctx.stroke();
    ctx.font="9px monospace"; ctx.fillStyle="#94a3b8"; ctx.textAlign="center";
    ctx.fillText("5m",20+sBar/2,H-27); ctx.textAlign="left";

    // Draw objects
    for(const obj of objetos){
      const pts=obj.pts.map(p=>toCv(p,off,zoom));

      if(obj.tipo==="captor"){
        const pos=pts[0];
        const hm=obj.h_mastro??hM, hs=obj.h_struct??hS, ht=hm+hs;
        const objNp=obj.np??np;
        const af=ANGULO_POR_ALTURA_NP[objNp]||(h=>45);
        const ang=af(ht); const ar=ang*Math.PI/180;
        const rb=hm*Math.tan(ar)*ESCALA*zoom;
        const rs=ht*Math.tan(ar)*ESCALA*zoom;
        const Rr=RAIO_ESFERA[objNp];
        const re=Math.sqrt(Math.max(0,Rr*Rr-(Rr-hm)*(Rr-hm)))*ESCALA*zoom;
        const corNp=COR_NP[objNp]||"#6366f1";

        if(showProt){
          // Zone at top of structure
          ctx.beginPath(); ctx.arc(pos.x,pos.y,rb,0,Math.PI*2);
          ctx.fillStyle=corNp+"15"; ctx.fill();
          ctx.strokeStyle=corNp+"99"; ctx.lineWidth=1.5; ctx.setLineDash([6,3]); ctx.stroke();
          // Zone at ground level
          if(hs>0){
            ctx.beginPath(); ctx.arc(pos.x,pos.y,rs,0,Math.PI*2);
            ctx.strokeStyle=corNp+"55"; ctx.lineWidth=1; ctx.setLineDash([3,5]); ctx.stroke();
          }
          // Rolling sphere radius
          ctx.beginPath(); ctx.arc(pos.x,pos.y,re,0,Math.PI*2);
          ctx.strokeStyle="#6366f180"; ctx.lineWidth=1; ctx.setLineDash([4,4]); ctx.stroke();
          ctx.setLineDash([]);
        }

        // Captor symbol
        const ct=obj.captor_tipo??tipo;
        const mastPx=Math.min(hm*ESCALA*zoom*0.6,35);
        ctx.strokeStyle=corNp; ctx.lineWidth=2;
        ctx.setLineDash([]);

        if(ct==="franklin"){
          // Vertical rod + lightning
          ctx.beginPath(); ctx.moveTo(pos.x,pos.y); ctx.lineTo(pos.x,pos.y-mastPx); ctx.stroke();
          ctx.fillStyle=corNp;
          ctx.beginPath();
          ctx.moveTo(pos.x,pos.y-mastPx);
          ctx.lineTo(pos.x+5,pos.y-mastPx-7);
          ctx.lineTo(pos.x+2,pos.y-mastPx-7);
          ctx.lineTo(pos.x+6,pos.y-mastPx-16);
          ctx.lineTo(pos.x-1,pos.y-mastPx-9);
          ctx.lineTo(pos.x+2,pos.y-mastPx-9);
          ctx.closePath(); ctx.fill();
        } else if(ct==="esfera"){
          ctx.beginPath(); ctx.moveTo(pos.x,pos.y); ctx.lineTo(pos.x,pos.y-mastPx); ctx.stroke();
          ctx.beginPath(); ctx.arc(pos.x,pos.y-mastPx,6,0,Math.PI*2);
          ctx.fillStyle=corNp; ctx.fill();
        } else {
          // Faraday mesh symbol
          const s=8;
          for(let dx=-s;dx<=s;dx+=s){
            ctx.beginPath(); ctx.moveTo(pos.x+dx,pos.y-s); ctx.lineTo(pos.x+dx,pos.y+s); ctx.stroke();
          }
          for(let dy=-s;dy<=s;dy+=s){
            ctx.beginPath(); ctx.moveTo(pos.x-s,pos.y+dy); ctx.lineTo(pos.x+s,pos.y+dy); ctx.stroke();
          }
        }

        ctx.beginPath(); ctx.arc(pos.x,pos.y,4,0,Math.PI*2);
        ctx.fillStyle=corNp; ctx.fill();

        if(showDim){
          ctx.font=`${9*Math.min(zoom,1.3)}px monospace`; ctx.fillStyle=corNp;
          ctx.fillText(`NP${objNp} α=${ang}° r=${(rb/ESCALA/zoom).toFixed(1)}m`,pos.x+8,pos.y-2);
          ctx.fillText(`h=${hm}m R=${Rr}m esf=${(re/ESCALA/zoom).toFixed(1)}m`,pos.x+8,pos.y+10);
        }

      } else if(obj.tipo==="rect" && pts.length>=2){
        const [a,b]=pts;
        ctx.strokeStyle=obj.cor; ctx.lineWidth=obj.esp; ctx.fillStyle=obj.cor+"22";
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.rect(a.x,a.y,b.x-a.x,b.y-a.y); ctx.stroke(); ctx.fill();
        if(showDim){
          const W2=Math.abs(obj.pts[1].x-obj.pts[0].x).toFixed(1);
          const H2=Math.abs(obj.pts[1].y-obj.pts[0].y).toFixed(1);
          ctx.font="9px monospace"; ctx.fillStyle="#94a3b8";
          ctx.fillText(`${W2}×${H2}m`,(a.x+b.x)/2-15,Math.min(a.y,b.y)-5);
        }

      } else if(obj.tipo==="circulo" && pts.length>=2){
        const r=Math.sqrt((pts[1].x-pts[0].x)**2+(pts[1].y-pts[0].y)**2);
        ctx.strokeStyle=obj.cor; ctx.lineWidth=obj.esp; ctx.fillStyle=obj.cor+"22";
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(pts[0].x,pts[0].y,r,0,Math.PI*2); ctx.stroke(); ctx.fill();
        if(showDim){
          const rm=(dist(obj.pts[0],obj.pts[1])).toFixed(1);
          ctx.font="9px monospace"; ctx.fillStyle="#94a3b8";
          ctx.fillText(`r=${rm}m`,pts[0].x+r+4,pts[0].y);
        }

      } else if(obj.tipo==="triangulo" && pts.length>=3){
        ctx.strokeStyle=obj.cor; ctx.lineWidth=obj.esp; ctx.fillStyle=obj.cor+"22";
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
        pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
        ctx.closePath(); ctx.stroke(); ctx.fill();

      } else if(pts.length>=2){
        // parede / linha
        ctx.strokeStyle=obj.cor; ctx.lineWidth=obj.esp; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
        pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
        if(obj.fechado) ctx.closePath();
        ctx.stroke();
        if(showDim && pts.length===2){
          const dm=dist(obj.pts[0],obj.pts[1]).toFixed(1);
          const mx=(pts[0].x+pts[1].x)/2, my=(pts[0].y+pts[1].y)/2;
          ctx.font="9px monospace"; ctx.fillStyle="#94a3b8";
          ctx.fillText(`${dm}m`,mx+3,my-4);
        }
      }
    }

    // In-progress drawing
    if(building.length>0 && cursor){
      const all=[...building, cursor];
      const cpts=all.map(p=>toCv(p,off,zoom));
      ctx.strokeStyle="#6366f1"; ctx.lineWidth=1.5; ctx.setLineDash([5,5]);
      ctx.beginPath(); ctx.moveTo(cpts[0].x,cpts[0].y);
      cpts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
      ctx.stroke(); ctx.setLineDash([]);
      // Show live dimension
      if(building.length===1 && showDim){
        const dm=dist(building[0],cursor).toFixed(1);
        const lp=toCv(cursor,off,zoom);
        ctx.font="10px monospace"; ctx.fillStyle="#6366f1";
        ctx.fillText(`${dm}m`,lp.x+8,lp.y-4);
      }
      // Captor preview
      if(tool==="captor"){
        const pos=cpts[0];
        const rb=raioBoer*ESCALA*zoom;
        const re=raioEsfera*ESCALA*zoom;
        ctx.beginPath(); ctx.arc(pos.x,pos.y,rb,0,Math.PI*2);
        ctx.strokeStyle=COR_NP[np]+"80"; ctx.lineWidth=1.5; ctx.setLineDash([6,3]); ctx.stroke();
        ctx.beginPath(); ctx.arc(pos.x,pos.y,re,0,Math.PI*2);
        ctx.strokeStyle="#6366f160"; ctx.lineWidth=1; ctx.setLineDash([4,4]); ctx.stroke();
        ctx.setLineDash([]);
      }
      // Rect/circle preview while drawing 2nd point
      if((tool==="rect"||tool==="circulo") && building.length===1){
        const [a,b]=[cpts[0],cpts[cpts.length-1]];
        ctx.strokeStyle="#6366f1"; ctx.lineWidth=1.5; ctx.setLineDash([5,5]);
        if(tool==="rect"){
          ctx.beginPath(); ctx.rect(a.x,a.y,b.x-a.x,b.y-a.y); ctx.stroke();
          if(showDim){
            const W2=Math.abs(all[0].x-cursor.x).toFixed(1);
            const H2=Math.abs(all[0].y-cursor.y).toFixed(1);
            ctx.font="9px monospace"; ctx.fillStyle="#6366f1";
            ctx.fillText(`${W2}×${H2}m`,(a.x+b.x)/2-15,Math.min(a.y,b.y)-6);
          }
        } else {
          const r=Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2);
          ctx.beginPath(); ctx.arc(a.x,a.y,r,0,Math.PI*2); ctx.stroke();
          if(showDim){
            const rm=dist(building[0],cursor).toFixed(1);
            ctx.font="9px monospace"; ctx.fillStyle="#6366f1";
            ctx.fillText(`r=${rm}m`,b.x+4,b.y-4);
          }
        }
        ctx.setLineDash([]);
      }
    }

    // Cursor crosshair
    if(cursor){
      const cp=toCv(cursor,off,zoom);
      ctx.strokeStyle="#6366f160"; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(cp.x-10,cp.y); ctx.lineTo(cp.x+10,cp.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cp.x,cp.y-10); ctx.lineTo(cp.x,cp.y+10); ctx.stroke();
      if(showDim){
        ctx.font="8px monospace"; ctx.fillStyle="#6366f1";
        ctx.fillText(`(${cursor.x.toFixed(1)},${cursor.y.toFixed(1)})m`,cp.x+8,cp.y-4);
      }
    }
  },[objetos,off,zoom,building,cursor,np,hM,hS,showGrid,showDim,showProt,tool,tipo,
     raioBoer,raioEsfera,raioSolo,angulo,R]);

  useEffect(()=>{draw();},[draw]);

  function getCvCoords(e:React.MouseEvent<HTMLCanvasElement>):Pt{
    const cv=cvRef.current!;
    const rect=cv.getBoundingClientRect();
    const sx=cv.width/rect.width, sy=cv.height/rect.height;
    return snap(frCv((e.clientX-rect.left)*sx,(e.clientY-rect.top)*sy,off,zoom));
  }

  function handleMouseMove(e:React.MouseEvent<HTMLCanvasElement>){
    setCursor(getCvCoords(e));
    if(panStart){
      setOff({x:panStart.off.x+(e.clientX-panStart.mouse.x), y:panStart.off.y+(e.clientY-panStart.mouse.y)});
    }
  }

  function handleMouseDown(e:React.MouseEvent<HTMLCanvasElement>){
    if(e.button===1||e.altKey){
      setPan({mouse:{x:e.clientX,y:e.clientY},off:{...off}}); return;
    }
    const p=getCvCoords(e);
    const cv=cvRef.current!;
    const rect=cv.getBoundingClientRect();
    const sx=cv.width/rect.width, sy=cv.height/rect.height;
    const cx=(e.clientX-rect.left)*sx, cy=(e.clientY-rect.top)*sy;

    if(tool==="borracha"){
      // Delete ONLY the single closest object near click point
      let closest:string|null=null;
      let minD=15; // px threshold
      for(const obj of objetos){
        if(obj.tipo==="captor"){
          const pos=toCv(obj.pts[0],off,zoom);
          const d=Math.sqrt((pos.x-cx)**2+(pos.y-cy)**2);
          if(d<minD){ minD=d; closest=obj.id; }
        } else {
          const pts=obj.pts.map(q=>toCv(q,off,zoom));
          for(let i=0;i<pts.length-1;i++){
            // Point to segment distance
            const ax=pts[i].x,ay=pts[i].y,bx=pts[i+1]?.x??ax,by=pts[i+1]?.y??ay;
            const ab=Math.sqrt((bx-ax)**2+(by-ay)**2);
            const t=ab>0?Math.max(0,Math.min(1,((cx-ax)*(bx-ax)+(cy-ay)*(by-ay))/(ab*ab))):0;
            const px2=ax+t*(bx-ax), py2=ay+t*(by-ay);
            const d=Math.sqrt((cx-px2)**2+(cy-py2)**2);
            if(d<minD){ minD=d; closest=obj.id; }
          }
          // Also check rect corners
          if(obj.tipo==="rect"&&pts.length>=2){
            const [a,b]=pts;
            const rectPts=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y},a];
            for(let i=0;i<rectPts.length-1;i++){
              const ax=rectPts[i].x,ay=rectPts[i].y,bx=rectPts[i+1].x,by=rectPts[i+1].y;
              const ab=Math.sqrt((bx-ax)**2+(by-ay)**2);
              if(ab===0) continue;
              const t=Math.max(0,Math.min(1,((cx-ax)*(bx-ax)+(cy-ay)*(by-ay))/(ab*ab)));
              const d=Math.sqrt((cx-(ax+t*(bx-ax)))**2+(cy-(ay+t*(by-ay)))**2);
              if(d<minD){ minD=d; closest=obj.id; }
            }
          }
          if(obj.tipo==="circulo"&&pts.length>=2){
            const r=Math.sqrt((pts[1].x-pts[0].x)**2+(pts[1].y-pts[0].y)**2);
            const dCenter=Math.sqrt((cx-pts[0].x)**2+(cy-pts[0].y)**2);
            const d=Math.abs(dCenter-r);
            if(d<minD){ minD=d; closest=obj.id; }
          }
        }
      }
      if(closest) setObj(prev=>prev.filter(o=>o.id!==closest));
      return;
    }

    if(tool==="captor"){
      setObj(prev=>[...prev,{
        id:Date.now().toString(), tipo:"captor", pts:[p], cor:COR_NP[np]||"#6366f1", esp:2,
        captor_tipo:tipo, h_mastro:hM, h_struct:hS, np,
      }]);
      return;
    }

    if(tool==="parede"||tool==="linha"){
      if(building.length===0) setBld([p]);
      else setBld(prev=>[...prev,p]);
      return;
    }

    if(tool==="rect"||tool==="circulo"){
      if(building.length===0) setBld([p]);
      else {
        setObj(prev=>[...prev,{id:Date.now().toString(),tipo:tool,pts:[building[0],p],cor,esp,}]);
        setBld([]);
      }
      return;
    }

    if(tool==="triangulo"){
      if(building.length<2) setBld(prev=>[...prev,p]);
      else {
        setObj(prev=>[...prev,{id:Date.now().toString(),tipo:"triangulo",pts:[...building,p],cor,esp,}]);
        setBld([]);
      }
    }
  }

  function handleDblClick(){
    if((tool==="parede"||tool==="linha") && building.length>=2){
      setObj(prev=>[...prev,{id:Date.now().toString(),tipo:tool,pts:building,cor,esp,fechado:tool==="parede"}]);
      setBld([]);
    }
  }

  function handleMouseUp(){ setPan(null); }

  function handleWheel(e:React.WheelEvent){
    e.preventDefault();
    setZoom(z=>Math.max(0.2,Math.min(6,z*(e.deltaY>0?0.88:1.12))));
  }

  function exportPNG(){
    const cv=cvRef.current; if(!cv) return;
    const a=document.createElement("a"); a.href=cv.toDataURL(); a.download="planta_spda.png"; a.click();
  }

  function limpar(){ setObj([]); setBld([]); }

  const TOOLS:[Ferramenta,string,React.ReactNode][] = [
    ["parede","Parede",<Minus className="w-3.5 h-3.5"/>],
    ["linha","Linha",<Pencil className="w-3.5 h-3.5"/>],
    ["rect","Retângulo",<Square className="w-3.5 h-3.5"/>],
    ["circulo","Círculo",<Circle className="w-3.5 h-3.5"/>],
    ["triangulo","Triângulo",<Triangle className="w-3.5 h-3.5"/>],
    ["captor","Captor",<span className="text-xs font-bold">⚡</span>],
    ["borracha","Borracha",<Eraser className="w-3.5 h-3.5"/>],
  ];

  const selectCls="flex h-8 w-full rounded border border-input bg-background-secondary px-2 py-1 text-xs text-foreground";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="p-2.5 rounded-lg border border-border bg-background-secondary space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {TOOLS.map(([id,label,icon])=>(
              <button key={id} type="button" onClick={()=>{setTool(id);setBld([]);}}
                title={label}
                className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs border transition-colors ${
                  tool===id?"bg-primary/15 border-primary text-primary":"border-border text-foreground-muted hover:border-border-secondary"
                }`}>
                {icon}<span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={cor} onChange={e=>setCor(e.target.value)}
              className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent" title="Cor da linha"/>
            <div className="flex items-center gap-1 text-xs text-foreground-muted">
              <span>Esp:</span>
              <input type="range" min="0.5" max="8" step="0.5" value={esp}
                onChange={e=>setEsp(Number(e.target.value))} className="w-16 accent-primary"/>
              <span className="font-mono w-4">{esp}</span>
            </div>
          </div>
          <div className="flex gap-1 ml-auto">
            <button onClick={()=>setZoom(z=>Math.min(6,z*1.2))} className="p-1.5 rounded border border-border text-foreground-muted hover:bg-background"><ZoomIn className="w-3.5 h-3.5"/></button>
            <button onClick={()=>setZoom(z=>Math.max(0.2,z/1.2))} className="p-1.5 rounded border border-border text-foreground-muted hover:bg-background"><ZoomOut className="w-3.5 h-3.5"/></button>
            <button onClick={()=>{setZoom(1);setOff({x:60,y:60});}} className="px-2 py-1 rounded border border-border text-xs text-foreground-muted hover:bg-background">1:1</button>
            <button onClick={exportPNG} className="p-1.5 rounded border border-border text-foreground-muted hover:bg-background" title="Exportar PNG"><Download className="w-3.5 h-3.5"/></button>
            <button onClick={limpar} className="p-1.5 rounded border border-border text-foreground-muted hover:bg-red-50 hover:text-red-600" title="Limpar tudo"><RotateCcw className="w-3.5 h-3.5"/></button>
          </div>
        </div>
        <div className="flex gap-3 text-[10px] text-foreground-muted">
          {([
            {label:"Grade",  val:showGrid, set:setGrid},
            {label:"Cotas",  val:showDim,  set:setDim},
            {label:"Zonas",  val:showProt, set:setProt},
          ] as {label:string;val:boolean;set:(v:boolean)=>void}[]).map(({label,val,set})=>(
            <label key={label} className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={val} onChange={e=>set(e.target.checked)} className="w-3 h-3 accent-primary"/>
              {label}
            </label>
          ))}
          <span className="ml-2 text-foreground-muted">Alt+drag=mover · Roda=zoom · 2×clique=encerrar</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-3">
        {/* Side panel */}
        <div className="space-y-3">
          {/* Captor config */}
          <div className="p-3 rounded-lg border border-border bg-background-secondary space-y-3">
            <div className="text-xs font-semibold text-foreground-muted">Captor</div>
            {CAPTORES.map(c=>(
              <button key={c.id} type="button" onClick={()=>setTipo(c.id as TipoCaptor)}
                className={`w-full flex items-start gap-2 p-2 rounded border text-xs text-left transition-colors ${
                  tipo===c.id?"border-primary bg-primary/10 text-primary":"border-border text-foreground-muted hover:border-border-secondary"
                }`}>
                <div>
                  <div className="font-medium">{c.nome}</div>
                  <div className="text-[10px] opacity-70">{c.desc}</div>
                </div>
              </button>
            ))}

            <div className="border-t border-border pt-2 space-y-2">
              <div>
                <div className="text-[10px] text-foreground-muted">Nível de Proteção (NP)</div>
                <div className="flex gap-1 mt-1">
                  {["I","II","III","IV"].map(n=>(
                    <button key={n} type="button" onClick={()=>setNp(n)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${
                        np===n?"text-white border-transparent":"border-border text-foreground-muted"
                      }`} style={np===n?{background:COR_NP[n]}:{}}>
                      NP {n}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-foreground-muted mt-1">Define: ângulo α, raio R, malha Faraday</div>
              </div>

              <div>
                <div className="text-[10px] text-foreground-muted">Alt. mastro h₁ (m)</div>
                <div className="flex items-center gap-2">
                  <input type="range" min="1" max="30" value={hM} onChange={e=>setHM(Number(e.target.value))} className="flex-1 accent-primary"/>
                  <span className="text-xs font-mono text-primary w-8">{hM}m</span>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-foreground-muted">Alt. estrutura H (m)</div>
                <div className="flex items-center gap-2">
                  <input type="range" min="0" max="100" value={hS} onChange={e=>setHS(Number(e.target.value))} className="flex-1 accent-primary"/>
                  <span className="text-xs font-mono text-primary w-8">{hS}m</span>
                </div>
              </div>
            </div>

            {/* Live calculations */}
            <div className="border-t border-border pt-2 space-y-1 text-[10px]">
              <div className="font-semibold text-foreground-muted">Cálculos — NBR 5419-3:2026</div>
              <div className="flex justify-between"><span className="text-foreground-muted">h total (h₁+H):</span><span className="font-mono text-primary">{hTotal}m</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">α (Tab.A.1, NP {np}):</span><span className="font-mono text-primary">{angulo}°</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">r (topo estrutura):</span><span className="font-mono text-primary">{raioBoer.toFixed(2)}m</span></div>
              {hS>0&&<div className="flex justify-between"><span className="text-foreground-muted">r (solo):</span><span className="font-mono text-primary">{raioSolo.toFixed(2)}m</span></div>}
              <div className="flex justify-between"><span className="text-foreground-muted">R esfera (NP {np}):</span><span className="font-mono text-primary">{R}m</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">r esfera rolante:</span><span className="font-mono text-primary">{raioEsfera.toFixed(2)}m</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">Malha Faraday:</span><span className="font-mono text-primary">{malha}m × {malha}m</span></div>
            </div>
          </div>

          {/* Structure dimensions for perimeter */}
          <div className="p-3 rounded-lg border border-border bg-background-secondary space-y-2">
            <div className="text-xs font-semibold text-foreground-muted flex items-center gap-1"><Ruler className="w-3 h-3"/>Dimensões da estrutura</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-foreground-muted">Comprimento (m)</div>
                <Input type="number" min="1" value={structL} onChange={e=>setStructL(Number(e.target.value))}
                  className="mt-1 h-7 text-xs font-mono"/>
              </div>
              <div>
                <div className="text-[10px] text-foreground-muted">Largura (m)</div>
                <Input type="number" min="1" value={structW} onChange={e=>setStructW(Number(e.target.value))}
                  className="mt-1 h-7 text-xs font-mono"/>
              </div>
            </div>
            <div className="space-y-1 text-[10px] pt-1 border-t border-border">
              <div className="flex justify-between"><span className="text-foreground-muted">Área:</span><span className="font-mono text-primary">{(structL*structW).toFixed(1)} m²</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">Perímetro:</span><span className="font-mono text-primary font-bold">{perimetroStruct.toFixed(1)} m</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">Descidas (NP {np}, a cada {DIST_DESCIDAS[np]}m):</span><span className="font-mono text-primary font-bold">{numDescidas}</span></div>
              {perimetroDesenho>0&&(
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="text-foreground-muted">Desenhado:</span>
                  <span className="font-mono text-amber-500">{perimetroDesenho.toFixed(1)} m</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="rounded-lg overflow-hidden border border-border" style={{height:520}}>
          <canvas ref={cvRef} width={900} height={520}
            style={{width:"100%",height:"100%",cursor:tool==="borracha"?"cell":"crosshair"}}
            onMouseMove={handleMouseMove} onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp} onDoubleClick={handleDblClick}
            onWheel={handleWheel} onContextMenu={e=>e.preventDefault()}/>
        </div>
      </div>
    </div>
  );
}
