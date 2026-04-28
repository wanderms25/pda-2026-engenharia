/**
 * Cliente HTTP completo para o backend FastAPI.
 *
 * Inclui:
 * - Helpers de autenticação (token JWT armazenado em localStorage)
 * - Fetch autenticado automático
 * - Análise de risco + recomendação
 * - Laudo + remediação + PDF de inspeção com fotos inline
 * - CRUD de clientes e projetos (rotas protegidas)
 * - Upload de fotos
 */
import { API_BASE_URL } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

// =============================================================================
// AUTH — gerenciamento de token em localStorage
// =============================================================================
const TOKEN_KEY = "pda_token";
const USER_KEY = "pda_user";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getCurrentUser(): UsuarioInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UsuarioInfo): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

// =============================================================================
// FETCH HELPERS
// =============================================================================
export async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (authenticated) {
    const token = getAuthToken();
    if (!token) {
      throw new ApiError(401, "Não autenticado — faça login primeiro");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    const bodyObj = body as { detail?: string | Array<{ msg?: string }> };
    let message = `API error ${response.status}`;
    if (typeof bodyObj?.detail === "string") {
      message = bodyObj.detail;
    } else if (Array.isArray(bodyObj?.detail) && bodyObj.detail[0]?.msg) {
      message = bodyObj.detail[0].msg;
    }
    throw new ApiError(response.status, message, body);
  }

  if (response.status === 204) return null as T;
  return response.json();
}

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================
export interface UsuarioInfo {
  id: string;
  email: string;
  nome: string;
  registro_profissional?: string | null;
  empresa?: string | null;
  logo_base64?: string | null;
  uf_profissional?: string | null;
  tipo_registro?: string | null;
  numero_registro?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  endereco?: string | null;
  role: string;
  senha_temporaria: boolean;
  validade: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  usuario: UsuarioInfo;
}

export async function login(email: string, senha: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", senha);
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const bodyData = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      bodyData?.detail ?? "Credenciais inválidas",
      bodyData,
    );
  }
  const result: TokenResponse = await response.json();
  setAuthToken(result.access_token);
  setCurrentUser(result.usuario);
  return result;
}

export async function trocarSenha(
  senha_atual: string,
  senha_nova: string,
): Promise<UsuarioInfo> {
  const user = await request<UsuarioInfo>(
    "/auth/trocar-senha",
    {
      method: "POST",
      body: JSON.stringify({ senha_atual, senha_nova }),
    },
    true,
  );
  setCurrentUser(user);
  return user;
}

export async function obterMe(): Promise<UsuarioInfo> {
  const user = await request<UsuarioInfo>("/auth/me", {}, true);
  setCurrentUser(user);
  return user;
}

export async function atualizarPerfil(data: {
  nome?: string;
  registro_profissional?: string;
  empresa?: string;
  logo_base64?: string;
  uf_profissional?: string;
  tipo_registro?: string;
  numero_registro?: string;
  telefone?: string;
  cpf?: string;
  endereco?: string;
}): Promise<UsuarioInfo> {
  const user = await request<UsuarioInfo>(
    "/auth/me",
    { method: "PATCH", body: JSON.stringify(data) },
    true,
  );
  setCurrentUser(user);
  return user;
}

// =============================================================================
// ADMIN — gerenciamento de usuários
// =============================================================================
export interface UsuarioListItem {
  id: string;
  email: string;
  nome: string;
  registro_profissional: string | null;
  role: string;
  ativo: boolean;
  validade: string | null;
  senha_temporaria: boolean;
  criado_em: string;
}

export interface CriarUsuarioInput {
  email: string;
  nome: string;
  registro_profissional?: string;
  validade?: string; // ISO datetime
  role?: "ADMIN" | "USER";
  // Extended fields for full user profile
  cpf?: string;
  telefone?: string;
  empresa?: string;
  tipo_registro?: string;
  uf_profissional?: string;
  numero_registro?: string;
}

export interface UsuarioCriadoResponse {
  id: string;
  email: string;
  nome: string;
  role: string;
  validade: string | null;
  senha_gerada: string;
}

export async function listarUsuariosAdmin(): Promise<UsuarioListItem[]> {
  return request<UsuarioListItem[]>("/admin/usuarios", {}, true);
}

export async function criarUsuarioAdmin(
  data: CriarUsuarioInput,
): Promise<UsuarioCriadoResponse> {
  return request<UsuarioCriadoResponse>(
    "/admin/usuarios",
    { method: "POST", body: JSON.stringify(data) },
    true,
  );
}

export async function resetSenhaUsuario(id: string): Promise<UsuarioCriadoResponse> {
  return request<UsuarioCriadoResponse>(
    `/admin/usuarios/${id}/reset-senha`,
    { method: "POST" },
    true // <--- ESSE 'true' É A MÁGICA! Ele manda a função request colocar o Token.
  );
}

export async function deletarUsuarioAdmin(usuario_id: string): Promise<void> {
  await request<null>(`/admin/usuarios/${usuario_id}`, { method: "DELETE" }, true);
}

// =============================================================================
// CLIENTES (protegido)
// =============================================================================
export interface Cliente {
  id: string;
  razao_social: string;
  cnpj: string | null;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
}

export interface ClienteInput {
  razao_social: string;
  cnpj?: string;
  contato_nome?: string;
  contato_email?: string;
  contato_telefone?: string;
}

export async function listarClientes(): Promise<Cliente[]> {
  return request<Cliente[]>("/clientes", {}, true);
}

export async function criarCliente(data: ClienteInput): Promise<Cliente> {
  return request<Cliente>(
    "/clientes",
    { method: "POST", body: JSON.stringify(data) },
    true,
  );
}

export async function deletarCliente(id: string): Promise<void> {
  await request<null>(`/clientes/${id}`, { method: "DELETE" }, true);
}

// =============================================================================
// PROJETOS (protegido)
// =============================================================================
export interface Projeto {
  id: string;
  cliente_id: string;
  nome: string;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  uf: string | null;
  municipio: string | null;
  criado_em: string;
}

export interface ProjetoInput {
  cliente_id: string;
  nome: string;
  endereco?: string;
  latitude?: number;
  longitude?: number;
  uf?: string;
  municipio?: string;
}

export async function listarProjetos(cliente_id?: string): Promise<Projeto[]> {
  const query = cliente_id ? `?cliente_id=${cliente_id}` : "";
  return request<Projeto[]>(`/projetos${query}`, {}, true);
}

export async function criarProjeto(data: ProjetoInput): Promise<Projeto> {
  return request<Projeto>(
    "/projetos",
    { method: "POST", body: JSON.stringify(data) },
    true,
  );
}

export async function deletarProjeto(id: string): Promise<void> {
  await request<null>(`/projetos/${id}`, { method: "DELETE" }, true);
}

// =============================================================================
// ANÁLISE DE RISCO
// =============================================================================
export interface AnaliseRiscoRequest {
  nome_projeto: string;
  NG: number;
  dimensoes: { L: number; W: number; H: number; H_saliencia?: number };
  localizacao: string;
  linhas: Array<{
    nome: string;
    comprimento_m: number;
    instalacao: string;
    tipo: string;
    ambiente: string;
    resistividade_solo_ohm_m?: number;
    tensao_suportavel_UW_kV: number;
    fator_ptu?: number;
    fator_peb?: number;
    fator_blindagem?: number;
  }>;
  fatores: {
    tipo_estrutura: string;
    tipo_piso: string;
    risco_incendio: string;
    providencias_incendio: string;
    perigo_especial: string;
    tipo_construcao: string;
    risco_explosao_ou_vida_imediata: boolean;
    numero_pessoas_zona: number;
    numero_pessoas_total: number;
    horas_ano_presenca: number;
    blindagem_espacial?: boolean;
    fator_ks3?: number;
  };
  medidas: {
    spda_nivel: string;
    dps_coordenados_nivel: string;
    dps_classe_I_entrada: string;
    aviso_alerta_toque_passo: boolean;
    isolacao_eletrica_descida: boolean;
    malha_equipotencializacao_solo: boolean;
    descida_natural_estrutura_continua: boolean;
  };
  calcular_r4: boolean;
  numero_art?: string;
  fotos?: Array<{ nome: string; base64: string }>;
  nome_obra?: string;
  municipio_uf?: string;
  endereco_obra?: string;
  valores_calculados?: Record<string, number>;
  endereco?: string;
  linhas_extra?: Record<string, unknown>;
}

export interface PassoRecomendacao {
  prioridade: number;
  acao: string;
  justificativa: string;
  referencia_norma: string;
  impacto_estimado: string;
}

export interface RecomendacaoOut {
  ja_conforme: boolean;
  config_recomendada: {
    spda_nivel: string | null;
    dps_coordenados_nivel: string | null;
    dps_classe_I_nivel: string | null;
    avisos_alerta: boolean;
    isolacao_eletrica_descida: boolean;
    malha_equipotencializacao_solo: boolean;
    descricao: string;
  } | null;
  R1_antes: number;
  R3_antes: number;
  R1_depois: number;
  R3_depois: number;
  reducao_R1: number;
  reducao_R3: number;
  passos: PassoRecomendacao[];
  alerta_nao_conforme: string | null;
}

export interface AnaliseRiscoResponse {
  nome_projeto: string;
  areas_m2: Record<string, number>;
  numeros_eventos: Record<string, number>;
  componentes: {
    RA: number; RB: number; RC: number; RM: number;
    RU: number; RV: number; RW: number; RZ: number;
  };
  R1: number;
  R3: number;
  R4: number | null;
  frequencia_danos_total: number;
  avaliacao: Array<{
    tipo_risco: string;
    valor_calculado: number;
    valor_tolerado: number;
    status: "CONFORME" | "NAO_CONFORME" | "INFORMATIVO";
    mensagem: string;
    razao: number;
  }>;
  exige_protecao: boolean;
  recomendacao: RecomendacaoOut;
}

export async function calcularAnaliseRisco(
  req: AnaliseRiscoRequest,
): Promise<AnaliseRiscoResponse> {
  return request<AnaliseRiscoResponse>("/analise-risco/calcular", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function gerarLaudoWord(req: AnaliseRiscoRequest): Promise<Blob> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/laudo/word`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(response.status, errBody?.detail ?? `Erro ao gerar Word: ${response.status}`);
  }
  return response.blob();
}

export async function gerarLaudoPDF(req: AnaliseRiscoRequest): Promise<Blob> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/laudo/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(response.status, errBody?.detail ?? `Erro ao gerar PDF: ${response.status}`);
  }
  return response.blob();
}

// =============================================================================
// CHECKLIST E LAUDO DE INSPEÇÃO
// =============================================================================
export interface ChecklistItemOut {
  codigo: string;
  descricao: string;
  referencia_normativa: string;
  norma: string;
  categoria: string;
  tipo_resposta: string;
  obrigatorio: boolean;
  observacoes: string;
}

export async function obterChecklist(): Promise<
  Record<string, ChecklistItemOut[]>
> {
  return request<Record<string, ChecklistItemOut[]>>("/spda/checklist");
}

export interface AcaoCorretiva {
  codigo_item: string;
  descricao_nao_conformidade: string;
  acao_recomendada: string;
  prazo: string;
  referencia_norma: string;
  prioridade: number;
  prioridade_label: string;
  custo_relativo: string;
}

export interface ResultadoRemediacao {
  total_itens: number;
  conformes: number;
  nao_conformes: number;
  na: number;
  percentual_conformidade: number;
  ja_conforme_100: boolean;
  prazo_mais_urgente: string | null;
  acoes: AcaoCorretiva[];
  acoes_por_prioridade: Record<string, AcaoCorretiva[]>;
}

export async function analisarLaudo(
  respostas: Record<string, string>,
): Promise<ResultadoRemediacao> {
  return request<ResultadoRemediacao>("/laudo/analisar", {
    method: "POST",
    body: JSON.stringify({ respostas }),
  });
}

// =============================================================================
// PDF DO LAUDO DE INSPEÇÃO (com fotos inline)
// =============================================================================
export interface FotoLaudoInput {
  codigo_item: string;
  legenda: string;
  data_uri: string;
  latitude?: number;
  longitude?: number;
}

export interface LaudoInspecaoPDFRequest {
  projeto: {
    nome: string;
    cliente?: string;
    endereco?: string;
  };
  responsavel?: {
    nome: string;
    registro: string;
    art: string;
  };
  respostas: Record<string, string>;
  fotos: FotoLaudoInput[];
  area_classificada?: boolean;
  atmosfera_agressiva?: boolean;
  servico_essencial?: boolean;
}

export async function gerarPDFLaudoInspecao(
  req: LaudoInspecaoPDFRequest,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/laudo/inspecao/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getAuthToken() ? { "Authorization": `Bearer ${getAuthToken()}` } : {}),
    },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      response.status,
      `Erro ao gerar PDF da inspeção: ${response.status}`,
      text,
    );
  }
  return response.blob();
}

// =============================================================================
// NG — mapa do Anexo F
// =============================================================================
export async function buscarMunicipios(query: string): Promise<
  Array<{ municipio_uf: string; NG: number; nome: string; uf: string }>
> {
  const result = await request<{
    resultados: Array<{ municipio_uf: string; NG: number; nome: string; uf: string }>;
  }>(`/ng/buscar?q=${encodeURIComponent(query)}&limit=10`);
  return result.resultados;
}

// =============================================================================
// BrasilAPI — consulta pública de CNPJ (sem auth, sem cadastro)
// https://brasilapi.com.br/docs#tag/CNPJ
// =============================================================================
export interface DadosCNPJ {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  email: string | null;
  telefone: string | null;
  situacao: string | null;
}

/**
 * Busca dados públicos de um CNPJ na BrasilAPI.
 * Formata automaticamente (remove pontos/traços) antes de consultar.
 *
 * Limite de 3 requisições/minuto por IP (gratuito).
 * Documentação: https://brasilapi.com.br/docs#tag/CNPJ
 */
export async function buscarCNPJ(cnpj: string): Promise<DadosCNPJ> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) {
    throw new ApiError(400, "CNPJ deve ter 14 dígitos");
  }

  const response = await fetch(
    `https://brasilapi.com.br/api/cnpj/v1/${limpo}`,
  );

  if (response.status === 404) {
    throw new ApiError(404, "CNPJ não encontrado");
  }
  if (response.status === 429) {
    throw new ApiError(
      429,
      "Muitas consultas — aguarde um minuto e tente novamente",
    );
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Erro ao consultar BrasilAPI: ${response.status}`,
    );
  }

  const data = await response.json();

  // BrasilAPI retorna estrutura rica — normalizamos para os campos que usamos
  return {
    cnpj: data.cnpj ?? limpo,
    razao_social: data.razao_social ?? data.nome ?? "",
    nome_fantasia: data.nome_fantasia ?? null,
    logradouro: data.logradouro ?? data.descricao_tipo_de_logradouro
      ? `${data.descricao_tipo_de_logradouro ?? ""} ${data.logradouro ?? ""}`.trim()
      : data.logradouro ?? null,
    numero: data.numero ?? null,
    complemento: data.complemento ?? null,
    bairro: data.bairro ?? null,
    municipio: data.municipio ?? null,
    uf: data.uf ?? null,
    cep: data.cep ?? null,
    email: data.email ?? null,
    telefone: data.ddd_telefone_1 ?? null,
    situacao: data.descricao_situacao_cadastral ?? null,
  };
}

/**
 * Formata um CNPJ bruto (14 dígitos) no formato 00.000.000/0000-00.
 */
export function formatarCNPJ(cnpj: string): string {
  const limpo = cnpj.replace(/\D/g, "").slice(0, 14);
  return limpo
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// ══════════════════════════════════════════════════════════════════════
// Tipos para o wizard completo de análise de risco (6 etapas)
// ══════════════════════════════════════════════════════════════════════

export interface TrechoSL {
  id: string;
  comprimento_m: number;
  instalacao_ci: string;  // AEREO | ENTERRADO | ENT_MALHA
  tipo_ct: string;        // BT_SINAL | AT_COM_TRAFO
  ambiente_ce: string;    // RURAL | SUBURBANO | URBANO | URBANO_ALTAS
  blindagem_rs: string;   // key do FATOR_CLD
  uw_kv: number;
}

export interface EstruturaAdjacenteInput {
  l_adj: number;
  w_adj: number;
  h_adj: number;
  cdj: string;     // LocalizacaoEstrutura
  ct_adj: string;  // TipoLinhaEletrica
}

export interface LinhaEletricaWizard {
  id: string;
  nome: string;
  tipo_linha: string; // ENERGIA | SINAL
  ptu: string;        // key PROBABILIDADE_PTA
  peb: string;        // NivelProtecao
  cld_cli: string;    // key FATOR_CLD
  trechos: TrechoSL[];
  adjacente: EstruturaAdjacenteInput;
}

export interface ZonaWizard {
  id: string;
  nome: string;
  // Proteção e Blindagem
  blindagem_espacial: boolean;
  ks3_energia: string;
  ks3_sinal: string;
  pspd: string;  // NivelProtecao
  // L1 — Perdas de Vida Humana
  hz: string;           // PerigoEspecial
  nz: number;
  tz_mode: 'h_dia' | 'h_ano';
  tz_valor: number;
  lf_personalizar: boolean;
  lf_tipo: string;       // TipoEstrutura
  lo: string;
  rt: string;            // TipoPiso
  rf: string;            // RiscoIncendio
  rp: string;            // ProvidenciasIncendio
  // F — Frequência de Danos
  habilitar_f: boolean;
  sistema_interno_ft: string; // CRITICO | NAO_CRITICO
  equipamentos_zpr0a: boolean;
  // L3 — Patrimônio Cultural
  habilitar_l3: boolean;
  // L4 — Econômico
  habilitar_l4: boolean;
}

export interface WizardAnaliseRisco {
  // Etapa 1
  obra_cliente: string;
  nome_analise: string;
  responsavel_tecnico: string;
  status: string;
  art_rt_trt: string;
  endereco: string;
  latitude: string;
  longitude: string;
  uf: string;
  municipio: string;
  NG: number;
  ng_manual: boolean;
  // Etapa 2
  L: number;
  W: number;
  H: number;
  Hp: number;
  fachada_vidro: boolean;
  localizacao: string;
  pb_nivel: string;
  pb_especial?: string | null; // CORRIGIDO PARA ACEITAR NULO OU UNDEFINED
  rs_tipo: string;
  nt: number;
  lf_tipo: string;
  pta_tipo: string;
  // Etapa 3
  linhas: LinhaEletricaWizard[];
  // Etapa 5
  zonas: ZonaWizard[];
}

export interface ResultadoZona {
  id: string;
  nome: string;
  R1: number;
  F: number; // CORRIGIDO DE 'RF' PARA 'F'
  componentes: {
    RA: number; RB: number; RC: number; RM: number;
    RU: number; RV: number; RW: number; RZ: number;
  };
  frequencia_componentes: {
    FM: number; FV: number; FC: number; FZ: number; FW: number; FB: number;
  };
  perdas: {
    LA: number; LB: number; LC: number;
    rf: number; rp: number; rt: number; fp: number; rS: number; LO: number;
  };
  contribuicao_linhas: Array<{
    nome: string; tipo: string;
    RU: number; RV: number; RW: number; RZ: number;
    FV: number; FW: number; FZ: number;
  }>;
  FT: number;
}

export interface WizardAnaliseResponse {
  R1_total: number;
  F_total: number;
  R3_total: number;
  RT: number;
  FT: number;
  atende_R1: boolean;
  atende_F: boolean;
  areas: { AD: number; AM: number; AL: number; AI: number };
  eventos: {
    ND: number; NM: number;
    por_linha: Array<{ nome: string; NL: number; NI: number; NDJ: number }>;
  };
  zonas_resultado: ResultadoZona[];
  estrutura: {
    L: number; W: number; H: number; Hp: number;
    CD: number; PB: number; rS: number; nt: number; NG: number;
  };
  recomendacoes: string[];
}


// ── PDF do wizard (análise de risco multi-zona) ─────────────────────────────

export interface WizardPDFRequest {
  wizard_input: Record<string, unknown>;
  resultado: Record<string, unknown>;
}

export async function gerarPDFWizard(req: WizardPDFRequest): Promise<Blob> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/laudo/pdf-wizard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(response.status, errBody?.detail ?? `Erro ao gerar PDF: ${response.status}`);
  }
  return response.blob();
}

// ─── Cálculo PDA (único ponto de verdade — sem cálculo no frontend) ─────────

export interface TrechoCalcOut { id:string; AL:number; AI:number; NL:number; NI:number; PLD:number; PLI:number; }
export interface LinhaCalcOut { id:string; nome:string; tipo_linha:string; AL_total:number; AI_total:number; NL_total:number; NI_total:number; NDJ:number; trechos:TrechoCalcOut[]; }
export interface LinhaContribOut {
  id:string; nome:string;
  RU:number; RV:number; RW:number; RZ:number;
  RU4:number; RV4:number; RW4:number; RZ4:number;
  FV:number; FW:number; FZ:number;
}
export interface ZonaCalcOut {
  id:string; nome:string;
  linhas_contrib: LinhaContribOut[];
  RA:number; RB:number; RC:number; RM:number; RU:number; RV:number; RW:number; RZ:number;
  R1:number;
  R3:number; RB3:number; RV3:number;
  F:number; FB:number; FC:number; FM:number; FV:number; FW:number; FZ:number;
  R4:number;
  RA4:number; RB4:number; RC4:number; RM4:number;
  RU4:number; RV4:number; RW4:number; RZ4:number;
  LA:number; LB:number; LC:number;
}
export interface CalcResponse {
  AD:number; AM:number; AL:number; AI:number; ND:number; NM:number;
  linhas:LinhaCalcOut[];
  zonas:ZonaCalcOut[];
  R1_global:number; R3_global:number; F_global:number; R4_global:number;
  FT_global:number; F_atende:boolean; conforme_norma:boolean; zonas_fora_ft:string[];
  RA_g:number; RB_g:number; RC_g:number; RM_g:number;
  RU_g:number; RV_g:number; RW_g:number; RZ_g:number;
}

export async function calcularPDA(payload: unknown): Promise<CalcResponse> {
  const token = getAuthToken();
  const resp = await fetch(`${API_BASE_URL}/calcular`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => null);
    throw new ApiError(resp.status, err?.detail ?? `Erro ao calcular: ${resp.status}`);
  }
  return resp.json();
}