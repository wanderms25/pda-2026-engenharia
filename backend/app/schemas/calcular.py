"""
Schema para o endpoint /api/v1/calcular.
Recebe o estado completo do formulário frontend e retorna todos os valores calculados.
O frontend NÃO faz cálculos — apenas exibe o retorno deste endpoint.
"""
from pydantic import BaseModel, Field


class TrechoSLIn(BaseModel):
    id: str
    comprimento_m: float = 1000.0
    instalacao_ci: str = "ENTERRADO"   # AEREO | ENTERRADO | ENT_MALHA
    tipo_ct: str = "BT_SINAL"          # BT_SINAL | AT_COM_TRAFO
    ambiente_ce: str = "URBANO_ALTAS"  # RURAL | SUBURBANO | URBANO | URBANO_ALTAS
    blindagem_rs: str = "AEREO_NAO_BLINDADO"  # para PLD (Tab. B.8)
    uw_kv: float = 1.5                 # tensão suportável (kV)


class EstAdjIn(BaseModel):
    """Estrutura adjacente ligada à linha (Eq. A.4 — NDJ)."""
    l_adj: float = 0.0
    w_adj: float = 0.0
    h_adj: float = 0.0
    cdj: str = "CERCADA_MESMA_ALTURA"
    ct_adj: str = "BT_SINAL"


class LinhaIn(BaseModel):
    id: str
    nome: str
    tipo_linha: str = "ENERGIA"
    ptu: str = "NENHUMA"               # PTU key (Tab. B.6)
    peb: str = "NENHUM"               # PEB key (Tab. B.7)
    cld_cli: str = "AEREO_NAO_BLINDADO"  # CLD/CLI key (Tab. B.4)
    trechos: list[TrechoSLIn] = Field(default_factory=list)
    adj: EstAdjIn = Field(default_factory=EstAdjIn)  # Estrutura adjacente (NDJ)


class ZonaIn(BaseModel):
    id: str
    nome: str
    # Fatores de ocupação
    nz: int = 100
    tz_mode: str = "h_ano"           # h_dia | h_ano
    tz_valor: float = 2920
    # Perdas L1 — Tab. C.1
    rt: float = 0.001                # tipo piso (Tab. C.3)
    rf: float = 0.01                 # risco incêndio (Tab. C.5)
    rp: float = 0.5                  # providências incêndio (Tab. C.4)
    hz: float = 1.0                  # perigo especial (Tab. C.6) — default 1 (sem perigo)
    lf_valor: float = 0.01           # LF (Tab. C.2) — usado se lf_custom=True
    lf_custom: bool = False          # True = usa lf_valor; False = usa LF da estrutura
    lo: float = 0.0                  # LO = valor de LC quando tem_lo=True
    tem_lo: bool = False             # ativa LC/RM/RC (risco explosão/vida imediata)
    # Probabilidades de sistemas internos
    pspd: float = 0.01               # PSPD coordenado (Tab. B.3)
    blindagem: bool = False           # habilita uso de KS2 por blindagem espacial interna informada
    ks3: float = 1.0                 # KS3 padrão/pior caso quando não houver separação energia/sinal
    ks3_energia: float = 1.0         # KS3 do sistema interno de energia (Tab. B.5)
    ks3_sinal: float = 1.0           # KS3 do sistema interno de sinal (Tab. B.5)
    wm1: float = 20.0                # Espaçamento malha SPDA/descidas (m) → KS1 = 0.12×wm1
    wm2: float = 0.0                 # Espaçamento blindagem espacial interna (m) → KS2 = 0.12×wm2
    uw_equip: float = 1.0            # Tensão suportável nominal dos equipamentos (kV) → KS4 = 1/UW
    # Patrimônio L3
    tem_l3: bool = False
    cp_l3: float = 1.0              # cz/ct = val_patrimônio / val_edificio
    # Falhas F
    habilitar_f: bool = True
    ft_sistema: float = 0.1
    zpr0a: bool = False              # equipamentos em ZPR0A (ativa FB)
    # L4 — perdas econômicas (Anexo D, informativo)
    habilitar_l4: bool = False
    tipo_estrutura_l4: str = "USAR_TIPO_L1"  # USAR_TIPO_L1 | ou tipo da estrutura para L4
    l4_base_perdas: str = "ANEXO_D"            # ANEXO_D = Tabela D.2
    l4_usar_relacoes_valor: bool = False       # False quando se usa RT4 representativo 1e-3
    val_animais: float = 0.0
    val_edificio: float = 0.0
    val_conteudo: float = 0.0
    val_sistemas: float = 0.0


class EstruturaPDA(BaseModel):
    """Dados da estrutura e medidas globais."""
    # Geometria
    L: float = 50.0
    W: float = 20.0
    H: float = 15.0
    Hp: float = 0.0
    # Atmosférico
    NG: float = 12.0
    loc: str = "CERCADA_MESMA_ALTURA"   # CD — Tab. A.1
    # Proteção global
    pb: float = 1.0                     # PB — Tab. B.2
    pta: float = 0.1                    # PTA — Tab. B.1
    # Total de pessoas
    nt: int = 120
    # Tipo de estrutura e construção (usados em LF, LO, rs)
    tipo_estrutura: str = "OUTROS"      # Tab. C.2
    tipo_construcao: str = "ALV_CONCRETO"  # Tab. C.7


class CalcRequest(BaseModel):
    """Payload completo para o endpoint /calcular."""
    estrutura: EstruturaPDA
    zonas: list[ZonaIn]
    linhas: list[LinhaIn]


# ─── Response types ──────────────────────────────────────────────────────────

class TrechoCalcOut(BaseModel):
    id: str
    # Areas e eventos por trecho SL (Anexo A)
    AL: float = 0.0
    AI: float = 0.0
    NL: float
    NI: float
    PLD: float
    PLI: float


class LinhaCalcOut(BaseModel):
    id: str
    nome: str = ""
    tipo_linha: str = ""
    AL_total: float = 0.0
    AI_total: float = 0.0
    NL_total: float
    NI_total: float
    NDJ: float = 0.0   # Eq. A.4 — descargas na estrutura adjacente
    trechos: list[TrechoCalcOut]


class LinhaContribOut(BaseModel):
    """Contribuição de uma linha elétrica para os riscos da zona."""
    id: str
    nome: str
    RU: float = 0.0;  RV: float = 0.0;  RW: float = 0.0;  RZ: float = 0.0
    RU4: float = 0.0; RV4: float = 0.0; RW4: float = 0.0; RZ4: float = 0.0
    FV: float = 0.0;  FW: float = 0.0;  FZ: float = 0.0


class ZonaCalcOut(BaseModel):
    id: str
    nome: str
    linhas_contrib: list[LinhaContribOut] = Field(default_factory=list)  # contribuição por linha
    # Componentes R1
    RA: float; RB: float; RC: float; RM: float
    RU: float; RV: float; RW: float; RZ: float
    R1: float
    # L3 e sub-componentes
    R3: float
    RB3: float = 0.0
    RV3: float = 0.0
    # F e sub-componentes (Seção 7)
    F: float
    FB: float = 0.0
    FC: float = 0.0
    FM: float = 0.0
    FV: float = 0.0
    FW: float = 0.0
    FZ: float = 0.0
    # R4 e sub-componentes
    R4: float
    RA4: float = 0.0; RB4: float = 0.0; RC4: float = 0.0; RM4: float = 0.0
    RU4: float = 0.0; RV4: float = 0.0; RW4: float = 0.0; RZ4: float = 0.0
    # Perdas e probabilidades para auditoria
    LA: float; LB: float; LC: float
    PC_calc: float = 0.0
    PM_calc: float = 0.0
    PMS_calc: float = 0.0
    KS1_calc: float = 0.0
    KS2_calc: float = 0.0
    KS4_calc: float = 0.0


class CalcResponse(BaseModel):
    """Resposta completa do cálculo — tudo que o frontend precisa para exibir."""
    # Areas e eventos globais
    AD: float; AM: float; AL: float = 0.0; AI: float = 0.0; ND: float; NM: float
    # Linhas calculadas
    linhas: list[LinhaCalcOut]
    # Por zona
    zonas: list[ZonaCalcOut]
    # Consolidados globais
    R1_global: float
    R3_global: float
    F_global: float
    R4_global: float
    FT_global: float = 0.1
    F_atende: bool = True
    conforme_norma: bool = True
    zonas_fora_ft: list[str] = Field(default_factory=list)
    # Componentes globais somadas
    RA_g: float; RB_g: float; RC_g: float; RM_g: float
    RU_g: float; RV_g: float; RW_g: float; RZ_g: float