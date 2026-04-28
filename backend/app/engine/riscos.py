"""
Motor de cálculo — Componentes de risco e riscos consolidados.

NBR 5419-2:2026, Seção 6 e Tabela 6.

Equações principais (6.2 a 6.5):
    RA = ND × PA × LA                       (S1, D1)
    RB = ND × PB × LB                       (S1, D2)
    RC = ND × PC × LC                       (S1, D3)
    RM = NM × PM × LM                       (S2, D3)
    RU = (NL + NDJ) × PU × LU               (S3, D1)
    RV = (NL + NDJ) × PV × LV               (S3, D2)
    RW = (NL + NDJ) × PW × LW               (S3, D3)
    RZ = NI × PZ × LZ                       (S4, D3)

Riscos consolidados (NBR 5419-2:2026, 4.2.1 e Tabela 2):
    R1 = RA + RB + RC* + RM* + RU + RV + RW* + RZ*
         (* apenas se houver risco de explosão ou risco imediato à vida humana
            por falha de sistemas internos)
    R3 = RB + RV
    R4 = RA† + RB + RC + RM + RU† + RV + RW + RZ
         († apenas se houver animais de valor comercial)

Frequência de danos F (substitui o antigo R2 da edição 2015):
    Tratada em `engine/frequencia_danos.py` (módulo separado).
"""
from dataclasses import dataclass, field


# =============================================================================
# ENTRADA: resultado intermediário já consolidado para facilitar a composição
# =============================================================================
@dataclass(frozen=True)
class EntradaComponentes:
    """
    Dados mínimos para calcular todos os componentes de risco de uma zona.

    Cada Nx, Px, Lx já deve vir calculado pelos módulos eventos/probabilidades/perdas.
    """
    ND: float
    NM: float
    NL: float
    NI: float
    NDJ: float

    PA: float
    PB: float
    PC: float
    PM: float
    PU: float
    PV: float
    PW: float
    PZ: float

    LA: float
    LB: float
    LC: float
    LM: float
    LU: float
    LV: float
    LW: float
    LZ: float

    # PEB é necessário para a frequência FV da Tabela 7.
    # Não participa diretamente das componentes de risco, pois PV já inclui PEB×PLD×CLD.
    PEB: float = 1.0


# =============================================================================
# COMPONENTES DE RISCO
# =============================================================================
@dataclass(frozen=True)
class ComponentesRisco:
    """Os 8 componentes normativos (Tabela 6 da NBR 5419-2:2026)."""
    RA: float  # S1-D1
    RB: float  # S1-D2
    RC: float  # S1-D3
    RM: float  # S2-D3
    RU: float  # S3-D1
    RV: float  # S3-D2
    RW: float  # S3-D3
    RZ: float  # S4-D3

    def resumo(self) -> dict[str, float]:
        return self.__dict__.copy()


def calcular_componentes(e: EntradaComponentes) -> ComponentesRisco:
    """Calcula os 8 componentes de risco conforme Seção 6 da NBR 5419-2:2026."""
    return ComponentesRisco(
        RA=e.ND * e.PA * e.LA,
        RB=e.ND * e.PB * e.LB,
        RC=e.ND * e.PC * e.LC,
        RM=e.NM * e.PM * e.LM,
        RU=(e.NL + e.NDJ) * e.PU * e.LU,
        RV=(e.NL + e.NDJ) * e.PV * e.LV,
        RW=(e.NL + e.NDJ) * e.PW * e.LW,
        RZ=e.NI * e.PZ * e.LZ,
    )


# =============================================================================
# RISCOS CONSOLIDADOS R1, R3, R4
# =============================================================================
@dataclass(frozen=True)
class RiscosConsolidados:
    """
    Riscos totais calculados para a estrutura (ou zona de estudo).

    R1: risco de perda de vida humana (OBRIGATÓRIO)
    R3: risco de perda de patrimônio cultural (OBRIGATÓRIO quando aplicável)
    R4: risco de perda econômica (INFORMATIVO — Anexo D)
    F: frequência de danos dos sistemas internos (Seção 7), quando aplicável
    FT: frequência tolerável adotada para comparação de F
    """
    R1: float
    R3: float
    R4: float | None = None
    F: float | None = None
    FT: float = 0.1
    detalhes: dict[str, dict[str, float]] = field(default_factory=dict)


def calcular_R1(
    comp: ComponentesRisco,
    risco_explosao_ou_vida_imediata: bool = False,
) -> float:
    """
    R1 — Risco de perda de vida humana.

    NBR 5419-2:2026, Tabela 2.

    - RA, RB, RU, RV entram sempre.
    - RC, RM, RW, RZ entram SOMENTE quando houver risco de explosão ou risco
      imediato à vida humana por falha de sistemas internos.
    """
    R1 = comp.RA + comp.RB + comp.RU + comp.RV
    if risco_explosao_ou_vida_imediata:
        R1 += comp.RC + comp.RM + comp.RW + comp.RZ
    return R1


def calcular_R3(comp: ComponentesRisco) -> float:
    """
    R3 — Risco de perda de patrimônio cultural.

    NBR 5419-2:2026, Tabela 2. Só envolve danos físicos (D2).
    """
    return comp.RB + comp.RV


def calcular_R4(
    comp: ComponentesRisco,
    considerar_animais: bool = False,
) -> float:
    """
    R4 — Risco de perda econômica (informativo — Anexo D).

    Todos os componentes entram, exceto RA e RU que só entram quando há
    animais de valor comercial na estrutura.
    """
    R4 = comp.RB + comp.RC + comp.RM + comp.RV + comp.RW + comp.RZ
    if considerar_animais:
        R4 += comp.RA + comp.RU
    return R4


def avaliar_riscos(
    comp: ComponentesRisco,
    risco_explosao_ou_vida_imediata: bool = False,
    calcular_r4: bool = False,
    considerar_animais: bool = False,
) -> RiscosConsolidados:
    """
    Função de alto nível: recebe os componentes e devolve R1, R3 e (opcional) R4
    já consolidados, com detalhamento por fonte/dano para exibição no relatório.
    """
    R1 = calcular_R1(comp, risco_explosao_ou_vida_imediata)
    R3 = calcular_R3(comp)
    R4 = calcular_R4(comp, considerar_animais) if calcular_r4 else None

    return RiscosConsolidados(
        R1=R1,
        R3=R3,
        R4=R4,
        detalhes={
            "por_fonte": {
                "S1_na_estrutura": comp.RA + comp.RB + comp.RC,
                "S2_proximo_estrutura": comp.RM,
                "S3_na_linha": comp.RU + comp.RV + comp.RW,
                "S4_proximo_linha": comp.RZ,
            },
            "por_tipo_dano": {
                "D1_ferimentos": comp.RA + comp.RU,
                "D2_danos_fisicos": comp.RB + comp.RV,
                "D3_falhas_sistemas": comp.RC + comp.RM + comp.RW + comp.RZ,
            },
        },
    )
