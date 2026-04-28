"""
Comparação dos riscos calculados com os valores toleráveis RT e FT.

NBR 5419-2:2026:
- Seção 5.4 — procedimento específico para avaliar R1/R3.
- Seção 7.3 — procedimento para avaliar a frequência de danos F.
"""
from dataclasses import dataclass
from enum import Enum

from app.engine.riscos import RiscosConsolidados
from app.nbr5419.enums import TipoPerda
from app.nbr5419.parte2_tabelas import RISCO_TOLERAVEL


class StatusConformidade(str, Enum):
    CONFORME = "CONFORME"           # R ≤ RT ou F ≤ FT
    NAO_CONFORME = "NAO_CONFORME"   # R > RT ou F > FT
    INFORMATIVO = "INFORMATIVO"     # R4 — orientação econômica


@dataclass(frozen=True)
class ResultadoAvaliacao:
    tipo_risco: TipoPerda | str
    valor_calculado: float
    valor_tolerado: float
    status: StatusConformidade
    mensagem: str

    @property
    def razao(self) -> float:
        """Razão R/RT ou F/FT. Útil para visualização em barras."""
        if self.valor_tolerado == 0:
            return float("inf")
        return self.valor_calculado / self.valor_tolerado


def avaliar_conformidade(riscos: RiscosConsolidados) -> list[ResultadoAvaliacao]:
    """
    Compara R1/R3 com RT, F com FT e R4 como informativo.

    A frequência de danos F deve participar da decisão de conformidade quando
    houver avaliação de falha de sistemas internos. Quando a análise de F foi
    realizada por zona/sistema/equipamento, `detalhes["F_atende"]` pode indicar
    o atendimento de cada item ao seu respectivo FT; nesse caso, ele prevalece
    sobre uma comparação simplificada de F global contra um FT único.
    """
    resultados: list[ResultadoAvaliacao] = []

    # R1 — perda de vida humana (obrigatório)
    rt1 = RISCO_TOLERAVEL[TipoPerda.L1]
    status1 = StatusConformidade.CONFORME if riscos.R1 <= rt1 else StatusConformidade.NAO_CONFORME
    resultados.append(
        ResultadoAvaliacao(
            tipo_risco=TipoPerda.L1,
            valor_calculado=riscos.R1,
            valor_tolerado=rt1,
            status=status1,
            mensagem=(
                f"R1 = {riscos.R1:.2e} / RT = {rt1:.0e} — "
                + (
                    "Estrutura atende aos critérios da NBR 5419-2:2026."
                    if status1 == StatusConformidade.CONFORME
                    else "Medidas de proteção são necessárias para reduzir R1 ≤ RT."
                )
            ),
        )
    )

    # F — frequência de danos dos sistemas internos (Seção 7)
    if getattr(riscos, "F", None) is not None:
        ft = float(getattr(riscos, "FT", 0.1) or 0.1)
        detalhes = getattr(riscos, "detalhes", {}) or {}
        atende_f = bool(detalhes.get("F_atende", detalhes.get("F_conforme", riscos.F <= ft)))
        status_f = StatusConformidade.CONFORME if atende_f else StatusConformidade.NAO_CONFORME
        resultados.append(
            ResultadoAvaliacao(
                tipo_risco="F",
                valor_calculado=float(riscos.F or 0.0),
                valor_tolerado=ft,
                status=status_f,
                mensagem=(
                    f"F = {float(riscos.F or 0.0):.2e} / FT = {ft:.2e} — "
                    + (
                        "Frequência de danos dentro do limite tolerável adotado."
                        if status_f == StatusConformidade.CONFORME
                        else "Medidas de proteção são necessárias para reduzir F ≤ FT."
                    )
                ),
            )
        )

    # R3 — perda de patrimônio cultural (obrigatório quando aplicável)
    if riscos.R3 > 0:
        rt3 = RISCO_TOLERAVEL[TipoPerda.L3]
        status3 = StatusConformidade.CONFORME if riscos.R3 <= rt3 else StatusConformidade.NAO_CONFORME
        resultados.append(
            ResultadoAvaliacao(
                tipo_risco=TipoPerda.L3,
                valor_calculado=riscos.R3,
                valor_tolerado=rt3,
                status=status3,
                mensagem=(
                    f"R3 = {riscos.R3:.2e} / RT = {rt3:.0e} — "
                    + (
                        "Patrimônio cultural adequadamente protegido."
                        if status3 == StatusConformidade.CONFORME
                        else "Adotar medidas para preservar o patrimônio cultural."
                    )
                ),
            )
        )

    # R4 — informativo/opcional (Anexo D)
    if riscos.R4 is not None:
        rt4 = RISCO_TOLERAVEL[TipoPerda.L4]
        resultados.append(
            ResultadoAvaliacao(
                tipo_risco=TipoPerda.L4,
                valor_calculado=riscos.R4,
                valor_tolerado=rt4,
                status=StatusConformidade.INFORMATIVO,
                mensagem=(
                    f"R4 = {riscos.R4:.2e} (informativo — Anexo D). "
                    "RT = 10⁻³ é apenas um valor representativo para avaliação econômica."
                ),
            )
        )

    return resultados


def exige_protecao(resultados: list[ResultadoAvaliacao]) -> bool:
    """Retorna True se algum indicador obrigatório está acima do tolerável."""
    return any(r.status == StatusConformidade.NAO_CONFORME for r in resultados)
