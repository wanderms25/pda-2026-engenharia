import { z } from "zod";

/**
 * Schemas Zod — espelham exatamente o Pydantic do backend.
 *
 * Manter sincronizado com `backend/app/schemas/analise_risco.py` e com
 * `backend/app/nbr5419/enums.py`.
 */

export const nivelProtecaoEnum = z.enum([
  "I",
  "II",
  "III",
  "IV",
  "NENHUM",
]);

export const localizacaoEnum = z.enum([
  "CERCADA_OBJETOS_MAIS_ALTOS",
  "CERCADA_MESMA_ALTURA",
  "ISOLADA",
  "ISOLADA_TOPO_COLINA",
]);

export const tipoInstalacaoEnum = z.enum([
  "AEREO",
  "ENTERRADO",
  "ENT_MALHA",
]);

export const tipoLinhaEnum = z.enum(["BT_SINAL", "AT_COM_TRAFO"]);

export const ambienteLinhaEnum = z.enum([
  "RURAL",
  "SUBURBANO",
  "URBANO",
  "URBANO_ALTAS",
]);

export const tipoEstruturaEnum = z.enum([
  "HOSPITAL",
  "HOTEL",
  "ESCOLA",
  "EDIFICIO_CIVICO",
  "ENTRETENIMENTO_PUBLICO",
  "IGREJA",
  "MUSEU",
  "INDUSTRIAL",
  "COMERCIAL",
  "RESIDENCIAL",
  "AGRICULTURA",
  "ESCRITORIO",
  "RISCO_EXPLOSAO",
  "OUTROS",
]);

export const tipoPisoEnum = z.enum([
  "TERRA_CONCRETO",
  "MARMORE_CERAMICA",
  "BRITA_CARPETE",
  "ASFALTO",
]);

export const riscoIncendioEnum = z.enum([
  "EXPLOSAO",
  "ALTO",
  "NORMAL",
  "BAIXO",
  "NENHUM",
]);

export const providenciasIncendioEnum = z.enum([
  "NENHUMA",
  "EXTINTORES",
  "HIDRANTES",
  "AUTOMATICA",
  "OPERADA",
]);

export const perigoEspecialEnum = z.enum([
  "NENHUM",
  "PANICO_BAIXO",
  "PANICO_MEDIO",
  "PANICO_ALTO",
  "EVAC_DIFICIL",
  "CONTAM_AMB",
]);

export const tipoConstrucaoEnum = z.enum([
  "ALV_CONCRETO",
  "MADEIRA",
  "METALICA",
]);

export const dimensoesSchema = z.object({
  L: z.number().positive("Comprimento deve ser positivo"),
  W: z.number().positive("Largura deve ser positiva"),
  H: z.number().positive("Altura deve ser positiva"),
  H_saliencia: z.number().positive().optional(),
});

export const linhaEletricaSchema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  comprimento_m: z.number().positive().default(1000),
  instalacao: tipoInstalacaoEnum,
  tipo: tipoLinhaEnum,
  ambiente: ambienteLinhaEnum,
  resistividade_solo_ohm_m: z.number().positive().optional(),
  tensao_suportavel_UW_kV: z.number().positive().default(2.5),
});

export const medidasProtecaoSchema = z.object({
  spda_nivel: nivelProtecaoEnum.default("NENHUM"),
  dps_coordenados_nivel: nivelProtecaoEnum.default("NENHUM"),
  dps_classe_I_entrada: nivelProtecaoEnum.default("NENHUM"),
  aviso_alerta_toque_passo: z.boolean().default(false),
  isolacao_eletrica_descida: z.boolean().default(false),
  malha_equipotencializacao_solo: z.boolean().default(false),
  descida_natural_estrutura_continua: z.boolean().default(false),
});

export const fatoresPerdaSchema = z.object({
  tipo_estrutura: tipoEstruturaEnum,
  tipo_piso: tipoPisoEnum.default("TERRA_CONCRETO"),
  risco_incendio: riscoIncendioEnum.default("NORMAL"),
  providencias_incendio: providenciasIncendioEnum.default("NENHUMA"),
  perigo_especial: perigoEspecialEnum.default("NENHUM"),
  tipo_construcao: tipoConstrucaoEnum.default("ALV_CONCRETO"),
  risco_explosao_ou_vida_imediata: z.boolean().default(false),
  numero_pessoas_zona: z.number().int().min(0).default(1),
  numero_pessoas_total: z.number().int().min(1).default(1),
  horas_ano_presenca: z.number().min(0).max(8760).default(8760),
});

export const analiseRiscoFormSchema = z.object({
  nome_projeto: z.string().min(1, "Informe o nome do projeto"),
  NG: z.number().positive("NG deve ser positivo"),
  dimensoes: dimensoesSchema,
  localizacao: localizacaoEnum,
  linhas: z.array(linhaEletricaSchema).default([]),
  fatores: fatoresPerdaSchema,
  medidas: medidasProtecaoSchema,
  calcular_r4: z.boolean().default(false),
});

export type AnaliseRiscoFormData = z.infer<typeof analiseRiscoFormSchema>;
