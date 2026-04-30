"""
Motor de cálculo — Probabilidades de dano Px (Anexo B da NBR 5419-2:2026).

Implementa todas as probabilidades do Anexo B:
- PA, PB, PC, PM (descargas relacionadas à estrutura)
- PU, PV, PW, PZ (descargas relacionadas a linhas elétricas)

As medidas de proteção do frontend (MedidasProtecaoSchema) são traduzidas
aqui em valores de probabilidade conforme as Tabelas B.1 a B.8.
"""
from dataclasses import dataclass

from app.nbr5419.enums import NivelProtecao
from app.nbr5419.parte2_linhas import calcular_pld_tabela_b8, calcular_pli_tabela_b9
from app.nbr5419.parte2_tabelas import (
    FATOR_CLD,
    PROBABILIDADE_PB,
    PROBABILIDADE_PB_CAPTACAO_NP1_ESTRUTURA_CONTINUA,
    PROBABILIDADE_PB_COBERTURA_METALICA_ESTRUTURA_CONTINUA,
    PROBABILIDADE_PEB,
    PROBABILIDADE_PSPD,
    PROBABILIDADE_PTA,
)


@dataclass(frozen=True)
class EntradaProbabilidades:
    """Todas as medidas de proteção relevantes para compor Px."""

    # Proteção externa
    spda_nivel: NivelProtecao = NivelProtecao.NENHUM
    captacao_np1_estrutura_continua: bool = False       # caso especial Tabela B.2
    cobertura_metalica_estrutura_continua: bool = False # outro caso especial Tabela B.2

    # Medidas contra tensão de toque/passo (Tabela B.1)
    avisos_alerta: bool = False
    isolacao_eletrica_descida: bool = False
    malha_equipotencializacao_solo: bool = False
    descida_natural_estrutura_continua: bool = False
    restricoes_fisicas_fixas: bool = False

    # Sistema coordenado de DPS (Tabela B.3)
    dps_coordenados_nivel: NivelProtecao = NivelProtecao.NENHUM

    # DPS classe I para ligação equipotencial (Tabela B.7)
    dps_classe_I_nivel: NivelProtecao = NivelProtecao.NENHUM

    # Características da linha elétrica (Tabela B.4 e B.8)
    tipo_roteamento_linha: str = "AEREO_NAO_BLINDADO"
    tipo_linha: str = "ENERGIA"  # ENERGIA | SINAL — Tabela B.9
    tensao_UW_kV: float = 2.5

    # MPS para redução de PM (NBR 5419-4) — blindagens, roteamento etc.
    MPS_reduz_PM: float = 1.0  # PMS fornecido pela análise de MPS (padrão = sem MPS)


def calcular_PTA(ent: EntradaProbabilidades) -> float:
    """
    Probabilidade PTA — Tabela B.1.

    Se mais de uma medida for tomada, PTA é o PRODUTO dos valores correspondentes.
    """
    if ent.restricoes_fisicas_fixas:
        return PROBABILIDADE_PTA["RESTRICOES_FISICAS_FIXAS"]

    PTA = 1.0
    if ent.avisos_alerta:
        PTA *= PROBABILIDADE_PTA["AVISOS_ALERTA"]
    if ent.isolacao_eletrica_descida:
        PTA *= PROBABILIDADE_PTA["ISOLACAO_ELETRICA_DESCIDA"]
    if ent.malha_equipotencializacao_solo:
        PTA *= PROBABILIDADE_PTA["MALHA_EQUIPOTENCIALIZACAO_SOLO"]
    if ent.descida_natural_estrutura_continua:
        PTA *= PROBABILIDADE_PTA["ESTRUTURA_METALICA_DESCIDA_NATURAL"]
    return PTA


def calcular_PB(ent: EntradaProbabilidades) -> float:
    """
    Probabilidade PB — Tabela B.2.

    Inclui os dois casos especiais de estruturas com captação/cobertura metálica
    atuando como elemento natural.
    """
    if ent.cobertura_metalica_estrutura_continua:
        return PROBABILIDADE_PB_COBERTURA_METALICA_ESTRUTURA_CONTINUA
    if ent.captacao_np1_estrutura_continua:
        return PROBABILIDADE_PB_CAPTACAO_NP1_ESTRUTURA_CONTINUA
    return PROBABILIDADE_PB[ent.spda_nivel]


def calcular_PA(ent: EntradaProbabilidades) -> float:
    """
    PA = PTA × PB — Equação B.1.
    """
    return calcular_PTA(ent) * calcular_PB(ent)


def calcular_PC(ent: EntradaProbabilidades) -> float:
    """
    PC = PSPD × CLD — Equação B.2 (Tabelas B.3 e B.4).
    """
    PSPD = PROBABILIDADE_PSPD[ent.dps_coordenados_nivel]
    CLD = FATOR_CLD.get(ent.tipo_roteamento_linha, {"CLD": 1.0})["CLD"]
    return PSPD * CLD


def calcular_PM(ent: EntradaProbabilidades) -> float:
    """
    Probabilidade PM — NBR 5419-2:2026, B.4.8/B.4.9.

    Quando não houver sistema coordenado de DPS: PM = PMS.
    Quando houver sistema coordenado de DPS: PM = PSPD × PMS.
    Aqui `MPS_reduz_PM` representa PMS calculado pela Parte 4/B.4.
    """
    PMS = ent.MPS_reduz_PM
    if ent.dps_coordenados_nivel == NivelProtecao.NENHUM:
        return PMS
    PSPD = PROBABILIDADE_PSPD[ent.dps_coordenados_nivel]
    return PSPD * PMS


def _PLD(roteamento: str, UW_kV: float) -> float:
    """Tabela B.8 — consulta exata do UW tabelado."""
    return calcular_pld_tabela_b8(roteamento, UW_kV)


def _PLI(tipo_linha: str, UW_kV: float) -> float:
    """Tabela B.9 — consulta exata por tipo de linha (ENERGIA/SINAL) e UW."""
    return calcular_pli_tabela_b9(tipo_linha, UW_kV)


def calcular_PU(ent: EntradaProbabilidades) -> float:
    """
    Probabilidade PU — NBR 5419-2:2026, B.5.

    PU = PTU × PEB × PLD × CLD
    onde PTU (medidas adicionais contra tensão de toque/passo por descarga na
    linha) aqui assumido igual a PTA. PEB é definido pela classe I dos DPS.
    """
    PTU = calcular_PTA(ent)  # simplificação: mesmas medidas adicionais
    PEB = PROBABILIDADE_PEB[ent.dps_classe_I_nivel]
    PLD_val = _PLD(ent.tipo_roteamento_linha, ent.tensao_UW_kV)
    CLD = FATOR_CLD.get(ent.tipo_roteamento_linha, {"CLD": 1.0})["CLD"]
    return PTU * PEB * PLD_val * CLD


def calcular_PV(ent: EntradaProbabilidades) -> float:
    """
    PV = PEB × PLD × CLD — Equação B.9.
    """
    PEB = PROBABILIDADE_PEB[ent.dps_classe_I_nivel]
    PLD_val = _PLD(ent.tipo_roteamento_linha, ent.tensao_UW_kV)
    CLD = FATOR_CLD.get(ent.tipo_roteamento_linha, {"CLD": 1.0})["CLD"]
    return PEB * PLD_val * CLD


def calcular_PW(ent: EntradaProbabilidades) -> float:
    """
    PW = PSPD × PLD × CLD — Equação B.10.
    """
    PSPD = PROBABILIDADE_PSPD[ent.dps_coordenados_nivel]
    PLD_val = _PLD(ent.tipo_roteamento_linha, ent.tensao_UW_kV)
    CLD = FATOR_CLD.get(ent.tipo_roteamento_linha, {"CLD": 1.0})["CLD"]
    return PSPD * PLD_val * CLD


def calcular_PZ(ent: EntradaProbabilidades) -> float:
    """
    PZ = PSPD × PLI × CLI — Equação B.11.

    Usa a Tabela B.9 para PLI, sem aproximar por PLD.
    """
    PSPD = PROBABILIDADE_PSPD[ent.dps_coordenados_nivel]
    CLI = FATOR_CLD.get(ent.tipo_roteamento_linha, {"CLI": 1.0})["CLI"]
    tipo_linha = getattr(ent, "tipo_linha", "ENERGIA")
    PLI = _PLI(tipo_linha, ent.tensao_UW_kV)
    return PSPD * PLI * CLI


@dataclass(frozen=True)
class Probabilidades:
    PA: float
    PB: float
    PC: float
    PM: float
    PU: float
    PV: float
    PW: float
    PZ: float
    PEB: float


def calcular_todas_probabilidades(ent: EntradaProbabilidades) -> Probabilidades:
    """Calcula as probabilidades Px conforme Anexo B, incluindo PEB para FV da Tabela 7."""
    return Probabilidades(
        PA=calcular_PA(ent),
        PB=calcular_PB(ent),
        PC=calcular_PC(ent),
        PM=calcular_PM(ent),
        PU=calcular_PU(ent),
        PV=calcular_PV(ent),
        PW=calcular_PW(ent),
        PZ=calcular_PZ(ent),
        PEB=PROBABILIDADE_PEB[ent.dps_classe_I_nivel],
    )
