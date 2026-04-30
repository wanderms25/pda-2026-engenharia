"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_BASE_URL } from "@/lib/config";
import { gerarLaudoPDF, gerarLaudoWord, calcularPDA, type AnaliseRiscoRequest, type CalcResponse } from "@/lib/api";
import { ANALISE_RISCO_RESULT_STORAGE_KEY } from "@/lib/dimensionamento-risco";
import { gerarPlanoAprovacaoAnaliseRisco } from "@/lib/recomendacoes-aprovacao";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ClipboardList, Zap, Layers, BarChart2, FileText,
  Plus, Trash2, Info, ChevronDown, ChevronUp, MapPin,
  Shield, ShieldAlert, DollarSign, Activity,
} from "lucide-react";
import { MunicipioAutocomplete } from "@/components/analise/municipio-autocomplete";
import { ClienteAutocomplete, enderecoCliente, nomeCliente } from "@/components/clientes/cliente-autocomplete";
import type { Cliente } from "@/lib/api";

// ─── Theme accent (blue) ──────────────────────────────────────────────────────
const A = {
  bg:      "bg-blue-600",
  bgHov:   "bg-blue-700",
  bgFaint: "bg-blue-600/10",
  bgFaintH:"bg-blue-600/20",
  border:  "border-blue-500/30",
  text:    "text-blue-400",
  textB:   "text-blue-300",
  shadow:  "shadow-blue-500/20",
  sectionHdr: "bg-[#0d1f3a] hover:bg-[#0f2444]",
  resBg:   "bg-[#0a1628] border-blue-500/20",
  cardBg:  "bg-[#0d1117] border-[#1e3a5f]",
  ngCard:  "bg-[#0d1f3a] border-blue-500/30",
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type TabId = "exemplos" | "informacoes" | "zonas" | "analises" | "relatorio";
const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "exemplos",    label: "Exemplos",    icon: Activity },
  { id: "informacoes", label: "Informações", icon: ClipboardList },
  { id: "zonas",       label: "Zonas",       icon: Layers },
  { id: "analises",    label: "Análises",    icon: BarChart2 },
  { id: "relatorio",   label: "Relatório",   icon: FileText },
];

// ─── Option lists (NBR 5419-2:2026) ──────────────────────────────────────────
const CD_OPT = [
  { v:"CERCADA_OBJETOS_MAIS_ALTOS", l:"Cercada por objetos mais altos (CD=0.25)" },
  { v:"CERCADA_MESMA_ALTURA",       l:"Cercada por objetos de mesma altura (CD=0.5)" },
  { v:"ISOLADA",                    l:"Isolada - sem outros objetos nas proximidades (CD=1)" },
  { v:"ISOLADA_TOPO_COLINA",        l:"No topo de colina ou monte (CD=2)" },
];
const PB_OPT = [
  { v:"NENHUM:null",         l:"Estrutura não protegida por SPDA (PB=1)" },
  { v:"IV:null",             l:"Estrutura protegida por SPDA NP IV (PB=0.2)" },
  { v:"III:null",            l:"Estrutura protegida por SPDA NP III (PB=0.1)" },
  { v:"II:null",             l:"Estrutura protegida por SPDA NP II (PB=0.05)" },
  { v:"I:null",              l:"Estrutura protegida por SPDA NP I (PB=0.02)" },
  { v:"I:NP1_METALICA",      l:"NP I + estrutura metálica/concreto como descida natural (PB=0.01)" },
  { v:"I:COBERTURA_METALICA",l:"Cobertura metálica captação natural + descida natural (PB=0.001)" },
];
const RS_EST_OPT = [
  { v:"ALVENARIA_CONCRETO", l:"Robusta: estrutura metálica ou concreto armado (rS=1)" },
  { v:"MADEIRA",            l:"Simples: madeira ou alvenaria simples (rS=2)" },
];
const LF_OPT = [
  { v:"HOSPITAL",               l:"Hospital, hotel, escola, edifício cívico (LF=1e-1)" },
  { v:"INDUSTRIAL",             l:"Industrial, comercial (LF=2e-2)" },
  { v:"ESCRITORIO",             l:"Escritórios / outros (LF=1e-2)" },
  { v:"ENTRETENIMENTO_PUBLICO", l:"Entretenimento público, igreja, museu (LF=5e-2)" },
  { v:"RISCO_EXPLOSAO",         l:"Risco de explosão (LF=1e-1)" },
  { v:"OUTROS",                 l:"Outros (LF=1e-2)" },
];
const PTA_OPT = [
  { v:"NENHUMA",                            l:"Nenhuma medida de proteção (PTA=1)" },
  { v:"AVISOS_ALERTA",                      l:"Avisos de alerta - visíveis (PTA=0.1)" },
  { v:"ISOLACAO_ELETRICA_DESCIDA",          l:"Isolação elétrica das descidas - 3mm XLPE (PTA=0.01)" },
  { v:"MALHA_EQUIPOTENCIALIZACAO_SOLO",     l:"Malha equipotencialização do solo (PTA=0.01)" },
  { v:"ESTRUTURA_METALICA_DESCIDA_NATURAL", l:"Estrutura metálica contínua ou concreto armado - descida natural (PTA=0.001)" },
  { v:"RESTRICOES_FISICAS_FIXAS",           l:"Restrições físicas fixas - contra toque e passo (PTA=0)" },
];
const PTU_OPT = [
  { v:"NENHUMA",                            l:"Nenhuma medida de proteção (PTU=1)" },
  { v:"AVISOS_ALERTA",                      l:"Avisos visíveis de alerta (PTU=0.1)" },
  { v:"ISOLACAO_ELETRICA_DESCIDA",          l:"Isolação elétrica contra tensão de toque (PTU=0.01)" },
  { v:"RESTRICOES_FISICAS_FIXAS",           l:"Restrições físicas fixas (PTU=0)" },
];
const PEB_OPT = [
  { v:"NENHUM",   l:"Sem DPS Classe I (PEB=1)" },
  { v:"IV",       l:"DPS Classe I projetado para NP III-IV (PEB=0,05)" },
  { v:"II",       l:"DPS Classe I projetado para NP II (PEB=0,02)" },
  { v:"I",        l:"DPS Classe I projetado para NP I (PEB=0,01)" },
  { v:"NP1_PLUS", l:"Nota 2 — limp superior ao NP I (PEB=0,005)" },
  { v:"NP1_MAX",  l:"Nota 2 — limp muito superior ao NP I (PEB=0,001)" },
];
const CLD_OPT = [
  { v:"AEREO_NAO_BLINDADO",                   l:"Aérea não blindada (CLD=1 CLI=1)" },
  { v:"ENTERRADO_NAO_BLINDADO",               l:"Subterrânea não blindada (CLD=1 CLI=1)" },
  { v:"LINHA_ENERGIA_AT_NEUTRO_MULTI_ATERRADO",l:"Energia com neutro multiaterrado (CLD=1 CLI=0.2)" },
  { v:"ENTERRADO_BLINDADO_NAO_ATERRADO",      l:"Subterrânea blindada - não interligada BEP (CLD=1 CLI=0.3)" },
  { v:"AEREO_BLINDADO_NAO_ATERRADO",          l:"Aérea blindada - não interligada BEP (CLD=1 CLI=0.1)" },
  { v:"AEREO_BLINDADO_ATERRADO",              l:"Blindada interligada ao BEP (CLD=1 CLI=0)" },
  { v:"CABO_PROTECAO_METALICO",               l:"Cabo proteção / eletroduto metálico (CLD=0 CLI=0)" },
  { v:"SEM_LINHA_EXTERNA",                    l:"Sem linha externa / fibra óptica (CLD=0 CLI=0)" },
  { v:"INTERFACE_ISOLANTE_PROTEGIDA_POR_DPS", l:"Interface isolante conforme ABNT NBR 5419-4 (CLD=0 CLI=0)" },
];
const CI_OPT = [
  { v:"AEREO",     l:"Aéreo (CI=1)" },
  { v:"ENTERRADO", l:"Enterrado (CI=0.5)" },
  { v:"ENT_MALHA", l:"Enterrado dentro da malha de aterramento (CI=0.01)" },
];
const CT_OPT = [
  { v:"BT_SINAL",    l:"Linha de BT ou linha de sinal (CT=1)" },
  { v:"AT_COM_TRAFO",l:"Linha de AT com transformador AT/BT (CT=0.2)" },
];
const CE_OPT = [
  { v:"RURAL",       l:"Rural (CE=1)" },
  { v:"SUBURBANO",   l:"Suburbano (CE=0.5)" },
  { v:"URBANO",      l:"Urbano (CE=0.1)" },
  { v:"URBANO_ALTAS",l:"Urbano com edificações superiores a 20m (CE=0.01)" },
];
const RS_LINE_OPT = [
  { v:"AEREO_NAO_BLINDADO",      l:"Aérea não blindada / blindagem não interligada (PLD=1)" },
  { v:"ENTERRADO_NAO_BLINDADO",  l:"Subterrânea não blindada / blindagem não interligada (PLD=1)" },
  { v:"BLINDADO_5_20_OHM_KM",    l:"Blindada interligada — 5 < Rs ≤ 20 Ω/km (Tab. B.8)" },
  { v:"BLINDADO_1_5_OHM_KM",     l:"Blindada interligada — 1 < Rs ≤ 5 Ω/km (Tab. B.8)" },
  { v:"BLINDADO_MENOS_1_OHM_KM", l:"Blindada interligada — Rs ≤ 1 Ω/km (Tab. B.8)" },
];
const UW_LINHA_OPT = [
  { v:"1.0",l:"1 kV"},{ v:"1.5",l:"1.5 kV"},{ v:"2.5",l:"2.5 kV"},
  { v:"4.0",l:"4 kV"},{ v:"6.0",l:"6 kV"},
];
const UW_OPT = UW_LINHA_OPT;
const STATUS_OPT = [
  { v:"",             l:"Selecionar status" },
  { v:"RASCUNHO",    l:"Rascunho" },
  { v:"EM_ANDAMENTO",l:"Em andamento" },
  { v:"CONCLUIDO",   l:"Concluído" },
  { v:"REVISAO",     l:"Em revisão" },
];
// Zonas options
const KS3_OPT = [
  { v:"1",      l:"Cabo não blindado - sem preocupação lacos (a) - KS3=1" },
  { v:"0.5",    l:"Cabo não blindado - lacos grandes 25m2 (f) - KS3=0.5" },
  { v:"0.2",    l:"Cabo não blindado - evitar lacos medios 10m2 (b) - KS3=0.2" },
  { v:"0.01",   l:"Cabo não blindado - lacos pequenos 0.5m2 (c) - KS3=0.01" },
  { v:"0.0001", l:"Cabos blindados ou em condutos metálicos (d) - KS3=0.0001" },
];
const PSPD_OPT = [
  { v:"1",     l:"Nenhum sistema coordenado de DPS (PSPD=1)" },
  { v:"0.05",  l:"DPS coordenado NP III-IV (PSPD=0.05)" },
  { v:"0.02",  l:"DPS coordenado NP II (PSPD=0.02)" },
  { v:"0.01",  l:"DPS coordenado NP I (PSPD=0.01)" },
  { v:"0.005", l:"Melhor que NP I (PSPD=0.005)" },
];
const HZ_OPT = [
  { v:"1",  l:"Sem perigo especial (hz=1)" },
  { v:"2",  l:"Baixo nível de pânico - estrutura até 2 andares, até 100 pessoas (hz=2)" },
  { v:"5",  l:"Nível médio de pânico - eventos culturais/esportivos 100-1000 pessoas (hz=5)" },
  { v:"5b", l:"Dificuldade de evacuação - pessoas imobilizadas, hospitais (hz=5)" },
  { v:"10", l:"Alto nível de pânico - eventos culturais/esportivos > 1000 pessoas (hz=10)" },
];
const LO_OPT = [
  { v:"0",     l:"Não aplicável (LO=0)" },
  { v:"0.1",   l:"Risco de explosão (LO=1e-1)" },
  { v:"0.01",  l:"UTI / Bloco cirúrgico de hospital (LO=1e-2)" },
  { v:"0.001", l:"Outras partes de hospital (LO=1e-3)" },
];
const RT_OPT = [
  { v:"0.01",    l:"Terra, concreto - Rc <= 1 kohm (rt=1e-2)" },
  { v:"0.001",   l:"Mármore, cerâmica - Rc 1-10 kohm (rt=1e-3)" },
  { v:"0.0001",  l:"Brita, tapete, carpete - Rc 10-100 kohm (rt=1e-4)" },
  { v:"0.00001", l:"Asfalto, linoleo, madeira - Rc >= 100 kohm (rt=1e-5)" },
];
const RF_OPT = [
  { v:"1",     l:"Explosão - Zonas 0, 20 e explosivos sólidos (rf=1)" },
  { v:"0.1a",  l:"Explosão - Zonas 1, 21 (rf=1e-1)" },
  { v:"0.001a",l:"Explosão - Zonas 2, 22 (rf=1e-3)" },
  { v:"0.1b",  l:"Incêndio ALTO - carga >= 800 MJ/m2, materiais combustíveis (rf=1e-1)" },
  { v:"0.01",  l:"Incêndio NORMAL - carga 400 a 800 MJ/m2 (rf=1e-2)" },
  { v:"0.001b",l:"Incêndio BAIXO - carga < 400 MJ/m2, pouco material combustível (rf=1e-3)" },
  { v:"0",     l:"Nenhum risco de incêndio ou explosão (rf=0)" },
];
const RP_OPT = [
  { v:"1",   l:"Nenhuma providência (rp=1)" },
  { v:"0.5", l:"Extintores, hidrantes, alarme manual, rotas de escape (rp=0.5)" },
  { v:"0.2", l:"Instalação fixa automática ou alarme automático (rp=0.2)" },
];
const FT_OPT = [
  { v:"1",     l:"Não crítico — valor representativo da norma (FT = 1/ano)" },
  { v:"0.1",   l:"Sistema crítico — valor máximo da norma (FT = 0,1/ano)" },
  { v:"0.01",  l:"Critério interno conservador (FT = 0,01/ano)" },
  { v:"0.001", l:"Critério interno muito conservador (FT = 0,001/ano)" },
];
const L4_TIPO_OPT = [
  { v:"USAR_TIPO_L1",             l:"Usar tipo geral da estrutura" },
  { v:"RISCO_EXPLOSAO",           l:"Risco de explosão (LF=1; LO=1e-1)" },
  { v:"HOSPITAL",                 l:"Hospital (LF=0,5; LO=1e-2)" },
  { v:"INDUSTRIAL",               l:"Industrial (LF=0,5; LO=1e-2)" },
  { v:"MUSEU",                    l:"Museu (LF=0,5; LO=1e-3)" },
  { v:"AGRICULTURA",              l:"Agricultura (LF=0,5; LO=1e-3)" },
  { v:"HOTEL",                    l:"Hotel (LF=0,2; LO=1e-2)" },
  { v:"ESCOLA",                   l:"Escola (LF=0,2; LO=1e-3)" },
  { v:"ESCRITORIO",               l:"Escritório (LF=0,2; LO=1e-2)" },
  { v:"IGREJA",                   l:"Igreja (LF=0,2; LO=1e-3)" },
  { v:"ENTRETENIMENTO_PUBLICO",   l:"Entretenimento público (LF=0,2; LO=1e-3)" },
  { v:"COMERCIAL",                l:"Comercial (LF=0,2; LO=1e-2)" },
  { v:"OUTROS",                   l:"Outros (LF=0,1; LO=1e-4)" },
];
const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

// ─── Factor maps (NBR 5419-2:2026) ───────────────────────────────────────────
const CD_MAP: Record<string,number> = { CERCADA_OBJETOS_MAIS_ALTOS:0.25,CERCADA_MESMA_ALTURA:0.5,ISOLADA:1,ISOLADA_TOPO_COLINA:2 };
const CI_MAP: Record<string,number> = { AEREO:1,ENTERRADO:0.5,ENT_MALHA:0.01 };
const CT_MAP: Record<string,number> = { BT_SINAL:1,AT_COM_TRAFO:0.2 };
const CE_MAP: Record<string,number> = { RURAL:1,SUBURBANO:0.5,URBANO:0.1,URBANO_ALTAS:0.01 };
const PB_MAP: Record<string,number> = { "NENHUM:null":1,"IV:null":0.2,"III:null":0.1,"II:null":0.05,"I:null":0.02,"I:NP1_METALICA":0.01,"I:COBERTURA_METALICA":0.001 };
const PTA_MAP: Record<string,number> = { NENHUMA:1,AVISOS_ALERTA:0.1,ISOLACAO_ELETRICA_DESCIDA:0.01,MALHA_EQUIPOTENCIALIZACAO_SOLO:0.01,ESTRUTURA_METALICA_DESCIDA_NATURAL:0.001,RESTRICOES_FISICAS_FIXAS:0 };
const PTU_MAP: Record<string,number> = { NENHUMA:1,AVISOS_ALERTA:0.1,ISOLACAO_ELETRICA_DESCIDA:0.01,RESTRICOES_FISICAS_FIXAS:0 };
const PEB_MAP: Record<string,number> = { NENHUM:1,IV:0.05,III:0.05,II:0.02,I:0.01,NP1_PLUS:0.005,NP1_MAX:0.001 };


type NivelProtecaoLaudo = "NENHUM" | "IV" | "III" | "II" | "I";

function nivelProtecaoFromPspdValue(pspd: string | number | undefined): NivelProtecaoLaudo {
  const v = Number(pspd);
  if (!Number.isFinite(v) || v >= 1) return "NENHUM";
  if (v <= 0.01 + 1e-12) return "I";
  if (v <= 0.02 + 1e-12) return "II";
  if (v <= 0.05 + 1e-12) return "III";
  return "NENHUM";
}

function nivelProtecaoFromPebKey(peb: string | undefined): NivelProtecaoLaudo {
  switch (peb) {
    case "IV": return "IV";
    case "III": return "III";
    case "II": return "II";
    case "I":
    case "NP1_PLUS":
    case "NP1_MAX":
      return "I";
    default:
      return "NENHUM";
  }
}

function nivelProtecaoFromZonasPspd(zs: Array<{ pspd?: string | number }>): NivelProtecaoLaudo {
  const vals = zs.map(z => Number(z.pspd)).filter(v => Number.isFinite(v) && v > 0);
  if (!vals.length) return "NENHUM";
  return nivelProtecaoFromPspdValue(Math.min(...vals));
}

function nivelProtecaoFromLinhasPeb(ls: Array<{ peb?: string }>): NivelProtecaoLaudo {
  const ordem: Record<NivelProtecaoLaudo, number> = { NENHUM: 99, IV: 4, III: 3, II: 2, I: 1 };
  let melhor: NivelProtecaoLaudo = "NENHUM";
  for (const linha of ls) {
    const nivel = nivelProtecaoFromPebKey(linha.peb);
    if (ordem[nivel] < ordem[melhor]) melhor = nivel;
  }
  return melhor;
}
const CLD_CLI_MAP: Record<string,{cld:number,cli:number}> = {
  AEREO_NAO_BLINDADO:{cld:1,cli:1},ENTERRADO_NAO_BLINDADO:{cld:1,cli:1},
  LINHA_ENERGIA_AT_NEUTRO_MULTI_ATERRADO:{cld:1,cli:0.2},
  ENTERRADO_BLINDADO_NAO_ATERRADO:{cld:1,cli:0.3},AEREO_BLINDADO_NAO_ATERRADO:{cld:1,cli:0.1},
  AEREO_BLINDADO_ATERRADO:{cld:1,cli:0},CABO_PROTECAO_METALICO:{cld:0,cli:0},
  SEM_LINHA_EXTERNA:{cld:0,cli:0},INTERFACE_ISOLANTE_PROTEGIDA_POR_DPS:{cld:0,cli:0},
};
// Tabela B.8 — PLD: probabilidade por blindagem Rs e tensão UW
// Linha não blindada ou blindagem não interligada: PLD=1 para qualquer UW
// Blindada interligada, Rs 5-20: cresce com UW (0.95, 0.9, 0.8 só para UW altos)
// Blindada interligada, Rs 1-5: valores corretos da Tabela B.8
// Blindada interligada, Rs ≤ 1: idem
const PLD_MAP: Record<string,Record<string,number>> = {
  AEREO_NAO_BLINDADO:       {"0.35":1,   "0.5":1,    "1.0":1,   "1.5":1,   "2.5":1,    "4.0":1,    "6.0":1   },
  ENTERRADO_NAO_BLINDADO:   {"0.35":1,   "0.5":1,    "1.0":1,   "1.5":1,   "2.5":1,    "4.0":1,    "6.0":1   },
  BLINDADO_5_20_OHM_KM:     {"0.35":1,   "0.5":1,    "1.0":1,   "1.5":1,   "2.5":0.95, "4.0":0.9,  "6.0":0.8 },
  BLINDADO_1_5_OHM_KM:      {"0.35":1,   "0.5":1,    "1.0":0.9, "1.5":0.8, "2.5":0.6,  "4.0":0.3,  "6.0":0.1 },
  BLINDADO_MENOS_1_OHM_KM:  {"0.35":1,   "0.5":0.85, "1.0":0.6, "1.5":0.4, "2.5":0.2,  "4.0":0.04, "6.0":0.02},
};
// Tabela B.9 — PLI: probabilidade por tipo de linha e tensão UW.
// A Tabela B.9 não possui colunas 0.35 e 0.5 kV; por isso, o campo de UW da linha
// usa apenas o domínio comum do cálculo completo PLD/PLI: 1, 1.5, 2.5, 4 e 6 kV.
const PLI_MAP: Record<string,Record<string,number>> = {
  ENERGIA: {"1.0":1, "1.5":0.6, "2.5":0.3, "4.0":0.16, "6.0":0.1},
  SINAL:   {"1.0":1, "1.5":0.5, "2.5":0.2, "4.0":0.08, "6.0":0.04},
};
const LF_MAP: Record<string,number> = { HOSPITAL:0.1,INDUSTRIAL:0.02,ESCRITORIO:0.01,ENTRETENIMENTO_PUBLICO:0.05,RISCO_EXPLOSAO:0.1,OUTROS:0.01 };
const RF_MAP: Record<string,number> = { "1":1,"0.1a":0.1,"0.001a":0.001,"0.1b":0.1,"0.01":0.01,"0.001b":0.001,"0":0 };

// ─── Calculation helpers ──────────────────────────────────────────────────────

function periodo(n:number):string {
  if(!n||n===0)return "∞";const a=1/n;
  if(a<1/12)return `${(a*365).toFixed(1)} dias/evt`;
  if(a<1)return `${(a*12).toFixed(1)} meses/evt`;
  return `${a.toFixed(1)} anos/evt`;
}
function fmtE(v:number):string {
  if(v===0)return "0";if(!isFinite(v))return "∞";
  const e=Math.floor(Math.log10(Math.abs(v)));const m=v/Math.pow(10,e);
  const sup=String(e).split("").map(c=>c==="-"?"⁻":("⁰¹²³⁴⁵⁶⁷⁸⁹"[parseInt(c)]||c)).join("");
  return `${m.toFixed(2)} × 10${sup}`;
}
function fmtM2(v:number):string { if(!isFinite(v)||isNaN(v))return "0"; return `${v.toFixed(v>=10000?0:2).replace(/\B(?=(\d{3})+(?!\d))/g,".")}` }

// ─── Types ────────────────────────────────────────────────────────────────────
interface TrechoSL { id:string;comprimento_m:number;instalacao_ci:string;tipo_ct:string;ambiente_ce:string;blindagem_rs:string;uw_kv:string; }
interface EstAdj { l_adj:number;w_adj:number;h_adj:number;cdj:string;ct_adj:string; }
interface Linha { id:string;nome:string;tipo_linha:string;ptu:string;peb:string;cld_cli:string;trechos:TrechoSL[];adj:EstAdj; }
interface Zona {
  id:string;nome:string;
  blindagem:boolean;wm1:number;wm2:number;
  ks3e:string;ks3s:string;pspd:string;uw_equip:string;
  hz:string;nz:number;tz_mode:"h_dia"|"h_ano";tz_valor:number;
  lf_custom:boolean;lf_tipo:string;lo:string;rt:string;rf:string;rp:string;
  tem_l3:boolean;val_pat:number;val_edif_l3:number;
  habilitar_f:boolean;ft_sistema:string;zpr0a:boolean;
  habilitar_l4:boolean;tipo_l4:string;l4_base_perdas:string;l4_usar_relacoes_valor:boolean;val_animais:number;val_edif_l4:number;val_conteudo:number;val_sistemas:number;
}

function novoTrecho(id:string):TrechoSL { return {id,comprimento_m:1000,instalacao_ci:"ENTERRADO",tipo_ct:"BT_SINAL",ambiente_ce:"URBANO",blindagem_rs:"ENTERRADO_NAO_BLINDADO",uw_kv:"1.5"}; }
function novaLinha(id:string,nome:string,tipo:string):Linha { return {id,nome,tipo_linha:tipo,ptu:"AVISOS_ALERTA",peb:"NENHUM",cld_cli:tipo==="SINAL"?"INTERFACE_ISOLANTE_PROTEGIDA_POR_DPS":"AEREO_NAO_BLINDADO",trechos:[novoTrecho("T01")],adj:{l_adj:0,w_adj:0,h_adj:0,cdj:"CERCADA_MESMA_ALTURA",ct_adj:"BT_SINAL"}}; }
function novaZona(id:string):Zona { return {id,nome:`Zona ${id}`,blindagem:false,wm1:20,wm2:0,ks3e:"1",ks3s:"1",pspd:"0.01",uw_equip:"1.0",hz:"1",nz:100,tz_mode:"h_ano",tz_valor:2920,lf_custom:false,lf_tipo:"ESCRITORIO",lo:"0",rt:"0.001",rf:"0.001b",rp:"0.5",tem_l3:false,val_pat:10,val_edif_l3:12,habilitar_f:true,ft_sistema:"0.1",zpr0a:false,habilitar_l4:false,tipo_l4:"USAR_TIPO_L1",l4_base_perdas:"ANEXO_D",l4_usar_relacoes_valor:false,val_animais:0,val_edif_l4:12,val_conteudo:20,val_sistemas:0}; }


type CalcPayloadParams = {
  L:number; W:number; H:number; Hp:number; NG:number;
  loc:string; pb:string; pta:string; nt:number; lfEst:string; rsEst:string;
  zonas:Zona[]; linhas:Linha[];
};

function montarCalcPayload(p: CalcPayloadParams) {
  const resolvedLF = (z:Zona) =>
    z.lf_custom ? (LF_MAP[z.lf_tipo]??0.01) : (LF_MAP[p.lfEst]??0.01);
  const rfNum = (rf:string):number => RF_MAP[rf]??0.01;
  const cpL3 = (z:Zona) => z.val_pat / Math.max(z.val_edif_l3, 1);

  return {
    estrutura: {
      L: p.L,
      W: p.W,
      H: p.H,
      Hp: p.Hp,
      NG: p.NG,
      loc: p.loc,
      pb: PB_MAP[p.pb] ?? 1,
      pta: PTA_MAP[p.pta] ?? 1,
      nt: p.nt,
      tipo_estrutura: p.lfEst,
      tipo_construcao: ({"ALVENARIA_CONCRETO":"ALV_CONCRETO","MADEIRA":"MADEIRA"} as Record<string,string>)[p.rsEst]||"ALV_CONCRETO",
    },
    zonas: p.zonas.map(z => ({
      id: z.id,
      nome: z.nome,
      nz: z.nz,
      tz_mode: z.tz_mode,
      tz_valor: z.tz_valor,
      rt: parseFloat(z.rt) || 0.001,
      rf: rfNum(z.rf),
      rp: parseFloat(z.rp) || 0.5,
      hz: z.hz==="5b" ? 5 : z.hz==="10b" ? 10 : parseFloat(z.hz) || 1,
      lf_valor: resolvedLF(z),
      lf_custom: z.lf_custom,
      lo: parseFloat(z.lo) || 0,
      tem_lo: (parseFloat(z.lo)||0) > 0,
      pspd: parseFloat(z.pspd) || 0.01,
      ks3: Math.max(parseFloat(z.ks3e)||1, parseFloat(z.ks3s)||1),
      ks3_energia: parseFloat(z.ks3e) || 1,
      ks3_sinal: parseFloat(z.ks3s) || 1,
      blindagem: z.blindagem,
      wm1: z.wm1,
      wm2: z.wm2,
      uw_equip: parseFloat(z.uw_equip) || 1.0,
      tem_l3: z.tem_l3,
      cp_l3: cpL3(z),
      habilitar_f: z.habilitar_f,
      ft_sistema: parseFloat(z.ft_sistema) || 0.1,
      zpr0a: z.zpr0a,
      habilitar_l4: z.habilitar_l4,
      tipo_estrutura_l4: z.tipo_l4 || "USAR_TIPO_L1",
      l4_base_perdas: "ANEXO_D",
      l4_usar_relacoes_valor: Boolean(z.l4_usar_relacoes_valor),
      val_animais: Number.isFinite(Number(z.val_animais)) ? Number(z.val_animais) : 0,
      val_edificio: Number.isFinite(Number(z.val_edif_l4)) ? Number(z.val_edif_l4) : 0,
      val_conteudo: Number.isFinite(Number(z.val_conteudo)) ? Number(z.val_conteudo) : 0,
      val_sistemas: Number.isFinite(Number(z.val_sistemas)) ? Number(z.val_sistemas) : 0,
    })),
    linhas: p.linhas.map(l => ({
      id: l.id,
      nome: l.nome,
      tipo_linha: l.tipo_linha,
      ptu: l.ptu,
      peb: l.peb,
      cld_cli: l.cld_cli,
      trechos: l.trechos.map(t => ({
        id: t.id,
        comprimento_m: t.comprimento_m,
        instalacao_ci: t.instalacao_ci,
        tipo_ct: t.tipo_ct,
        ambiente_ce: t.ambiente_ce,
        blindagem_rs: t.blindagem_rs,
        uw_kv: parseFloat(t.uw_kv) || 1.5,
      })),
      adj: {
        l_adj: l.adj.l_adj,
        w_adj: l.adj.w_adj,
        h_adj: l.adj.h_adj,
        cdj: l.adj.cdj,
        ct_adj: l.adj.ct_adj,
      },
    })),
  };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
const FL = "text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1 flex items-center gap-1";
const INP = "w-full min-w-0 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500";
const INP_STYLE = {background:"#1a2035",border:"1px solid #2a3555",colorScheme:"dark" as const};

function Sel({value,onChange,options}:{value:string;onChange:(v:string)=>void;options:{v:string;l:string}[]}) {
  return (
    <div className="relative w-full min-w-0 overflow-hidden">
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full min-w-0 appearance-none text-white text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none cursor-pointer truncate"
        style={{background:"#1a2035",border:"1px solid #2a3555",colorScheme:"dark",maxWidth:"100%",boxSizing:"border-box"}}>
        {options.map(o=><option key={o.v} value={o.v} style={{background:"#1a2035",color:"white"}}>{o.l}</option>)}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6"/></svg>
    </div>
  );
}

// Section header (module-level, not nested)
function SecHdr({n,icon:Icon,title,open,toggle}:{n:number;icon:any;title:string;open:boolean;toggle:()=>void}) {
  return (
    <button onClick={toggle} className={`w-full flex items-center gap-3 px-5 py-3 ${A.sectionHdr} transition-colors rounded-t-xl`}>
      <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">{n}</span>
      <Icon className="w-5 h-5 text-blue-400 shrink-0"/>
      <span className="font-semibold text-white">{title}</span>
      <span className="ml-auto text-gray-400">{open?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</span>
    </button>
  );
}

// SVG Gauge (semi-circle) — maior, com % e rótulos
function Gauge({val,rt,label}:{val:number;rt:number;label:string}) {
  const maxScale = rt > 0 ? rt * 3 : 1;
  const ratio    = Math.min(isFinite(val/maxScale) ? val/maxScale : 0, 1);
  const rtRatio  = 1 / 3;
  const cx = 100; const cy = 90; const R = 72;
  const toXY = (r:number) => ({ x: cx - R * Math.cos(Math.PI * r), y: cy - R * Math.sin(Math.PI * r) });
  const rtPt  = toXY(rtRatio);
  const endPt = toXY(ratio);
  const isOver = val > rt;
  const pct = rt > 0 ? (val / rt * 100).toFixed(1) : "∞";
  const nx = cx - 64*Math.cos(Math.PI*ratio);
  const ny = cy - 64*Math.sin(Math.PI*ratio);
  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[220px]">
      <path d={`M${cx-R},${cy} A${R},${R} 0 0,1 ${cx+R},${cy}`} fill="none" stroke="#1e3a5f" strokeWidth="14" strokeLinecap="round"/>
      <path d={`M${cx-R},${cy} A${R},${R} 0 0,1 ${rtPt.x.toFixed(1)},${rtPt.y.toFixed(1)}`} fill="none" stroke="#22c55e" strokeWidth="14" strokeLinecap="round"/>
      {isOver && <path d={`M${rtPt.x.toFixed(1)},${rtPt.y.toFixed(1)} A${R},${R} 0 0,1 ${endPt.x.toFixed(1)},${endPt.y.toFixed(1)}`} fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round"/>}
      <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke={isOver?"#ef4444":"#3b82f6"} strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="4" fill={isOver?"#ef4444":"#3b82f6"}/>
      <circle cx={rtPt.x.toFixed(1)} cy={rtPt.y.toFixed(1)} r="3" fill="#fff" opacity="0.6"/>
      <text x={cx} y={cy-16} textAnchor="middle" fill={isOver?"#ef4444":"#3b82f6"} fontSize="11" fontWeight="bold">{label}={fmtE(val)}</text>
      <text x={cx} y={cy-3}  textAnchor="middle" fill="#6b7280" fontSize="8">Ref: RT={fmtE(rt)}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fill={isOver?"#ef4444":"#93c5fd"} fontSize="9" fontWeight="bold">{pct}% do RT</text>
      <text x={cx-R-4} y={cy+4} textAnchor="end"   fill="#4b5563" fontSize="7">0</text>
      <text x={cx+R+4} y={cy+4} textAnchor="start" fill="#4b5563" fontSize="7">3×RT</text>
    </svg>
  );
}

// SVG Bar Chart — maior, labels giradas, tooltip React via state
function BarChart({data,rt}:{data:{label:string;value:number;color:string;tooltip?:string}[];rt:number}) {
  const [hovered,setHovered] = React.useState<number|null>(null);
  if(data.length===0) return <div className="text-xs text-gray-500 text-center py-8">Nenhum componente relevante</div>;
  const maxVal = Math.max(...data.map(d=>d.value), rt*1.4, 1e-20);
  const W=500; const H=220;
  const pad={l:72,r:110,t:24,b:48};
  const cw=W-pad.l-pad.r; const ch=H-pad.t-pad.b;
  const slot=cw/Math.max(data.length,1);
  const barW=Math.min(40, slot*0.55);
  const rtY=pad.t+ch*(1-rt/maxVal);
  const nonZero=data.filter(d=>d.value>0).length;
  const minBarH=2; // barra mínima visual para não-zero
  return (
    <div className="relative w-full overflow-hidden" style={{paddingBottom:"0"}}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Grid horizontal */}
        {[0,0.25,0.5,0.75,1].map(r=>{
          const y=pad.t+ch*(1-r); const v=maxVal*r;
          return <g key={r}>
            <line x1={pad.l} y1={y} x2={pad.l+cw} y2={y} stroke="#1e3a5f" strokeWidth="0.5"/>
            <text x={pad.l-5} y={y+3} textAnchor="end" fill="#6b7280" fontSize="8">{fmtE(v)}</text>
          </g>;
        })}
        {/* Eixos */}
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t+ch} stroke="#2a3555" strokeWidth="1"/>
        <line x1={pad.l} y1={pad.t+ch} x2={pad.l+cw} y2={pad.t+ch} stroke="#2a3555" strokeWidth="1"/>
        {/* Linha RT */}
        {rt>0&&rt<=maxVal&&<>
          <line x1={pad.l} y1={rtY} x2={pad.l+cw+100} y2={rtY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="5,3"/>
          <text x={pad.l+cw+5} y={rtY-3} fill="#ef4444" fontSize="8">RT={fmtE(rt)}</text>
        </>}
        {/* Barras */}
        {data.map((d,i)=>{
          const rawH=ch*(d.value/maxVal);
          const bh=d.value>0?Math.max(minBarH,rawH):0;
          const x=pad.l+i*slot+(slot-barW)/2;
          const y=pad.t+ch-bh;
          const isH=hovered===i;
          const pctTot=nonZero>0&&d.value>0?(d.value/data.reduce((s,x)=>s+x.value,0)*100).toFixed(1):"0";
          const pctRT=rt>0&&d.value>0?(d.value/rt*100).toFixed(1):"0";
          return <g key={d.label}
            onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}
            style={{cursor:d.value>0?"pointer":"default"}}>
            {bh>0&&<rect x={x} y={y} width={barW} height={bh} fill={d.color} rx="3" opacity={isH?1:0.85}/>}
            {bh>0&&isH&&<rect x={x-1} y={y-1} width={barW+2} height={bh+2} fill="none" stroke="#fff" strokeWidth="1.5" rx="3"/>}
            {/* Label valor acima da barra — só se barra visível e não overlap */}
            {d.value>0&&rawH>6&&(
              <text x={x+barW/2} y={y-4} textAnchor="middle" fill="#e5e7eb" fontSize="7.5" fontWeight={isH?"bold":"normal"}>
                {fmtE(d.value)}
              </text>
            )}
            {/* Label eixo X */}
            <text
              x={x+barW/2} y={pad.t+ch+14}
              textAnchor="middle"
              fill={isH?"#fff":"#9ca3af"}
              fontSize="9"
              fontWeight={isH?"bold":"normal"}>
              {d.label}
            </text>
          </g>;
        })}
      </svg>
      {/* Tooltip HTML sobreposto */}
      {hovered!==null&&data[hovered]&&data[hovered].value>0&&(()=>{
        const d=data[hovered];
        const pctTot=(d.value/Math.max(data.reduce((s,x)=>s+x.value,0),1e-30)*100).toFixed(1);
        const pctRT=rt>0?(d.value/rt*100).toFixed(1):"—";
        return (
          <div className="absolute top-2 left-[72px] bg-[#1a2035] border border-[#2a3555] rounded-xl p-3 text-xs shadow-xl z-20 max-w-[220px] pointer-events-none">
            <p className="font-bold text-white mb-1" style={{color:d.color}}>{d.label} = {fmtE(d.value)}</p>
            <p className="text-gray-400">{pctTot}% do total · {pctRT}% do RT</p>
            {d.tooltip&&<p className="text-gray-500 mt-1 text-[10px] leading-4">{d.tooltip}</p>}
          </div>
        );
      })()}
    </div>
  );
}

// Custom dark-themed checkbox.
// Importante: não usa input/label nativo, porque o foco do input oculto fazia
// o container de rolagem pular ao habilitar/desabilitar opções nas zonas.
function Chk({id,checked,onChange,label,extra}:{id:string;checked:boolean;onChange:(v:boolean)=>void;label?:React.ReactNode;extra?:React.ReactNode}) {
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const scrollEl = e.currentTarget.closest('[data-pda-scroll="true"]') as HTMLElement | null;
    const scrollTop = scrollEl?.scrollTop ?? 0;
    const scrollLeft = scrollEl?.scrollLeft ?? 0;
    const winX = typeof window !== "undefined" ? window.scrollX : 0;
    const winY = typeof window !== "undefined" ? window.scrollY : 0;

    onChange(!checked);

    const restore = () => {
      if (scrollEl) {
        scrollEl.scrollTop = scrollTop;
        scrollEl.scrollLeft = scrollLeft;
      }
      if (typeof window !== "undefined") window.scrollTo(winX, winY);
    };

    requestAnimationFrame(restore);
    window.setTimeout(restore, 0);
  };

  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onMouseDown={e=>e.preventDefault()}
      onClick={toggle}
      className="flex items-center gap-2 cursor-pointer select-none group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
    >
      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all pointer-events-none
          ${checked?"bg-blue-600 border-blue-600":"bg-[#111827] border-[#2a3555] group-hover:border-blue-500"}`}>
        {checked&&<svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
      </span>
      {label&&<span className="text-sm text-gray-300">{label}</span>}
      {extra&&<span className="text-xs text-blue-400">{extra}</span>}
    </button>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnaliseRiscoPage() {
  const [tab,setTab] = useState<TabId>("exemplos");

  // Informações state
  const [s1,setS1]=useState(true);const [s2,setS2]=useState(true);const [s3,setS3]=useState(true);
  const [il2,setIl2]=useState(false);const [il3,setIl3]=useState(false);
  const [obra,setObra]=useState("");const [nomeAn,setNomeAn]=useState("");const [resp,setResp]=useState("");
  const [statusV,setStatusV]=useState("");const [art,setArt]=useState("");const [endV,setEndV]=useState("");
  const [latV,setLatV]=useState("");const [lngV,setLngV]=useState("");
  const [uf,setUf]=useState("SP");const [mun,setMun]=useState("");const [ng,setNg]=useState(12);
  const [ngMan,setNgMan]=useState(false);const [ngManV,setNgManV]=useState(12);
  const [L,setL]=useState(50);const [W,setW]=useState(20);const [H,setH]=useState(15);const [Hp,setHp]=useState(0);
  const [vidro,setVidro]=useState(false);const [loc,setLoc]=useState("CERCADA_MESMA_ALTURA");
  const [pb,setPb]=useState("III:null");const [rsEst,setRsEst]=useState("ALVENARIA_CONCRETO");
  const [nt,setNt]=useState(120);const [lfEst,setLfEst]=useState("ESCRITORIO");const [pta,setPta]=useState("AVISOS_ALERTA");
  const [linhas,setLinhas]=useState<Linha[]>([novaLinha("L01","Linha de Energia","ENERGIA"),novaLinha("L02","Linha de Sinal","SINAL")]);
  const [editNome,setEditNome]=useState<Record<string,boolean>>({});

  // Zonas state
  const [zonas,setZonas]=useState<Zona[]>([novaZona("01")]);
  const [zonaAtiva,setZonaAtiva]=useState("01");
  const [ilL1,setIlL1]=useState(false);const [ilL3,setIlL3]=useState(false);const [ilF,setIlF]=useState(false);const [ilL4,setIlL4]=useState(false);
  const [recL1,setRecL1]=useState(false);const [recL3,setRecL3]=useState(false);const [recF,setRecF]=useState(false);const [recL4,setRecL4]=useState(false);
  const [pdfLoading,setPdfLoading]=useState(false);
  const [pdfError,setPdfError]=useState<string|null>(null);
  const [wordLoading,setWordLoading]=useState(false);
  const [wordError,setWordError]=useState<string|null>(null);
  const [pdfPreviewUrl,setPdfPreviewUrl]=useState<string|null>(null);
  const [pdfPreviewLoading,setPdfPreviewLoading]=useState(false);
  // Resultado do cálculo backend (única fonte de verdade)
  const [calc,setCalc]=useState<CalcResponse|null>(null);
  const [calcLoading,setCalcLoading]=useState(false);
  const [calcError,setCalcError]=useState<string|null>(null);
  // Ref para debounce do cálculo
  const calcTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const calcRequestSeqRef=useRef(0);
  const calcAbortRef=useRef<AbortController|null>(null);
  const saveTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pageRootRef=useRef<HTMLDivElement|null>(null);
  const contentScrollRef=useRef<HTMLDivElement|null>(null);
  const [confirmClearOpen,setConfirmClearOpen]=useState(false);

  function aplicarClienteCadastrado(cliente: Cliente) {
    setObra(nomeCliente(cliente));
    const endereco = enderecoCliente(cliente);
    if (endereco) setEndV(endereco);
    if (cliente.uf_cliente) setUf(cliente.uf_cliente);
    if (cliente.cidade) setMun(cliente.cidade);
  }

  // Mantém esta tela com apenas um ponto de rolagem.
  // O scroll passa a ficar no contentScrollRef, evitando scroll duplo/vazio no body/main.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = pageRootRef.current;
    const main = root?.closest("main") as HTMLElement | null;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousMainOverflow = main?.style.overflow;
    const previousMainMinHeight = main?.style.minHeight;
    const previousMainHeight = main?.style.height;
    const previousMainMaxHeight = main?.style.maxHeight;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    if (main) {
      main.style.overflow = "hidden";
      main.style.minHeight = "0";
      main.style.height = "100dvh";
      main.style.maxHeight = "100dvh";
    }

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      if (main) {
        main.style.overflow = previousMainOverflow ?? "";
        main.style.minHeight = previousMainMinHeight ?? "";
        main.style.height = previousMainHeight ?? "";
        main.style.maxHeight = previousMainMaxHeight ?? "";
      }
    };
  }, []);

  // ─── Persistência localStorage ─────────────────────────────────────────────
  const STORAGE_KEY = 'pda_analise_risco_v1';

  // Carrega estado salvo ao montar (roda só 1x)
  useEffect(()=>{
    if(typeof window==='undefined') return;
    try {
      const saved=localStorage.getItem(STORAGE_KEY);
      if(!saved) return;
      const d=JSON.parse(saved);
      if(d.obra!==undefined) setObra(d.obra);
      if(d.nomeAn!==undefined) setNomeAn(d.nomeAn);
      if(d.resp!==undefined) setResp(d.resp);
      if(d.statusV!==undefined) setStatusV(d.statusV);
      if(d.art!==undefined) setArt(d.art);
      if(d.endV!==undefined) setEndV(d.endV);
      if(d.latV!==undefined) setLatV(d.latV);
      if(d.lngV!==undefined) setLngV(d.lngV);
      if(d.uf!==undefined) setUf(d.uf);
      if(d.mun!==undefined) setMun(d.mun);
      if(d.ng!==undefined) setNg(d.ng);
      if(d.ngMan!==undefined) setNgMan(d.ngMan);
      if(d.ngManV!==undefined) setNgManV(d.ngManV);
      if(d.L!==undefined) setL(d.L);
      if(d.W!==undefined) setW(d.W);
      if(d.H!==undefined) setH(d.H);
      if(d.Hp!==undefined) setHp(d.Hp);
      if(d.vidro!==undefined) setVidro(d.vidro);
      if(d.loc!==undefined) setLoc(d.loc);
      if(d.pb!==undefined) setPb(d.pb);
      if(d.rsEst!==undefined) setRsEst(d.rsEst);
      if(d.nt!==undefined) setNt(d.nt);
      if(d.lfEst!==undefined) setLfEst(d.lfEst);
      if(d.pta!==undefined) setPta(d.pta);
      if(d.linhas && Array.isArray(d.linhas)) setLinhas(d.linhas);
      if(d.zonas && Array.isArray(d.zonas)) {
        setZonas(d.zonas.map((z:any) => ({
          ...novaZona(z.id || "01"),
          ...z,
          uw_equip: z.uw_equip ?? "1.0",
          tipo_l4: z.tipo_l4 ?? z.tipo_estrutura_l4 ?? "USAR_TIPO_L1",
          l4_base_perdas: "ANEXO_D",
          l4_usar_relacoes_valor: Boolean(z.l4_usar_relacoes_valor),
          // Migração de estados antigos: o backend usa val_edificio; a tela usa val_edif_l4.
          val_edif_l4: z.val_edif_l4 ?? z.val_edificio ?? 0,
        })));
      }
      if(d.zonaAtiva!==undefined) setZonaAtiva(d.zonaAtiva);
    } catch(e){ console.warn('[PDA] Erro ao carregar estado salvo:',e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Salva o último resultado calculado para a aba Dimensionamento usar como referência.
  useEffect(()=>{
    if(typeof window==='undefined') return;
    try {
      if(!calc) return;
      localStorage.setItem(ANALISE_RISCO_RESULT_STORAGE_KEY, JSON.stringify({
        salvo_em: new Date().toISOString(),
        obra, nomeAn, resp, art,
        R1_global: calc.R1_global,
        R3_global: calc.R3_global,
        R4_global: calc.R4_global,
        F_global: calc.F_global,
        FT_global: calc.FT_global,
        F_atende: calc.F_atende,
        conforme_norma: calc.conforme_norma,
        zonas_fora_ft: calc.zonas_fora_ft,
      }));
    } catch(e){ console.warn('[PDA] Erro ao salvar resultado para dimensionamento:',e); }
  },[calc,obra,nomeAn,resp,art]);

  // Salva estado no localStorage (debounce 1.5s para não sobrecarregar)
  useEffect(()=>{
    if(typeof window==='undefined') return;
    if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current=setTimeout(()=>{
      try {
        localStorage.setItem(STORAGE_KEY,JSON.stringify({
          obra,nomeAn,resp,statusV,art,endV,latV,lngV,
          uf,mun,ng,ngMan,ngManV,
          L,W,H,Hp,vidro,loc,pb,rsEst,nt,lfEst,pta,
          linhas,zonas,zonaAtiva,
        }));
      } catch(e){ console.warn('[PDA] Erro ao salvar estado:',e); }
    },1500);
    return ()=>{ if(saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[obra,nomeAn,resp,statusV,art,endV,latV,lngV,uf,mun,ng,ngMan,ngManV,
     L,W,H,Hp,vidro,loc,pb,rsEst,nt,lfEst,pta,
     JSON.stringify(linhas),JSON.stringify(zonas),zonaAtiva]);
  const [reportColor,setReportColor]=useState("#0d5c4a");

  // ── Constrói payload para o endpoint /calcular ──────────────────────────────
  function buildCalcPayload() {
    return montarCalcPayload({
      L,
      W,
      H,
      Hp,
      NG,
      loc,
      pb,
      pta,
      nt,
      lfEst,
      rsEst,
      zonas,
      linhas,
    });
  }

  // Chama o backend para calcular — debounce de 600ms feito via useEffect.
  // Usa sequência + AbortController para evitar que uma resposta antiga sobrescreva
  // o cálculo mais recente. Isso é importante ao aplicar cenários de exemplo,
  // pois vários estados são alterados de uma vez e podem existir requisições em voo.
  async function triggerCalc(payloadOverride?: ReturnType<typeof montarCalcPayload>) {
    const requestId = calcRequestSeqRef.current + 1;
    calcRequestSeqRef.current = requestId;

    if (calcAbortRef.current) calcAbortRef.current.abort();
    const controller = new AbortController();
    calcAbortRef.current = controller;

    setCalcLoading(true);
    setCalcError(null);

    try {
      const result = await calcularPDA(payloadOverride ?? buildCalcPayload(), controller.signal);
      if (requestId !== calcRequestSeqRef.current) return;
      setCalc(result);
      // Invalida preview PDF pois os dados mudaram
      if(pdfPreviewUrl){ URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }
    } catch(e:any) {
      if (e?.name === "AbortError") return;
      if (requestId !== calcRequestSeqRef.current) return;
      setCalcError(e?.message||"Erro ao calcular");
    }
    finally {
      if (requestId === calcRequestSeqRef.current) {
        setCalcLoading(false);
        calcAbortRef.current = null;
      }
    }
  }

  useEffect(() => {
    return () => {
      if (calcAbortRef.current) calcAbortRef.current.abort();
      if (calcTimerRef.current) clearTimeout(calcTimerRef.current);
    };
  }, []);

    // Auto-calcula no backend quando dados mudam (debounce 600ms)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(calcTimerRef.current) clearTimeout(calcTimerRef.current);
    calcTimerRef.current = setTimeout(()=>{
      triggerCalc();
    }, 600);
    return ()=>{ if(calcTimerRef.current) clearTimeout(calcTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[L,W,H,Hp,ng,ngMan,ngManV,loc,pb,pta,nt,lfEst,rsEst,JSON.stringify(zonas),JSON.stringify(linhas)]);

  function planoAprovacaoAtual() {
    return gerarPlanoAprovacaoAnaliseRisco({
      calc,
      zonas: zonas as unknown as Array<Record<string, unknown>>,
      linhas: linhas as unknown as Array<Record<string, unknown>>,
      dimensoes: { L, W, H, Hp },
      pb,
      pta,
    });
  }

    // Build AnaliseRiscoRequest — enums mapeados 1:1 com backend (enums.py)
  function buildPdfRequest():AnaliseRiscoRequest {
    const z0 = zonas[0];

    // SPDA nivel
    const spda_nivel = pb.startsWith("I:")?"I":pb.startsWith("II:")?"II":pb.startsWith("III:")?"III":pb.startsWith("IV:")?"IV":"NENHUM";

    // TipoEstrutura (enums.py) — lfEst já é o valor correto do enum
    // valores: HOSPITAL, HOTEL, ESCOLA, EDIFICIO_CIVICO, ENTRETENIMENTO_PUBLICO,
    //          IGREJA, MUSEU, INDUSTRIAL, COMERCIAL, RESIDENCIAL, AGRICULTURA, ESCRITORIO, RISCO_EXPLOSAO, OUTROS
    const tipoEstruturaEnum = lfEst as any; // lfEst já vem do LF_OPT com valores corretos

    // TipoConstrucao (enums.py): ALV_CONCRETO, MADEIRA, METALICA
    const tipoConstrucaoMap:Record<string,string> = {
      ALVENARIA_CONCRETO:"ALV_CONCRETO", MADEIRA:"MADEIRA", METALICA:"METALICA",
    };

    // TipoPiso (enums.py): TERRA_CONCRETO=0.01, MARMORE_CERAMICA=0.001, BRITA_CARPETE=0.0001, ASFALTO=0.00001
    const tipoPisoMap:Record<string,string> = {
      "0.01":"TERRA_CONCRETO","0.001":"MARMORE_CERAMICA",
      "0.0001":"BRITA_CARPETE","0.00001":"ASFALTO",
    };

    // RiscoIncendio (enums.py): EXPLOSAO=1, ALTO=0.1, NORMAL=0.01, BAIXO=0.001, NENHUM=0
    // z.rf usa chaves do RF_OPT: "1","0.1a","0.1b","0.01","0.001a","0.001b","0"
    const riscoIncendioMap:Record<string,string> = {
      "1":"EXPLOSAO","0.1a":"ALTO","0.1b":"ALTO",
      "0.01":"NORMAL","0.001a":"BAIXO","0.001b":"BAIXO","0":"NENHUM",
    };

    // ProvidenciasIncendio (enums.py): NENHUMA=1, EXTINTORES=0.5, AUTOMATICA=0.2
    const providenciasMap:Record<string,string> = {
      "1":"NENHUMA","0.5":"EXTINTORES","0.2":"AUTOMATICA",
    };

    // PerigoEspecial (enums.py): NENHUM=1, PANICO_BAIXO=2, PANICO_MEDIO=5, PANICO_ALTO=10, EVAC_DIFICIL=5, CONTAM_AMB=20
    // z.hz usa: "1","2","5","10","10b"
    const perigoMap:Record<string,string> = {
      "1":"NENHUM","2":"PANICO_BAIXO","5":"PANICO_MEDIO",
      "5b":"EVAC_DIFICIL","10":"PANICO_ALTO","10b":"PANICO_ALTO",
    };

    // fp_zona — igual ao calcZona do frontend
    const fp_raw = z0.tz_mode==="h_ano" ? z0.tz_valor/8760 : z0.tz_valor*365/8760;
    const horas_presenca = Math.round(fp_raw * 8760);

    return {
      nome_projeto: nomeAn||obra||"Análise PDA",
      NG,
      dimensoes:{L,W,H,H_saliencia:Hp>0?Hp:undefined},
      localizacao:loc as any,
      linhas: linhas.map(l=>({
        nome:l.nome,
        comprimento_m:l.trechos.reduce((s,t)=>s+t.comprimento_m,0)/Math.max(l.trechos.length,1),
        instalacao:(l.trechos[0]?.instalacao_ci||"AEREO") as any,
        tipo:(l.trechos[0]?.tipo_ct||"BT_SINAL") as any,
        ambiente:(l.trechos[0]?.ambiente_ce||"URBANO_ALTAS") as any,
        tensao_suportavel_UW_kV:parseFloat(l.trechos[0]?.uw_kv||"1.5"),
        fator_ptu:PTU_MAP[l.ptu]??1,
        fator_peb:PEB_MAP[l.peb]??1,
        fator_blindagem:CLD_CLI_MAP[l.cld_cli]?.cli??1,
      })),
      fatores:{
        tipo_estrutura:tipoEstruturaEnum,
        tipo_piso:(tipoPisoMap[z0.rt]||"MARMORE_CERAMICA") as any,
        risco_incendio:(riscoIncendioMap[z0.rf]||"NORMAL") as any,
        providencias_incendio:(providenciasMap[z0.rp]||"NENHUMA") as any,
        perigo_especial:(perigoMap[z0.hz]||"NENHUM") as any,
        tipo_construcao:(tipoConstrucaoMap[rsEst]||"ALV_CONCRETO") as any,
        risco_explosao_ou_vida_imediata:(z0.lo||"0")!=="0",
        numero_pessoas_zona:z0.nz||nt,
        numero_pessoas_total:nt,
        horas_ano_presenca:Math.min(horas_presenca, 8760),
      },
      medidas:{
        spda_nivel:spda_nivel as any,
        // Reflete os fatores realmente usados no payload/cálculo:
        // P_SPD por zona e P_EB por linha. Não deixar o laudo imprimir "NENHUM"
        // quando o cálculo usa DPS coordenado ou DPS Classe I de entrada.
        dps_coordenados_nivel:nivelProtecaoFromZonasPspd(zonas) as any,
        dps_classe_I_entrada:nivelProtecaoFromLinhasPeb(linhas) as any,
        aviso_alerta_toque_passo:pta==="AVISOS_ALERTA",
        isolacao_eletrica_descida:pta==="ISOLACAO_ELETRICA_DESCIDA",
        malha_equipotencializacao_solo:pta==="MALHA_EQUIPOTENCIALIZACAO_SOLO",
        descida_natural_estrutura_continua:pta==="ESTRUTURA_METALICA_DESCIDA_NATURAL",
      },
      calcular_r4:true,
      numero_art:art||undefined,
      nome_obra:obra||undefined,
            municipio_uf:mun ? (mun + (uf ? '-' + uf : '')) || undefined : undefined,
      endereco_obra:endV||undefined,
      // Valores calculados pelo backend (único ponto de verdade).
      // O laudo deve refletir estes dados completos; não deve recalcular nem perder
      // os componentes por zona/linha. O cast é necessário porque o schema antigo
      // tipava `valores_calculados` como Record<string, number>, mas o laudo técnico
      // precisa receber também arrays/objetos detalhados.
      valores_calculados: calc ? (() => {
        const zonasCalc: any[] = (calc as any).zonas ?? [];
        const linhasCalc: any[] = (calc as any).linhas ?? [];
        const somaZ = (k: string) => zonasCalc.reduce((s, z) => s + (Number(z?.[k]) || 0), 0);
        const somaL = (k: string) => linhasCalc.reduce((s, l) => s + (Number(l?.[k]) || 0), 0);
        const temR3 = zonas.some(z => z.tem_l3) || zonasCalc.some(z => (Number(z?.R3)||0) || (Number(z?.RB3)||0) || (Number(z?.RV3)||0)) || ((calc as any).R3_global || 0) > 0;
        const temR4 = zonas.some(z => z.habilitar_l4) || zonasCalc.some(z => ["R4","RA4","RB4","RC4","RM4","RU4","RV4","RW4","RZ4"].some(k => Number(z?.[k]) || 0)) || ((calc as any).R4_global || 0) > 0;

        return ({
          RA: calc.RA_g, RB: calc.RB_g, RC: calc.RC_g, RM: calc.RM_g,
          RU: calc.RU_g, RV: calc.RV_g, RW: calc.RW_g, RZ: calc.RZ_g,
          R1: calc.R1_global, R3: calc.R3_global, F: calc.F_global, R4: calc.R4_global,
          R1_global: calc.R1_global, R3_global: calc.R3_global, F_global: calc.F_global, R4_global: calc.R4_global,
          FT: (calc as any).FT_global ?? 0.1, FT_global: (calc as any).FT_global ?? 0.1,
          F_atende: (calc as any).F_atende ?? true, F_conforme: (calc as any).F_atende ?? true,
          conforme_norma: (calc as any).conforme_norma ?? false, zonas_fora_ft: (calc as any).zonas_fora_ft ?? [],
          ng_manual: ngMan, ng_origem: ngMan ? "MANUAL_TESTE" : "ANEXO_F",
          AD: calc.AD, AM: calc.AM, AL: calc.AL, AI: calc.AI, ND: calc.ND, NM: calc.NM,
          NL: somaL("NL_total"), NI: somaL("NI_total"), NDJ: somaL("NDJ"),

          componentes_globais: {
            RA: calc.RA_g, RB: calc.RB_g, RC: calc.RC_g, RM: calc.RM_g,
            RU: calc.RU_g, RV: calc.RV_g, RW: calc.RW_g, RZ: calc.RZ_g,
          },

          FB: somaZ("FB"), FC: somaZ("FC"), FM: somaZ("FM"),
          FV: somaZ("FV"), FW: somaZ("FW"), FZ: somaZ("FZ"),

          RB3: somaZ("RB3"), RV3: somaZ("RV3"),
          RA4: somaZ("RA4"), RB4: somaZ("RB4"), RC4: somaZ("RC4"), RM4: somaZ("RM4"),
          RU4: somaZ("RU4"), RV4: somaZ("RV4"), RW4: somaZ("RW4"), RZ4: somaZ("RZ4"),

          zonas: zonasCalc,
          linhas: linhasCalc,
          tem_R3: temR3,
          tem_R4: temR4,
        } as any);
      })() : undefined,
    };
  }

  async function baixarPDF() {
    setPdfLoading(true);setPdfError(null);
    try {
      const blob = await gerarLaudoPDF(buildPdfRequest());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href=url;a.download=`analise-de-risco-${(obra||nomeAn||"projeto").toLowerCase().replace(/\s+/g,"-")}.pdf`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e:any){setPdfError(e?.message||"Erro ao gerar PDF");}
    finally{setPdfLoading(false);}
  }

  async function baixarWord() {
    setWordLoading(true);setWordError(null);
    try {
      const blob = await gerarLaudoWord(buildPdfRequest());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href=url;a.download=`analise-de-risco-${(obra||nomeAn||"projeto").toLowerCase().replace(/\s+/g,"-")}.docx`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e:any){setWordError(e?.message||"Erro ao gerar Word");}
    finally{setWordLoading(false);}
  }

  async function gerarPreviewPDF() {
    if(pdfPreviewUrl) return; // já gerado
    setPdfPreviewLoading(true);setPdfError(null);
    try {
      const blob = await gerarLaudoPDF(buildPdfRequest());
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
    } catch(e:any){setPdfError(e?.message||"Erro ao gerar pré-visualização");}
    finally{setPdfPreviewLoading(false);}
  }

  // Live calcs (Informações)
  const NG = ngMan?ngManV:ng;
  // Áreas e eventos — do backend (calc)
  const AD = calc?.AD ?? 0;
  const AM = calc?.AM ?? 0;
  const ND = calc?.ND ?? 0;
  const NM = calc?.NM ?? 0;
  function linhaNL(l:Linha){return calcLinhaData(l.id)?.NL_total??0;}
  function linhaNI(l:Linha){return calcLinhaData(l.id)?.NI_total??0;}
  function linhaNDJ(l:Linha){return calcLinhaData(l.id)?.NDJ??0;}

  // Line manipulation
  function addLinha(){const id=`L${Date.now()}`;setLinhas(p=>[...p,novaLinha(id,`Linha ${p.length+1}`,"ENERGIA")]);}
  function delLinha(id:string){setLinhas(p=>p.filter(l=>l.id!==id));}
  function updLinha(id:string,patch:Partial<Linha>){setLinhas(p=>p.map(l=>l.id===id?{...l,...patch}:l));}
  function addTrecho(lid:string){setLinhas(p=>p.map(l=>{if(l.id!==lid)return l;const n=l.trechos.length+1;return {...l,trechos:[...l.trechos,novoTrecho(`T${String(n).padStart(2,"0")}`)]};}));}
  function delTrecho(lid:string,tid:string){setLinhas(p=>p.map(l=>l.id!==lid?l:{...l,trechos:l.trechos.filter(t=>t.id!==tid)}));}
  function updTrecho(lid:string,tid:string,patch:Partial<TrechoSL>){setLinhas(p=>p.map(l=>l.id!==lid?l:{...l,trechos:l.trechos.map(t=>t.id===tid?{...t,...patch}:t)}));}
  function updAdj(lid:string,patch:Partial<EstAdj>){setLinhas(p=>p.map(l=>l.id!==lid?l:{...l,adj:{...l.adj,...patch}}));}

  // Zona manipulation
  function addZona(){const id=String(zonas.length+1).padStart(2,"0");setZonas(p=>[...p,novaZona(id)]);setZonaAtiva(id);}

  function solicitarLimpezaDados(){
    setConfirmClearOpen(true);
  }

  function limparDados(){
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(ANALISE_RISCO_RESULT_STORAGE_KEY); } catch(_e){}
    if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if(calcTimerRef.current) clearTimeout(calcTimerRef.current);
    if(calcAbortRef.current) calcAbortRef.current.abort();
    setConfirmClearOpen(false);
    setObra(""); setNomeAn(""); setResp(""); setStatusV(""); setArt(""); setEndV(""); setLatV(""); setLngV("");
    setUf("SP"); setMun(""); setNg(12); setNgMan(false); setNgManV(12);
    setL(50); setW(20); setH(15); setHp(0); setVidro(false); setLoc("CERCADA_MESMA_ALTURA");
    setPb("III:null"); setRsEst("ALVENARIA_CONCRETO"); setNt(120); setLfEst("OUTROS"); setPta("AVISOS_ALERTA");
    setLinhas([novaLinha("L01","Linha de Energia","ENERGIA"),novaLinha("L02","Linha de Sinal","SINAL")]);
    setZonas([novaZona("01")]); setZonaAtiva("01"); setCalc(null); setCalcError(null); setCalcLoading(false);
    if(pdfPreviewUrl){ URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }
    handleTabChange("exemplos");
  }
  function preencherCenarioExemploNormativo(blindagemAtiva:boolean){
    const linhasExemplo: Linha[] = [
      { id:"L01", nome:"Linha de Energia", tipo_linha:"ENERGIA", ptu:"AVISOS_ALERTA", peb:"II", cld_cli:"ENTERRADO_NAO_BLINDADO", trechos:[{ id:"T01", comprimento_m:500, instalacao_ci:"ENTERRADO", tipo_ct:"BT_SINAL", ambiente_ce:"URBANO", blindagem_rs:"ENTERRADO_NAO_BLINDADO", uw_kv:"1.5" }], adj:{l_adj:0,w_adj:0,h_adj:0,cdj:"CERCADA_MESMA_ALTURA",ct_adj:"BT_SINAL"} },
      { id:"L02", nome:"Linha de Sinal", tipo_linha:"SINAL", ptu:"NENHUMA", peb:"NENHUM", cld_cli:"AEREO_BLINDADO_ATERRADO", trechos:[{ id:"T01", comprimento_m:300, instalacao_ci:"AEREO", tipo_ct:"BT_SINAL", ambiente_ce:"URBANO", blindagem_rs:"BLINDADO_1_5_OHM_KM", uw_kv:"1.5" }], adj:{l_adj:0,w_adj:0,h_adj:0,cdj:"CERCADA_MESMA_ALTURA",ct_adj:"BT_SINAL"} },
    ];

    const zonasExemplo: Zona[] = [
      { ...novaZona("01"), id:"01", nome: blindagemAtiva ? "Zona 01 — Museu técnico / sala crítica — com blindagem" : "Zona 01 — Museu técnico / sala crítica — sem blindagem", blindagem: blindagemAtiva, wm1:5, wm2: blindagemAtiva ? 2 : 0, ks3e:"0.2", ks3s:"0.01", pspd:"0.02", uw_equip:"1.0", hz:"1", nz:50, tz_mode:"h_ano", tz_valor:2920, lf_custom:false, lf_tipo:"ENTRETENIMENTO_PUBLICO", lo:"0.001", rt:"0.01", rf:"0.01", rp:"0.5", tem_l3:true, val_pat:3, val_edif_l3:10, habilitar_f:true, ft_sistema:"0.1", zpr0a:false, habilitar_l4:true, tipo_l4:"MUSEU", l4_base_perdas:"ANEXO_D", l4_usar_relacoes_valor:true, val_animais:0.5, val_edif_l4:3.0, val_conteudo:1.2, val_sistemas:2.0 },
      { ...novaZona("02"), id:"02", nome: blindagemAtiva ? "Zona 02 — Administração / arquivo — com blindagem" : "Zona 02 — Administração / arquivo — sem blindagem", blindagem: blindagemAtiva, wm1:10, wm2: blindagemAtiva ? 1 : 0, ks3e:"0.5", ks3s:"0.2", pspd:"0.05", uw_equip:"1.0", hz:"1", nz:20, tz_mode:"h_ano", tz_valor:2080, lf_custom:true, lf_tipo:"ESCRITORIO", lo:"0.0001", rt:"0.001", rf:"0.001b", rp:"0.2", tem_l3:false, val_pat:0, val_edif_l3:10, habilitar_f:true, ft_sistema:"0.1", zpr0a:false, habilitar_l4:true, tipo_l4:"ESCRITORIO", l4_base_perdas:"ANEXO_D", l4_usar_relacoes_valor:true, val_animais:0, val_edif_l4:1.0, val_conteudo:0.5, val_sistemas:0.8 },
    ];

    setObra(blindagemAtiva ? "Cenário teste — com blindagem espacial interna" : "Cenário teste — sem blindagem espacial interna");
    setNomeAn("Validação normativa — 2 zonas, 2 linhas, R1/R3/F/R4");
    setResp("Teste normativo"); setStatusV("EM_ANDAMENTO"); setArt("TESTE-NBR5419-2026"); setEndV("Cenário fictício para validação de cálculo");
    setUf("SP"); setMun("Cenário manual"); setNgMan(true); setNgManV(10); setNg(10);
    setL(40); setW(20); setH(10); setHp(0); setVidro(false); setLoc("CERCADA_MESMA_ALTURA");
    setPb("III:null"); setRsEst("ALVENARIA_CONCRETO"); setNt(100); setLfEst("ENTRETENIMENTO_PUBLICO"); setPta("AVISOS_ALERTA");
    setLinhas(linhasExemplo); setZonas(zonasExemplo); setZonaAtiva("01");

    // Calcula imediatamente com o payload do cenário, sem depender da próxima
    // renderização do React. Isso evita a tela de análise ficar em zero até
    // alguma alteração manual disparar novo cálculo.
    const payloadExemplo = montarCalcPayload({
      L: 40,
      W: 20,
      H: 10,
      Hp: 0,
      NG: 10,
      loc: "CERCADA_MESMA_ALTURA",
      pb: "III:null",
      pta: "AVISOS_ALERTA",
      nt: 100,
      lfEst: "ENTRETENIMENTO_PUBLICO",
      rsEst: "ALVENARIA_CONCRETO",
      zonas: zonasExemplo,
      linhas: linhasExemplo,
    });
    triggerCalc(payloadExemplo);
    handleTabChange("analises");
  }

  function preencherCenarioRecomendacao(alvo: "I"|"II"|"III"|"IV"|"APROVADO", blindagemAtiva:boolean){
    const perfis = {
      I: {
        titulo: "Recomendação NP I", pb:"II", ng:80, L:80, W:42, H:24, loc:"ISOLADA_TOPO_COLINA",
        lfEst:"RISCO_EXPLOSAO", lfTipo:"RISCO_EXPLOSAO", lfValor:"0.1", lo:"0.01", rf:"0.1b", rp:"1", hz:"10", nt:1200,
        pta:"NENHUMA", pspd:"1", uwEquip:"1.0", ks3Sem:"1", ks3Com:"0.2", wm1:20, wm2:3,
        energiaComp:1800, sinalComp:1200, pebEnergia:"NENHUM", pebSinal:"NENHUM", cldEnergia:"AEREO_NAO_BLINDADO", cldSinal:"AEREO_NAO_BLINDADO",
        shieldEnergia:"AEREO_NAO_BLINDADO", shieldSinal:"AEREO_NAO_BLINDADO", uwLinha:"1.0", temL3:true, valPat:12, valEdifL3:10,
        resumo:"Cenário severo para forçar plano com recomendação de NP I e medidas combinadas."
      },
      II: {
        titulo: "Recomendação NP II", pb:"III", ng:18, L:60, W:32, H:18, loc:"ISOLADA",
        lfEst:"ENTRETENIMENTO_PUBLICO", lfTipo:"ENTRETENIMENTO_PUBLICO", lfValor:"0.05", lo:"0.002", rf:"0.01", rp:"1", hz:"5", nt:650,
        pta:"NENHUMA", pspd:"1", uwEquip:"1.0", ks3Sem:"1", ks3Com:"0.2", wm1:20, wm2:2,
        energiaComp:1200, sinalComp:800, pebEnergia:"NENHUM", pebSinal:"NENHUM", cldEnergia:"AEREO_NAO_BLINDADO", cldSinal:"AEREO_NAO_BLINDADO",
        shieldEnergia:"AEREO_NAO_BLINDADO", shieldSinal:"BLINDADO_5_20_OHM_KM", uwLinha:"1.0", temL3:true, valPat:8, valEdifL3:10,
        resumo:"Cenário intermediário alto para testar recomendação de NP II e revisão de linhas."
      },
      III: {
        titulo: "Recomendação NP III", pb:"IV", ng:34, L:48, W:26, H:12, loc:"ISOLADA",
        lfEst:"ENTRETENIMENTO_PUBLICO", lfTipo:"ENTRETENIMENTO_PUBLICO", lfValor:"0.05", lo:"0.0008", rf:"0.01", rp:"0.5", hz:"2", nt:260,
        pta:"NENHUMA", pspd:"0.05", uwEquip:"1.0", ks3Sem:"1", ks3Com:"0.2", wm1:20, wm2:2,
        energiaComp:900, sinalComp:600, pebEnergia:"NENHUM", pebSinal:"NENHUM", cldEnergia:"AEREO_NAO_BLINDADO", cldSinal:"AEREO_BLINDADO_NAO_ATERRADO",
        shieldEnergia:"AEREO_NAO_BLINDADO", shieldSinal:"BLINDADO_5_20_OHM_KM", uwLinha:"1.5", temL3:false, valPat:0, valEdifL3:10,
        resumo:"Cenário moderado para testar recomendação de NP III."
      },
      IV: {
        titulo: "Recomendação NP IV + MPS", pb:"IV", ng:18, L:55, W:28, H:10, loc:"CERCADA_MESMA_ALTURA",
        lfEst:"ESCRITORIO", lfTipo:"ESCRITORIO", lfValor:"0.01", lo:"0", rf:"0.001b", rp:"0.5", hz:"1", nt:80,
        pta:"AVISOS_ALERTA", pspd:"1", uwEquip:"1.0", ks3Sem:"1", ks3Com:"0.2", wm1:20, wm2:2,
        energiaComp:1800, sinalComp:1400, pebEnergia:"NENHUM", pebSinal:"NENHUM", cldEnergia:"AEREO_NAO_BLINDADO", cldSinal:"AEREO_NAO_BLINDADO",
        shieldEnergia:"AEREO_NAO_BLINDADO", shieldSinal:"AEREO_NAO_BLINDADO", uwLinha:"1.0", temL3:false, valPat:0, valEdifL3:10,
        resumo:"Cenário com R dentro do limite e F fora, para testar recomendação mantendo NP IV e focando MPS/DPS/ZPR."
      },
      APROVADO: {
        titulo: "Laudo aprovado", pb:"III", ng:1.5, L:35, W:18, H:8, loc:"CERCADA_OBJETOS_MAIS_ALTOS",
        lfEst:"ESCRITORIO", lfTipo:"ESCRITORIO", lfValor:"0.01", lo:"0", rf:"0.001b", rp:"0.2", hz:"1", nt:25,
        pta:"RESTRICOES_FISICAS_FIXAS", pspd:"0.005", uwEquip:"4.0", ks3Sem:"0.01", ks3Com:"0.0001", wm1:10, wm2:1,
        energiaComp:120, sinalComp:100, pebEnergia:"NP1_MAX", pebSinal:"NP1_MAX", cldEnergia:"CABO_PROTECAO_METALICO", cldSinal:"INTERFACE_ISOLANTE_PROTEGIDA_POR_DPS",
        shieldEnergia:"BLINDADO_MENOS_1_OHM_KM", shieldSinal:"BLINDADO_MENOS_1_OHM_KM", uwLinha:"6.0", temL3:false, valPat:0, valEdifL3:10,
        resumo:"Cenário de referência para verificar laudo aprovado e manutenção da conformidade."
      },
    } as const;

    const p = perfis[alvo];
    const ks3 = blindagemAtiva ? p.ks3Com : p.ks3Sem;
    const linhasExemplo: Linha[] = [
      {
        id:"L01", nome:"Linha de Energia", tipo_linha:"ENERGIA", ptu:p.pta, peb:p.pebEnergia, cld_cli:p.cldEnergia,
        trechos:[{ id:"T01", comprimento_m:p.energiaComp, instalacao_ci:"AEREO", tipo_ct:"BT_SINAL", ambiente_ce:"RURAL", blindagem_rs:p.shieldEnergia, uw_kv:p.uwLinha }],
        adj:{l_adj:0,w_adj:0,h_adj:0,cdj:"CERCADA_MESMA_ALTURA",ct_adj:"BT_SINAL"}
      },
      {
        id:"L02", nome:"Linha de Sinal", tipo_linha:"SINAL", ptu:p.pta, peb:p.pebSinal, cld_cli:p.cldSinal,
        trechos:[{ id:"T01", comprimento_m:p.sinalComp, instalacao_ci:"AEREO", tipo_ct:"BT_SINAL", ambiente_ce:"RURAL", blindagem_rs:p.shieldSinal, uw_kv:p.uwLinha }],
        adj:{l_adj:0,w_adj:0,h_adj:0,cdj:"CERCADA_MESMA_ALTURA",ct_adj:"BT_SINAL"}
      },
    ];

    const zonasExemplo: Zona[] = [
      {
        ...novaZona("01"),
        id:"01",
        nome:`${p.titulo} — ${blindagemAtiva ? "com blindagem espacial interna" : "sem blindagem espacial interna"}`,
        blindagem: blindagemAtiva,
        wm1:p.wm1,
        wm2: blindagemAtiva ? p.wm2 : 0,
        ks3e:ks3,
        ks3s:ks3,
        pspd:p.pspd,
        uw_equip:p.uwEquip,
        hz:p.hz,
        nz:p.nt,
        tz_mode:"h_ano",
        tz_valor:2920,
        lf_custom:true,
        lf_tipo:p.lfTipo,
        lo:p.lo,
        rt:"0.001",
        rf:p.rf,
        rp:p.rp,
        tem_l3:p.temL3,
        val_pat:p.valPat,
        val_edif_l3:p.valEdifL3,
        habilitar_f:true,
        ft_sistema:"0.1",
        zpr0a:false,
        habilitar_l4:true,
        tipo_l4:p.lfEst,
        l4_base_perdas:"ANEXO_D",
        l4_usar_relacoes_valor:true,
        val_animais:0,
        val_edif_l4:1,
        val_conteudo:0.5,
        val_sistemas:1,
      }
    ];

    setObra(`${p.titulo} — ${blindagemAtiva ? "com blindagem" : "sem blindagem"}`);
    setNomeAn(`${p.resumo} ${blindagemAtiva ? "Versão com blindagem espacial interna." : "Versão sem blindagem espacial interna."}`);
    setResp("Teste normativo"); setStatusV("EM_ANDAMENTO"); setArt("TESTE-NBR5419-2026"); setEndV("Cenário fictício para validação de recomendação");
    setUf("SP"); setMun("Cenário manual"); setNgMan(true); setNgManV(p.ng); setNg(p.ng);
    setL(p.L); setW(p.W); setH(p.H); setHp(0); setVidro(false); setLoc(p.loc);
    setPb(`${p.pb}:null`); setRsEst("ALVENARIA_CONCRETO"); setNt(p.nt); setLfEst(p.lfEst); setPta(p.pta);
    setLinhas(linhasExemplo); setZonas(zonasExemplo); setZonaAtiva("01");

    const payloadExemplo = montarCalcPayload({
      L:p.L, W:p.W, H:p.H, Hp:0, NG:p.ng, loc:p.loc, pb:`${p.pb}:null`, pta:p.pta,
      nt:p.nt, lfEst:p.lfEst, rsEst:"ALVENARIA_CONCRETO", zonas:zonasExemplo, linhas:linhasExemplo,
    });
    triggerCalc(payloadExemplo);
    handleTabChange("analises");
  }

  function delZona(id:string){if(zonas.length===1)return;const nz=zonas.filter(z=>z.id!==id);setZonas(nz);if(zonaAtiva===id)setZonaAtiva(nz[0].id);}
  function updZona(id:string,patch:Partial<Zona>){setZonas(p=>p.map(z=>z.id===id?{...z,...patch}:z));}


  const zona = zonas.find(z=>z.id===zonaAtiva)||zonas[0];
  // Dados calculados pelo backend — fallback para zeros enquanto carrega
  const calcZonaData = (zid:string) => calc?.zonas.find(z=>z.id===zid);
  const calcLinhaData = (lid:string) => calc?.linhas.find(l=>l.id===lid);
  const calcTrechoData = (lid:string,tid:string) => calcLinhaData(lid)?.trechos.find(t=>t.id===tid);
  const zc = calcZonaData(zona.id);
  const RT1=1e-5,RT3=1e-4,RT4=1e-3;

  // Corrige o “scroll extra” ao alternar abas.
  // Agora a rolagem real da página fica no container contentScrollRef.
  const resetScrollPosition = useCallback(() => {
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });

      const main = pageRootRef.current?.closest("main") as HTMLElement | null;
      main?.scrollTo({ top: 0, left: 0, behavior: "auto" });

      document.documentElement.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.body.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, []);

  const handleTabChange = useCallback((nextTab: TabId) => {
    setTab(nextTab);
    resetScrollPosition();
  }, [resetScrollPosition]);

  useEffect(() => {
    resetScrollPosition();
  }, [tab, resetScrollPosition]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div ref={pageRootRef} className="bg-[#0d1117] text-white h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden flex flex-col">
      {/* Tab bar — sticky abaixo do header do app-shell (h-14 = 56px) */}
      <div className="shrink-0 sticky top-0 z-20 bg-[#0d1117] border-b border-[#1e2a3a] px-4 py-2">
        <div className="flex items-center gap-2 max-w-5xl mx-auto flex-wrap">
          {/* Loading indicator */}
          {calcLoading&&<span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-900/20 border border-blue-500/20 px-2 py-0.5 rounded-full">
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            Calculando…
          </span>}
          {calcError&&<span className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 px-2 py-0.5 rounded-full cursor-pointer" onClick={() => triggerCalc()}>⚠ {calcError} — clique para recalcular</span>}
          {TABS.map(({id,label,icon:Icon})=>{
            const active=tab===id;
            return <button key={id} onClick={()=>handleTabChange(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${active?`${A.bg} text-white shadow-lg ${A.shadow}`:"text-gray-400 hover:text-white hover:bg-[#1a2035]"}`}>
              <Icon className="w-4 h-4"/>{label}
            </button>;
          })}
          <button onClick={solicitarLimpezaDados} title="Limpar todos os dados da análise"
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-300 border border-[#2a3555] hover:border-red-500/40 bg-[#0d1117] px-2.5 py-1 rounded-full transition-colors shrink-0">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Limpar tela
          </button>
        </div>
      </div>

      <div ref={contentScrollRef} data-pda-scroll="true" style={{ overflowAnchor: "none" }} className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-28">

        {/* ═══ EXEMPLOS ═══ */}
        {tab==="exemplos" && (
          <div className="space-y-6 min-w-0">
            <section className="rounded-2xl border border-[#1f2a44] bg-[#0b1020] p-6 shadow-lg">
              <div className="flex items-start gap-4">
                <Activity className="w-8 h-8 text-blue-400 shrink-0 mt-1"/>
                <div>
                  <h2 className="text-xl font-bold text-white">Exemplos normativos para validação</h2>
                  <p className="text-sm text-gray-400 mt-2 max-w-3xl">Preencha automaticamente cenários completos para validar cálculo, plano de adequação, níveis de proteção, blindagem espacial interna, frequência F, R1, R3 e L4 pelo Anexo D da NBR 5419-2:2026.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button onClick={()=>preencherCenarioExemploNormativo(false)} className="px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold shadow-lg">Cenário clássico SEM blindagem</button>
                <button onClick={()=>preencherCenarioExemploNormativo(true)} className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg">Cenário clássico COM blindagem</button>
                <button onClick={solicitarLimpezaDados} className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-950/20 hover:bg-red-900/30 text-red-200 font-semibold transition-colors">Limpar tela</button>
              </div>

              <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-950/10 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-blue-200">Cenários de recomendação para validação do laudo</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-3xl">Use estes exemplos para conferir se a tela e o PDF geram recomendações coerentes para NP I, NP II, NP III, NP IV e laudo aprovado. Cada cenário possui versão com e sem blindagem espacial interna.</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
                  {[
                    { id:"I", titulo:"NP I", desc:"risco severo" },
                    { id:"II", titulo:"NP II", desc:"risco alto" },
                    { id:"III", titulo:"NP III", desc:"risco moderado" },
                    { id:"IV", titulo:"NP IV", desc:"F crítico / MPS" },
                    { id:"APROVADO", titulo:"Aprovado", desc:"manutenção" },
                  ].map((item)=> (
                    <div key={item.id} className="rounded-xl bg-[#111827] border border-[#2a3555] p-3 space-y-2">
                      <div>
                        <p className="text-sm font-bold text-white">{item.titulo}</p>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wide">{item.desc}</p>
                      </div>
                      <button onClick={()=>preencherCenarioRecomendacao(item.id as "I"|"II"|"III"|"IV"|"APROVADO", false)} className="w-full px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600/50 text-gray-100 text-xs font-semibold transition-colors">Sem blindagem</button>
                      <button onClick={()=>preencherCenarioRecomendacao(item.id as "I"|"II"|"III"|"IV"|"APROVADO", true)} className="w-full px-3 py-2 rounded-lg bg-blue-700/80 hover:bg-blue-700 border border-blue-400/30 text-white text-xs font-semibold transition-colors">Com blindagem</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div className="rounded-xl bg-[#111827] border border-[#2a3555] p-4">
                  <p className="font-semibold text-white mb-2">O que será preenchido</p>
                  <p>Os cenários alteram geometria, NG, PB/NP adotado, DPS, linhas externas, perdas, zonas e blindagem para exercitar recomendações diferentes.</p>
                </div>
                <div className="rounded-xl bg-[#111827] border border-[#2a3555] p-4">
                  <p className="font-semibold text-white mb-2">Validação esperada</p>
                  <p>Depois de carregar, gere o PDF e confira se o plano indica somente as medidas necessárias pelos resultados reais calculados. O cenário aprovado deve trazer apenas manutenção da conformidade.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ═══ INFORMAÇÕES ═══ */}
        {tab==="informacoes" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-200">Etapas da Análise</h2>
            {/* Seção 1 */}
            <div className="rounded-xl overflow-hidden">
              <SecHdr n={1} icon={ClipboardList} title="Dados do Cliente / Avaliação" open={s1} toggle={()=>setS1(v=>!v)}/>
              {s1&&<div className="bg-[#111827] p-5 space-y-4 rounded-b-xl">
                <ClienteAutocomplete
                  label="Buscar cliente cadastrado"
                  value={obra}
                  onValueChange={setObra}
                  onSelect={aplicarClienteCadastrado}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[["Obra / Cliente",obra,setObra],["Nome da Análise",nomeAn,setNomeAn],["Responsável Técnico",resp,setResp]].map(([lbl,val,set]:any)=>
                    <div key={lbl}><p className={FL}>{lbl}</p><input className={INP} style={INP_STYLE} value={val} onChange={e=>set(e.target.value)}/></div>)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><p className={FL}>Status</p><Sel value={statusV} onChange={setStatusV} options={STATUS_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div><p className={FL}>ART / RT / TRT</p><input className={INP} style={INP_STYLE} placeholder="Nº do documento" value={art} onChange={e=>setArt(e.target.value)}/></div>
                </div>
                <div><p className={FL}>Endereço Completo <Info className="w-3 h-3 text-gray-500"/></p><input className={INP} style={INP_STYLE} placeholder="Rua, nº, bairro, CEP" value={endV} onChange={e=>setEndV(e.target.value)}/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className={FL}>Latitude</p><input className={INP} style={INP_STYLE} placeholder="Ex: -19.9167" value={latV} onChange={e=>setLatV(e.target.value)}/></div>
                  <div><p className={FL}>Longitude</p><input className={INP} style={INP_STYLE} placeholder="Ex: -43.9345" value={lngV} onChange={e=>setLngV(e.target.value)}/></div>
                </div>
                <div className="flex items-center gap-3">
                  <Chk id="ngMan" checked={ngMan} onChange={setNgMan} label={<span className="flex items-center gap-1">Informar NG manualmente <Info className="w-3.5 h-3.5 text-gray-500"/></span>}/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  {ngMan?<div><p className={FL}>NG manual</p><input type="number" className={INP} style={INP_STYLE} value={ngManV} onChange={e=>setNgManV(Number(e.target.value))} min={0}/></div>
                  :<><div><p className={FL}>UF</p><select value={uf} onChange={e=>setUf(e.target.value)} className={`${INP} cursor-pointer appearance-none pr-8`} style={INP_STYLE}>{UFS.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                    <div><p className={FL}>Município</p><MunicipioAutocomplete uf={uf} value={mun} onChange={(m,ngVal)=>{setMun(m);if(ngVal)setNg(ngVal);}}/></div></>}
                  <div><p className={FL}>NG <Info className="w-3 h-3 text-gray-500"/></p>
                    <div className={`${A.ngCard} border rounded-xl px-4 py-3 flex items-center gap-3`}>
                      <Zap className="w-6 h-6 text-blue-400"/><span className="text-2xl font-bold text-white">{NG}</span><span className="text-xs text-gray-400">raios/km²/ano</span>
                    </div>
                  </div>
                </div>
                <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-[#2a3555] hover:border-blue-500 rounded-lg px-4 py-2 transition-colors">
                  <Zap className="w-4 h-4"/> Verificar NG da Norma Anterior
                </button>
              </div>}
            </div>
            {/* Seção 2 */}
            <div className="rounded-xl overflow-hidden">
              <SecHdr n={2} icon={MapPin} title="Características da Estrutura" open={s2} toggle={()=>setS2(v=>!v)}/>
              {s2&&<div className="bg-[#111827] p-5 space-y-4 rounded-b-xl">
                <button onClick={()=>setIl2(v=>!v)} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                  <Info className="w-4 h-4 border border-blue-400 rounded-full"/>Ver ilustração: Área de exposição equivalente AD{il2?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
                </button>
                {il2&&<div className="bg-[#1a2035] rounded-lg p-3 text-xs text-gray-400">AD = L×W + 2×(3H)×(L+W) + π×(3H)² — NBR 5419-2:2026, Eq. A.1</div>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {([["Comprimento L (m)",L,setL],["Largura W (m)",W,setW],["Altura H (m)",H,setH],["Altura proeminência Hp (m)",Hp,setHp]] as [string,number,(v:number)=>void][]).map(([lbl,val,set])=>
                    <div key={lbl}><p className={FL}>{lbl}</p><div className="flex items-center gap-1"><input type="number" className={INP} style={INP_STYLE} value={val} onChange={e=>set(Number(e.target.value))} min={0}/><span className="text-gray-500 text-xs shrink-0">m</span></div></div>)}
                </div>
                <div className="flex items-center gap-3">
                  <Chk id="vidro" checked={vidro} onChange={setVidro} label="Fachada de vidro / materiais não metálicos"/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><p className={FL}>Localização CD (Tab. A.1)</p><Sel value={loc} onChange={setLoc} options={CD_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div><p className={FL}>Nível Proteção SPDA - PB (Tab. B.2)</p><Sel value={pb} onChange={setPb} options={PB_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div><p className={FL}>Tipo Estrutura rS (Tab. C.7)</p><Sel value={rsEst} onChange={setRsEst} options={RS_EST_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div><p className={FL}>Pessoas total (nt)</p><input type="number" className={INP} style={INP_STYLE} value={nt} onChange={e=>setNt(Number(e.target.value))} min={0}/></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><p className={FL}>Tipo de Estrutura - LF (Tab. C.2)</p><Sel value={lfEst} onChange={setLfEst} options={LF_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div><p className={FL}>Proteção choque estrutura - PTA (Tab. B.1)</p><Sel value={pta} onChange={setPta} options={PTA_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                </div>
                <div className={`${A.resBg} border rounded-lg px-5 py-3`}>
                  <p className="text-[10px] text-blue-400 font-bold tracking-widest mb-2">RESULTADOS CALCULADOS</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-sm">
                    {[["AD",`${fmtM2(AD)} m²`,"Eq. A.3"],["ND",`${fmtE(ND)} /ano`,"Eq. A.4"],["AM",`${fmtM2(AM)} m²`,"Eq. A.6"],["NM",`${fmtE(NM)} /ano`,"Eq. A.7"]].map(([k,v,eq])=>
                      <div key={k}><span className="text-gray-400 text-xs">{k}</span><p className="text-white font-semibold">{v}</p><p className="text-[10px] text-blue-400">{eq}</p></div>)}
                  </div>
                </div>
              </div>}
            </div>
            {/* Seção 3 */}
            <div className="rounded-xl overflow-hidden">
              <SecHdr n={3} icon={Zap} title="Linhas Elétricas Conectadas" open={s3} toggle={()=>setS3(v=>!v)}/>
              {s3&&<div className="bg-[#111827] p-5 space-y-4 rounded-b-xl">
                <button onClick={()=>setIl3(v=>!v)} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                  <Info className="w-4 h-4 border border-blue-400 rounded-full"/>Ver ilustração: Linhas conectadas à estrutura{il3?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
                </button>
                {il3&&<div className="bg-[#1a2035] rounded-lg p-3 text-xs text-gray-400">NL = Ng×AL×CI×CT×CE×10⁻⁶ (Eq. A.8) | NI = Ng×AI×CI×CT×CE×10⁻⁶ (Eq. A.9)</div>}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{linhas.length} {linhas.length===1?"linha configurada":"linhas configuradas"}</span>
                  <button onClick={addLinha} className={`flex items-center gap-2 text-sm ${A.bgFaint} hover:${A.bgFaintH} text-blue-400 border ${A.border} rounded-lg px-3 py-1.5 transition-colors`}>
                    <Plus className="w-4 h-4"/> Adicionar Linha
                  </button>
                </div>
                {linhas.map(linha=>{
                  const nlL=linhaNL(linha);const niL=linhaNI(linha);
                  return <div key={linha.id} className="bg-[#0d1117] border border-[#2a3555] rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <Zap className="w-4 h-4 text-blue-400 shrink-0"/>
                      {editNome[linha.id]
                        ?<input autoFocus className="bg-[#1a2035] border border-blue-500 text-white text-sm rounded px-2 py-1 w-44"
                            value={linha.nome} onChange={e=>updLinha(linha.id,{nome:e.target.value})}
                            onBlur={()=>setEditNome(p=>({...p,[linha.id]:false}))} onKeyDown={e=>e.key==="Enter"&&setEditNome(p=>({...p,[linha.id]:false}))}/>
                        :<button className="text-sm font-semibold text-white bg-[#1a2035] border border-transparent hover:border-blue-500 rounded px-2 py-1" onClick={()=>setEditNome(p=>({...p,[linha.id]:true}))}>{linha.nome}</button>}
                      <div className="ml-auto flex items-center gap-2">
                        <select value={linha.tipo_linha} onChange={e=>updLinha(linha.id,{tipo_linha:e.target.value})} className="text-white text-xs rounded px-2 py-1 focus:outline-none cursor-pointer appearance-none" style={{background:"#1a2035",border:"1px solid #2a3555"}}>
                          <option value="ENERGIA">Energia</option><option value="SINAL">Sinal</option>
                        </select>
                        <button onClick={()=>delLinha(linha.id)} className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-900/20"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><p className={FL}>PTU (Tab. B.6)</p><Sel value={linha.ptu} onChange={v=>updLinha(linha.id,{ptu:v})} options={PTU_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                      <div><p className={FL}>PEB (Tab. B.7)</p><Sel value={linha.peb} onChange={v=>updLinha(linha.id,{peb:v})} options={PEB_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                      <div><p className={FL}>CLD/CLI (Tab. B.4)</p><Sel value={linha.cld_cli} onChange={v=>updLinha(linha.id,{cld_cli:v})} options={CLD_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                    </div>
                    {linha.trechos.map((t,idx)=>{
                      const tCalc=calcTrechoData(linha.id,t.id);
                      const pld=tCalc?.PLD??0;
                      // PLI — Tabela B.9: depende do tipo de linha (BT_SINAL=energia, AT_COM_TRAFO=sinal) e UW
                      const pli=tCalc?.PLI??0;
                      const nlT=tCalc?.NL??0;
                      const niT=tCalc?.NI??0;
                      return <div key={t.id} className="border border-[#2a3555]/60 rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-400">Trecho {String(idx+1).padStart(2,"0")} ({idx+1}/{linha.trechos.length})</span>
                          {linha.trechos.length>1&&<button onClick={()=>delTrecho(linha.id,t.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5"/></button>}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div><p className={FL}>Comprimento LL (m)</p><div className="flex items-center gap-1"><input type="number" className={INP} style={INP_STYLE} value={t.comprimento_m} onChange={e=>updTrecho(linha.id,t.id,{comprimento_m:Number(e.target.value)})} min={0}/><span className="text-gray-500 text-xs shrink-0">m</span></div></div>
                          <div><p className={FL}>Instalação CI (Tab. A.2)</p><Sel value={t.instalacao_ci} onChange={v=>updTrecho(linha.id,t.id,{instalacao_ci:v})} options={CI_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                          <div><p className={FL}>Tipo CT (Tab. A.3)</p><Sel value={t.tipo_ct} onChange={v=>updTrecho(linha.id,t.id,{tipo_ct:v})} options={CT_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                          <div><p className={FL}>Ambiente CE (Tab. A.4)</p><Sel value={t.ambiente_ce} onChange={v=>updTrecho(linha.id,t.id,{ambiente_ce:v})} options={CE_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><p className={FL}>Blindagem Rs (Tab. B.8)</p><Sel value={t.blindagem_rs} onChange={v=>updTrecho(linha.id,t.id,{blindagem_rs:v})} options={RS_LINE_OPT.map(o=>({v:o.v,l:o.l}))}/><p className="text-xs text-blue-400 mt-1">PLD atual = {pld.toFixed(2)}</p></div>
                          <div><p className={FL}>Tensão UW (kV)</p><Sel value={t.uw_kv} onChange={v=>updTrecho(linha.id,t.id,{uw_kv:v})} options={UW_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                        </div>
                        <div className={`${A.resBg} border rounded-lg px-4 py-2 grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-sm`}>
                          <span className="text-blue-400 font-semibold">NL={fmtE(nlT)}</span>
                          <span className="text-blue-400 font-semibold">NI={fmtE(niT)}</span>
                          <span className="text-gray-300">PLD={pld.toFixed(2)}</span>
                          <span className="text-gray-300">PLI={pli.toFixed(2)} <span className="text-gray-500 text-[10px]">(Tab.B.9)</span></span>
                        </div>
                      </div>;
                    })}
                    <button onClick={()=>addTrecho(linha.id)} className="w-full text-sm text-gray-400 hover:text-white border border-dashed border-[#2a3555] hover:border-blue-500 rounded-lg py-2 flex items-center justify-center gap-2 transition-colors">
                      <Plus className="w-4 h-4"/> Adicionar Trecho SL
                    </button>
                    <div className="bg-[#0d1117] border border-blue-500/20 rounded-lg px-4 py-3 font-mono text-sm">
                      <p className="text-[10px] text-blue-400 font-bold tracking-widest mb-1">TOTAL {linha.nome.toUpperCase()} ({linha.trechos.length} TRECHO{linha.trechos.length>1?"S":""})</p>
                      <p className="text-blue-400">NL = {fmtE(nlL)} /ano &nbsp;|&nbsp; NI = {fmtE(niL)} /ano</p>
                    </div>
                    <div className="border-t border-[#2a3555] pt-3 space-y-3">
                      <p className="text-[10px] text-gray-500 font-bold tracking-widest">ESTRUTURA ADJACENTE — {linha.nome.toUpperCase()} (EQ. A.4)</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {(["l_adj","w_adj","h_adj"] as (keyof EstAdj)[]).map(k=><div key={k as string}><p className={FL}>{k.replace("_adj","").toUpperCase()} adj</p><div className="flex items-center gap-1"><input type="number" className={INP} style={INP_STYLE} value={linha.adj[k] as number} onChange={e=>updAdj(linha.id,{[k]:Number(e.target.value)})} min={0}/><span className="text-gray-500 text-xs shrink-0">m</span></div></div>)}
                        <div><p className={FL}>CDJ (A.1)</p><Sel value={linha.adj.cdj} onChange={v=>updAdj(linha.id,{cdj:v})} options={CD_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                        <div><p className={FL}>CT adj (A.3)</p><Sel value={linha.adj.ct_adj} onChange={v=>updAdj(linha.id,{ct_adj:v})} options={CT_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                      </div>
                    </div>
                  </div>;
                })}
              </div>}
            </div>
            {/* Frequência + Resumo */}
            <div className="bg-[#0d1f3a]/40 border border-blue-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4"><BarChart2 className="w-5 h-5 text-blue-400"/><div><p className="font-semibold text-white">Frequência Média Anual de Eventos Danosos</p><p className="text-xs text-gray-400">Conforme Anexo A — NBR 5419-2:2026</p></div></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#1e3a5f] rounded-xl p-3"><p className="text-[10px] text-blue-300 font-bold mb-1">S1-ND</p><p className="text-white font-bold text-sm font-mono">{fmtE(ND)}</p><p className="text-[10px] text-gray-400">{periodo(ND)}</p><p className="text-[10px] text-blue-300 mt-1">Eq. A.4</p></div>
                <div className="bg-[#3d1f0e] rounded-xl p-3"><p className="text-[10px] text-orange-300 font-bold mb-1">S2-NM</p><p className="text-white font-bold text-sm font-mono">{fmtE(NM)}</p><p className="text-[10px] text-gray-400">{periodo(NM)}</p><p className="text-[10px] text-orange-300 mt-1">Eq. A.7</p></div>
                {linhas.map(l=>{const nl=linhaNL(l);const ni=linhaNI(l);const isE=l.tipo_linha==="ENERGIA";const bg=isE?"bg-[#1a2a10]":"bg-[#1a1a2a]";const tx=isE?"text-lime-300":"text-violet-300";
                  return [<div key={`s3-${l.id}`} className={`${bg} rounded-xl p-3`}><p className={`text-[10px] ${tx} font-bold mb-1`}>S3-{l.nome.substring(0,8).toUpperCase()}</p><p className="text-white font-bold text-sm font-mono">{fmtE(nl)}</p><p className="text-[10px] text-gray-400">{periodo(nl)}</p><p className={`text-[10px] ${tx} mt-1`}>Eq. A.8</p></div>,
                    <div key={`s4-${l.id}`} className={`${bg} rounded-xl p-3`}><p className={`text-[10px] ${tx} font-bold mb-1`}>S4-{l.nome.substring(0,8).toUpperCase()}</p><p className="text-white font-bold text-sm font-mono">{fmtE(ni)}</p><p className="text-[10px] text-gray-400">{periodo(ni)}</p><p className={`text-[10px] ${tx} mt-1`}>Eq. A.9</p></div>];
                })}
              </div>
            </div>
            <div className="bg-[#0d1f3a]/40 border border-blue-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4"><ClipboardList className="w-5 h-5 text-blue-400"/><div><p className="font-semibold text-white">Resumo dos Cálculos Gerais</p><p className="text-xs text-gray-400">Valores de N calculados conforme Anexo A da NBR 5419-2:2026</p></div></div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[["AD",`${fmtM2(AD)} m²`,"Área de exposição equivalente da estrutura","Eq. A.3"],["ND",`${fmtE(ND)} /ano`,"Nº eventos — descargas na estrutura","Eq. A.4"],["AM",`${fmtM2(AM)} m²`,"Área de exposição para descargas próximas","Eq. A.6"],["NM",`${fmtE(NM)} /ano`,"Nº eventos — descargas próximas","Eq. A.7"]].map(([k,v,d,e])=>
                  <div key={k} className={`${A.cardBg} border rounded-xl p-3`}><p className="text-[10px] text-gray-500 font-bold tracking-wider">{k}</p><p className="text-white font-bold text-sm font-mono mt-1">{v}</p><p className="text-[10px] text-gray-600 mt-1">{d}</p><p className="text-[10px] text-blue-400 mt-1">{e}</p></div>)}
                {linhas.map(l=>{const nl=linhaNL(l);const ni=linhaNI(l);const tag=l.tipo_linha==="ENERGIA"?"LINHA DE ENERGIA":"LINHA DE SINAL";
                  return [<div key={`rnl-${l.id}`} className={`${A.cardBg} border rounded-xl p-3`}><p className="text-[10px] text-gray-500 font-bold">NL ({tag})</p><p className="text-white font-bold text-sm font-mono mt-1">{fmtE(nl)}</p><p className="text-[10px] text-blue-400 mt-1">Eq. A.8</p></div>,
                    <div key={`rni-${l.id}`} className={`${A.cardBg} border rounded-xl p-3`}><p className="text-[10px] text-gray-500 font-bold">NI ({tag})</p><p className="text-white font-bold text-sm font-mono mt-1">{fmtE(ni)}</p><p className="text-[10px] text-blue-400 mt-1">Eq. A.9</p></div>,
                    <div key={`rndj-${l.id}`} className={`${A.cardBg} border rounded-xl p-3`}><p className="text-[10px] text-gray-500 font-bold">NDJ ({tag})</p><p className="text-white font-bold text-sm font-mono mt-1">{fmtE(linhaNDJ(l))}</p><p className="text-[10px] text-blue-400 mt-1">Eq. A.5</p></div>];
                })}
              </div>
            </div>
            <div className="flex justify-end pb-4"><button onClick={()=>handleTabChange("zonas")} className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-colors">Zonas <Layers className="w-4 h-4"/></button></div>
          </div>
        )}

        {/* ═══ ZONAS ═══ */}
        {tab==="zonas" && (
          <div className="space-y-4 pb-8">
            {/* Zone tab pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {zonas.map(z=>(
                <button key={z.id} onClick={()=>setZonaAtiva(z.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${zonaAtiva===z.id?`${A.bg} text-white`:"bg-[#1a2035] text-gray-300 hover:text-white"}`}>
                  {z.nome}
                  {zonas.length>1&&<span onClick={e=>{e.stopPropagation();delZona(z.id);}} className="hover:text-red-300 ml-1">×</span>}
                </button>
              ))}
              <button onClick={addZona} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white border border-[#2a3555] hover:border-blue-500 rounded-full px-3 py-2 transition-colors">
                <Plus className="w-4 h-4"/> Zona
              </button>
            </div>

            {/* Two-column: Identificação + Proteção */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* LEFT: Identificação */}
              <div className="bg-[#0d1f3a] border border-blue-500/30 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-400"/>
                  <p className="font-semibold text-white text-sm">Identificação — {zona.nome}</p>
                </div>
                <div>
                  <p className={FL}>Nome da Zona</p>
                  <input className={INP} style={INP_STYLE} value={zona.nome} onChange={e=>updZona(zona.id,{nome:e.target.value})}/>
                </div>
                {/* RESULTADOS CALCULADOS */}
                <div className="bg-[#0a1220] border border-blue-500/20 rounded-lg p-3 font-mono text-xs space-y-1">
                  <p className="text-[10px] text-blue-400 font-bold tracking-widest">RESULTADOS CALCULADOS</p>
                  <p className="text-blue-300">rf=<span className="text-white">{fmtE(RF_MAP[zona.rf]??0.01)}</span> | LO=<span className="text-white">{zona.lo==="0"?"0":fmtE(parseFloat(zona.lo))}</span> | rS=<span className="text-white">{({"ALVENARIA_CONCRETO":"1","MADEIRA":"2"} as Record<string,string>)[rsEst]||"1"}</span> | fp=<span className="text-white">{fmtE((zona.nz/Math.max(nt,1))*(zona.tz_mode==="h_ano"?zona.tz_valor/8760:zona.tz_valor*365/8760))}</span></p>
                  <p className="text-blue-300">LA=<span className="text-white">{fmtE((zc?.LA??0))}</span> | LB=<span className="text-white">{fmtE((zc?.LB??0))}</span> | LC=<span className="text-white">{(zc?.LC??0)===0?"0":fmtE((zc?.LC??0))}</span></p>
                </div>
              </div>
              {/* RIGHT: Proteção e Blindagem */}
              <div className="bg-[#0d1f3a] border border-blue-500/30 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-blue-400"/><p className="font-semibold text-white text-sm">Proteção e Blindagem</p></div>
                <div className="flex items-center gap-3">
                  <Chk id="blind" checked={zona.blindagem} onChange={v=>updZona(zona.id,{blindagem:v})} label={<span className="flex items-center gap-1">Blindagem Espacial Interna <Info className="w-3.5 h-3.5 text-gray-500"/></span>}/>
                </div>
                {zona.blindagem&&<div className="grid grid-cols-2 gap-3">
                  <div><p className={FL}>Wm1 - malha/descidas externa (m) <Info className="w-3 h-3 text-gray-500"/></p><div className="flex items-center gap-1"><input type="number" className={INP} style={INP_STYLE} value={zona.wm1} onChange={e=>updZona(zona.id,{wm1:Number(e.target.value)})} min={0}/><span className="text-gray-500 text-xs shrink-0">m</span></div><p className="text-[10px] text-gray-500 mt-1">KS1 não é alterado pela blindagem interna</p></div>
                  <div><p className={FL}>Wm2 - blindagem interna (m) <Info className="w-3 h-3 text-gray-500"/></p><div className="flex items-center gap-1"><input type="number" className={INP} style={INP_STYLE} value={zona.wm2} onChange={e=>updZona(zona.id,{wm2:Number(e.target.value)})} min={0}/><span className="text-gray-500 text-xs shrink-0">m</span></div><p className="text-[10px] text-gray-500 mt-1">KS2=0.12×Wm2</p></div>
                </div>}
                <div className="grid grid-cols-2 gap-3">
                  <div><p className={FL}>Fiação interna Energia - KS3 (Tab. B.5) <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.ks3e} onChange={v=>updZona(zona.id,{ks3e:v})} options={KS3_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div><p className={FL}>Fiação interna Sinal - KS3 (Tab. B.5) <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.ks3s} onChange={v=>updZona(zona.id,{ks3s:v})} options={KS3_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                </div>
                <div><p className={FL}>Coordenação DPS - PSPD (Tab. B.3) <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.pspd} onChange={v=>updZona(zona.id,{pspd:v})} options={PSPD_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                <div><p className={FL}>Tensão suportável dos equipamentos UW (kV) — KS4 <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.uw_equip} onChange={v=>updZona(zona.id,{uw_equip:v})} options={UW_OPT.filter(o=>parseFloat(o.v)>=1).map(o=>({v:o.v,l:o.l}))}/><p className="text-[10px] text-gray-500 mt-1">KS4 = 1/UW, limitado a 1, conforme a norma.</p></div>
              </div>
            </div>

            {/* L1 — PERDAS DE VIDA HUMANA */}
            <div className="rounded-xl overflow-hidden">
              <div className="bg-[#7f1d1d] px-5 py-3 flex items-center gap-3">
                <Shield className="w-5 h-5 text-red-300"/>
                <div><p className="font-bold text-white">L1 — PERDAS DE VIDA HUMANA</p><p className="text-xs text-red-300">Seção 6 e Anexo C da NBR 5419-2:2026</p></div>
              </div>
              <div className="bg-[#111827] p-5 space-y-4">
                <button onClick={()=>setIlL1(v=>!v)} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                  <Info className="w-4 h-4 border border-blue-400 rounded-full"/>Ver ilustração: Perdas de vida humana{ilL1?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
                </button>
                {ilL1&&<div className="bg-[#1a2035] rounded-lg p-3 text-xs text-gray-400">LA = rt × LT × (nz/nt) × (tz/8760) × rS — Eq. C.1 | LB = rp × rf × hz × LF × (nz/nt) × (tz/8760) × rS — Eq. C.3</div>}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><p className={FL}>Perigo Especial - hz (Tab. C.6) <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.hz} onChange={v=>updZona(zona.id,{hz:v})} options={HZ_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div><p className={FL}>Pessoas na zona (nz) <Info className="w-3 h-3 text-gray-500"/></p><input type="number" className={INP} style={INP_STYLE} value={zona.nz} onChange={e=>updZona(zona.id,{nz:Number(e.target.value)})} min={0}/></div>
                  <div>
                    <p className={FL}>Tempo de permanência <Info className="w-3 h-3 text-gray-500"/></p>
                    <div className="flex items-center gap-2 mb-2">
                      {(["h_dia","h_ano"] as ("h_dia"|"h_ano")[]).map(m=><button key={m} onClick={()=>updZona(zona.id,{tz_mode:m,tz_valor:m==="h_ano"?2920:8})}
                        className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${zona.tz_mode===m?`${A.bg} text-white`:"bg-[#1a2035] text-gray-400 hover:text-white"}`}>
                        {m==="h_dia"?"h/dia":"h/ano"}
                      </button>)}
                    </div>
                    <div className="flex items-center gap-1"><input type="number" className={INP} style={INP_STYLE} value={zona.tz_valor} onChange={e=>updZona(zona.id,{tz_valor:Number(e.target.value)})} min={0}/><span className="text-gray-500 text-xs shrink-0">{zona.tz_mode==="h_dia"?"h/dia":"h/ano"}</span></div>
                    <p className="text-[10px] text-gray-500 mt-1">tz/8760 = {fmtE(zona.tz_mode==="h_ano"?zona.tz_valor/8760:zona.tz_valor*365/8760)} → fp = {fmtE((zona.nz/Math.max(nt,1))*(zona.tz_mode==="h_ano"?zona.tz_valor/8760:zona.tz_valor*365/8760))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className={FL}>Tipo de Estrutura - LF (Tab. C.2) <Info className="w-3 h-3 text-gray-500"/></p>
                    <div className="flex items-center gap-3 mb-2">
                      <Chk id="lfcust" checked={zona.lf_custom} onChange={v=>updZona(zona.id,{lf_custom:v})} label={<span className="text-xs text-blue-400 flex items-center gap-1">✓ Personalizar LF para esta zona</span>}/>
                    </div>
                    {zona.lf_custom?<Sel value={zona.lf_tipo} onChange={v=>updZona(zona.id,{lf_tipo:v})} options={LF_OPT.map(o=>({v:o.v,l:o.l}))}/>
                    :<p className="text-xs text-gray-400">Usando valor da estrutura: <span className="text-gray-300">{LF_OPT.find(o=>o.v===lfEst)?.l.split("(")[0] || lfEst} (LF={LF_MAP[lfEst]?.toExponential(0)||"1e-2"})</span></p>}
                  </div>
                  <div><p className={FL}>Risco Falhas Sistemas Internos - LO <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.lo} onChange={v=>updZona(zona.id,{lo:v})} options={LO_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><p className={FL}>Tipo de Piso/solo - rt (Tab. C.3) <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.rt} onChange={v=>updZona(zona.id,{rt:v})} options={RT_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div><p className={FL}>Risco de incêndio/explosão - rf (Tab. C.5) <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.rf} onChange={v=>updZona(zona.id,{rf:v})} options={RF_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div><p className={FL}>Proteção contra incêndio - rp (Tab. C.4) <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.rp} onChange={v=>updZona(zona.id,{rp:v})} options={RP_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                </div>
              </div>
            </div>

            {/* L1 resultado */}
            <div className="bg-[#7f1d1d] rounded-xl overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between">
                <div><p className="font-semibold text-white">Perdas de vida humana (L1) — {zona.nome}</p><p className="text-xs text-red-300">Análise de risco R1 conforme Seção 6 e Anexo C da NBR 5419-2:2026</p></div>
                <span className={`text-sm font-mono font-bold px-3 py-1 rounded-lg ${(zc?.R1??0)>RT1?"bg-red-900 text-red-200":"bg-blue-900 text-blue-200"}`}>R1={fmtE((zc?.R1??0))}</span>
              </div>
              <div className="bg-[#111827] p-5 space-y-4">
                <p className="text-[10px] text-gray-400 font-bold tracking-widest">DISTRIBUIÇÃO DAS COMPONENTES — R1</p>
                <div className="flex gap-6 flex-col lg:flex-row items-start">
                  <div className="flex-1 min-w-0">
                    <BarChart data={[
                      {label:"RB",value:(zc?.RB??0),color:"#f97316",tooltip:"RB = ND × PB × LB (danos físicos diretos, S1-D2)"},
                      {label:"RV",value:(zc?.RV??0),color:"#a855f7",tooltip:"RV = NL × PV × LV (danos físicos via linha, S3-D2)"},
                      {label:"RA",value:(zc?.RA??0),color:"#3b82f6",tooltip:"RA = ND × PA × LA (choque, S1-D1)"},
                      {label:"RU",value:(zc?.RU??0),color:"#22c55e",tooltip:"RU = (NL+NDJ) × PU × LU (choque via linha, S3-D1)"},
                      {label:"RC",value:(zc?.RC??0),color:"#eab308",tooltip:"RC = ND × PC × LC (falha sistemas, S1-D3)"},
                      {label:"RM",value:(zc?.RM??0),color:"#14b8a6",tooltip:"RM = NM × PM × LM (falha próx., S2-D3)"},
                      {label:"RW",value:(zc?.RW??0),color:"#6366f1",tooltip:"RW = (NL+NDJ) × PW × LW (falha via linha, S3-D3)"},
                      {label:"RZ",value:(zc?.RZ??0),color:"#ec4899",tooltip:"RZ = NI × PZ × LZ (falha próx. linha, S4-D3)"},
                    ].sort((a,b)=>b.value-a.value)} rt={RT1}/>
                  </div>
                  <div className="flex flex-col items-center justify-center w-[240px] shrink-0">
                    <p className="text-xs text-gray-400 mb-2 text-center">Comparação R1 × R.tolerável</p>
                    <Gauge val={(zc?.R1??0)} rt={RT1} label="R1"/>
                  </div>
                </div>
                {linhas.length>0&&<div>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-2">CONTRIBUIÇÃO POR LINHA ELÉTRICA</p>
                  <div className="overflow-x-auto"><table className="w-full min-w-[400px] text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">Linha</th><th className="text-right">RU</th><th className="text-right">RV</th><th className="text-right">RW</th><th className="text-right">RZ</th><th className="text-right">Total</th></tr></thead>
                    <tbody>{(calc?.zonas.find(z=>z.id===zona.id)?.linhas_contrib??[]).map(lc=><tr key={lc.id} className="border-t border-[#2a3555]">
                      <td className="py-1 font-medium text-white">{lc.nome} <span className="text-gray-500">({lc.nome.toLowerCase().includes("sinal")?"S":"E"})</span></td>
                      <td className="text-right font-mono text-gray-300">{lc.RU>0?fmtE(lc.RU):"0"}</td>
                      <td className="text-right font-mono text-gray-300">{lc.RV>0?fmtE(lc.RV):"0"}</td>
                      <td className="text-right font-mono text-gray-300">{lc.RW>0?fmtE(lc.RW):"0"}</td>
                      <td className="text-right font-mono text-gray-300">{lc.RZ>0?fmtE(lc.RZ):"0"}</td>
                      <td className="text-right font-mono text-white font-bold">{fmtE(lc.RU+lc.RV+lc.RW+lc.RZ)}</td>
                    </tr>)}</tbody>
                  </table></div>
                </div>}
                <button onClick={()=>setRecL1(v=>!v)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white">
                  {recL1?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>} Recomendação
                </button>
                {recL1&&<div className={`rounded-lg px-4 py-3 flex flex-col gap-1 ${(zc?.R1??0)>RT1?"bg-red-900/30 border border-red-500/40":"bg-blue-900/30 border border-blue-500/30"}`}>
                  {(zc?.R1??0)>RT1 ? <>
                    <div className="flex items-center gap-2"><span className="text-red-400 font-bold text-sm">✗ Não atende — ação obrigatória</span></div>
                    <p className="text-xs text-gray-400">R1 = {fmtE((zc?.R1??0))} | RT = {fmtE(RT1)} | Razão = {((zc?.R1??0)/RT1*100).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-1">A componente RB é a maior. Verifique: o Nível de Proteção do SPDA, a instalação de DPS Classe I (ligação equipotencial), interfaces isolantes, os sistemas de combate a incêndio, a dificuldade de evacuação (nível de pânico) e a tensão suportável nominal de impulso (UW) dos equipamentos.</p>
                    <div className="mt-1 bg-red-950/60 border border-red-800/40 rounded px-3 py-1.5 text-xs text-red-400">Alerta global: somatório = {fmtE((zc?.R1??0))} / {fmtE(RT1)} ({((zc?.R1??0)/RT1*100).toFixed(1)}%). Medidas de proteção adicionais são obrigatórias.</div>
                  </> : <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-blue-300 font-bold text-sm">✓ {(zc?.R1??0)/RT1<0.1?"Atende com ampla margem de segurança":"Atende com boa margem"}</span>
                    <span className="text-xs text-gray-400 font-mono">R1 = {fmtE((zc?.R1??0))} | RT = {fmtE(RT1)} | {((zc?.R1??0)/RT1*100).toFixed(1)}%</span>
                  </div>}
                </div>}
              </div>
            </div>

            {/* L3 — PATRIMÔNIO CULTURAL */}
            <div className="rounded-xl overflow-hidden">
              <div className="bg-[#7c2d12] px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg>
                  <div><p className="font-bold text-white">L3 — PATRIMÔNIO CULTURAL</p><p className="text-xs text-orange-300">Anexo C.4 da NBR 5419-2:2026</p></div>
                </div>
              </div>
              <div className="bg-[#111827] p-5 space-y-4">
                <button onClick={()=>setIlL3(v=>!v)} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                  <Info className="w-4 h-4 border border-blue-400 rounded-full"/>Ver ilustração: Patrimônio cultural{ilL3?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
                </button>
                {ilL3&&<div className="bg-[#1a2035] rounded-lg p-4 overflow-hidden">
                  <svg viewBox="0 0 600 280" className="w-full max-w-lg mx-auto">
                    <rect x="0" y="0" width="600" height="280" fill="#0d1117" rx="12"/>
                    <rect x="60" y="40" width="480" height="220" fill="none" stroke="#92400e" strokeWidth="2" strokeDasharray="10,5" rx="4"/>
                    <line x1="80" y1="248" x2="520" y2="248" stroke="#92400e" strokeWidth="3"/>
                    <rect x="120" y="160" width="360" height="88" fill="none" stroke="#b45309" strokeWidth="2"/>
                    <polygon points="100,160 300,80 500,160" fill="none" stroke="#b45309" strokeWidth="2"/>
                    <rect x="145" y="160" width="16" height="88" fill="none" stroke="#b45309" strokeWidth="1.5"/>
                    <rect x="195" y="160" width="16" height="88" fill="none" stroke="#b45309" strokeWidth="1.5"/>
                    <rect x="248" y="160" width="16" height="88" fill="none" stroke="#b45309" strokeWidth="1.5"/>
                    <rect x="340" y="160" width="16" height="88" fill="none" stroke="#b45309" strokeWidth="1.5"/>
                    <rect x="390" y="160" width="16" height="88" fill="none" stroke="#b45309" strokeWidth="1.5"/>
                    <rect x="440" y="160" width="16" height="88" fill="none" stroke="#b45309" strokeWidth="1.5"/>
                    <rect x="273" y="192" width="54" height="56" fill="none" stroke="#b45309" strokeWidth="1.5"/>
                    <rect x="160" y="175" width="28" height="34" fill="none" stroke="#b45309" strokeWidth="1" rx="14"/>
                    <rect x="213" y="175" width="28" height="34" fill="none" stroke="#b45309" strokeWidth="1" rx="14"/>
                    <rect x="352" y="175" width="28" height="34" fill="none" stroke="#b45309" strokeWidth="1" rx="14"/>
                    <rect x="405" y="175" width="28" height="34" fill="none" stroke="#b45309" strokeWidth="1" rx="14"/>
                    <polyline points="352,28 332,73 347,68 327,113" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinejoin="round"/>
                    <polygon points="352,28 342,52 362,52" fill="#f59e0b"/>
                    <text x="300" y="235" textAnchor="middle" fill="#d97706" fontSize="13" fontWeight="500">Zona com patrimônio cultural</text>
                    <text x="300" y="22" textAnchor="middle" fill="#d97706" fontSize="14" fontWeight="bold">L3 — Patrimônio cultural</text>
                    <text x="300" y="37" textAnchor="middle" fill="#92400e" fontSize="11">Anexo C.4, NBR 5419-2:2026</text>
                  </svg>
                </div>}
                <div className="flex items-center gap-3">
                  <Chk id="l3" checked={zona.tem_l3} onChange={v=>updZona(zona.id,{tem_l3:v})} label="Possui Patrimônio Cultural"/>
                </div>
                {zona.tem_l3&&<div className="grid grid-cols-2 gap-4">
                  <div><p className={FL}>Valor patrimônio na zona (R$ mi)</p><input type="number" className={INP} style={INP_STYLE} value={zona.val_pat} onChange={e=>updZona(zona.id,{val_pat:Number(e.target.value)})} min={0}/></div>
                  <div><p className={FL}>Valor total edificação (R$ mi)</p><input type="number" className={INP} style={INP_STYLE} value={zona.val_edif_l3} onChange={e=>updZona(zona.id,{val_edif_l3:Number(e.target.value)})} min={0}/></div>
                </div>}
              </div>
            </div>

            {zona.tem_l3&&<div className="bg-[#7c2d12] rounded-xl overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between">
                <div><p className="font-semibold text-white">Perdas de patrimônio cultural (L3) — {zona.nome}</p><p className="text-xs text-orange-300">Análise de risco R3 conforme Anexo C.4 da NBR 5419-2:2026</p></div>
                <span className={`text-sm font-mono font-bold px-3 py-1 rounded-lg ${(zc?.R3??0)>RT3?"bg-red-900 text-red-200":"bg-blue-900 text-blue-200"}`}>R3={fmtE((zc?.R3??0))}</span>
              </div>
              <div className="bg-[#111827] p-5 space-y-4">
                <p className="text-[10px] text-gray-400 font-bold tracking-widest">DISTRIBUIÇÃO DAS COMPONENTES — R3</p>
                <div className="flex gap-4 flex-col md:flex-row">
                  <div className="flex-1"><BarChart data={[{label:"RB",value:(zc?.RB3??0),color:"#f97316",tooltip:"RB3 = ND × PB × LB3"},{label:"RV",value:(zc?.RV3??0),color:"#a855f7",tooltip:"RV3 = Σ(NL+NDJ) × PV × LB3"}].sort((a,b)=>b.value-a.value)} rt={RT3}/></div>
                  <div className="flex flex-col items-center justify-center w-[240px] shrink-0">
                    <p className="text-xs text-gray-400 mb-1">Comparação R3 × R.tolerável</p>
                    <Gauge val={(zc?.R3??0)} rt={RT3} label="R3"/>
                  </div>
                </div>
                {false&&<div>
                  {/* lineRV3 removido — backend não retorna contribuições por linha em L3 */}
                </div>}
                <button onClick={()=>setRecL3(v=>!v)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white">
                  {recL3?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>} Recomendação
                </button>
                {recL3&&<div className={`rounded-lg px-4 py-3 ${(zc?.R3??0)>RT3?"bg-red-900/30 border border-red-500/40":"bg-blue-900/30 border border-blue-500/30"}`}>
                  <div className="flex items-center justify-between">
                    {(zc?.R3??0)>RT3
                      ?<span className="text-red-400 font-bold text-sm">✗ Não atende — ação obrigatória</span>
                      :<span className="text-blue-300 font-bold text-sm">✓ {(zc?.R3??0)/RT3<0.1?"Atende com ampla margem":"Atende com boa margem"}</span>}
                    <span className="text-xs text-gray-400 font-mono">R3 = {fmtE((zc?.R3??0))} | RT = {fmtE(RT3)} | {((zc?.R3??0)/RT3*100).toFixed(1)}%</span>
                  </div>
                </div>}
              </div>
            </div>}

            {/* F — FREQUÊNCIA DE DANOS */}
            <div className="rounded-xl overflow-hidden">
              <div className="bg-[#7c2d12] px-5 py-3 flex items-center gap-3">
                <Activity className="w-5 h-5 text-orange-300"/>
                <div><p className="font-bold text-white">F — FREQUÊNCIA DE DANOS</p><p className="text-xs text-orange-300">Seção 7 da NBR 5419-2:2026 | FX = NX × PX (sem fator L)</p></div>
              </div>
              <div className="bg-[#111827] p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Chk id="hf" checked={zona.habilitar_f} onChange={v=>updZona(zona.id,{habilitar_f:v})} label="Habilitar Análise de Frequência de Danos (F)"/>
                </div>
                {zona.habilitar_f&&<>
                  <button onClick={()=>setIlF(v=>!v)} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                    <Info className="w-4 h-4 border border-blue-400 rounded-full"/>Ver ilustração: Frequência de danos (F vs FT){ilF?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
                  </button>
                  {ilF&&(
                  <div className="bg-[#0d1117] border border-[#7c2d12]/40 rounded-xl p-5 my-2">
                    {/* Título */}
                    <p className="text-center text-base font-bold text-orange-400 mb-1">Frequência de danos — F</p>
                    <p className="text-center text-xs text-orange-700 mb-5">Seção 7, NBR 5419-2:2026 | FX = NX × PX (sem fator L)</p>
                    {/* Linha principal */}
                    <div className="flex items-center gap-3 justify-center mb-4 flex-wrap">
                      {/* Fontes de dano */}
                      <div className="border border-orange-700 rounded-xl p-3 min-w-[130px]">
                        <p className="text-center text-xs text-orange-400 font-semibold mb-2">Fontes de dano</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[["S1","ND"],["S2","NM"],["S3","NL"],["S4","NI"]].map(([s,n])=>(
                            <div key={s} className="bg-[#3d1f0e]/60 border border-orange-800/60 rounded-lg px-2 py-1 text-center">
                              <p className="text-[10px] text-orange-500 font-bold">{s} → {n}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Seta */}
                      <svg viewBox="0 0 40 20" className="w-8 h-5 shrink-0"><line x1="0" y1="10" x2="32" y2="10" stroke="#92400e" strokeWidth="2"/><polygon points="32,6 40,10 32,14" fill="#92400e"/></svg>
                      {/* F calculado */}
                      <div className="border border-orange-600 rounded-xl p-3 min-w-[150px]">
                        <p className="text-center text-xs text-orange-300 font-bold mb-1">F (calculado)</p>
                        <p className="text-center text-sm font-bold text-orange-200 mb-1">FX = NX × PX</p>
                        <p className="text-center text-[10px] text-orange-600 leading-4">FB + FC + FM +<br/>FV + FW + FZ</p>
                        <p className="text-center text-[9px] text-orange-800 mt-1">(sem fator L — 2026)</p>
                      </div>
                      {/* vs */}
                      <p className="text-sm font-bold text-orange-600">vs</p>
                      {/* FT tolerável */}
                      <div className="border border-teal-700 rounded-xl p-3 min-w-[150px]">
                        <p className="text-center text-xs text-teal-300 font-bold mb-1">FT (tolerável)</p>
                        <p className="text-center text-[10px] text-teal-500 leading-4">Definido pelo tipo<br/>de sistema interno</p>
                        <p className="text-center text-[9px] text-teal-700 mt-1.5">Ex: Crítico → FT = 0.1<br/>Normal → FT = 1.0</p>
                      </div>
                    </div>
                    {/* Seta para baixo e dois resultados */}
                    <div className="flex justify-center mb-3">
                      <svg viewBox="0 0 20 30" className="w-4 h-6"><line x1="10" y1="0" x2="10" y2="22" stroke="#92400e" strokeWidth="2"/><polygon points="6,20 14,20 10,30" fill="#92400e"/></svg>
                    </div>
                    <div className="flex gap-3 justify-center flex-wrap">
                      {/* F > FT */}
                      <div className="border border-red-700 rounded-xl p-3 text-center min-w-[180px]">
                        <p className="text-sm font-bold text-red-400 mb-1">F &gt; FT</p>
                        <p className="text-[10px] text-red-500 leading-4">Medidas de proteção necessárias</p>
                        <p className="text-[10px] text-red-600 leading-4">Instalação de SPDA obrigatória</p>
                      </div>
                      {/* F <= FT */}
                      <div className="border border-teal-700 rounded-xl p-3 text-center min-w-[180px]">
                        <p className="text-sm font-bold text-teal-400 mb-1">F ≤ FT</p>
                        <p className="text-[10px] text-teal-500 leading-4">Proteção dispensada</p>
                        <p className="text-[10px] text-teal-600 leading-4">para este tipo de perda</p>
                      </div>
                    </div>
                  </div>
                  )}
                  <div><p className={FL}>Sistema Interno <Info className="w-3 h-3 text-gray-500"/></p><Sel value={zona.ft_sistema} onChange={v=>updZona(zona.id,{ft_sistema:v})} options={FT_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div className="flex items-center gap-3">
                    <Chk id="zpr" checked={zona.zpr0a} onChange={v=>updZona(zona.id,{zpr0a:v})} label={<span className="flex items-center gap-1">Equipamentos em ZPR 0A <Info className="w-3.5 h-3.5 text-gray-500"/></span>}/>
                  </div>
                  <div className="bg-[#0d1f3a] border border-blue-500/30 rounded-lg px-4 py-3">
                    <p className="text-[10px] text-blue-400 font-bold tracking-widest">FT (FREQUÊNCIA TOLERÁVEL)</p>
                    <p className="text-white font-mono font-bold">{fmtE(parseFloat(zona.ft_sistema)||0.1)}</p>
                  </div>
                </>}
              </div>
            </div>

            {zona.habilitar_f&&<div className="bg-[#7c2d12] rounded-xl overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between">
                <div><p className="font-semibold text-white">Frequência de danos — {zona.nome}</p><p className="text-xs text-orange-300">Substitui o antigo R2 (Serviço Público) — Seção 7 da NBR 5419-2:2026 | FX = NX × PX (sem fator L)</p></div>
                <span className={`text-sm font-mono font-bold px-3 py-1 rounded-lg ${(zc?.F??0)>parseFloat(zona.ft_sistema||"0.1")?"bg-red-900 text-red-200":"bg-blue-900 text-blue-200"}`}>F={fmtE((zc?.F??0))}</span>
              </div>
              <div className="bg-[#111827] p-5 space-y-4">
                <p className="text-[10px] text-gray-400 font-bold tracking-widest">DISTRIBUIÇÃO DAS COMPONENTES — F</p>
                <div className="flex gap-4 flex-col md:flex-row">
                  <div className="flex-1"><BarChart data={[{label:"FV",value:(zc?.FV??0),color:"#3b82f6",tooltip:"FV=(NL+NDJ)×PEB — corrente impulsiva direta"},{label:"FM",value:(zc?.FM??0),color:"#f97316",tooltip:"FM=NM×PM — descargas próximas à estrutura"},{label:"FW",value:(zc?.FW??0),color:"#a855f7",tooltip:"FW=(NL+NDJ)×PW — tensão induzida via linha"},{label:"FZ",value:(zc?.FZ??0),color:"#eab308",tooltip:"FZ=NI×PZ — descargas próximas à linha"},{label:"FC",value:(zc?.FC??0),color:"#f59e0b",tooltip:"FC=ND×PC — falhas sistemas internos"},{label:"FB",value:(zc?.FB??0),color:"#22c55e",tooltip:"FB=ND×PB (ZPR0A) — campo EM direto"}].sort((a,b)=>b.value-a.value)} rt={parseFloat(zona.ft_sistema)||0.1}/></div>
                  <div className="flex flex-col items-center justify-center w-[240px] shrink-0">
                    <p className="text-xs text-gray-400 mb-1">Comparação F × FT</p>
                    <Gauge val={(zc?.F??0)} rt={parseFloat(zona.ft_sistema)||0.1} label="F"/>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[10px] text-gray-400">
                  <div className="bg-[#0d1117] border border-[#2a3555] rounded px-2 py-1">PM={fmtE(((zc as any)?.PM_calc ?? 0))}</div>
                  <div className="bg-[#0d1117] border border-[#2a3555] rounded px-2 py-1">PMS={fmtE(((zc as any)?.PMS_calc ?? 0))}</div>
                  <div className="bg-[#0d1117] border border-[#2a3555] rounded px-2 py-1">PC={fmtE(((zc as any)?.PC_calc ?? 0))}</div>
                  <div className="bg-[#0d1117] border border-[#2a3555] rounded px-2 py-1">KS1={(((zc as any)?.KS1_calc ?? 0)).toFixed(3)}</div>
                  <div className="bg-[#0d1117] border border-[#2a3555] rounded px-2 py-1">KS2={(((zc as any)?.KS2_calc ?? 0)).toFixed(3)}</div>
                  <div className="bg-[#0d1117] border border-[#2a3555] rounded px-2 py-1">KS4={(((zc as any)?.KS4_calc ?? 0)).toFixed(3)}</div>
                </div>
                {linhas.length>0&&<div>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-2">CONTRIBUIÇÃO POR LINHA ELÉTRICA</p>
                  <div className="overflow-x-auto"><table className="w-full min-w-[400px] text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">Linha</th><th className="text-right">FV</th><th className="text-right">FW</th><th className="text-right">FZ</th><th className="text-right">Total</th></tr></thead>
                    <tbody>{(calc?.zonas.find(z=>z.id===zona.id)?.linhas_contrib??[]).map(lc=>{
                      const fv=lc.FV??0; const fw=lc.FW??0; const fz=lc.FZ??0;
                      return <tr key={lc.id} className="border-t border-[#2a3555]"><td className="py-1 font-medium text-white">{lc.nome}</td><td className="text-right font-mono text-gray-300">{fmtE(fv)}</td><td className="text-right font-mono text-gray-300">{fmtE(fw)}</td><td className="text-right font-mono text-gray-300">{fmtE(fz)}</td><td className="text-right font-mono text-white">{fmtE(fv+fw+fz)}</td></tr>;})}
                    </tbody>
                  </table></div>
                </div>}
                <button onClick={()=>setRecF(v=>!v)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white">
                  {recF?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>} Recomendação
                </button>
                {recF&&<div className={`rounded-lg px-4 py-3 flex flex-col gap-2 ${(zc?.F??0)>parseFloat(zona.ft_sistema||"0.1")?"bg-red-900/30 border border-red-500/40":"bg-blue-900/30 border border-blue-500/30"}`}>
                  <div className="flex items-center justify-between">
                    {(zc?.F??0)>parseFloat(zona.ft_sistema||"0.1")
                      ?<span className="text-red-400 font-bold text-sm">✗ Não atende — ação obrigatória</span>
                      :<span className="text-blue-300 font-bold text-sm">✓ {(zc?.F??0)/parseFloat(zona.ft_sistema||"0.1")<0.5?"Atende com boa margem":"Atende"}</span>}
                    <span className="text-xs text-gray-400 font-mono">F = {fmtE((zc?.F??0))} | FT = {fmtE(parseFloat(zona.ft_sistema||"0.1"))} | Razão = {((zc?.F??0)/parseFloat(zona.ft_sistema||"0.1")*100).toFixed(1)}%</span>
                  </div>
                  {(zc?.F??0)>parseFloat(zona.ft_sistema||"0.1")&&<>
                    <p className="text-xs text-gray-400">A componente FM é a maior (componente dominante em regiões de alta atividade atmosférica). Verifique: o SPDA externo com subsistema de captação em malha e espaçamento entre descidas inferior a 5 m, o sistema coordenado de DPS (NBR 5419-4) - DPS NP I é a medida mais eficiente para reduzir FM -, a blindagem espacial da estrutura, a blindagem e roteamento das linhas internas e a tensão suportável UW dos equipamentos.</p>
                    <div className="bg-red-950/60 border border-red-800/40 rounded px-3 py-1.5 text-xs text-red-400">Alerta global: somatório = {fmtE((zc?.F??0))} / {fmtE(parseFloat(zona.ft_sistema||"0.1"))} ({((zc?.F??0)/parseFloat(zona.ft_sistema||"0.1")*100).toFixed(1)}%). Medidas de proteção adicionais são obrigatórias.</div>
                  </>}
                </div>}
              </div>
            </div>}

            {/* L4 — PERDAS ECONÔMICAS */}
            <div className="rounded-xl overflow-hidden">
              <div className="bg-[#0d2d1a] px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-blue-300"/>
                  <div><p className="font-bold text-white">L4 — PERDAS ECONÔMICAS</p><p className="text-xs text-blue-300">Anexo D da NBR 5419-2:2026</p></div>
                </div>
                <span className="text-xs text-gray-400 border border-gray-600 px-2 py-1 rounded">OPCIONAL (Anexo D)</span>
              </div>
              <div className="bg-[#111827] p-5 space-y-4">
                <button onClick={()=>setIlL4(v=>!v)} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                  <Info className="w-4 h-4 border border-blue-400 rounded-full"/>Ver ilustração: Perdas econômicas{ilL4?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
                </button>
                {ilL4&&<div className="bg-[#1a2035] rounded-lg p-3 text-xs text-gray-400">R4 = RA + RB + RC + RM + RU + RV + RW + RZ (RA/RU somente quando houver animais) — Anexo D, informativo</div>}
                <div className="flex items-center gap-3">
                  <Chk id="l4" checked={zona.habilitar_l4} onChange={v=>updZona(zona.id,{habilitar_l4:v})} label="Habilitar Avaliação Econômica"/>
                </div>
                {zona.habilitar_l4&&<div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 text-xs text-gray-400 bg-[#1a2035] border border-[#2a3555] rounded-lg p-3">
                    Modo normativo: L4 calculado pelo Anexo D. A Tabela D.1 usa ca/ct, (ca+cb+cc+cs)/ct e cs/ct apenas na análise econômica completa; usando RT4 representativo, mantenha as relações desabilitadas.
                  </div>
                  <div className="col-span-2"><p className={FL}>Tipo/base L4 — Tabela D.2</p><Sel value={zona.tipo_l4} onChange={v=>updZona(zona.id,{tipo_l4:v,l4_base_perdas:"ANEXO_D"})} options={L4_TIPO_OPT.map(o=>({v:o.v,l:o.l}))}/></div>
                  <div className="col-span-2"><Chk id={`l4-rel-${zona.id}`} checked={zona.l4_usar_relacoes_valor} onChange={v=>updZona(zona.id,{l4_usar_relacoes_valor:v,l4_base_perdas:"ANEXO_D"})} label="Usar relações econômicas ca/ct, (ca+cb+cc+cs)/ct e cs/ct" extra={<span className="text-xs text-gray-500">Desmarcado = RT4 representativo, relações substituídas por 1.</span>}/></div>
                  <div><p className={FL}>Valor animais (R$ mi)</p><input type="number" className={INP} style={INP_STYLE} value={zona.val_animais} onChange={e=>updZona(zona.id,{val_animais:Number(e.target.value)})} min={0}/></div>
                  <div><p className={FL}>Valor edificação (R$ mi)</p><input type="number" className={INP} style={INP_STYLE} value={zona.val_edif_l4} onChange={e=>updZona(zona.id,{val_edif_l4:Number(e.target.value)})} min={0}/></div>
                  <div><p className={FL}>Valor conteúdo (R$ mi)</p><input type="number" className={INP} style={INP_STYLE} value={zona.val_conteudo} onChange={e=>updZona(zona.id,{val_conteudo:Number(e.target.value)})} min={0}/></div>
                  <div><p className={FL}>Valor sistemas internos (R$ mi)</p><input type="number" className={INP} style={INP_STYLE} value={zona.val_sistemas} onChange={e=>updZona(zona.id,{val_sistemas:Number(e.target.value)})} min={0}/></div>
                </div>}
              </div>
            </div>

            {zona.habilitar_l4&&<div className="bg-[#0d2d1a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between">
                <div><p className="font-semibold text-white">Perdas econômicas (L4) — {zona.nome}</p><p className="text-xs text-blue-300">Análise de risco R4 conforme Anexo D da NBR 5419-2:2026</p></div>
                <span className="text-sm font-mono font-bold px-3 py-1 rounded-lg bg-blue-900 text-blue-200">R4={fmtE((zc?.R4??0))}</span>
              </div>
              <div className="bg-[#111827] p-5 space-y-4">
                <p className="text-[10px] text-gray-400 font-bold tracking-widest">DISTRIBUIÇÃO DAS COMPONENTES — R4</p>
                <div className="flex gap-4 flex-col md:flex-row">
                  <div className="flex-1"><BarChart data={[{label:"RB",value:(zc?.RB4??0),color:"#f97316",tooltip:"RB4=ND×PB×LB4"},{label:"RV",value:(zc?.RV4??0),color:"#a855f7",tooltip:"RV4=(NL+NDJ)×PV×LB4"},{label:"RA",value:(zc?.RA4??0),color:"#3b82f6",tooltip:"RA4=ND×PA×LA4"},{label:"RU",value:(zc?.RU4??0),color:"#22c55e",tooltip:"RU4=(NL+NDJ)×PU×LA4"},{label:"RC",value:(zc?.RC4??0),color:"#eab308",tooltip:"RC4=ND×PC×LC4"},{label:"RM",value:(zc?.RM4??0),color:"#14b8a6",tooltip:"RM4=NM×PM×LC4"},{label:"RW",value:(zc?.RW4??0),color:"#6366f1",tooltip:"RW4=(NL+NDJ)×PW×LC4"},{label:"RZ",value:(zc?.RZ4??0),color:"#ec4899",tooltip:"RZ4=NI×PZ×LC4"}].sort((a,b)=>b.value-a.value)} rt={RT4}/></div>
                  <div className="flex flex-col items-center justify-center w-[240px] shrink-0">
                    <p className="text-xs text-gray-400 mb-1">{zona.l4_usar_relacoes_valor ? "R4 — análise econômica completa" : "Comparação R4 × RT4 representativo"}</p>
                    <Gauge val={(zc?.R4??0)} rt={RT4} label="R4"/>
                    {zona.l4_usar_relacoes_valor&&<p className="text-[10px] text-gray-500 text-center mt-1">Com ca/ct e cs/ct habilitados, o RT4 representativo não deve ser usado como critério decisório.</p>}
                  </div>
                </div>
                {(zc?.linhas_contrib?.length??0)>0&&<div>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-2">CONTRIBUIÇÃO POR LINHA ELÉTRICA</p>
                  <div className="overflow-x-auto"><table className="w-full min-w-[400px] text-xs">
                    <thead><tr className="text-gray-500">
                      <th className="text-left py-1">Linha</th>
                      <th className="text-right">RU4</th>
                      <th className="text-right">RV4</th>
                      <th className="text-right">RW4</th>
                      <th className="text-right">RZ4</th>
                      <th className="text-right">Total</th>
                    </tr></thead>
                    <tbody>{(zc?.linhas_contrib??[]).map((lc:any)=><tr key={lc.id} className="border-t border-[#2a3555]">
                      <td className="py-1 font-medium text-white">{lc.nome}</td>
                      <td className="text-right font-mono text-gray-300">{fmtE(lc.RU4 ?? 0)}</td>
                      <td className="text-right font-mono text-gray-300">{fmtE(lc.RV4 ?? 0)}</td>
                      <td className="text-right font-mono text-gray-300">{fmtE(lc.RW4 ?? 0)}</td>
                      <td className="text-right font-mono text-gray-300">{fmtE(lc.RZ4 ?? 0)}</td>
                      <td className="text-right font-mono text-white">{fmtE((lc.RU4 ?? 0)+(lc.RV4 ?? 0)+(lc.RW4 ?? 0)+(lc.RZ4 ?? 0))}</td>
                    </tr>)}</tbody>
                  </table></div>
                </div>}
                <button onClick={()=>setRecL4(v=>!v)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white">
                  {recL4?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>} Recomendação
                </button>
                {recL4&&<div className={`rounded-lg px-4 py-3 ${(zc?.R4??0)>RT4?"bg-red-900/30 border border-red-500/40":"bg-blue-900/30 border border-blue-500/30"}`}>
                  <div className="flex items-center justify-between">
                    {(zc?.R4??0)>RT4
                      ?<span className="text-red-400 font-bold text-sm">✗ Não atende</span>
                      :<span className="text-blue-300 font-bold text-sm">✓ {(zc?.R4??0)/RT4<0.1?"Atende com ampla margem de segurança":"Atende com boa margem"}</span>}
                    <span className="text-xs text-gray-400 font-mono">R4 = {fmtE((zc?.R4??0))} | RT = {fmtE(RT4)} | {((zc?.R4??0)/RT4*100).toFixed(1)}%</span>
                  </div>
                </div>}
              </div>
            </div>}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button onClick={()=>handleTabChange("informacoes")} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-[#2a3555] hover:border-blue-500 rounded-xl px-4 py-2 transition-colors">
                <ChevronDown className="w-4 h-4 rotate-90"/> Informações
              </button>
              <button onClick={()=>handleTabChange("analises")} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-colors">
                Análises <BarChart2 className="w-4 h-4"/>
              </button>
            </div>
          </div>
        )}

        {/* ═══ ANÁLISES ═══ */}
        {tab==="analises"&&(()=>{
          const todasZonas = zonas.map(z=>({z, c:calc?.zonas.find(cz=>cz.id===z.id)||{R1:0,R3:0,F:0,R4:0,RA:0,RB:0,RC:0,RM:0,RU:0,RV:0,RW:0,RZ:0,LA:0,LB:0,LC:0,id:z.id,nome:z.nome,linhas_contrib:[] as import("@/lib/api").LinhaContribOut[]}}));
          const RT1=1e-5, RT3=1e-4, FT_def=0.1;
          const R1_global = todasZonas.reduce((s,{c})=>s+c.R1,0);
          const R3_global = todasZonas.reduce((s,{c})=>s+(c.R3||0),0);
          const F_global  = todasZonas.reduce((s,{z,c})=>s+(z.habilitar_f?c.F:0),0);
          const R4_global = todasZonas.reduce((s,{c})=>s+c.R4,0);
          const zonasComF = todasZonas.filter(({z})=>z.habilitar_f);
          // A norma permite avaliar F por estrutura, zona, sistema ou equipamento.
          // A comparação de cada frequência F deve ser feita com o seu FT.
          // Por isso, a conformidade de F é avaliada por zona; o card global usa o FT mais restritivo apenas como referência.
          const FT_global = zonasComF.length>0 ? Math.min(...zonasComF.map(({z})=>parseFloat(z.ft_sistema||"0.1")||0.1)) : FT_def;
          const R1_ok = R1_global<=RT1;
          const R3_ok = R3_global<=RT3 || !todasZonas.some(({z})=>z.tem_l3);
          const F_ok  = zonasComF.length===0 || zonasComF.every(({z,c})=>c.F <= (parseFloat(z.ft_sistema||"0.1")||0.1));
          const l4AnaliseEconomicaCompleta = todasZonas.some(({z})=>z.habilitar_l4 && z.l4_usar_relacoes_valor);
          const tudo_ok = R1_ok && R3_ok && F_ok;
          const RA_g=todasZonas.reduce((s,{c})=>s+c.RA,0);
          const RB_g=todasZonas.reduce((s,{c})=>s+c.RB,0);
          const RC_g=todasZonas.reduce((s,{c})=>s+c.RC,0);
          const RM_g=todasZonas.reduce((s,{c})=>s+c.RM,0);
          const RU_g=todasZonas.reduce((s,{c})=>s+c.RU,0);
          const RV_g=todasZonas.reduce((s,{c})=>s+c.RV,0);
          const RW_g=todasZonas.reduce((s,{c})=>s+c.RW,0);
          const RZ_g=todasZonas.reduce((s,{c})=>s+c.RZ,0);
          const compDataR1=[
            {label:"RA",value:RA_g,color:"#3b82f6",tooltip:"S1-D1: Ferimentos por descarga na estrutura (tensão toque/passo)"},
            {label:"RB",value:RB_g,color:"#ef4444",tooltip:"S1-D2: Danos físicos por descarga direta na estrutura"},
            {label:"RC",value:RC_g,color:"#f59e0b",tooltip:"S1-D3: Falhas de sistemas internos por descarga na estrutura"},
            {label:"RM",value:RM_g,color:"#8b5cf6",tooltip:"S2-D3: Falhas de sistemas por descarga próxima à estrutura"},
            {label:"RU",value:RU_g,color:"#06b6d4",tooltip:"S3-D1: Ferimentos por descarga na linha conectada"},
            {label:"RV",value:RV_g,color:"#f97316",tooltip:"S3-D2: Danos físicos por descarga na linha conectada"},
            {label:"RW",value:RW_g,color:"#ec4899",tooltip:"S3-D3: Falhas de sistemas por descarga na linha"},
            {label:"RZ",value:RZ_g,color:"#84cc16",tooltip:"S4-D3: Falhas de sistemas por descarga próxima à linha"},
          ].filter(d=>d.value>0);
          const dominante=[...compDataR1].sort((a,b)=>b.value-a.value)[0];
          const planoAprovacao = gerarPlanoAprovacaoAnaliseRisco({
            calc,
            zonas: zonas as unknown as Array<Record<string, unknown>>,
            linhas: linhas as unknown as Array<Record<string, unknown>>,
            dimensoes: { L, W, H, Hp },
            pb,
            pta,
          });
          return (
          <div className="space-y-6 pb-8">
            {/* Veredicto global */}
            <div className={`rounded-2xl border px-6 py-5 flex items-center gap-5 ${tudo_ok?"bg-green-950/40 border-green-500/30":"bg-red-950/40 border-red-500/30"}`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${tudo_ok?"bg-green-500/20":"bg-red-500/20"}`}>
                {tudo_ok
                  ? <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  : <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                }
              </div>
              <div className="flex-1">
                <p className={`text-lg font-bold ${tudo_ok?"text-green-300":"text-red-300"}`}>
                  {tudo_ok?"✓ Estrutura CONFORME com a NBR 5419-2:2026":"✗ Estrutura NÃO CONFORME — medidas de proteção obrigatórias"}
                </p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {obra||"Obra não identificada"} · {mun}{uf?`-${uf}`:""} · NG={NG} · {zonas.length} zona{zonas.length>1?"s":""}
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-gray-500 uppercase tracking-widest">R1 Global</p>
                <p className={`text-2xl font-mono font-bold ${R1_ok?"text-green-400":"text-red-400"}`}>{fmtE(R1_global)}</p>
                <p className="text-xs text-gray-500">RT = {fmtE(RT1)}</p>
              </div>
            </div>
            {/* Cards R1/F/R3/R4 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {([
                {id:"R1",val:R1_global,rt:RT1,label:"R1 — Vida Humana",obr:true},
                {id:"F",val:F_global,rt:FT_global,label:"F — Freq. Danos",obr:todasZonas.some(({z})=>z.habilitar_f)},
                {id:"R3",val:R3_global,rt:RT3,label:"R3 — Patrimônio",obr:todasZonas.some(({z})=>z.tem_l3)},
                {id:"R4",val:R4_global,rt:1e-3,label:"R4 — Econômico",obr:false,infoOnly:l4AnaliseEconomicaCompleta},
              ] as {id:string;val:number;rt:number;label:string;obr:boolean;infoOnly?:boolean}[]).map(({id,val,rt,label,obr,infoOnly})=>{
                const ok=infoOnly ? true : val<=rt;
                const pct=rt>0?(val/rt*100).toFixed(1):"∞";
                if(!obr&&val===0) return (
                  <div key={id} className="rounded-xl border border-[#1e2a3a] bg-[#0d1117] p-4 opacity-50">
                    <p className="text-xs text-gray-500 mb-1 font-medium">{label}</p>
                    <p className="text-xs text-gray-600">Não aplicável</p>
                  </div>
                );
                return (
                  <div key={id} className={`rounded-xl border p-4 ${ok?"border-green-500/30 bg-green-950/20":"border-red-500/40 bg-red-950/20"}`}>
                    <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${ok?"text-green-400":"text-red-400"}`}>{label}</p>
                    <p className={`text-xl font-mono font-bold ${ok?"text-green-300":"text-red-300"}`}>{fmtE(val)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">RT = {fmtE(rt)}</p>
                    <div className="mt-2 h-1.5 bg-[#1e2a3a] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${ok?"bg-green-500":"bg-red-500"}`} style={{width:`${Math.min(parseFloat(pct),100)}%`}}/>
                    </div>
                    <p className={`text-xs mt-1 font-bold ${ok?"text-green-400":"text-red-400"}`}>
                      {infoOnly ? "INFORMATIVO" : (ok?"ATENDE":"NÃO ATENDE")} {infoOnly ? "— análise econômica completa" : `· ${pct}% do RT`}
                    </p>
                    {!obr&&<p className="text-[10px] text-gray-600 mt-0.5">{infoOnly ? "Anexo D/6.10 — não usar RT4 representativo como decisão" : "Informativo (Anexo D)"}</p>}
                  </div>
                );
              })}
            </div>

            {/* Plano de adequação normativa para aprovação */}
            <div className={`rounded-2xl border p-5 ${planoAprovacao.aprovado ? "bg-green-950/20 border-green-500/30" : "bg-amber-950/20 border-amber-500/30"}`}>
              <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className={`w-5 h-5 ${planoAprovacao.aprovado ? "text-green-300" : "text-amber-300"}`}/>
                    <p className={`text-sm font-bold uppercase tracking-widest ${planoAprovacao.aprovado ? "text-green-300" : "text-amber-300"}`}>{planoAprovacao.aprovado ? "Conformidade e manutenção" : "Recomendação para aprovação normativa"}</p>
                  </div>
                  <h3 className="text-lg font-bold text-white">{planoAprovacao.titulo}</h3>
                  <p className="text-sm text-gray-400 mt-1 max-w-4xl">{planoAprovacao.resumo}</p>
                </div>
                {!planoAprovacao.aprovado && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
                    <div className="rounded-xl bg-[#0d1117] border border-[#24314f] px-3 py-2"><p className="text-gray-500">NP sugerido</p><p className="font-bold text-blue-300">NP {planoAprovacao.npRecomendado}</p></div>
                    <div className="rounded-xl bg-[#0d1117] border border-[#24314f] px-3 py-2"><p className="text-gray-500">Método</p><p className="font-bold text-blue-300 capitalize">{planoAprovacao.metodoDimensionamento}</p></div>
                    <div className="rounded-xl bg-[#0d1117] border border-[#24314f] px-3 py-2"><p className="text-gray-500">Parâmetros do NP</p><p className="font-bold text-blue-300">R={planoAprovacao.parametrosDimensionamento.raioEsferaM} m | {planoAprovacao.parametrosDimensionamento.malhaM[0]} × {planoAprovacao.parametrosDimensionamento.malhaM[1]} m</p></div>
                    <div className="rounded-xl bg-[#0d1117] border border-[#24314f] px-3 py-2"><p className="text-gray-500">Descidas mín.</p><p className="font-bold text-blue-300">{planoAprovacao.parametrosDimensionamento.numeroMinimoDescidas} | dist. {planoAprovacao.parametrosDimensionamento.distanciaDescidaM} m</p></div>
                  </div>
                )}
              </div>

              {!planoAprovacao.aprovado && planoAprovacao.componentesDominantes.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {planoAprovacao.componentesDominantes.map((c)=>(
                    <span key={c.codigo} className="text-xs rounded-full bg-[#0d1117] border border-[#24314f] px-3 py-1 text-gray-300">
                      <strong className="text-white">{c.codigo}</strong> {fmtE(c.valor)} · {c.percentualR1.toFixed(1)}% do R1
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {planoAprovacao.acoes.map((acao, idx)=>(
                  <div key={`${acao.categoria}-${idx}`} className="rounded-xl border border-[#24314f] bg-[#0d1117] p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${acao.prioridade === "Obrigatória" ? "bg-red-900/50 text-red-300" : acao.prioridade === "Alta" ? "bg-amber-900/50 text-amber-300" : acao.prioridade === "Média" ? "bg-blue-900/50 text-blue-300" : "bg-green-900/50 text-green-300"}`}>{acao.prioridade}</span>
                      <span className="text-[10px] text-gray-500">{acao.componentesAtacados.join(" · ")}</span>
                    </div>
                    <p className="font-bold text-white text-sm">{acao.categoria}</p>
                    <p className="text-sm text-gray-300 mt-1">{acao.acao}</p>
                    <p className="text-xs text-gray-500 mt-2">{acao.justificativa}</p>
                    <p className="text-[11px] text-blue-300 mt-2">Efeito esperado: {acao.efeitoEsperado}</p>
                  </div>
                ))}
              </div>

              {planoAprovacao.observacoes.length > 0 && (
                <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-950/20 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-2">Observações do dimensionamento</p>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-gray-300">
                    {planoAprovacao.observacoes.map((obs, idx)=><li key={idx}>{obs}</li>)}
                  </ul>
                </div>
              )}
            </div>
            {/* Gauges globais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`rounded-xl border p-4 ${R1_ok?"border-green-500/20 bg-green-950/10":"border-red-500/20 bg-red-950/10"}`}>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3 text-center">R1 Global × RT (10⁻⁵)</p>
                <div className="flex justify-center"><Gauge val={R1_global} rt={RT1} label="R1"/></div>
                <p className="text-xs text-gray-500 text-center mt-1">NBR 5419-2:2026 Tabela 4 — Risco tolerável L1</p>
              </div>
              {todasZonas.some(({z})=>z.habilitar_f)&&(
                <div className={`rounded-xl border p-4 ${F_ok?"border-green-500/20 bg-green-950/10":"border-red-500/20 bg-red-950/10"}`}>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3 text-center">F Global × FT mais restritivo ({fmtE(FT_global)})</p>
                  <div className="flex justify-center"><Gauge val={F_global} rt={FT_global} label="F"/></div>
                  <p className="text-xs text-gray-500 text-center mt-1">Seção 7 — soma global informativa; conformidade de F avaliada por zona/sistema/equipamento</p>
                </div>
              )}
            </div>
            {/* Distribuição componentes R1 */}
            {compDataR1.length>0&&(
              <div className="rounded-xl border border-[#1e2a3a] bg-[#0d1117] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Distribuição das Componentes — R1 Global</p>
                  {dominante&&<span className="text-xs bg-red-900/50 text-red-300 border border-red-700/40 px-2 py-0.5 rounded-full font-bold">Dominante: {dominante.label} ({(dominante.value/R1_global*100).toFixed(1)}%)</span>}
                </div>
                <BarChart data={compDataR1} rt={RT1}/>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3">
                  {([
                    {k:"RA",d:"S1-D1 Toque/Passo"},{k:"RB",d:"S1-D2 Danos Físicos"},
                    {k:"RC",d:"S1-D3 Falhas Sist."},{k:"RM",d:"S2-D3 Desc. Próxima"},
                    {k:"RU",d:"S3-D1 Linha→Vida"},{k:"RV",d:"S3-D2 Linha→Físico"},
                    {k:"RW",d:"S3-D3 Linha→Sist."},{k:"RZ",d:"S4-D3 Prox.Linha→Sist."},
                  ] as {k:string;d:string}[]).map(({k,d})=>(
                    <div key={k} className="text-[10px] text-gray-500 flex items-center gap-1">
                      <span className="font-mono font-bold text-gray-300">{k}</span><span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Por Zona */}
            {todasZonas.length>1&&(
              <div className="space-y-3">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest px-1">Resultado por Zona</p>
                {todasZonas.map(({z,c})=>{
                  const zOk=c.R1<=RT1;
                  const pctR1=R1_global>0?(c.R1/R1_global*100).toFixed(1):"0";
                  return (
                    <div key={z.id} className={`rounded-xl border ${zOk?"border-green-500/20":"border-red-500/30"} bg-[#0d1117]`}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${zOk?"bg-green-500":"bg-red-500"}`}/>
                        <span className="font-semibold text-white text-sm">{z.nome}</span>
                        <span className={`text-xs font-mono font-bold ml-auto ${zOk?"text-green-400":"text-red-400"}`}>R1={fmtE(c.R1)}</span>
                        <span className="text-xs text-gray-500">{pctR1}% do global</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${zOk?"bg-green-900/50 text-green-300":"bg-red-900/50 text-red-300"}`}>{zOk?"ATENDE":"NÃO ATENDE"}</span>
                      </div>
                      <div className="h-1 mx-4 mb-3 bg-[#1e2a3a] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${zOk?"bg-green-500/60":"bg-red-500/60"}`} style={{width:`${Math.min(parseFloat(pctR1),100)}%`}}/>
                      </div>
                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                          {([
                            {k:"RA",v:c.RA},{k:"RB",v:c.RB},{k:"RC",v:c.RC},{k:"RM",v:c.RM},
                            {k:"RU",v:c.RU},{k:"RV",v:c.RV},{k:"RW",v:c.RW},{k:"RZ",v:c.RZ},
                          ] as {k:string;v:number}[]).map(({k,v})=>(
                            <div key={k} className={`rounded-lg p-2 text-center ${v>0?"bg-[#1a2035] border border-[#2a3555]":"bg-[#111827] opacity-40"}`}>
                              <p className="text-[10px] text-gray-500 font-mono">{k}</p>
                              <p className="text-xs font-mono text-white">{v>0?fmtE(v):"—"}</p>
                            </div>
                          ))}
                        </div>
                        {(()=>{const lcs=(c as import("@/lib/api").ZonaCalcOut).linhas_contrib??[];return lcs.length>0&&(
                          <div className="mt-3">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Contribuição das Linhas</p>
                            {lcs.map(lc=>{
                              const tot=lc.RU+lc.RV+lc.RW+lc.RZ;
                              const pct=c.R1>0?(tot/c.R1*100).toFixed(1):"0";
                              return tot>0?(
                                <div key={lc.nome} className="flex items-center gap-2 text-xs mb-1">
                                  <span className="text-gray-400 w-24 truncate">{lc.nome}</span>
                                  <div className="flex-1 h-1.5 bg-[#1e2a3a] rounded-full"><div className="h-full bg-blue-500/70 rounded-full" style={{width:`${Math.min(parseFloat(pct),100)}%`}}/></div>
                                  <span className="text-gray-500 w-20 text-right font-mono">{fmtE(tot)}</span>
                                  <span className="text-blue-400 w-10 text-right">{pct}%</span>
                                </div>
                              ):null;
                            })}
                          </div>
                        );})()}
                        {z.habilitar_f&&(
                          <div className="mt-3 pt-3 border-t border-[#1e2a3a] flex items-center gap-3">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest">F (Frequência de Danos)</span>
                            <span className="font-mono text-sm text-purple-300">{fmtE(c.F)}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.F<=parseFloat(z.ft_sistema||"0.1")?"bg-green-900/50 text-green-300":"bg-red-900/50 text-red-300"}`}>{c.F<=parseFloat(z.ft_sistema||"0.1")?"ATENDE":"NÃO ATENDE"}</span>
                            <span className="text-xs text-gray-600 ml-auto">FT={z.ft_sistema}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Resumo estrutura */}
            <div className="rounded-xl border border-[#1e2a3a] bg-[#0d1117] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1e2a3a] bg-[#0d1f3a]">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Resumo dos Dados da Estrutura — NBR 5419-2:2026</p>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
                {([
                  ["Obra / Cliente",obra||"—"],
                  ["Município / UF",`${mun||"—"}${uf?`-${uf}`:""}`],
                  ["Nível de Atividade de Raios (NG)",`${NG} descargas/km²/ano`],
                  ["Dimensões L × W × H",`${L} × ${W} × ${H} m`],
                  ["Saliência Hp",`${Hp} m`],
                  ["Área de Captação AD",`${fmtM2(AD)} m²`],
                  ["Área de Captação AM",`${fmtM2(AM)} m²`],
                  ["Nd — descargas/ano na estrutura",fmtE(ND)],
                  ["Nm — descargas/ano próximas",fmtE(NM)],
                  ["Zonas analisadas",String(zonas.length)],
                  ["Linhas elétricas",String(linhas.length)],
                  ["Trechos SL totais",String(linhas.reduce((s,l)=>s+l.trechos.length,0))],
                  ["ART / RT / TRT",art||"—"],
                  ["Responsável Técnico",resp||"—"],
                ] as [string,string][]).map(([k,v])=>(
                  <div key={k} className="flex items-start gap-2 py-1 border-b border-[#1a2035]">
                    <span className="text-[11px] text-gray-500 w-52 shrink-0">{k}</span>
                    <span className="text-[11px] text-gray-200 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Navegação */}
            <div className="flex items-center justify-between pt-2">
              <button onClick={()=>handleTabChange("zonas")} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-[#2a3555] hover:border-blue-500 rounded-xl px-4 py-2 transition-colors">
                <ChevronDown className="w-4 h-4 rotate-90"/> Zonas
              </button>
              <button onClick={()=>handleTabChange("relatorio")} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-colors">
                Relatório <FileText className="w-4 h-4"/>
              </button>
            </div>
          </div>
          );
        })()}

        {/* ═══ RELATÓRIO ═══ */}
        {tab==="relatorio"&&(()=>{
          // Gera preview automaticamente ao entrar na aba
          if(!pdfPreviewUrl && !pdfPreviewLoading && !pdfError) {
            gerarPreviewPDF();
          }
          return (
          <div className="space-y-4 pb-8">
            {/* ── BARRA DE AÇÃO ── */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Cor do Relatório — afeta o Word */}
              <label className="flex items-center gap-2 cursor-pointer bg-[#1a2035] border border-[#2a3555] hover:border-blue-500 rounded-xl px-3 py-2 transition-colors select-none">
                <span className="w-4 h-4 rounded-full border-2 border-white/20 shrink-0" style={{background:reportColor}}/>
                <span className="text-sm text-gray-300">Cor do Relatório</span>
                <input type="color" value={reportColor} onChange={e=>setReportColor(e.target.value)} className="sr-only" aria-label="Cor do relatório"/>
              </label>
              {/* Exportar Word */}
              <button onClick={baixarWord} disabled={wordLoading}
                className="flex items-center gap-2 bg-[#1a2035] border border-[#2a3555] hover:border-blue-500 disabled:opacity-50 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors">
                {wordLoading
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Gerando Word…</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Exportar Word</>
                }
              </button>
              {/* Exportar PDF */}
              <button onClick={baixarPDF} disabled={pdfLoading}
                className="flex items-center gap-2 bg-[#1a2035] border border-[#2a3555] hover:border-blue-500 disabled:opacity-50 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors">
                {pdfLoading
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Gerando PDF…</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Exportar PDF</>
                }
              </button>
              {/* Atualizar preview */}
              <button onClick={()=>{
                if(pdfPreviewUrl){URL.revokeObjectURL(pdfPreviewUrl);setPdfPreviewUrl(null);}
                setTimeout(gerarPreviewPDF, 100);
              }} className="flex items-center gap-2 bg-[#1a2035] border border-[#2a3555] hover:border-blue-500 text-gray-400 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Atualizar
              </button>
              {(pdfError||wordError)&&<p className="text-xs text-red-400 ml-2">{pdfError||wordError}</p>}
            </div>

            {/* ── PREVIEW DO PDF REAL ── */}
            <div className="rounded-2xl bg-[#111827] border border-[#1e2a3a] overflow-hidden" style={{minHeight:"80vh"}}>
              {pdfPreviewLoading&&(
                <div className="flex flex-col items-center justify-center h-96 gap-4">
                  <svg className="animate-spin w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <p className="text-sm text-gray-400">Gerando pré-visualização do laudo…</p>
                  <p className="text-xs text-gray-600">Isso pode levar alguns segundos</p>
                </div>
              )}
              {!pdfPreviewLoading&&pdfPreviewUrl&&(
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full border-0"
                  style={{height:"85vh", minHeight:"600px"}}
                  title="Pré-visualização do Laudo PDF"
                />
              )}
              {!pdfPreviewLoading&&!pdfPreviewUrl&&!pdfError&&(
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
                  <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <p className="text-sm">Iniciando geração do relatório…</p>
                </div>
              )}
              {!pdfPreviewLoading&&pdfError&&(
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <p className="text-red-400 text-sm">{pdfError}</p>
                  <button onClick={()=>{setPdfError(null);gerarPreviewPDF();}}
                    className="text-xs text-blue-400 hover:text-blue-300 underline">Tentar novamente</button>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        </div>
      </div>

      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#24314f] bg-[#111827] shadow-2xl">
            <div className="p-6 border-b border-[#1f2a44]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-300"/>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirmar limpeza da análise</h3>
                  <p className="text-sm text-gray-400 mt-1">Isso vai limpar o cenário carregado, os dados preenchidos, os resultados calculados e a prévia do laudo.</p>
                </div>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={()=>setConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#2a3555] text-gray-300 hover:text-white hover:bg-[#1a2035] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={limparDados}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
              >
                Limpar tela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
