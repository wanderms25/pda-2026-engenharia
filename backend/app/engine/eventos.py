"""
Motor de cálculo — Número anual de eventos perigosos.

Implementa as equações A.3, A.4, A.5, A.7, A.9 da ABNT NBR 5419-2:2026.

Fontes e eventos:
- S1 → ND   (descargas diretas na estrutura)
- S1 → NDJ  (descargas diretas em estrutura adjacente conectada por linha)
- S2 → NM   (descargas próximo da estrutura)
- S3 → NL   (descargas diretas na linha elétrica)
- S4 → NI   (descargas próximo da linha elétrica)
"""
from dataclasses import dataclass

from app.nbr5419.enums import (
    AmbienteLinha,
    LocalizacaoEstrutura,
    TipoInstalacaoLinha,
    TipoLinhaEletrica,
)
from app.nbr5419.parte2_tabelas import (
    FATOR_AMBIENTAL_CE,
    FATOR_INSTALACAO_CI,
    FATOR_LOCALIZACAO_CD,
    FATOR_TIPO_LINHA_CT,
)


@dataclass(frozen=True)
class ParametrosLinha:
    """Parâmetros de uma linha elétrica conectada à estrutura."""
    comprimento_m: float
    instalacao: TipoInstalacaoLinha
    tipo: TipoLinhaEletrica
    ambiente: AmbienteLinha


def calcular_ND(
    NG: float, AD: float, localizacao: LocalizacaoEstrutura
) -> float:
    """
    Número anual de eventos perigosos por descargas DIRETAS na estrutura.

    NBR 5419-2:2026, Equação (A.3):
        ND = NG × AD × CD × 10⁻⁶

    Parameters
    ----------
    NG : float
        Densidade de descargas atmosféricas para a terra (1/km²/ano) — do Anexo F.
    AD : float
        Área de exposição equivalente da estrutura (m²).
    localizacao : LocalizacaoEstrutura
        Classificação da localização relativa (Tabela A.1).
    """
    CD = FATOR_LOCALIZACAO_CD[localizacao]
    return NG * AD * CD * 1e-6


def calcular_NDJ(
    NG: float,
    ADJ: float,
    localizacao_adjacente: LocalizacaoEstrutura,
    tipo_linha: TipoLinhaEletrica,
) -> float:
    """
    Número anual de eventos perigosos por descargas diretas na ESTRUTURA ADJACENTE.

    NBR 5419-2:2026, Equação (A.4):
        NDJ = NG × ADJ × CDJ × CT × 10⁻⁶
    """
    CDJ = FATOR_LOCALIZACAO_CD[localizacao_adjacente]
    CT = FATOR_TIPO_LINHA_CT[tipo_linha]
    return NG * ADJ * CDJ * CT * 1e-6


def calcular_NM(NG: float, AM: float) -> float:
    """
    Número anual de eventos perigosos por descargas PRÓXIMO da estrutura.

    NBR 5419-2:2026, Equação (A.5):
        NM = NG × AM × 10⁻⁶
    """
    return NG * AM * 1e-6


def calcular_NL(NG: float, AL: float, linha: ParametrosLinha) -> float:
    """
    Número anual de eventos perigosos por descargas diretas NA LINHA ELÉTRICA.

    NBR 5419-2:2026, Equação (A.7):
        NL = NG × AL × CI × CE × CT × 10⁻⁶
    """
    CI = FATOR_INSTALACAO_CI[linha.instalacao]
    CE = FATOR_AMBIENTAL_CE[linha.ambiente]
    CT = FATOR_TIPO_LINHA_CT[linha.tipo]
    return NG * AL * CI * CE * CT * 1e-6


def calcular_NI(NG: float, AI: float, linha: ParametrosLinha) -> float:
    """
    Número anual de eventos perigosos por descargas PRÓXIMO DA LINHA elétrica.

    NBR 5419-2:2026, Equação (A.9):
        NI = NG × AI × CI × CE × CT × 10⁻⁶
    """
    CI = FATOR_INSTALACAO_CI[linha.instalacao]
    CE = FATOR_AMBIENTAL_CE[linha.ambiente]
    CT = FATOR_TIPO_LINHA_CT[linha.tipo]
    return NG * AI * CI * CE * CT * 1e-6


@dataclass(frozen=True)
class NumerosEventos:
    """Consolidado de todos os números anuais de eventos."""
    ND: float
    NM: float
    NL: float | None = None
    NI: float | None = None
    NDJ: float | None = None

    def resumo(self) -> dict[str, float]:
        return {k: v for k, v in self.__dict__.items() if v is not None}
