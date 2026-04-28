"""
Motor de cálculo — Áreas de exposição equivalentes.

Implementa as equações do Anexo A da ABNT NBR 5419-2:2026.

Equações implementadas:
- A.1: AD  (área de exposição equivalente da estrutura isolada)
- A.2: AD' (área atribuída a saliência elevada na cobertura)
- A.6: AM  (área próximo da estrutura, até 500 m do perímetro)
- A.8: AL  (área de descargas diretas na linha elétrica)
- A.10: AI (área próximo à linha elétrica)
"""
import math
from dataclasses import dataclass
from math import pi, sqrt


@dataclass(frozen=True)
class DimensoesEstrutura:
    """
    Dimensões da estrutura em metros (L × W × H).

    Para estruturas com saliência elevada, usar H_min e H_max.
    """
    L: float  # comprimento (m)
    W: float  # largura (m)
    H: float  # altura (m)
    H_saliencia: float | None = None  # altura da saliência elevada, se houver (m)

    def __post_init__(self) -> None:
        for nome, valor in [("L", self.L), ("W", self.W), ("H", self.H)]:
            if valor <= 0:
                raise ValueError(f"Dimensão {nome} deve ser positiva, recebido: {valor}")


def calcular_AD(dim: DimensoesEstrutura) -> float:
    """
    Área de exposição equivalente AD de uma estrutura retangular isolada em solo plano.

    NBR 5419-2:2026, Equação (A.1):
        AD = L × W + 2 × (3 × H) × (L + W) + π × (3 × H)²

    Para estruturas com forma complexa (saliência elevada), retorna o MAIOR valor entre:
      - AD calculado pela Equação A.1 com H = H_min
      - AD' = π × (3 × H_saliencia)²  (Equação A.2)

    Returns
    -------
    float
        Área de exposição equivalente em m².
    """
    L, W, H = dim.L, dim.W, dim.H

    AD_base = L * W + 2 * (3 * H) * (L + W) + pi * (3 * H) ** 2

    if dim.H_saliencia is not None and dim.H_saliencia > H:
        # Equação A.2
        AD_saliencia = pi * (3 * dim.H_saliencia) ** 2
        return max(AD_base, AD_saliencia)

    return AD_base


def calcular_AM(dim: DimensoesEstrutura) -> float:
    """
    Área de exposição equivalente AM — descargas atmosféricas próximo da estrutura.

    A região se estende até 500 m do perímetro.

    NBR 5419-2:2026, Equação (A.6):
        AM = 2 × 500 × (L + W) + π × 500²
    """
    L, W = dim.L, dim.W
    return 2 * 500 * (L + W) + pi * (500 ** 2)


def calcular_AL(comprimento_linha_m: float) -> float:
    """
    Área de exposição equivalente AL — descargas atmosféricas diretas na linha elétrica.

    NBR 5419-2:2026, Equação (A.8):
        AL = 40 × LL

    Obs.: quando LL é desconhecido, usar LL = 1000 m (item A.4.1).
    """
    if comprimento_linha_m <= 0:
        raise ValueError("Comprimento da linha deve ser positivo")
    return 40.0 * comprimento_linha_m


def calcular_AL_enterrada_alta_resistividade(
    comprimento_linha_m: float, resistividade_ohm_m: float
) -> float:
    """
    AL para trechos enterrados em solo com ρ > 400 Ω·m.

    NBR 5419-2:2026, Anexo A, Nota 1 sob Tabela A.2:
        AL = 0,6 × √ρ × LL
    """
    if resistividade_ohm_m <= 400:
        return calcular_AL(comprimento_linha_m)
    return 0.6 * sqrt(resistividade_ohm_m) * comprimento_linha_m


def calcular_AI(comprimento_linha_m: float) -> float:
    """
    Área de exposição equivalente AI — descargas atmosféricas próximo de uma linha elétrica.

    NBR 5419-2:2026, Equação (A.10):
        AI = 4000 × LL
    """
    if comprimento_linha_m <= 0:
        raise ValueError("Comprimento da linha deve ser positivo")
    return 4000.0 * comprimento_linha_m


def calcular_ADJ(dim_adjacente: DimensoesEstrutura) -> float:
    """
    Área de exposição equivalente ADJ da estrutura ADJACENTE conectada por linha elétrica.

    Usa a mesma fórmula de AD (Equação A.1) aplicada às dimensões da estrutura adjacente.
    """
    return calcular_AD(dim_adjacente)


@dataclass(frozen=True)
class AreasExposicao:
    """Consolidado das áreas de exposição para uma estrutura."""
    AD: float
    AM: float
    AL: float | None = None
    AI: float | None = None
    ADJ: float | None = None

    def resumo_m2(self) -> dict[str, float]:
        return {k: v for k, v in self.__dict__.items() if v is not None}
