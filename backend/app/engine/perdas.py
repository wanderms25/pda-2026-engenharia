"""
Motor de cálculo — Perdas Lx (Anexo C e D da NBR 5419-2:2026).

Implementa as equações C.1 a C.4 (perda L1) e D.1 a D.4 (perda L4).

Equações principais (Anexo C, perda de vida humana L1):

    LA = rt × LT × (nz/nt) × (tz/8760) × rs                      (C.1)
    LU = rt × LT × (nz/nt) × (tz/8760) × rs                      (C.2)
    LB = LV = rp × rf × hz × LF × (nz/nt) × (tz/8760) × rs       (C.3)
    LC = LM = LW = LZ = LO × (nz/nt) × (tz/8760) × rs            (C.4)

Para estruturas SEM zoneamento, tz/8760 = 1 e nz/nt = 1.
Para L3 (patrimônio cultural) usamos a Equação C.7 e a Tabela C.9.
"""
from dataclasses import dataclass

from app.nbr5419.enums import (
    PerigoEspecial,
    ProvidenciasIncendio,
    RiscoIncendio,
    TipoConstrucao,
    TipoEstrutura,
    TipoPiso,
)
from app.nbr5419.parte2_tabelas import (
    FATOR_HZ,
    FATOR_RF,
    FATOR_RP,
    FATOR_RS,
    FATOR_RT,
    LF_L1_POR_ESTRUTURA,
    LF_L3_MUSEUS_GALERIAS,
    LF_L4_POR_ESTRUTURA,
    LO_L1_POR_ESTRUTURA,
    LO_L4_POR_ESTRUTURA,
    LT_L1,
    LT_L4,
)


@dataclass(frozen=True)
class EntradaPerdas:
    """Dados para calcular as perdas Lx de uma zona de estudo."""

    tipo_estrutura: TipoEstrutura
    tipo_piso: TipoPiso = TipoPiso.TERRA_CONCRETO
    risco_incendio: RiscoIncendio = RiscoIncendio.NORMAL
    providencias_incendio: ProvidenciasIncendio = ProvidenciasIncendio.NENHUMA
    perigo_especial: PerigoEspecial = PerigoEspecial.NENHUM
    tipo_construcao: TipoConstrucao = TipoConstrucao.ALVENARIA_CONCRETO

    # Ocupação e presença de pessoas
    numero_pessoas_zona: int = 1
    numero_pessoas_total: int = 1
    horas_ano_presenca: float = 8760.0

    # Flags para L1 — risco imediato à vida por falha de sistema interno (LO > 0)
    risco_vida_imediato_por_falha: bool = False
    uti_ou_bloco_cirurgico: bool = False  # caso especial NBR 5419-2:2026 Tabela C.2

    # Para L3 (patrimônio cultural)
    eh_patrimonio_cultural: bool = False

    # Para L4 (informativo, Anexo D)
    calcular_l4: bool = False


@dataclass(frozen=True)
class Perdas:
    """Os 8 valores de perda Lx relativos a um tipo de perda (L1, L3 ou L4)."""
    LA: float
    LB: float
    LC: float
    LM: float
    LU: float
    LV: float
    LW: float
    LZ: float


def _fator_ocupacao(ent: EntradaPerdas) -> float:
    """(nz/nt) × (tz/8760) — NBR 5419-2:2026, C.3.1.b e c."""
    razao_pessoas = ent.numero_pessoas_zona / max(ent.numero_pessoas_total, 1)
    razao_tempo = min(ent.horas_ano_presenca, 8760.0) / 8760.0
    return razao_pessoas * razao_tempo


def calcular_perdas_L1(ent: EntradaPerdas) -> Perdas:
    """
    Perdas Lx para o tipo de perda L1 (vida humana).

    NBR 5419-2:2026, Tabela C.1 e Anexo C.
    """
    rt = FATOR_RT[ent.tipo_piso]
    rp = FATOR_RP[ent.providencias_incendio]
    rf = FATOR_RF[ent.risco_incendio]
    hz = FATOR_HZ[ent.perigo_especial]
    rs = FATOR_RS[ent.tipo_construcao]
    LF = LF_L1_POR_ESTRUTURA.get(ent.tipo_estrutura, 1e-2)

    # LO — Tabela C.2: só > 0 em casos específicos
    if ent.uti_ou_bloco_cirurgico:
        LO = 1e-2
    elif ent.risco_vida_imediato_por_falha or ent.tipo_estrutura == TipoEstrutura.RISCO_EXPLOSAO:
        LO = LO_L1_POR_ESTRUTURA.get(ent.tipo_estrutura, 1e-3)
    else:
        LO = 0.0

    ocup = _fator_ocupacao(ent)

    # Equações C.1 e C.2
    LA = LU = rt * LT_L1 * ocup * rs

    # Equação C.3
    LB = LV = rp * rf * hz * LF * ocup * rs

    # Equação C.4
    LC = LM = LW = LZ = LO * ocup * rs

    return Perdas(LA=LA, LB=LB, LC=LC, LM=LM, LU=LU, LV=LV, LW=LW, LZ=LZ)


def calcular_perdas_L3(ent: EntradaPerdas) -> Perdas:
    """
    Perdas Lx para o tipo de perda L3 (patrimônio cultural).

    NBR 5419-2:2026, Tabela C.8 e C.9 — somente componentes de danos físicos (D2)
    entram, os demais são zero.

    Equação C.7: LB = LV = rp × rf × LF × (cz / ct)
    Aqui assumimos cz/ct = 1 (zona de estudo única tratada como patrimônio integral).
    Para zoneamento, sobrescrever este valor no chamador.
    """
    if not ent.eh_patrimonio_cultural:
        return Perdas(LA=0, LB=0, LC=0, LM=0, LU=0, LV=0, LW=0, LZ=0)

    rp = FATOR_RP[ent.providencias_incendio]
    rf = FATOR_RF[ent.risco_incendio]
    LF = LF_L3_MUSEUS_GALERIAS  # 10⁻¹
    cz_sobre_ct = 1.0

    LB = LV = rp * rf * LF * cz_sobre_ct

    return Perdas(LA=0, LB=LB, LC=0, LM=0, LU=0, LV=LV, LW=0, LZ=0)


def calcular_perdas_L4(ent: EntradaPerdas) -> Perdas:
    """
    Perdas Lx para o tipo de perda L4 (valor econômico — Anexo D).

    Simplificação: usa as relações ca/ct, cb/ct, cc/ct, cs/ct = 1 quando não
    fornecidas pelo usuário (item D.3.1 Nota 'a' da Tabela D.1).
    """
    if not ent.calcular_l4:
        return Perdas(LA=0, LB=0, LC=0, LM=0, LU=0, LV=0, LW=0, LZ=0)

    rt = FATOR_RT[ent.tipo_piso]
    rp = FATOR_RP[ent.providencias_incendio]
    rf = FATOR_RF[ent.risco_incendio]
    LF = LF_L4_POR_ESTRUTURA.get(ent.tipo_estrutura, 1e-1)
    LO = LO_L4_POR_ESTRUTURA.get(ent.tipo_estrutura, 1e-4)

    # Simplificação conforme nota 'a' da Tabela D.1
    LA = LU = rt * LT_L4
    LB = LV = rp * rf * LF
    LC = LM = LW = LZ = LO

    return Perdas(LA=LA, LB=LB, LC=LC, LM=LM, LU=LU, LV=LV, LW=LW, LZ=LZ)
