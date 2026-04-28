"""
Frequência de danos F — NBR 5419-2:2026, Seção 7.

Este conceito SUBSTITUIU o risco R2 da edição 2015.

Conforme 7.1, a frequência de danos F serve para:
- quantificar perdas econômicas diretas;
- avaliar interrupções de serviços;
- ser usada como parâmetro adicional quando os danos não envolvem risco direto
  à vida, mas causam consequências relevantes para continuidade operacional.

A equação geral da frequência de danos mantém a mesma estrutura Nx × Px, sem
termo de perda Lx.
"""
from dataclasses import dataclass

from app.engine.probabilidades import Probabilidades
from app.engine.riscos import EntradaComponentes


@dataclass(frozen=True)
class FrequenciaDanos:
    """
    Frequência de danos por fonte.

    NBR 5419-2:2026, Seção 7:
    F = FB + FC + FM + FV + FW + FZ.

    FA e FU são mantidos apenas por compatibilidade com consumidores antigos,
    mas não entram no F_total da Tabela 7.
    """
    FA: float  # compatibilidade; não entra na Eq. 14
    FB: float  # FB = ND × PB, apenas quando houver equipamento em ZPR0A
    FC: float  # FC = ND × PC
    FM: float  # FM = NM × PM
    FU: float  # compatibilidade; não entra na Eq. 14
    FV: float  # FV = (NL + NDJ) × PEB
    FW: float  # FW = (NL + NDJ) × PW
    FZ: float  # FZ = NI × PZ

    @property
    def F_total(self) -> float:
        return self.FB + self.FC + self.FM + self.FV + self.FW + self.FZ

    @property
    def F_por_fonte(self) -> dict[str, float]:
        return {
            "S1": self.FB + self.FC,
            "S2": self.FM,
            "S3": self.FV + self.FW,
            "S4": self.FZ,
        }


def calcular_frequencia_danos(e: EntradaComponentes, equipamento_em_zpr0a: bool = False) -> FrequenciaDanos:
    """
    Calcula a frequência parcial de danos conforme Tabela 7.

    Pela NBR 5419-2:2026, FB só é considerado quando há equipamento em ZPR0A.
    Na ausência dessa indicação explícita, o valor normativo adotado é FB = 0.
    """
    return FrequenciaDanos(
        FA=0.0,
        FB=e.ND * e.PB if equipamento_em_zpr0a else 0.0,
        FC=e.ND * e.PC,
        FM=e.NM * e.PM,
        FU=0.0,
        FV=(e.NL + e.NDJ) * e.PEB,
        FW=(e.NL + e.NDJ) * e.PW,
        FZ=e.NI * e.PZ,
    )


def calcular_frequencia_a_partir_de_probabilidades(
    ND: float,
    NM: float,
    NL: float,
    NI: float,
    NDJ: float,
    prob: Probabilidades,
    equipamento_em_zpr0a: bool = False,
) -> FrequenciaDanos:
    """Helper para calcular F diretamente a partir dos Nx e do objeto Probabilidades."""
    return FrequenciaDanos(
        FA=0.0,
        FB=ND * prob.PB if equipamento_em_zpr0a else 0.0,
        FC=ND * prob.PC,
        FM=NM * prob.PM,
        FU=0.0,
        FV=(NL + NDJ) * prob.PEB,
        FW=(NL + NDJ) * prob.PW,
        FZ=NI * prob.PZ,
    )
