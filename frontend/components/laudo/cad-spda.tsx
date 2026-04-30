"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import {
  METODOS_PROTECAO,
  NIVEIS,
  NP_CONFIG,
  NivelProtecao,
  MetodoProtecao,
  TIPOS_CAPTORES,
  TipoCaptorNormativo,
  anguloProtecao,
  linhasMalhaRetangular,
  numeroMinimoDescidas,
  posicoesDescidasRetangulo,
  raioProtecaoAngulo,
  raioProtecaoEsferaRolante,
  raioProtecaoPorMetodo,
} from "@/lib/spda-norma";
import {
  carregarAnaliseParaDimensionamento,
  salvarRecomendacaoDimensionamento,
  type AnaliseParaDimensionamento,
} from "@/lib/dimensionamento-risco";
import { Box, CheckCircle2, CircleDot, Database, Download, FileUp, Grid3X3, Layers3, Move3D, Plus, Rotate3D, Sparkles, Trash2, Zap } from "lucide-react";

type Vista = "2d" | "3d";

type Captor = {
  id: string;
  nome: string;
  x: number;
  y: number;
  h: number;
  np: NivelProtecao;
  tipo: TipoCaptorNormativo;
  orientacaoGraus: number;
  comprimentoM: number;
};

type ArquivoPlanta = {
  nome: string;
  tamanho: number;
  tipo: string;
  url?: string;
};

type Ponto3D = { x: number; y: number; z: number };
type Ponto2D = { x: number; y: number; depth: number };
type ArrastoCaptor2D = { id: string; modo: "ponto" | "linha-inicio" | "linha-fim"; offsetX: number; offsetY: number };

type Face3D = {
  nome: string;
  pontos: Ponto3D[];
  fill: string;
  stroke?: string;
  opacity?: number;
};

const SCALE_2D = 13;
const TIPOS_CAPTORES_ORDEM: TipoCaptorNormativo[] = ["franklin", "minicaptor", "mastro", "condutor_suspenso", "malha", "natural"];

const captorInicial: Captor[] = [
  { id: "cap-1", nome: "Captor Franklin 01", x: 6, y: 5, h: 6, np: "II", tipo: "franklin", orientacaoGraus: 0, comprimentoM: 8 },
  { id: "cap-2", nome: "Captor Franklin 02", x: 24, y: 13, h: 6, np: "II", tipo: "franklin", orientacaoGraus: 0, comprimentoM: 8 },
];

function criarCaptoresRecomendados(analise: AnaliseParaDimensionamento, np: NivelProtecao): Captor[] {
  const L = Math.max(1, analise.dimensoes.comprimentoM);
  const W = Math.max(1, analise.dimensoes.larguraM);
  const hCaptor = Math.max(2, Math.min(8, (analise.dimensoes.alturaPontaM || analise.dimensoes.alturaM) * 0.25));
  const now = Date.now();
  const baseLine = (id: string, nome: string, x: number, y: number, comprimentoM: number, orientacaoGraus: number): Captor => ({
    id: `${id}-${now}`, nome, x, y, h: 0.25, np, tipo: "malha", orientacaoGraus, comprimentoM,
  });
  const baseMastro = (id: string, nome: string, x: number, y: number): Captor => ({
    id: `${id}-${now}`, nome, x, y, h: hCaptor, np, tipo: analise.metodoSugerido === "angulo" ? "franklin" : "mastro", orientacaoGraus: 0, comprimentoM: 0,
  });

  if (analise.metodoSugerido === "malha") {
    return [
      baseLine("malha-n", "Condutor em malha - periferia norte", 0, 0, L, 0),
      baseLine("malha-s", "Condutor em malha - periferia sul", 0, W, L, 0),
      baseLine("malha-l", "Condutor em malha - periferia leste", L, 0, W, 90),
      baseLine("malha-o", "Condutor em malha - periferia oeste", 0, 0, W, 90),
    ];
  }

  if (analise.metodoSugerido === "combinado") {
    return [
      baseLine("malha-n", "Condutor em malha - periferia norte", 0, 0, L, 0),
      baseLine("malha-s", "Condutor em malha - periferia sul", 0, W, L, 0),
      baseLine("malha-l", "Condutor em malha - periferia leste", L, 0, W, 90),
      baseLine("malha-o", "Condutor em malha - periferia oeste", 0, 0, W, 90),
      baseMastro("mastro-1", "Mastro complementar - canto 01", 0, 0),
      baseMastro("mastro-2", "Mastro complementar - canto 02", L, 0),
      baseMastro("mastro-3", "Mastro complementar - canto 03", L, W),
      baseMastro("mastro-4", "Mastro complementar - canto 04", 0, W),
    ];
  }

  return [
    baseMastro("mastro-1", "Captor/Mastro - canto 01", 0, 0),
    baseMastro("mastro-2", "Captor/Mastro - canto 02", L, 0),
    baseMastro("mastro-3", "Captor/Mastro - canto 03", L, W),
    baseMastro("mastro-4", "Captor/Mastro - canto 04", 0, W),
  ];
}

function toNP(value: string): NivelProtecao {
  return NIVEIS.includes(value as NivelProtecao) ? (value as NivelProtecao) : "II";
}

function toMetodo(value: string): MetodoProtecao {
  return ["angulo", "esfera", "malha", "combinado"].includes(value) ? (value as MetodoProtecao) : "angulo";
}

function toTipoCaptor(value: string): TipoCaptorNormativo {
  return TIPOS_CAPTORES_ORDEM.includes(value as TipoCaptorNormativo) ? (value as TipoCaptorNormativo) : "franklin";
}

function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(d).replace(/\.00$/, "").replace(/(\.[0-9]*?)0+$/, "$1");
}

function fmtSci(n: number | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  return n.toExponential(2).replace("e", " × 10^");
}

function bytesToLabel(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function projectPoint(p: Ponto3D, yawDeg: number, pitchDeg: number, zoom: number, originX: number, originY: number): Ponto2D {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const x1 = p.x * cy - p.y * sy;
  const y1 = p.x * sy + p.y * cy;
  const z1 = p.z;

  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;

  return {
    x: originX + x1 * zoom,
    y: originY + y2 * zoom * 0.38 - z2 * zoom,
    depth: y2,
  };
}

function linhaFinal(c: Captor) {
  const ang = (c.orientacaoGraus * Math.PI) / 180;
  return {
    x2: c.x + Math.cos(ang) * c.comprimentoM,
    y2: c.y + Math.sin(ang) * c.comprimentoM,
  };
}

function tipoUsaPonto(tipo: TipoCaptorNormativo) {
  return TIPOS_CAPTORES[tipo].usaPonto;
}

function tipoUsaLinha(tipo: TipoCaptorNormativo) {
  return TIPOS_CAPTORES[tipo].usaLinha;
}

function raioCaptor(c: Captor, metodoGlobal: MetodoProtecao) {
  if (!tipoUsaPonto(c.tipo)) return null;
  if (metodoGlobal === "malha") return null;
  return raioProtecaoPorMetodo(c.np, c.h, metodoGlobal);
}

export default function CadSPDA() {
  const [vista, setVista] = useState<Vista>("3d");
  const [metodoGlobal, setMetodoGlobal] = useState<MetodoProtecao>("angulo");
  const [npGlobal, setNpGlobal] = useState<NivelProtecao>("II");
  const [comprimento, setComprimento] = useState(30);
  const [largura, setLargura] = useState(18);
  const [alturaEdificacao, setAlturaEdificacao] = useState(12);
  const [alturaPlatibanda, setAlturaPlatibanda] = useState(1.2);
  const [inclinacaoCobertura, setInclinacaoCobertura] = useState(0);
  const [captors, setCaptors] = useState<Captor[]>(captorInicial);
  const [arquivo, setArquivo] = useState<ArquivoPlanta | null>(null);
  const [analiseVinculada, setAnaliseVinculada] = useState<AnaliseParaDimensionamento | null>(null);
  const [origemDimensionamento, setOrigemDimensionamento] = useState<"manual" | "analise-risco">("manual");
  const [recomendacaoSalvaEm, setRecomendacaoSalvaEm] = useState<string | null>(null);
  const [yaw, setYaw] = useState(-38);
  const [pitch, setPitch] = useState(20);
  const [zoom3d, setZoom3d] = useState(10);
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const dragCaptor2DRef = useRef<ArrastoCaptor2D | null>(null);

  useEffect(() => {
    setAnaliseVinculada(carregarAnaliseParaDimensionamento());
  }, []);

  const comprimentoSeguro = Math.max(1, comprimento || 1);
  const larguraSegura = Math.max(1, largura || 1);
  const alturaSegura = Math.max(0, alturaEdificacao || 0);
  const cfg = NP_CONFIG[npGlobal];
  const perimetro = 2 * (comprimentoSeguro + larguraSegura);
  const descidas = numeroMinimoDescidas(npGlobal, comprimentoSeguro, larguraSegura);
  const posDescidas = useMemo(() => posicoesDescidasRetangulo(npGlobal, comprimentoSeguro, larguraSegura), [npGlobal, comprimentoSeguro, larguraSegura]);
  const malha = useMemo(() => linhasMalhaRetangular(npGlobal, comprimentoSeguro, larguraSegura), [npGlobal, comprimentoSeguro, larguraSegura]);

  const svgW = Math.max(760, comprimentoSeguro * SCALE_2D + 140);
  const svgH = Math.max(460, larguraSegura * SCALE_2D + 140);
  const ox = 70;
  const oy = 70;
  const px = (x: number) => ox + x * SCALE_2D;
  const py = (y: number) => oy + y * SCALE_2D;

  function adicionarCaptor(tipo?: TipoCaptorNormativo) {
    const index = captors.length + 1;
    const tipoNovo = tipo || (metodoGlobal === "malha" ? "malha" : "franklin");
    setCaptors((prev) => [
      ...prev,
      {
        id: `cap-${Date.now()}`,
        nome: `${TIPOS_CAPTORES[tipoNovo].titulo} ${String(index).padStart(2, "0")}`,
        x: Math.max(1, Math.min(comprimentoSeguro - 1, comprimentoSeguro / 2)),
        y: Math.max(1, Math.min(larguraSegura - 1, larguraSegura / 2)),
        h: tipoUsaPonto(tipoNovo) ? 5 : 0.5,
        np: npGlobal,
        tipo: tipoNovo,
        orientacaoGraus: 0,
        comprimentoM: tipoUsaLinha(tipoNovo) ? Math.min(10, comprimentoSeguro) : 0,
      },
    ]);
  }

  function atualizarCaptor(id: string, patch: Partial<Captor>) {
    setCaptors((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      next.x = clamp(next.x, 0, comprimentoSeguro);
      next.y = clamp(next.y, 0, larguraSegura);
      next.h = Math.max(0, next.h);
      next.comprimentoM = Math.max(0, next.comprimentoM);
      return next;
    }));
  }

  function excluirCaptor(id: string) {
    setCaptors((prev) => prev.filter((c) => c.id !== id));
  }

  function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop() || "";
    const tipoImagem = file.type.startsWith("image/");
    const aceito = ["dwg", "dxf", "pdf", "png", "jpg", "jpeg", "webp"].includes(ext);
    if (!aceito) {
      e.target.value = "";
      return;
    }
    if (arquivo?.url) URL.revokeObjectURL(arquivo.url);
    setArquivo({
      nome: file.name,
      tamanho: file.size,
      tipo: ext.toUpperCase(),
      url: tipoImagem ? URL.createObjectURL(file) : undefined,
    });
  }

  function removerArquivo() {
    if (arquivo?.url) URL.revokeObjectURL(arquivo.url);
    setArquivo(null);
  }

  function atualizarAnaliseVinculada() {
    setAnaliseVinculada(carregarAnaliseParaDimensionamento());
  }

  function salvarRecomendacaoAtual(origem: "manual" | "analise-risco" = origemDimensionamento) {
    const observacoes: string[] = [
      `Método selecionado: ${METODOS_PROTECAO[metodoGlobal].titulo}.`,
      `Parâmetros normativos: esfera R=${cfg.raioEsferaM} m; malha ${cfg.malhaM[0]} × ${cfg.malhaM[1]} m; descidas a cada ${cfg.distanciaDescidaM} m.`,
    ];
    if (analiseVinculada?.justificativaMetodo) observacoes.push(analiseVinculada.justificativaMetodo);
    if (analiseVinculada?.alertas.length) observacoes.push(...analiseVinculada.alertas);

    const salvoEm = new Date().toISOString();
    salvarRecomendacaoDimensionamento({
      salvoEm,
      origem,
      obra: analiseVinculada?.obra || "Dimensionamento SPDA",
      np: npGlobal,
      metodo: metodoGlobal,
      dimensoes: { comprimentoM: comprimentoSeguro, larguraM: larguraSegura, alturaM: alturaSegura },
      parametrosNormativos: {
        raioEsferaM: cfg.raioEsferaM,
        malhaM: cfg.malhaM,
        distanciaDescidaM: cfg.distanciaDescidaM,
        numeroMinimoDescidas: descidas,
      },
      captores: captors.map((c) => ({
        nome: c.nome, tipo: TIPOS_CAPTORES[c.tipo].titulo, x: c.x, y: c.y, h: c.h, comprimentoM: c.comprimentoM, orientacaoGraus: c.orientacaoGraus,
      })),
      observacoes,
    });
    setRecomendacaoSalvaEm(salvoEm);
  }

  function aplicarAnaliseNoDimensionamento() {
    const analise = analiseVinculada ?? carregarAnaliseParaDimensionamento();
    if (!analise) return;
    const np = analise.npDeclarado ?? npGlobal;
    const captoresRecomendados = criarCaptoresRecomendados(analise, np);
    const cfgNovo = NP_CONFIG[np];
    const L = Math.max(1, analise.dimensoes.comprimentoM);
    const W = Math.max(1, analise.dimensoes.larguraM);
    const H = Math.max(0, analise.dimensoes.alturaM);
    const descidasNovo = numeroMinimoDescidas(np, L, W);
    const salvoEm = new Date().toISOString();

    setAnaliseVinculada(analise);
    setComprimento(L);
    setLargura(W);
    setAlturaEdificacao(H);
    if (analise.dimensoes.alturaPontaM > 0) setAlturaPlatibanda(Math.max(0, analise.dimensoes.alturaPontaM - H));
    setNpGlobal(np);
    setMetodoGlobal(analise.metodoSugerido);
    setCaptors(captoresRecomendados);
    setOrigemDimensionamento("analise-risco");
    setVista("3d");
    salvarRecomendacaoDimensionamento({
      salvoEm,
      origem: "analise-risco",
      obra: analise.obra,
      np,
      metodo: analise.metodoSugerido,
      dimensoes: { comprimentoM: L, larguraM: W, alturaM: H },
      parametrosNormativos: {
        raioEsferaM: cfgNovo.raioEsferaM,
        malhaM: cfgNovo.malhaM,
        distanciaDescidaM: cfgNovo.distanciaDescidaM,
        numeroMinimoDescidas: descidasNovo,
      },
      captores: captoresRecomendados.map((c) => ({
        nome: c.nome, tipo: TIPOS_CAPTORES[c.tipo].titulo, x: c.x, y: c.y, h: c.h, comprimentoM: c.comprimentoM, orientacaoGraus: c.orientacaoGraus,
      })),
      observacoes: [analise.justificativaMetodo, ...analise.alertas],
    });
    setRecomendacaoSalvaEm(salvoEm);
  }

  function exportarSVG() {
    const svg = document.getElementById("spda-designer-svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dimensionamento-spda-${vista}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pontoEventoParaModelo2D(e: PointerEvent<SVGElement>, svgEl?: SVGSVGElement | null) {
    const svg = svgEl || e.currentTarget.ownerSVGElement;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const svgX = (e.clientX - rect.left) * (svgW / rect.width);
    const svgY = (e.clientY - rect.top) * (svgH / rect.height);
    return {
      x: clamp((svgX - ox) / SCALE_2D, 0, comprimentoSeguro),
      y: clamp((svgY - oy) / SCALE_2D, 0, larguraSegura),
    };
  }

  function iniciarArrastoCaptor2D(e: PointerEvent<SVGElement>, id: string, modo: ArrastoCaptor2D["modo"]) {
    if (vista !== "2d") return;
    e.preventDefault();
    e.stopPropagation();
    const p = pontoEventoParaModelo2D(e);
    const captor = captors.find((c) => c.id === id);
    if (!p || !captor) return;
    dragCaptor2DRef.current = {
      id,
      modo,
      offsetX: modo === "linha-fim" ? 0 : p.x - captor.x,
      offsetY: modo === "linha-fim" ? 0 : p.y - captor.y,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Alguns elementos SVG podem não manter captura em todos os navegadores.
    }
  }

  function moverCaptor2D(e: PointerEvent<SVGSVGElement>) {
    const drag = dragCaptor2DRef.current;
    if (!drag) return false;
    e.preventDefault();
    const p = pontoEventoParaModelo2D(e, e.currentTarget);
    if (!p) return true;

    const captor = captors.find((c) => c.id === drag.id);
    if (!captor) return true;

    if (drag.modo === "linha-fim") {
      const dx = p.x - captor.x;
      const dy = p.y - captor.y;
      const comprimentoLinha = Math.sqrt(dx * dx + dy * dy);
      const orientacao = (Math.atan2(dy, dx) * 180) / Math.PI;
      atualizarCaptor(drag.id, {
        comprimentoM: comprimentoLinha,
        orientacaoGraus: Number.isFinite(orientacao) ? orientacao : captor.orientacaoGraus,
      });
      return true;
    }

    atualizarCaptor(drag.id, {
      x: p.x - drag.offsetX,
      y: p.y - drag.offsetY,
    });
    return true;
  }

  function pointerDown(e: PointerEvent<SVGSVGElement>) {
    if (vista !== "3d") return;
    dragRef.current = { x: e.clientX, y: e.clientY, yaw, pitch };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function pointerMove(e: PointerEvent<SVGSVGElement>) {
    if (moverCaptor2D(e)) return;
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setYaw(drag.yaw + dx * 0.35);
    setPitch(clamp(drag.pitch - dy * 0.25, -5, 62));
  }

  function pointerUp(e: PointerEvent<SVGSVGElement>) {
    dragCaptor2DRef.current = null;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // O ponteiro pode já ter sido liberado pelo navegador.
    }
  }

  const areaEdificacao = comprimentoSeguro * larguraSegura;
  const totalCoberto = captors.reduce((acc, c) => {
    const r = raioCaptor(c, metodoGlobal);
    return acc + (r ? Math.PI * r * r : 0);
  }, 0);
  const metodoInfo = METODOS_PROTECAO[metodoGlobal];
  const usarMalha = metodoGlobal === "malha" || metodoGlobal === "combinado" || captors.some((c) => c.tipo === "malha");
  const usarCaptoresPonto = metodoGlobal !== "malha" && captors.some((c) => tipoUsaPonto(c.tipo));

  function render3D() {
    const originX = svgW / 2;
    const originY = 365;
    const topZ = alturaSegura + Math.max(0, alturaPlatibanda);
    const roofDelta = Math.tan((Math.max(0, inclinacaoCobertura) * Math.PI) / 180) * (larguraSegura / 2);
    const zLeft = topZ + roofDelta;
    const zRight = topZ - roofDelta;
    const zRoofAt = (y: number) => topZ + (0.5 - y / larguraSegura) * 2 * roofDelta;
    const P = (p: Ponto3D) => projectPoint(p, yaw, pitch, zoom3d, originX, originY);

    const faces: Face3D[] = [
      { nome: "piso", pontos: [{ x: 0, y: 0, z: 0 }, { x: comprimentoSeguro, y: 0, z: 0 }, { x: comprimentoSeguro, y: larguraSegura, z: 0 }, { x: 0, y: larguraSegura, z: 0 }], fill: "rgba(15,23,42,0.08)", opacity: 0.9 },
      { nome: "frente", pontos: [{ x: 0, y: 0, z: 0 }, { x: comprimentoSeguro, y: 0, z: 0 }, { x: comprimentoSeguro, y: 0, z: zLeft }, { x: 0, y: 0, z: zLeft }], fill: "rgba(59,130,246,0.12)" },
      { nome: "direita", pontos: [{ x: comprimentoSeguro, y: 0, z: 0 }, { x: comprimentoSeguro, y: larguraSegura, z: 0 }, { x: comprimentoSeguro, y: larguraSegura, z: zRight }, { x: comprimentoSeguro, y: 0, z: zLeft }], fill: "rgba(37,99,235,0.09)" },
      { nome: "fundo", pontos: [{ x: comprimentoSeguro, y: larguraSegura, z: 0 }, { x: 0, y: larguraSegura, z: 0 }, { x: 0, y: larguraSegura, z: zRight }, { x: comprimentoSeguro, y: larguraSegura, z: zRight }], fill: "rgba(30,64,175,0.08)" },
      { nome: "esquerda", pontos: [{ x: 0, y: larguraSegura, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: zLeft }, { x: 0, y: larguraSegura, z: zRight }], fill: "rgba(96,165,250,0.08)" },
      { nome: "cobertura", pontos: [{ x: 0, y: 0, z: zLeft }, { x: comprimentoSeguro, y: 0, z: zLeft }, { x: comprimentoSeguro, y: larguraSegura, z: zRight }, { x: 0, y: larguraSegura, z: zRight }], fill: "rgba(59,130,246,0.18)", stroke: cfg.cor },
    ];

    const facesOrdenadas = faces
      .map((face) => ({ ...face, depth: face.pontos.reduce((acc, p) => acc + P(p).depth, 0) / face.pontos.length }))
      .sort((a, b) => a.depth - b.depth);

    return (
      <svg
        id="spda-designer-svg"
        width={svgW}
        height={620}
        className="block min-w-full cursor-grab active:cursor-grabbing select-none"
        role="img"
        aria-label="Visualização 3D interativa do SPDA"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <defs>
          <radialGradient id="sphere-protection" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor={cfg.cor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={cfg.cor} stopOpacity="0.02" />
          </radialGradient>
          <linearGradient id="roof-grad" x1="0" x2="1">
            <stop offset="0" stopColor={cfg.cor} stopOpacity="0.20" />
            <stop offset="1" stopColor={cfg.cor} stopOpacity="0.07" />
          </linearGradient>
        </defs>
        <rect width={svgW} height={620} rx={18} fill="rgba(15,23,42,0.02)" />
        {facesOrdenadas.map((face) => {
          const pts = face.pontos.map(P).map((p) => `${p.x},${p.y}`).join(" ");
          return <polygon key={face.nome} points={pts} fill={face.nome === "cobertura" ? "url(#roof-grad)" : face.fill} opacity={face.opacity ?? 1} stroke={face.stroke || "currentColor"} strokeOpacity={face.stroke ? 0.65 : 0.12} strokeWidth={face.nome === "cobertura" ? 2 : 1} />;
        })}

        {usarMalha && malha.linhasX.map((xv) => {
          const a = P({ x: xv, y: 0, z: zRoofAt(0) + 0.05 });
          const b = P({ x: xv, y: larguraSegura, z: zRoofAt(larguraSegura) + 0.05 });
          return <line key={`3dmx-${xv}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={cfg.cor} strokeOpacity="0.55" strokeWidth={1.4} />;
        })}
        {usarMalha && malha.linhasY.map((yv) => {
          const a = P({ x: 0, y: yv, z: zRoofAt(yv) + 0.05 });
          const b = P({ x: comprimentoSeguro, y: yv, z: zRoofAt(yv) + 0.05 });
          return <line key={`3dmy-${yv}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={cfg.cor} strokeOpacity="0.55" strokeWidth={1.4} />;
        })}

        {posDescidas.map((p, index) => {
          const top = P({ x: p.x, y: p.y, z: zRoofAt(p.y) });
          const base = P({ x: p.x, y: p.y, z: 0 });
          return (
            <g key={`3dd-${index}`}>
              <line x1={top.x} y1={top.y} x2={base.x} y2={base.y} stroke={cfg.cor} strokeOpacity="0.78" strokeWidth={2.2} />
              <circle cx={top.x} cy={top.y} r={4} fill={cfg.cor} />
              <text x={top.x + 6} y={top.y - 6} fontSize={10} fill={cfg.cor} fontWeight={700}>D{index + 1}</text>
            </g>
          );
        })}

        {captors.map((c) => {
          const color = NP_CONFIG[c.np].cor;
          const zBase = zRoofAt(c.y) + 0.1;
          const base = P({ x: c.x, y: c.y, z: zBase });
          const tip = P({ x: c.x, y: c.y, z: zBase + c.h });
          const r = raioCaptor(c, metodoGlobal) || 0;
          const rSvg = Math.max(12, r * zoom3d * 0.75);
          const finalLinha = linhaFinal(c);
          const lineEnd = P({ x: finalLinha.x2, y: finalLinha.y2, z: zRoofAt(clamp(finalLinha.y2, 0, larguraSegura)) + 0.18 });

          if (tipoUsaLinha(c.tipo)) {
            return (
              <g key={c.id}>
                <line x1={base.x} y1={base.y} x2={lineEnd.x} y2={lineEnd.y} stroke={color} strokeWidth={3} strokeLinecap="round" />
                <circle cx={base.x} cy={base.y} r={4} fill={color} />
                <circle cx={lineEnd.x} cy={lineEnd.y} r={4} fill={color} />
                <text x={base.x + 8} y={base.y - 8} fontSize={11} fontWeight={700} fill={color}>{c.nome}</text>
              </g>
            );
          }

          return (
            <g key={c.id}>
              {metodoGlobal === "esfera" || metodoGlobal === "combinado" ? (
                <ellipse cx={base.x} cy={base.y} rx={rSvg} ry={rSvg * 0.42} fill="url(#sphere-protection)" stroke={color} strokeOpacity="0.35" strokeDasharray="8 5" />
              ) : null}
              {metodoGlobal === "angulo" || metodoGlobal === "combinado" ? (
                <path d={`M ${tip.x},${tip.y} L ${base.x - rSvg},${base.y} M ${tip.x},${tip.y} L ${base.x + rSvg},${base.y}`} stroke={color} strokeOpacity="0.58" strokeWidth={1.5} strokeDasharray="5 5" />
              ) : null}
              <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={3.5} strokeLinecap="round" />
              <circle cx={tip.x} cy={tip.y} r={5.5} fill={color} stroke="#fff" strokeWidth={1.5} />
              <text x={tip.x + 8} y={tip.y - 7} fontSize={11} fontWeight={700} fill={color}>{c.nome}</text>
            </g>
          );
        })}

        <g>
          <text x={24} y={30} fontSize={12} fill="currentColor" opacity="0.78">3D interativo: arraste para girar. Yaw {Math.round(yaw)}° · Pitch {Math.round(pitch)}° · Zoom {fmt(zoom3d, 1)}.</text>
          <text x={24} y={50} fontSize={11} fill="currentColor" opacity="0.62">Método: {metodoInfo.titulo} · NP {npGlobal} · Edificação {fmt(comprimentoSeguro)} × {fmt(larguraSegura)} × {fmt(alturaSegura)} m</text>
        </g>
      </svg>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="w-4 h-4 text-primary" /> Designer SPDA 2D / 3D
            </CardTitle>
            <CardDescription>
              Ambiente para dimensionar o local, escolher método de proteção, posicionar captores e visualizar a solução em 2D e 3D com parâmetros da ABNT NBR 5419-3:2026.
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant={vista === "2d" ? "primary" : "outline"} size="sm" onClick={() => setVista("2d")}>2D</Button>
            <Button type="button" variant={vista === "3d" ? "primary" : "outline"} size="sm" onClick={() => setVista("3d")}>3D giratório</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => inputFileRef.current?.click()}>
              <FileUp className="w-4 h-4" /> DWG / DXF
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportarSVG}>
              <Download className="w-4 h-4" /> Exportar SVG
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <input ref={inputFileRef} type="file" accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={onUpload} />

        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Definir dimensionamento a partir da análise de risco</h3>
                {origemDimensionamento === "analise-risco" && <Badge variant="primary">Aplicado</Badge>}
              </div>
              <p className="text-xs text-foreground-muted max-w-4xl">
                Use os dados salvos da aba Análise de Risco para trazer dimensões da estrutura, NP declarado no campo PB e um ponto de partida para o método de captação. A análise indica a necessidade e o nível/medidas; o detalhamento geométrico continua sendo validado nesta aba.
              </p>
              {analiseVinculada ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg border border-border bg-background p-2"><span className="text-foreground-muted">Projeto</span><b className="block text-foreground truncate">{analiseVinculada.obra}</b></div>
                  <div className="rounded-lg border border-border bg-background p-2"><span className="text-foreground-muted">Dimensões</span><b className="block text-foreground">{fmt(analiseVinculada.dimensoes.comprimentoM)} × {fmt(analiseVinculada.dimensoes.larguraM)} × {fmt(analiseVinculada.dimensoes.alturaM)} m</b></div>
                  <div className="rounded-lg border border-border bg-background p-2"><span className="text-foreground-muted">NP da análise</span><b className="block text-foreground">{analiseVinculada.npDeclarado ? `NP ${analiseVinculada.npDeclarado}` : "Não definido"}</b></div>
                  <div className="rounded-lg border border-border bg-background p-2"><span className="text-foreground-muted">Método sugerido</span><b className="block text-foreground">{METODOS_PROTECAO[analiseVinculada.metodoSugerido].titulo}</b></div>
                  <div className="rounded-lg border border-border bg-background p-2"><span className="text-foreground-muted">R1</span><b className="block text-foreground font-mono">{fmtSci(analiseVinculada.valores?.R1)}</b></div>
                  <div className="rounded-lg border border-border bg-background p-2"><span className="text-foreground-muted">R3</span><b className="block text-foreground font-mono">{fmtSci(analiseVinculada.valores?.R3)}</b></div>
                  <div className="rounded-lg border border-border bg-background p-2"><span className="text-foreground-muted">F</span><b className="block text-foreground font-mono">{fmtSci(analiseVinculada.valores?.F)}</b></div>
                  <div className="rounded-lg border border-border bg-background p-2"><span className="text-foreground-muted">Conformidade</span><b className="block text-foreground">{analiseVinculada.valores?.conforme === undefined ? "—" : analiseVinculada.valores.conforme ? "Conforme" : "Não conforme"}</b></div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
                  Nenhuma análise de risco salva foi encontrada. Abra a aba Análise de Risco, carregue/calculue o cenário e volte para aplicar os dados no dimensionamento.
                </div>
              )}
              {analiseVinculada?.alertas.length ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
                  {analiseVinculada.alertas.map((a) => <div key={a}>• {a}</div>)}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={atualizarAnaliseVinculada}>
                <Database className="w-4 h-4" /> Atualizar análise
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={aplicarAnaliseNoDimensionamento} disabled={!analiseVinculada}>
                <Sparkles className="w-4 h-4" /> Aplicar no dimensionamento
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => salvarRecomendacaoAtual()}>
                <CheckCircle2 className="w-4 h-4" /> Salvar recomendação
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
              <div className="font-semibold text-sm text-foreground">Método e nível de proteção</div>
              <div>
                <Label>Método de proteção</Label>
                <select value={metodoGlobal} onChange={(e) => setMetodoGlobal(toMetodo(e.target.value))} className="flex h-10 w-full rounded-lg border border-input bg-background-alt px-3 text-sm text-foreground">
                  {(Object.keys(METODOS_PROTECAO) as MetodoProtecao[]).map((metodo) => (
                    <option key={metodo} value={metodo}>{METODOS_PROTECAO[metodo].titulo}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-foreground-muted">{metodoInfo.subtitulo}</p>
              </div>
              <div>
                <Label>NP do projeto</Label>
                <div className="grid grid-cols-4 gap-1 mt-2">
                  {NIVEIS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNpGlobal(n)}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-bold ${npGlobal === n ? "text-white border-transparent" : "border-border text-foreground-muted"}`}
                      style={npGlobal === n ? { background: NP_CONFIG[n].cor } : undefined}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="text-foreground-muted">Esfera rolante</div>
                  <div className="text-lg font-bold text-primary">R = {cfg.raioEsferaM} m</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="text-foreground-muted">Malha máxima</div>
                  <div className="text-lg font-bold text-primary">{cfg.malhaM[0]} × {cfg.malhaM[1]} m</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
              <div className="font-semibold text-sm text-foreground">Dimensões do local de instalação</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Comprimento (m)</Label>
                  <Input type="number" min={1} value={comprimento} onChange={(e) => setComprimento(Number(e.target.value) || 1)} />
                </div>
                <div>
                  <Label>Largura (m)</Label>
                  <Input type="number" min={1} value={largura} onChange={(e) => setLargura(Number(e.target.value) || 1)} />
                </div>
                <div>
                  <Label>Altura da edificação (m)</Label>
                  <Input type="number" min={0} value={alturaEdificacao} onChange={(e) => setAlturaEdificacao(Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Platibanda / base (m)</Label>
                  <Input type="number" min={0} step="0.1" value={alturaPlatibanda} onChange={(e) => setAlturaPlatibanda(Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Inclinação cobertura (°)</Label>
                  <Input type="number" min={0} max={45} value={inclinacaoCobertura} onChange={(e) => setInclinacaoCobertura(clamp(Number(e.target.value) || 0, 0, 45))} />
                </div>
                <div>
                  <Label>Perímetro (m)</Label>
                  <Input readOnly value={fmt(perimetro)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="text-foreground-muted">Área de cobertura</div>
                  <div className="text-lg font-bold text-primary">{fmt(areaEdificacao, 1)} m²</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="text-foreground-muted">Descidas mínimas</div>
                  <div className="text-lg font-bold text-primary">{descidas}</div>
                </div>
              </div>
            </div>

            {vista === "3d" && (
              <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-sm text-foreground"><Rotate3D className="w-4 h-4 text-primary" /> Controle 3D</div>
                <div>
                  <Label>Giro horizontal</Label>
                  <Input type="range" min={-180} max={180} value={yaw} onChange={(e) => setYaw(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Inclinação da câmera</Label>
                  <Input type="range" min={-5} max={62} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Zoom 3D</Label>
                  <Input type="range" min={5} max={18} step={0.5} value={zoom3d} onChange={(e) => setZoom3d(Number(e.target.value))} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => { setYaw(-38); setPitch(20); setZoom3d(10); }}>
                  <Move3D className="w-4 h-4" /> Resetar visualização
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm text-foreground">Para-raios / captores</div>
                <Button type="button" size="sm" onClick={() => adicionarCaptor()}>
                  <Plus className="w-4 h-4" /> Adicionar
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => adicionarCaptor("franklin")}>Franklin</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => adicionarCaptor("mastro")}>Mastro</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => adicionarCaptor("condutor_suspenso")}>Condutor</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => adicionarCaptor("malha")}>Malha</Button>
              </div>
              <div className="space-y-3 max-h-[620px] overflow-auto pr-1">
                {captors.map((c, idx) => {
                  const ang = anguloProtecao(c.np, c.h);
                  const rAng = raioProtecaoAngulo(c.np, c.h);
                  const rEsf = raioProtecaoEsferaRolante(c.np, c.h);
                  const usaPonto = tipoUsaPonto(c.tipo);
                  const usaLinha = tipoUsaLinha(c.tipo);
                  return (
                    <div key={c.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Input value={c.nome} onChange={(e) => atualizarCaptor(c.id, { nome: e.target.value })} className="h-8 text-xs font-semibold" />
                        <button type="button" onClick={() => excluirCaptor(c.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10" aria-label="Excluir captor">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Tipo</Label>
                          <select value={c.tipo} onChange={(e) => atualizarCaptor(c.id, { tipo: toTipoCaptor(e.target.value) })} className="flex h-9 w-full rounded border border-input bg-background-secondary px-2 text-xs text-foreground">
                            {TIPOS_CAPTORES_ORDEM.map((tipo) => <option key={tipo} value={tipo}>{TIPOS_CAPTORES[tipo].titulo}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label>NP</Label>
                          <select value={c.np} onChange={(e) => atualizarCaptor(c.id, { np: toNP(e.target.value) })} className="flex h-9 w-full rounded border border-input bg-background-secondary px-2 text-xs text-foreground">
                            {NIVEIS.map((n) => <option key={n} value={n}>NP {n}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label>X (m)</Label>
                          <Input type="number" value={c.x} min={0} max={comprimentoSeguro} onChange={(e) => atualizarCaptor(c.id, { x: Number(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <Label>Y (m)</Label>
                          <Input type="number" value={c.y} min={0} max={larguraSegura} onChange={(e) => atualizarCaptor(c.id, { y: Number(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <Label>{usaPonto ? "H captor (m)" : "Elevação (m)"}</Label>
                          <Input type="number" value={c.h} min={0} step="0.1" onChange={(e) => atualizarCaptor(c.id, { h: Number(e.target.value) || 0 })} />
                        </div>
                      </div>
                      {usaLinha && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Comprimento linha (m)</Label>
                            <Input type="number" value={c.comprimentoM} min={0} onChange={(e) => atualizarCaptor(c.id, { comprimentoM: Number(e.target.value) || 0 })} />
                          </div>
                          <div>
                            <Label>Orientação (°)</Label>
                            <Input type="number" value={c.orientacaoGraus} onChange={(e) => atualizarCaptor(c.id, { orientacaoGraus: Number(e.target.value) || 0 })} />
                          </div>
                        </div>
                      )}
                      <div className="rounded-lg border border-border bg-background-secondary p-2 text-[11px] text-foreground-muted">
                        <div className="font-medium text-foreground mb-1">{TIPOS_CAPTORES[c.tipo].descricao}</div>
                        {usaPonto ? (
                          <>
                            <div className="flex justify-between"><span>α Figura 1</span><b>{ang.aplicavel && ang.anguloGraus !== null ? `${ang.anguloGraus.toFixed(1)}°` : "N/A"}</b></div>
                            <div className="flex justify-between"><span>Raio pelo ângulo</span><b>{rAng !== null ? `${rAng.toFixed(2)} m` : "N/A"}</b></div>
                            <div className="flex justify-between"><span>Raio pela esfera</span><b>{rEsf !== null ? `${rEsf.toFixed(2)} m` : "H > R"}</b></div>
                            {!ang.aplicavel && <div className="mt-1 text-amber-600">Acima da curva do NP {c.np}: usar esfera rolante ou malhas.</div>}
                          </>
                        ) : (
                          <div className="flex justify-between"><span>Representação</span><b>condutor linear</b></div>
                        )}
                      </div>
                      <Badge variant="outline">#{idx + 1}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            {arquivo && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="font-semibold text-primary">Arquivo de planta vinculado: {arquivo.nome}</div>
                  <div className="text-xs text-foreground-muted">
                    Tipo {arquivo.tipo} · {bytesToLabel(arquivo.tamanho)}. DWG/DXF ficam anexados como referência; imagens são sobrepostas na vista 2D. Conversão CAD editável exige etapa própria DWG/DXF → SVG/imagem.
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={removerArquivo}>Remover arquivo</Button>
              </div>
            )}

            {vista === "2d" && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground-muted">
                Na vista 2D, arraste o círculo do captor/mastro para reposicionar. Para condutores em linha, arraste a extremidade inicial para mover ou a extremidade final para alterar comprimento e orientação.
              </div>
            )}

            <div className="rounded-2xl border border-border bg-background-secondary p-3 overflow-auto">
              {vista === "2d" ? (
                <svg
                  id="spda-designer-svg"
                  width={svgW}
                  height={svgH}
                  className="block min-w-full touch-none select-none"
                  role="img"
                  aria-label="Planta 2D do SPDA"
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={pointerUp}
                >
                  <defs>
                    <pattern id="small-grid" width={SCALE_2D} height={SCALE_2D} patternUnits="userSpaceOnUse">
                      <path d={`M ${SCALE_2D} 0 L 0 0 0 ${SCALE_2D}`} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.7" />
                    </pattern>
                  </defs>
                  <rect width={svgW} height={svgH} fill="transparent" />
                  <rect x={0} y={0} width={svgW} height={svgH} fill="url(#small-grid)" />
                  {arquivo?.url && <image href={arquivo.url} x={ox} y={oy} width={comprimentoSeguro * SCALE_2D} height={larguraSegura * SCALE_2D} opacity="0.38" preserveAspectRatio="none" />}
                  <rect x={px(0)} y={py(0)} width={comprimentoSeguro * SCALE_2D} height={larguraSegura * SCALE_2D} fill="rgba(59,130,246,0.05)" stroke="currentColor" strokeOpacity="0.35" strokeWidth={2} />

                  {usarMalha && malha.linhasX.map((xv) => <line key={`mx-${xv}`} x1={px(xv)} y1={py(0)} x2={px(xv)} y2={py(larguraSegura)} stroke={cfg.cor} strokeOpacity="0.48" strokeWidth={1.4} />)}
                  {usarMalha && malha.linhasY.map((yv) => <line key={`my-${yv}`} x1={px(0)} y1={py(yv)} x2={px(comprimentoSeguro)} y2={py(yv)} stroke={cfg.cor} strokeOpacity="0.48" strokeWidth={1.4} />)}

                  {posDescidas.map((p, index) => (
                    <g key={`d-${index}`}>
                      <circle cx={px(p.x)} cy={py(p.y)} r={5} fill={cfg.cor} />
                      <text x={px(p.x) + 7} y={py(p.y) - 7} fontSize={10} fill={cfg.cor} fontWeight={700}>D{index + 1}</text>
                    </g>
                  ))}

                  {captors.map((c) => {
                    const color = NP_CONFIG[c.np].cor;
                    const r = raioCaptor(c, metodoGlobal);
                    const finalLinha = linhaFinal(c);
                    const x2 = clamp(finalLinha.x2, 0, comprimentoSeguro);
                    const y2 = clamp(finalLinha.y2, 0, larguraSegura);

                    if (tipoUsaLinha(c.tipo)) {
                      return (
                        <g key={c.id}>
                          <line x1={px(c.x)} y1={py(c.y)} x2={px(x2)} y2={py(y2)} stroke={color} strokeWidth={3} strokeLinecap="round" />
                          <circle
                            cx={px(c.x)}
                            cy={py(c.y)}
                            r={7}
                            fill={color}
                            stroke="#fff"
                            strokeWidth={1.5}
                            className="cursor-grab active:cursor-grabbing"
                            onPointerDown={(e) => iniciarArrastoCaptor2D(e, c.id, "linha-inicio")}
                          />
                          <circle
                            cx={px(x2)}
                            cy={py(y2)}
                            r={7}
                            fill={color}
                            stroke="#fff"
                            strokeWidth={1.5}
                            className="cursor-crosshair"
                            onPointerDown={(e) => iniciarArrastoCaptor2D(e, c.id, "linha-fim")}
                          />
                          <text x={px(c.x) + 9} y={py(c.y) - 8} fontSize={11} fill={color} fontWeight={700}>{c.nome}</text>
                        </g>
                      );
                    }

                    return (
                      <g key={c.id}>
                        {r !== null && <circle cx={px(c.x)} cy={py(c.y)} r={r * SCALE_2D} fill={color} opacity="0.08" stroke={color} strokeOpacity="0.65" strokeWidth={1.5} strokeDasharray="8 5" />}
                        <line x1={px(c.x)} y1={py(c.y)} x2={px(c.x)} y2={py(c.y) - Math.min(54, c.h * 5)} stroke={color} strokeWidth={3} />
                        <circle
                          cx={px(c.x)}
                          cy={py(c.y)}
                          r={8}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={2}
                          className="cursor-grab active:cursor-grabbing"
                          onPointerDown={(e) => iniciarArrastoCaptor2D(e, c.id, "ponto")}
                        />
                        <Zap x={px(c.x) - 8} y={py(c.y) - Math.min(68, c.h * 5 + 18)} width={16} height={16} color={color} pointerEvents="none" />
                        <text x={px(c.x) + 9} y={py(c.y) + 4} fontSize={11} fill={color} fontWeight={700}>{c.nome}</text>
                      </g>
                    );
                  })}

                  <text x={ox} y={svgH - 24} fontSize={11} fill="currentColor" opacity="0.7">
                    Planta {fmt(comprimentoSeguro)} × {fmt(larguraSegura)} m · NP {npGlobal} · {metodoInfo.titulo} · Malha {cfg.malhaM[0]} × {cfg.malhaM[1]} m · Descidas mínimas: {descidas}
                  </text>
                </svg>
              ) : render3D()}
            </div>

            <div className="rounded-2xl border border-primary/25 bg-background-secondary p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Sparkles className="w-4 h-4 text-primary" /> Recomendação do dimensionamento
                  </div>
                  <p className="text-xs text-foreground-muted mt-1">
                    Dados técnicos para levar ao memorial/laudo do dimensionamento. Quando aplicado pela análise de risco, estes campos partem do NP e das dimensões informadas na análise.
                  </p>
                </div>
                {recomendacaoSalvaEm && <Badge variant="outline">Salvo {new Date(recomendacaoSalvaEm).toLocaleString("pt-BR")}</Badge>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                <div className="rounded-lg border border-border bg-background p-3"><span className="text-foreground-muted">Origem</span><b className="block text-foreground">{origemDimensionamento === "analise-risco" ? "Análise de risco" : "Manual"}</b></div>
                <div className="rounded-lg border border-border bg-background p-3"><span className="text-foreground-muted">NP adotado</span><b className="block text-foreground">NP {npGlobal}</b></div>
                <div className="rounded-lg border border-border bg-background p-3"><span className="text-foreground-muted">Método</span><b className="block text-foreground">{metodoInfo.titulo}</b></div>
                <div className="rounded-lg border border-border bg-background p-3"><span className="text-foreground-muted">Descidas mínimas</span><b className="block text-foreground">{descidas}</b></div>
                <div className="rounded-lg border border-border bg-background p-3"><span className="text-foreground-muted">Esfera rolante</span><b className="block text-foreground">R = {cfg.raioEsferaM} m</b></div>
                <div className="rounded-lg border border-border bg-background p-3"><span className="text-foreground-muted">Malha máxima</span><b className="block text-foreground">{cfg.malhaM[0]} × {cfg.malhaM[1]} m</b></div>
                <div className="rounded-lg border border-border bg-background p-3"><span className="text-foreground-muted">Espaçamento descidas</span><b className="block text-foreground">{cfg.distanciaDescidaM} m</b></div>
                <div className="rounded-lg border border-border bg-background p-3"><span className="text-foreground-muted">Captores/condutores</span><b className="block text-foreground">{captors.length}</b></div>
              </div>
              {analiseVinculada?.justificativaMetodo && (
                <div className="mt-3 rounded-lg border border-border bg-background p-3 text-xs text-foreground-muted">
                  <b className="text-foreground">Justificativa:</b> {analiseVinculada.justificativaMetodo}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-border bg-background-secondary p-3">
                <div className="flex items-center gap-2 font-semibold text-foreground"><Grid3X3 className="w-4 h-4 text-primary" /> Malha / gaiola</div>
                <p className="text-foreground-muted mt-1">Módulo máximo: {cfg.malhaM[0]} × {cfg.malhaM[1]} m. A visualização destaca periferia, cobertura e descidas distribuídas.</p>
              </div>
              <div className="rounded-xl border border-border bg-background-secondary p-3">
                <div className="flex items-center gap-2 font-semibold text-foreground"><CircleDot className="w-4 h-4 text-primary" /> Área estimada</div>
                <p className="text-foreground-muted mt-1">Soma geométrica dos raios de captores pontuais, sem descontar sobreposições: {fmt(totalCoberto, 1)} m².</p>
              </div>
              <div className="rounded-xl border border-border bg-background-secondary p-3">
                <div className="flex items-center gap-2 font-semibold text-foreground"><Box className="w-4 h-4 text-primary" /> Planta DWG/DXF</div>
                <p className="text-foreground-muted mt-1">O upload aceita DWG/DXF como anexo de referência. Para editar entidades CAD dentro do navegador, será necessária uma conversão posterior.</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              A ferramenta é uma visualização de projeto e conferência geométrica. O enquadramento final deve considerar a análise de risco, os métodos normativos aplicáveis, componentes reais instalados, distâncias de segurança e verificação técnica em campo.
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
