export type NivelProtecao = "I" | "II" | "III" | "IV";
export type MetodoProtecao = "angulo" | "esfera" | "malha" | "combinado";
export type TipoCaptorNormativo =
  | "franklin"
  | "minicaptor"
  | "mastro"
  | "condutor_suspenso"
  | "malha"
  | "natural";

export const NIVEIS: NivelProtecao[] = ["I", "II", "III", "IV"];

export const NP_CONFIG: Record<NivelProtecao, {
  raioEsferaM: number;
  malhaM: [number, number];
  distanciaDescidaM: number;
  cor: string;
  corBg: string;
  hMaxAnguloM: number;
}> = {
  I:   { raioEsferaM: 20, malhaM: [5, 5],   distanciaDescidaM: 10, cor: "#dc2626", corBg: "#fee2e2", hMaxAnguloM: 20 },
  II:  { raioEsferaM: 30, malhaM: [10, 10], distanciaDescidaM: 10, cor: "#ea580c", corBg: "#ffedd5", hMaxAnguloM: 30 },
  III: { raioEsferaM: 45, malhaM: [15, 15], distanciaDescidaM: 15, cor: "#ca8a04", corBg: "#fef9c3", hMaxAnguloM: 45 },
  IV:  { raioEsferaM: 60, malhaM: [20, 20], distanciaDescidaM: 20, cor: "#16a34a", corBg: "#dcfce7", hMaxAnguloM: 60 },
};

export const METODOS_PROTECAO: Record<MetodoProtecao, {
  titulo: string;
  subtitulo: string;
}> = {
  angulo: {
    titulo: "Franklin / ângulo de proteção",
    subtitulo: "Usa a Figura 1; aplicável apenas dentro dos limites de H do NP.",
  },
  esfera: {
    titulo: "Esfera rolante",
    subtitulo: "Método adequado em todos os casos; raio conforme Tabela 2.",
  },
  malha: {
    titulo: "Gaiola de Faraday / malhas",
    subtitulo: "Condutores em malha; módulo máximo conforme Tabela 2.",
  },
  combinado: {
    titulo: "Combinado",
    subtitulo: "Permite usar, separadamente ou em conjunto, esfera rolante e malhas.",
  },
};

export const TIPOS_CAPTORES: Record<TipoCaptorNormativo, {
  titulo: string;
  descricao: string;
  usaPonto: boolean;
  usaLinha: boolean;
}> = {
  franklin: {
    titulo: "Franklin / captor vertical",
    descricao: "Representa condutor vertical, minicaptor ou haste/mastro individual.",
    usaPonto: true,
    usaLinha: false,
  },
  minicaptor: {
    titulo: "Minicaptor",
    descricao: "Captor vertical de pequena altura posicionado na cobertura.",
    usaPonto: true,
    usaLinha: false,
  },
  mastro: {
    titulo: "Mastro",
    descricao: "Condutor vertical/mastro com altura própria acima do plano de referência.",
    usaPonto: true,
    usaLinha: false,
  },
  condutor_suspenso: {
    titulo: "Condutor suspenso",
    descricao: "Condutor de captação suspenso, representado como linha na planta.",
    usaPonto: false,
    usaLinha: true,
  },
  malha: {
    titulo: "Condutor em malha",
    descricao: "Elemento do método das malhas/gaiola de Faraday.",
    usaPonto: false,
    usaLinha: true,
  },
  natural: {
    titulo: "Componente natural",
    descricao: "Elemento metálico existente integrado ao SPDA quando aplicável.",
    usaPonto: false,
    usaLinha: true,
  },
};

/**
 * Curvas digitalizadas da Figura 1 da ABNT NBR 5419-3:2026.
 * A própria norma fornece o ângulo por gráfico, não por tabela numérica.
 * O sistema interpola linearmente entre pontos do gráfico e bloqueia o método
 * do ângulo acima do fim da curva de cada NP, conforme 5.3.2.11.
 */
export const CURVAS_ANGULO_FIGURA_1: Record<NivelProtecao, Array<[number, number]>> = {
  I:   [[2, 72], [5, 60], [10, 45], [15, 33], [20, 23]],
  II:  [[2, 74], [5, 66], [10, 55], [20, 38], [30, 23]],
  III: [[2, 76], [5, 70], [10, 61], [20, 48], [30, 37], [45, 23]],
  IV:  [[2, 78], [5, 72], [10, 65], [20, 53], [30, 45], [45, 34], [60, 23]],
};

export function anguloProtecao(np: NivelProtecao, hM: number): {
  aplicavel: boolean;
  anguloGraus: number | null;
  motivo?: string;
} {
  const curva = CURVAS_ANGULO_FIGURA_1[np];
  const h = Math.max(0, Number.isFinite(hM) ? hM : 0);
  const hMin = curva[0][0];
  const hMax = curva[curva.length - 1][0];

  if (h > hMax) {
    return {
      aplicavel: false,
      anguloGraus: null,
      motivo: `Para H acima de ${hMax} m no NP ${np}, aplicar esfera rolante ou malhas.`,
    };
  }

  if (h <= hMin) {
    return { aplicavel: true, anguloGraus: curva[0][1] };
  }

  for (let i = 1; i < curva.length; i += 1) {
    const [h0, a0] = curva[i - 1];
    const [h1, a1] = curva[i];
    if (h <= h1) {
      const t = (h - h0) / (h1 - h0);
      return { aplicavel: true, anguloGraus: a0 + t * (a1 - a0) };
    }
  }

  return { aplicavel: true, anguloGraus: curva[curva.length - 1][1] };
}

export function raioProtecaoAngulo(np: NivelProtecao, hM: number): number | null {
  const resultado = anguloProtecao(np, hM);
  if (!resultado.aplicavel || resultado.anguloGraus === null) return null;
  return hM * Math.tan((resultado.anguloGraus * Math.PI) / 180);
}

export function raioProtecaoEsferaRolante(np: NivelProtecao, hM: number): number | null {
  const R = NP_CONFIG[np].raioEsferaM;
  const h = Math.max(0, Number.isFinite(hM) ? hM : 0);
  if (h <= 0 || h > R) return null;
  return Math.sqrt(Math.max(0, 2 * R * h - h * h));
}

export function raioProtecaoPorMetodo(np: NivelProtecao, hM: number, metodo: MetodoProtecao): number | null {
  if (metodo === "esfera") return raioProtecaoEsferaRolante(np, hM);
  if (metodo === "angulo") return raioProtecaoAngulo(np, hM);
  if (metodo === "combinado") return raioProtecaoEsferaRolante(np, hM) ?? raioProtecaoAngulo(np, hM);
  return null;
}

export function numeroMinimoDescidas(np: NivelProtecao, comprimentoM: number, larguraM: number): number {
  const perimetro = 2 * (Math.max(0, comprimentoM) + Math.max(0, larguraM));
  if (perimetro <= 0) return 2;
  return Math.max(2, Math.ceil(perimetro / NP_CONFIG[np].distanciaDescidaM));
}

export function posicoesDescidasRetangulo(np: NivelProtecao, comprimentoM: number, larguraM: number) {
  const n = numeroMinimoDescidas(np, comprimentoM, larguraM);
  const L = Math.max(0, comprimentoM);
  const W = Math.max(0, larguraM);
  const per = 2 * (L + W);
  if (L <= 0 || W <= 0 || per <= 0) return [] as Array<{ x: number; y: number }>;
  const pontos: Array<{ x: number; y: number }> = [];

  function pointAt(d0: number) {
    let d = ((d0 % per) + per) % per;
    if (d <= L) return { x: d, y: 0 };
    d -= L;
    if (d <= W) return { x: L, y: d };
    d -= W;
    if (d <= L) return { x: L - d, y: W };
    d -= L;
    return { x: 0, y: W - d };
  }

  for (let i = 0; i < n; i += 1) pontos.push(pointAt((per / n) * i));
  return pontos;
}

export function linhasMalhaRetangular(np: NivelProtecao, comprimentoM: number, larguraM: number) {
  const [mx, my] = NP_CONFIG[np].malhaM;
  const linhasX: number[] = [];
  const linhasY: number[] = [];
  for (let x = 0; x <= comprimentoM + 1e-9; x += mx) linhasX.push(Math.min(comprimentoM, x));
  if (linhasX[linhasX.length - 1] !== comprimentoM) linhasX.push(comprimentoM);
  for (let y = 0; y <= larguraM + 1e-9; y += my) linhasY.push(Math.min(larguraM, y));
  if (linhasY[linhasY.length - 1] !== larguraM) linhasY.push(larguraM);
  return { linhasX: Array.from(new Set(linhasX)), linhasY: Array.from(new Set(linhasY)) };
}
