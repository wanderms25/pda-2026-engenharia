import { MetodoProtecao, NivelProtecao, NP_CONFIG } from "@/lib/spda-norma";

export const ANALISE_RISCO_STORAGE_KEY = "pda_analise_risco_v1";
export const ANALISE_RISCO_RESULT_STORAGE_KEY = "pda_analise_risco_v1_resultado";
export const DIMENSIONAMENTO_RECOMENDACAO_STORAGE_KEY = "pda_dimensionamento_recomendacao_v1";

export type AnaliseParaDimensionamento = {
  origem: "analise-risco";
  carregadaEm: string;
  obra: string;
  nomeAnalise: string;
  responsavel: string;
  art: string;
  endereco: string;
  dimensoes: {
    comprimentoM: number;
    larguraM: number;
    alturaM: number;
    alturaPontaM: number;
  };
  pb: string;
  spdaDeclarado: boolean;
  npDeclarado: NivelProtecao | null;
  metodoSugerido: MetodoProtecao;
  justificativaMetodo: string;
  coberturaMetalicaNatural: boolean;
  valores?: {
    R1?: number;
    R3?: number;
    R4?: number;
    F?: number;
    conforme?: boolean;
    fAtende?: boolean;
  };
  alertas: string[];
};

export type RecomendacaoDimensionamentoSalva = {
  salvoEm: string;
  origem: "manual" | "analise-risco";
  obra: string;
  np: NivelProtecao;
  metodo: MetodoProtecao;
  dimensoes: {
    comprimentoM: number;
    larguraM: number;
    alturaM: number;
  };
  parametrosNormativos: {
    raioEsferaM: number;
    malhaM: [number, number];
    distanciaDescidaM: number;
    numeroMinimoDescidas: number;
  };
  captores: Array<{
    nome: string;
    tipo: string;
    x: number;
    y: number;
    h: number;
    comprimentoM?: number;
    orientacaoGraus?: number;
  }>;
  observacoes: string[];
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : undefined;
}

function isNP(value: unknown): value is NivelProtecao {
  return value === "I" || value === "II" || value === "III" || value === "IV";
}

export function extrairNPDoPB(pb: unknown): NivelProtecao | null {
  const nivel = String(pb ?? "").split(":")[0];
  return isNP(nivel) ? nivel : null;
}

export function selecionarMetodoPorAnalise(params: {
  np: NivelProtecao | null;
  alturaM: number;
  comprimentoM: number;
  larguraM: number;
  coberturaMetalicaNatural: boolean;
}): { metodo: MetodoProtecao; justificativa: string } {
  const np = params.np ?? "II";
  const h = Math.max(0, params.alturaM);
  const l = Math.max(0, params.comprimentoM);
  const w = Math.max(0, params.larguraM);
  const area = l * w;

  if (params.coberturaMetalicaNatural) {
    return {
      metodo: "malha",
      justificativa: "A análise indicou cobertura metálica/captação natural; o dimensionamento inicia pelo método das malhas, mantendo o projetista responsável pela verificação da continuidade e demais requisitos de instalação.",
    };
  }

  if (params.np && h > NP_CONFIG[np].hMaxAnguloM) {
    return {
      metodo: "esfera",
      justificativa: `A altura H ultrapassa o limite da curva do método do ângulo para NP ${np}; iniciar pelo método da esfera rolante.`,
    };
  }

  if (area >= 400) {
    return {
      metodo: "combinado",
      justificativa: "Estrutura com cobertura ampla; iniciar com malha normativa e verificar pontos expostos pelo método da esfera rolante/ângulo quando aplicável.",
    };
  }

  return {
    metodo: "angulo",
    justificativa: "Estrutura simples dentro da faixa de H da Figura 1; iniciar pelo método do ângulo de proteção, com validação do projetista.",
  };
}

export function carregarAnaliseParaDimensionamento(): AnaliseParaDimensionamento | null {
  if (typeof window === "undefined") return null;
  try {
    const rawText = localStorage.getItem(ANALISE_RISCO_STORAGE_KEY);
    if (!rawText) return null;
    const raw = JSON.parse(rawText) as Record<string, unknown>;
    const resultadoText = localStorage.getItem(ANALISE_RISCO_RESULT_STORAGE_KEY);
    const resultado = resultadoText ? JSON.parse(resultadoText) as Record<string, unknown> : null;

    const comprimentoM = Math.max(1, toFiniteNumber(raw.L, 0));
    const larguraM = Math.max(1, toFiniteNumber(raw.W, 0));
    const alturaM = Math.max(0, toFiniteNumber(raw.H, 0));
    const alturaPontaM = Math.max(0, toFiniteNumber(raw.Hp, 0));
    const pb = String(raw.pb ?? "");
    const np = extrairNPDoPB(pb);
    const coberturaMetalicaNatural = pb.includes("COBERTURA_METALICA") || pb.includes("NP1_METALICA");
    const metodo = selecionarMetodoPorAnalise({ np, alturaM: alturaPontaM || alturaM, comprimentoM, larguraM, coberturaMetalicaNatural });
    const alertas: string[] = [];

    if (!np) alertas.push("A análise de risco não declarou um nível de SPDA no campo PB. Defina o NP no dimensionamento e retorne à análise para validar R ≤ RT.");
    if (alturaM > 60) alertas.push("Altura superior a 60 m: verificar proteção complementar para descargas laterais conforme NBR 5419-3.");
    if (metodo.metodo === "angulo" && np && (alturaPontaM || alturaM) > NP_CONFIG[np].hMaxAnguloM) {
      alertas.push("O método do ângulo não é aplicável para a altura informada; usar esfera rolante ou malhas.");
    }

    const valores = resultado ? {
      R1: toOptionalFiniteNumber(resultado.R1_global),
      R3: toOptionalFiniteNumber(resultado.R3_global),
      R4: toOptionalFiniteNumber(resultado.R4_global),
      F: toOptionalFiniteNumber(resultado.F_global),
      conforme: typeof resultado.conforme_norma === "boolean" ? resultado.conforme_norma : undefined,
      fAtende: typeof resultado.F_atende === "boolean" ? resultado.F_atende : undefined,
    } : undefined;

    return {
      origem: "analise-risco",
      carregadaEm: new Date().toISOString(),
      obra: String(raw.obra || raw.nomeAn || "Análise de risco sem nome"),
      nomeAnalise: String(raw.nomeAn || ""),
      responsavel: String(raw.resp || ""),
      art: String(raw.art || ""),
      endereco: String(raw.endV || ""),
      dimensoes: { comprimentoM, larguraM, alturaM, alturaPontaM },
      pb,
      spdaDeclarado: Boolean(np),
      npDeclarado: np,
      metodoSugerido: metodo.metodo,
      justificativaMetodo: metodo.justificativa,
      coberturaMetalicaNatural,
      valores,
      alertas,
    };
  } catch {
    return null;
  }
}

export function salvarRecomendacaoDimensionamento(recomendacao: RecomendacaoDimensionamentoSalva): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DIMENSIONAMENTO_RECOMENDACAO_STORAGE_KEY, JSON.stringify(recomendacao));
  } catch {
    // localStorage pode estar indisponível em navegação privada.
  }
}
