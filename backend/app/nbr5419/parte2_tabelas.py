"""
Tabelas normativas — ABNT NBR 5419-2:2026 (Análise de risco).

Este módulo codifica TODAS as tabelas e fatores tabelados dos Anexos A, B, C e D
da Parte 2 da norma, que são usados pelo motor de cálculo em `app/engine/*`.

Nenhum valor aqui pode ser alterado sem revisão normativa explícita.
"""
from app.nbr5419.enums import (
    AmbienteLinha,
    LocalizacaoEstrutura,
    NivelProtecao,
    PerigoEspecial,
    ProvidenciasIncendio,
    RiscoIncendio,
    TipoConstrucao,
    TipoEstrutura,
    TipoInstalacaoLinha,
    TipoLinhaEletrica,
    TipoPerda,
    TipoPiso,
)

# =============================================================================
# Tabela 4 — Valores típicos de risco tolerável RT (NBR 5419-2:2026, 5.3)
# =============================================================================
RISCO_TOLERAVEL: dict[TipoPerda, float] = {
    TipoPerda.L1: 1e-5,  # Perda de vida humana ou ferimentos permanentes
    TipoPerda.L3: 1e-4,  # Perda de patrimônio cultural
    TipoPerda.L4: 1e-3,  # Informativo — Anexo D (não normalizado)
}


# =============================================================================
# ANEXO A — Tabela A.1 — Fator de localização CD e CDJ
# =============================================================================
FATOR_LOCALIZACAO_CD: dict[LocalizacaoEstrutura, float] = {
    LocalizacaoEstrutura.CERCADA_OBJETOS_MAIS_ALTOS: 0.25,
    LocalizacaoEstrutura.CERCADA_MESMA_ALTURA: 0.50,
    LocalizacaoEstrutura.ISOLADA: 1.00,
    LocalizacaoEstrutura.ISOLADA_TOPO_COLINA: 2.00,
}


# =============================================================================
# ANEXO A — Tabela A.2 — Fator de instalação da linha elétrica CI
# =============================================================================
FATOR_INSTALACAO_CI: dict[TipoInstalacaoLinha, float] = {
    TipoInstalacaoLinha.AEREO: 1.00,
    TipoInstalacaoLinha.ENTERRADO: 0.50,
    TipoInstalacaoLinha.ENTERRADO_MALHA_ATERRAMENTO: 0.01,
}


# =============================================================================
# ANEXO A — Tabela A.3 — Fator do tipo de linha elétrica CT
# =============================================================================
FATOR_TIPO_LINHA_CT: dict[TipoLinhaEletrica, float] = {
    TipoLinhaEletrica.BT_SINAL: 1.00,
    TipoLinhaEletrica.AT_COM_TRAFO: 0.20,
}


# =============================================================================
# ANEXO A — Tabela A.4 — Fator ambiental da linha elétrica CE
# =============================================================================
FATOR_AMBIENTAL_CE: dict[AmbienteLinha, float] = {
    AmbienteLinha.RURAL: 1.00,
    AmbienteLinha.SUBURBANO: 0.50,
    AmbienteLinha.URBANO: 0.10,
    AmbienteLinha.URBANO_ESTRUTURAS_ALTAS: 0.01,
}


# =============================================================================
# ANEXO B — Tabela B.1 — Probabilidade PTA (medidas contra tensão de toque/passo)
# Obs.: se mais de uma medida for adotada, PTA é o PRODUTO dos valores.
# =============================================================================
PROBABILIDADE_PTA = {
    "NENHUMA": 1.0,
    "AVISOS_ALERTA": 1e-1,
    "ISOLACAO_ELETRICA_DESCIDA": 1e-2,          # somente para tensão de toque
    "MALHA_EQUIPOTENCIALIZACAO_SOLO": 1e-2,     # somente para tensão de passo
    "ESTRUTURA_METALICA_DESCIDA_NATURAL": 1e-3,
    "RESTRICOES_FISICAS_FIXAS": 0.0,
}


# =============================================================================
# ANEXO B — Tabela B.2 — Probabilidade PB (danos físicos por NP do SPDA)
# =============================================================================
PROBABILIDADE_PB: dict[NivelProtecao, float] = {
    NivelProtecao.NENHUM: 1.0,
    NivelProtecao.IV: 0.20,
    NivelProtecao.III: 0.10,
    NivelProtecao.II: 0.05,
    NivelProtecao.I: 0.02,
}

# Casos especiais da Tabela B.2 — estruturas com características reforçadas
PROBABILIDADE_PB_CAPTACAO_NP1_ESTRUTURA_CONTINUA = 0.01
PROBABILIDADE_PB_COBERTURA_METALICA_ESTRUTURA_CONTINUA = 0.001


# =============================================================================
# ANEXO B — Tabela B.3 — Probabilidade PSPD em função do NP dos DPS
# =============================================================================
PROBABILIDADE_PSPD: dict[NivelProtecao, float] = {
    NivelProtecao.NENHUM: 1.0,            # nenhum sistema coordenado de DPS
    NivelProtecao.IV: 0.05,                # III-IV
    NivelProtecao.III: 0.05,
    NivelProtecao.II: 0.02,
    NivelProtecao.I: 0.01,
}
# "Melhor que NP I": 0.005 a 0.001 (depende de ensaios específicos dos DPS)


# =============================================================================
# ANEXO B — Tabela B.4 — Fator CLD (blindagem/aterramento/isolação da linha)
# Esta tabela depende da configuração do roteamento da linha.
# =============================================================================
FATOR_CLD = {
    # Tabela B.4 — valores CLD/CLI por condição da linha externa.
    # Atenção: PLD/PLI por resistência de blindagem são tratados separadamente
    # nas Tabelas B.8 e B.9; não devem ser usados como CLD/CLI.
    "AEREO_NAO_BLINDADO": {"CLD": 1.0, "CLI": 1.0},
    "ENTERRADO_NAO_BLINDADO": {"CLD": 1.0, "CLI": 1.0},
    "LINHA_ENERGIA_AT_NEUTRO_MULTI_ATERRADO": {"CLD": 1.0, "CLI": 0.2},
    "ENTERRADO_BLINDADO_NAO_ATERRADO": {"CLD": 1.0, "CLI": 0.3},
    "AEREO_BLINDADO_NAO_ATERRADO": {"CLD": 1.0, "CLI": 0.1},
    "AEREO_BLINDADO_ATERRADO": {"CLD": 1.0, "CLI": 0.0},
    "ENTERRADO_BLINDADO_ATERRADO": {"CLD": 1.0, "CLI": 0.0},
    "CABO_PROTECAO_METALICO": {"CLD": 0.0, "CLI": 0.0},
    "SEM_LINHA_EXTERNA": {"CLD": 0.0, "CLI": 0.0},
    "INTERFACE_ISOLANTE_PROTEGIDA_POR_DPS": {"CLD": 0.0, "CLI": 0.0},
}


# =============================================================================
# ANEXO B — Tabela B.7 — Probabilidade PEB em função do NP dos DPS classe I
# =============================================================================
PROBABILIDADE_PEB: dict[NivelProtecao, float] = {
    NivelProtecao.NENHUM: 1.0,
    NivelProtecao.IV: 0.05,
    NivelProtecao.III: 0.05,
    NivelProtecao.II: 0.02,
    NivelProtecao.I: 0.01,
}


# =============================================================================
# ANEXO B — Tabela B.8 — Probabilidade PLD em função da tensão suportável de impulso UW
# da linha e características de roteamento. Valores aproximados da norma.
# =============================================================================
# Tabela B.8 — PLD: linhas não blindadas têm PLD=1 para qualquer UW
# Tabela B.8 já possui colunas 0,35 e 0,5 kV para PLD.
# A consulta normativa exata fica centralizada em parte2_linhas.py.
PROBABILIDADE_PLD = {
    # Não blindada (aérea ou subterrânea, blindagem não interligada): PLD=1 para qualquer UW
    ("AEREO_NAO_BLINDADO",      0.35): 1.00, ("AEREO_NAO_BLINDADO",      0.5): 1.00,
    ("AEREO_NAO_BLINDADO",      1.0):  1.00, ("AEREO_NAO_BLINDADO",      1.5): 1.00,
    ("AEREO_NAO_BLINDADO",      2.5):  1.00, ("AEREO_NAO_BLINDADO",      4.0): 1.00,
    ("AEREO_NAO_BLINDADO",      6.0):  1.00,
    ("ENTERRADO_NAO_BLINDADO",  0.35): 1.00, ("ENTERRADO_NAO_BLINDADO",  0.5): 1.00,
    ("ENTERRADO_NAO_BLINDADO",  1.0):  1.00, ("ENTERRADO_NAO_BLINDADO",  1.5): 1.00,
    ("ENTERRADO_NAO_BLINDADO",  2.5):  1.00, ("ENTERRADO_NAO_BLINDADO",  4.0): 1.00,
    ("ENTERRADO_NAO_BLINDADO",  6.0):  1.00,
    # 5 < Rs ≤ 20 Ω/km
    ("BLINDADO_5_20_OHM_KM",   0.35): 1.00, ("BLINDADO_5_20_OHM_KM",   0.5): 1.00,
    ("BLINDADO_5_20_OHM_KM",   1.0):  1.00, ("BLINDADO_5_20_OHM_KM",   1.5): 1.00,
    ("BLINDADO_5_20_OHM_KM",   2.5):  0.95, ("BLINDADO_5_20_OHM_KM",   4.0): 0.90,
    ("BLINDADO_5_20_OHM_KM",   6.0):  0.80,
    # 1 < Rs ≤ 5 Ω/km
    ("BLINDADO_1_5_OHM_KM",    0.35): 1.00, ("BLINDADO_1_5_OHM_KM",    0.5): 1.00,
    ("BLINDADO_1_5_OHM_KM",    1.0):  0.90, ("BLINDADO_1_5_OHM_KM",    1.5): 0.80,
    ("BLINDADO_1_5_OHM_KM",    2.5):  0.60, ("BLINDADO_1_5_OHM_KM",    4.0): 0.30,
    ("BLINDADO_1_5_OHM_KM",    6.0):  0.10,
    # Rs ≤ 1 Ω/km
    ("BLINDADO_MENOS_1_OHM_KM", 0.35): 1.00, ("BLINDADO_MENOS_1_OHM_KM", 0.5): 0.85,
    ("BLINDADO_MENOS_1_OHM_KM", 1.0):  0.60, ("BLINDADO_MENOS_1_OHM_KM", 1.5): 0.40,
    ("BLINDADO_MENOS_1_OHM_KM", 2.5):  0.20, ("BLINDADO_MENOS_1_OHM_KM", 4.0): 0.04,
    ("BLINDADO_MENOS_1_OHM_KM", 6.0):  0.02,
}

# Tabela B.9 — PLI: probabilidade por tipo de linha e tensão UW
# A Tabela B.9 não possui colunas 0,35 e 0,5 kV.
# Chave = (tipo_linha, uw_kv): "ENERGIA" ou "SINAL".
PROBABILIDADE_PLI = {
    # Linhas elétricas de ENERGIA — Tabela B.9
    ("ENERGIA", 1.0):  1.0,  ("ENERGIA", 1.5): 0.60,
    ("ENERGIA", 2.5):  0.30, ("ENERGIA", 4.0): 0.16,
    ("ENERGIA", 6.0):  0.10,
    # Linhas elétricas de SINAL — Tabela B.9
    ("SINAL", 1.0):  1.0,  ("SINAL", 1.5): 0.50,
    ("SINAL", 2.5):  0.20, ("SINAL", 4.0): 0.08,
    ("SINAL", 6.0):  0.04,
}


# =============================================================================
# ANEXO C — Tabela C.2 — Valores médios típicos de LT, LF, LO (tipo de perda L1)
# =============================================================================
# LT — ferimentos por choque elétrico (D1) — constante para todos os tipos
LT_L1: float = 1e-2

# LF — danos físicos (D2), varia conforme o tipo de estrutura
LF_L1_POR_ESTRUTURA: dict[TipoEstrutura, float] = {
    TipoEstrutura.RISCO_EXPLOSAO: 1e-1,
    TipoEstrutura.HOSPITAL: 1e-1,
    TipoEstrutura.HOTEL: 1e-1,
    TipoEstrutura.ESCOLA: 1e-1,
    TipoEstrutura.EDIFICIO_CIVICO: 1e-1,
    TipoEstrutura.ENTRETENIMENTO_PUBLICO: 5e-2,
    TipoEstrutura.IGREJA: 5e-2,
    TipoEstrutura.MUSEU: 5e-2,
    TipoEstrutura.INDUSTRIAL: 2e-2,
    TipoEstrutura.COMERCIAL: 2e-2,
    TipoEstrutura.OUTROS: 1e-2,
    TipoEstrutura.RESIDENCIAL: 1e-2,
    TipoEstrutura.ESCRITORIO: 1e-2,
    TipoEstrutura.AGRICULTURA: 1e-2,
}

# LO — falhas de sistemas internos (D3)
# Só se aplica a estruturas com risco de explosão ou onde falhas coloquem
# vida humana em risco (UTI/bloco cirúrgico, etc.)
LO_L1_POR_ESTRUTURA: dict[TipoEstrutura, float] = {
    TipoEstrutura.RISCO_EXPLOSAO: 1e-1,
    TipoEstrutura.HOSPITAL: 1e-3,  # outras partes de hospital
    # UTI/bloco cirúrgico: 1e-2 (caso especial tratado no engine)
}


# =============================================================================
# ANEXO C — Tabela C.3 — Fator rt em função do tipo de piso/superfície
# =============================================================================
FATOR_RT: dict[TipoPiso, float] = {
    TipoPiso.TERRA_CONCRETO: 1e-2,
    TipoPiso.MARMORE_CERAMICA: 1e-3,
    TipoPiso.BRITA_CARPETE: 1e-4,
    TipoPiso.ASFALTO_LINOLEO_MADEIRA: 1e-5,
}


# =============================================================================
# ANEXO C — Tabela C.4 — Fator rp em função das providências contra incêndio
# =============================================================================
FATOR_RP: dict[ProvidenciasIncendio, float] = {
    ProvidenciasIncendio.NENHUMA: 1.0,
    ProvidenciasIncendio.EXTINTORES_MANUAIS: 0.5,
    ProvidenciasIncendio.HIDRANTES: 0.5,
    ProvidenciasIncendio.INSTALACAO_FIXA_AUTOMATICA: 0.2,
    ProvidenciasIncendio.PROTECAO_OPERADA_AUTOMATICA: 0.2,
}


# =============================================================================
# ANEXO C — Tabela C.5 — Fator rf em função do risco de incêndio
# =============================================================================
FATOR_RF: dict[RiscoIncendio, float] = {
    RiscoIncendio.EXPLOSAO: 1.0,
    RiscoIncendio.ALTO: 1e-1,
    RiscoIncendio.NORMAL: 1e-2,
    RiscoIncendio.BAIXO: 1e-3,
    RiscoIncendio.NENHUM: 0.0,
}


# =============================================================================
# ANEXO C — Tabela C.6 — Fator hz (perigo especial)
# =============================================================================
FATOR_HZ: dict[PerigoEspecial, float] = {
    PerigoEspecial.NENHUM: 1.0,
    PerigoEspecial.BAIXO_NIVEL_PANICO: 2.0,
    PerigoEspecial.MEDIO_NIVEL_PANICO: 5.0,
    PerigoEspecial.ALTO_NIVEL_PANICO: 10.0,
    PerigoEspecial.DIFICULDADE_EVACUACAO: 5.0,
    PerigoEspecial.CONTAMINACAO_AMBIENTAL: 20.0,
}


# =============================================================================
# ANEXO C — Tabela C.7 — Fator rs em função do tipo de construção
# =============================================================================
FATOR_RS: dict[TipoConstrucao, float] = {
    # Tabela C.7 — simples (madeira ou alvenaria simples) = 2;
    # robusta (estrutura metálica ou concreto armado) = 1.
    TipoConstrucao.ALVENARIA_CONCRETO: 1.0,
    TipoConstrucao.MADEIRA: 2.0,
    TipoConstrucao.METALICA: 1.0,
}


# =============================================================================
# ANEXO C — Tabela C.9 — LF para perda de patrimônio cultural (L3)
# =============================================================================
LF_L3_MUSEUS_GALERIAS: float = 1e-1


# =============================================================================
# ANEXO D — Tabela D.2 — LT, LF, LO para L4 (perda econômica)
# =============================================================================
LT_L4: float = 1e-2

LF_L4_POR_ESTRUTURA: dict[TipoEstrutura, float] = {
    TipoEstrutura.RISCO_EXPLOSAO: 1.0,
    TipoEstrutura.HOSPITAL: 0.5,
    TipoEstrutura.INDUSTRIAL: 0.5,
    TipoEstrutura.MUSEU: 0.5,
    TipoEstrutura.AGRICULTURA: 0.5,
    TipoEstrutura.HOTEL: 0.2,
    TipoEstrutura.ESCOLA: 0.2,
    TipoEstrutura.ESCRITORIO: 0.2,
    TipoEstrutura.IGREJA: 0.2,
    TipoEstrutura.ENTRETENIMENTO_PUBLICO: 0.2,
    TipoEstrutura.COMERCIAL: 0.2,
    TipoEstrutura.EDIFICIO_CIVICO: 1e-1,  # não listado na D.2; tratado como "Outros"
    TipoEstrutura.RESIDENCIAL: 1e-1,
    TipoEstrutura.OUTROS: 1e-1,
}

LO_L4_POR_ESTRUTURA: dict[TipoEstrutura, float] = {
    TipoEstrutura.RISCO_EXPLOSAO: 1e-1,
    TipoEstrutura.HOSPITAL: 1e-2,
    TipoEstrutura.INDUSTRIAL: 1e-2,
    TipoEstrutura.ESCRITORIO: 1e-2,
    TipoEstrutura.HOTEL: 1e-2,
    TipoEstrutura.COMERCIAL: 1e-2,
    TipoEstrutura.MUSEU: 1e-3,
    TipoEstrutura.AGRICULTURA: 1e-3,
    TipoEstrutura.ESCOLA: 1e-3,
    TipoEstrutura.IGREJA: 1e-3,
    TipoEstrutura.ENTRETENIMENTO_PUBLICO: 1e-3,
    TipoEstrutura.OUTROS: 1e-4,
    TipoEstrutura.RESIDENCIAL: 1e-4,
    TipoEstrutura.EDIFICIO_CIVICO: 1e-4,
}