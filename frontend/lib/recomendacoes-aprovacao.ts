import { MetodoProtecao, NivelProtecao, NP_CONFIG, anguloProtecao, numeroMinimoDescidas } from "@/lib/spda-norma";
import type { CalcResponse } from "@/lib/api";

export type PrioridadePlano = "Obrigatória" | "Alta" | "Média" | "Monitoramento";

export type AcaoAprovacao = {
  prioridade: PrioridadePlano;
  categoria: string;
  acao: string;
  justificativa: string;
  efeitoEsperado: string;
  referenciaNormativa: string;
  componentesAtacados: string[];
};

export type PlanoAprovacaoNormativa = {
  aprovado: boolean;
  titulo: string;
  resumo: string;
  npRecomendado: NivelProtecao;
  metodoDimensionamento: MetodoProtecao;
  parametrosDimensionamento: {
    raioEsferaM: number;
    malhaM: [number, number];
    distanciaDescidaM: number;
    numeroMinimoDescidas: number;
    anguloProtecaoGraus: number | null;
    anguloAplicavel: boolean;
  };
  componentesDominantes: Array<{ codigo: string; valor: number; percentualR1: number }>;
  acoes: AcaoAprovacao[];
  observacoes: string[];
};

type EntradaPlano = {
  calc: CalcResponse | null;
  zonas?: Array<Record<string, unknown>>;
  linhas?: Array<Record<string, unknown>>;
  dimensoes: { L: number; W: number; H: number; Hp?: number };
  pb: string;
  pta?: string;
};

const RT1 = 1e-5;
const RT3 = 1e-4;
const PRIORIDADE_ORDEM: Record<PrioridadePlano, number> = { Obrigatória: 0, Alta: 1, Média: 2, Monitoramento: 3 };

function n(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nivelAtualPB(pb: string): NivelProtecao | null {
  const raw = String(pb || "").split(":")[0];
  return raw === "I" || raw === "II" || raw === "III" || raw === "IV" ? raw : null;
}

function nivelPorRazao(razao: number, atual: NivelProtecao | null): NivelProtecao {
  if (!atual) {
    if (razao > 4) return "I";
    if (razao > 2) return "II";
    return "III";
  }
  if (razao > 4) return "I";
  if (razao > 2 && (atual === "III" || atual === "IV")) return "II";
  if (razao > 1 && atual === "IV") return "III";
  return atual;
}

function metodoPorGeometria(np: NivelProtecao, L: number, W: number, H: number, pb: string): MetodoProtecao {
  const area = Math.max(0, L) * Math.max(0, W);
  const coberturaNatural = pb.includes("COBERTURA_METALICA") || pb.includes("NP1_METALICA");
  if (coberturaNatural) return "malha";
  if (H > NP_CONFIG[np].hMaxAnguloM) return "esfera";
  if (area >= 400) return "combinado";
  return "angulo";
}

function somaZ(calc: CalcResponse | null, key: keyof NonNullable<CalcResponse["zonas"]>[number]): number {
  return (calc?.zonas ?? []).reduce<number>((s, z) => s + n(z[key]), 0);
}

function maiorLinha(calc: CalcResponse | null): { nome: string; valor: number } | null {
  let melhor: { nome: string; valor: number } | null = null;
  for (const zona of calc?.zonas ?? []) {
    for (const linha of zona.linhas_contrib ?? []) {
      const total = n(linha.RU) + n(linha.RV) + n(linha.RW) + n(linha.RZ) + n(linha.FV) + n(linha.FW) + n(linha.FZ);
      if (!melhor || total > melhor.valor) melhor = { nome: String(linha.nome || linha.id || "Linha"), valor: total };
    }
  }
  return melhor;
}

function addUnica(acoes: AcaoAprovacao[], acao: AcaoAprovacao) {
  const chave = `${acao.categoria}|${acao.acao}`;
  if (!acoes.some((a) => `${a.categoria}|${a.acao}` === chave)) acoes.push(acao);
}

export function gerarPlanoAprovacaoAnaliseRisco(input: EntradaPlano): PlanoAprovacaoNormativa {
  const calc = input.calc;
  const L = Math.max(0, n(input.dimensoes.L));
  const W = Math.max(0, n(input.dimensoes.W));
  const H = Math.max(0, n(input.dimensoes.Hp) || n(input.dimensoes.H));
  const r1 = n(calc?.R1_global);
  const r3 = n(calc?.R3_global);
  const f = n(calc?.F_global);
  const ft = n(calc?.FT_global, 0.1) || 0.1;
  const fAtende = Boolean(calc?.F_atende ?? f <= ft);
  const r1Ok = r1 <= RT1;
  const r3Aplicavel = r3 > 0 || (calc?.zonas ?? []).some((z) => n((z as any).R3) > 0 || n((z as any).RB3) > 0 || n((z as any).RV3) > 0);
  const r3Ok = !r3Aplicavel || r3 <= RT3;
  const aprovado = Boolean(calc) && r1Ok && fAtende && r3Ok;
  const razaoMax = Math.max(r1 / RT1 || 0, f / ft || 0, r3Aplicavel ? r3 / RT3 || 0 : 0, 1);
  const npAtual = nivelAtualPB(input.pb);
  const npRecomendado = nivelPorRazao(razaoMax, npAtual);
  const metodoDimensionamento = metodoPorGeometria(npRecomendado, L, W, H, input.pb);
  const cfg = NP_CONFIG[npRecomendado];
  const angulo = anguloProtecao(npRecomendado, H);

  const componentes = [
    { codigo: "RA", valor: n(calc?.RA_g) },
    { codigo: "RB", valor: n(calc?.RB_g) },
    { codigo: "RC", valor: n(calc?.RC_g) },
    { codigo: "RM", valor: n(calc?.RM_g) },
    { codigo: "RU", valor: n(calc?.RU_g) },
    { codigo: "RV", valor: n(calc?.RV_g) },
    { codigo: "RW", valor: n(calc?.RW_g) },
    { codigo: "RZ", valor: n(calc?.RZ_g) },
  ].sort((a, b) => b.valor - a.valor);
  const componentesDominantes = componentes
    .filter((c) => c.valor > 0)
    .slice(0, 4)
    .map((c) => ({ ...c, percentualR1: r1 > 0 ? (c.valor / r1) * 100 : 0 }));

  const acoes: AcaoAprovacao[] = [];
  const linhaCritica = maiorLinha(calc);
  const danoFisico = n(calc?.RB_g) + n(calc?.RV_g) + somaZ(calc, "FB") + somaZ(calc, "FV");
  const toquePasso = n(calc?.RA_g) + n(calc?.RU_g);
  const sistemas = n(calc?.RC_g) + n(calc?.RM_g) + n(calc?.RW_g) + n(calc?.RZ_g) + somaZ(calc, "FC") + somaZ(calc, "FM") + somaZ(calc, "FW") + somaZ(calc, "FZ");

  if (!calc) {
    addUnica(acoes, {
      prioridade: "Obrigatória",
      categoria: "Cálculo",
      acao: "Executar a análise de risco antes de emitir recomendação conclusiva.",
      justificativa: "Sem resultado calculado não é possível comparar R e F contra seus limites toleráveis.",
      efeitoEsperado: "Gerar os indicadores R1, R3 e F para orientar as medidas de proteção.",
      referenciaNormativa: "ABNT NBR 5419-2:2026 - procedimento de análise de risco.",
      componentesAtacados: ["R", "F"],
    });
  }

  if (!aprovado || danoFisico > 0) {
    addUnica(acoes, {
      prioridade: !r1Ok || !r3Ok ? "Obrigatória" : "Alta",
      categoria: "SPDA externo / captação",
      acao: `Instalar ou adequar o SPDA externo para NP ${npRecomendado}, usando ${metodoDimensionamento === "angulo" ? "método do ângulo de proteção" : metodoDimensionamento === "esfera" ? "método da esfera rolante" : metodoDimensionamento === "malha" ? "método das malhas / gaiola de Faraday" : "método combinado"}.`,
      justificativa: "As componentes ligadas a dano físico e interceptação da descarga são reduzidas por SPDA dimensionado e posicionado conforme a Parte 3.",
      efeitoEsperado: "Reduzir PB/PV e, consequentemente, RB/RV, além das parcelas de frequência associadas a dano físico.",
      referenciaNormativa: "ABNT NBR 5419-2:2026, 5.5 e 5.6; ABNT NBR 5419-3:2026, 5.3.2 e Tabela 2.",
      componentesAtacados: ["RB", "RV", "FB", "FV", "R3"],
    });
  }

  if (!fAtende || sistemas > 0) {
    addUnica(acoes, {
      prioridade: !fAtende ? "Obrigatória" : "Alta",
      categoria: "MPS / DPS / ZPR",
      acao: "Implantar ou revisar MPS com sistema coordenado de DPS nas linhas de energia e sinal, respeitando as fronteiras de ZPR.",
      justificativa: "As falhas de sistemas internos são influenciadas por surtos conduzidos e campos eletromagnéticos; MPS, DPS coordenados, blindagem e roteamento reduzem essas probabilidades.",
      efeitoEsperado: "Reduzir PC, PM, PW e PZ, atuando sobre RC/RM/RW/RZ e FC/FM/FW/FZ.",
      referenciaNormativa: "ABNT NBR 5419-4:2026, 4.4.1 a 4.4.4 e Seção 7.",
      componentesAtacados: ["RC", "RM", "RW", "RZ", "FC", "FM", "FW", "FZ"],
    });
  }

  if (toquePasso > 0 || input.pta === "NENHUMA") {
    addUnica(acoes, {
      prioridade: !r1Ok ? "Alta" : "Média",
      categoria: "Tensões de toque e passo",
      acao: "Aplicar medidas contra toque e passo: isolação das descidas, malha de equipotencialização do solo, restrições físicas e avisos quando aplicáveis.",
      justificativa: "Essas medidas reduzem a probabilidade de ferimentos por tensões de toque e passo associadas às componentes RA e RU.",
      efeitoEsperado: "Reduzir PA/PTA e PU/PTU, diminuindo RA e RU.",
      referenciaNormativa: "ABNT NBR 5419-1:2026, 7.2; ABNT NBR 5419-3:2026, Seção 8.",
      componentesAtacados: ["RA", "RU"],
    });
  }

  if (linhaCritica && linhaCritica.valor > 0) {
    addUnica(acoes, {
      prioridade: !fAtende || !r1Ok ? "Alta" : "Média",
      categoria: "Linhas externas",
      acao: `Revisar a proteção das linhas externas, com atenção especial para "${linhaCritica.nome}"; avaliar DPS Classe I na entrada, equipotencialização, blindagem/interligação e roteamento dos cabos.`,
      justificativa: "Linhas que entram na estrutura podem transferir correntes e surtos, afetando RU/RV/RW/RZ e as frequências FV/FW/FZ.",
      efeitoEsperado: "Reduzir PU, PV, PW e PZ por meio de PEB, CLD/CLI, PLD/PLI e MPS adequadas.",
      referenciaNormativa: "ABNT NBR 5419-2:2026, Anexos A e B; ABNT NBR 5419-4:2026, 4.4 e 7.",
      componentesAtacados: ["RU", "RV", "RW", "RZ", "FV", "FW", "FZ"],
    });
  }

  if (r3Aplicavel && !r3Ok) {
    addUnica(acoes, {
      prioridade: "Obrigatória",
      categoria: "Patrimônio cultural",
      acao: "Priorizar medidas que reduzam danos físicos associados a RB3 e RV3 e recalcular R3 após a adequação.",
      justificativa: "R3 representa perda inaceitável de patrimônio cultural e deve permanecer abaixo do limite tolerável aplicável.",
      efeitoEsperado: "Reduzir R3 por redução de PB/PV e das perdas consequentes aplicáveis.",
      referenciaNormativa: "ABNT NBR 5419-2:2026, Tabela 4 e Anexo C.",
      componentesAtacados: ["RB3", "RV3", "R3"],
    });
  }

  if (aprovado) {
    addUnica(acoes, {
      prioridade: "Monitoramento",
      categoria: "Manutenção da conformidade",
      acao: "Manter documentação, inspeções e manutenção do SPDA/MPS, e repetir a análise quando houver alteração de uso, construção ou instalação elétrica.",
      justificativa: "A conformidade depende da manutenção das medidas declaradas e da atualização do prontuário técnico.",
      efeitoEsperado: "Preservar R e F dentro dos limites adotados.",
      referenciaNormativa: "ABNT NBR 5419-1:2026, escopo e critérios gerais; ABNT NBR 5419-3:2026, Seção 7; ABNT NBR 5419-4:2026, Seção 9.",
      componentesAtacados: ["R", "F"],
    });
  } else {
    addUnica(acoes, {
      prioridade: "Obrigatória",
      categoria: "Revalidação",
      acao: "Após aplicar as medidas recomendadas, recalcular a análise de risco até que R1, R3 quando aplicável, e F atendam aos limites toleráveis.",
      justificativa: "A aprovação somente deve ser emitida quando os indicadores obrigatórios ficarem dentro dos limites de tolerabilidade selecionados.",
      efeitoEsperado: "Comprovar numericamente a condição R <= RT e F <= FT.",
      referenciaNormativa: "ABNT NBR 5419-2:2026, 5.4, 5.5 e 5.6.",
      componentesAtacados: ["R1", "R3", "F"],
    });
  }

  const observacoes: string[] = [];
  if (metodoDimensionamento === "angulo" && !angulo.aplicavel) {
    observacoes.push("O método do ângulo não é aplicável para a altura H informada; usar esfera rolante ou malhas.");
  }
  if (H > 60) {
    observacoes.push("Altura superior a 60 m: verificar proteção complementar contra descargas laterais nas partes superiores da estrutura.");
  }
  if (input.pb.includes("COBERTURA_METALICA") || input.pb.includes("NP1_METALICA")) {
    observacoes.push("Uso de componente natural exige verificação de continuidade elétrica, interligações e conformidade construtiva antes de declarar a proteção como efetiva.");
  }

  const titulo = aprovado
    ? "Sistema aprovado pelos indicadores calculados"
    : "Sistema ainda não aprovado - plano de adequação necessário";
  const resumo = aprovado
    ? "Os indicadores obrigatórios avaliados atendem aos limites toleráveis. As ações listadas são de manutenção e rastreabilidade técnica."
    : "As ações abaixo indicam o caminho técnico mínimo para adequar o sistema. Após executá-las, a análise deve ser recalculada para confirmar a aprovação.";

  return {
    aprovado,
    titulo,
    resumo,
    npRecomendado,
    metodoDimensionamento,
    parametrosDimensionamento: {
      raioEsferaM: cfg.raioEsferaM,
      malhaM: cfg.malhaM,
      distanciaDescidaM: cfg.distanciaDescidaM,
      numeroMinimoDescidas: numeroMinimoDescidas(npRecomendado, L, W),
      anguloProtecaoGraus: angulo.anguloGraus,
      anguloAplicavel: angulo.aplicavel,
    },
    componentesDominantes,
    acoes: acoes.sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade]),
    observacoes,
  };
}
