"""
Tabelas normativas de PLD e PLI — ABNT NBR 5419-2:2026, Anexo B.

Este módulo centraliza a consulta das Tabelas B.8 e B.9 para evitar
aproximação por "valor mais próximo" e impedir divergências entre endpoints.

Regra adotada para validação normativa rígida:
- PLD usa somente os valores de UW explicitamente tabelados na Tabela B.8.
- PLI usa somente os valores de UW explicitamente tabelados na Tabela B.9.
- Como o cálculo completo também usa PZ = PSPD × PLI × CLI, a tensão da linha
  deve estar no domínio comum aplicável à PLI: 1,0; 1,5; 2,5; 4,0; 6,0 kV.
"""
from __future__ import annotations

from math import isclose
from typing import Final

UW_PLD_TABELA: Final[tuple[float, ...]] = (0.35, 0.5, 1.0, 1.5, 2.5, 4.0, 6.0)
UW_PLI_TABELA: Final[tuple[float, ...]] = (1.0, 1.5, 2.5, 4.0, 6.0)

# Domínio recomendado para o cálculo completo de risco, pois o endpoint calcula
# PLD e PLI no mesmo trecho de linha.
UW_LINHA_CALCULO_COMPLETO: Final[tuple[float, ...]] = UW_PLI_TABELA

PLD_TABELA_B8: Final[dict[str, dict[float, float]]] = {
    "AEREO_NAO_BLINDADO": {
        0.35: 1.0, 0.5: 1.0, 1.0: 1.0, 1.5: 1.0, 2.5: 1.0, 4.0: 1.0, 6.0: 1.0,
    },
    "ENTERRADO_NAO_BLINDADO": {
        0.35: 1.0, 0.5: 1.0, 1.0: 1.0, 1.5: 1.0, 2.5: 1.0, 4.0: 1.0, 6.0: 1.0,
    },
    "BLINDADO_5_20_OHM_KM": {
        0.35: 1.0, 0.5: 1.0, 1.0: 1.0, 1.5: 1.0, 2.5: 0.95, 4.0: 0.9, 6.0: 0.8,
    },
    "BLINDADO_1_5_OHM_KM": {
        0.35: 1.0, 0.5: 1.0, 1.0: 0.9, 1.5: 0.8, 2.5: 0.6, 4.0: 0.3, 6.0: 0.1,
    },
    "BLINDADO_MENOS_1_OHM_KM": {
        0.35: 1.0, 0.5: 0.85, 1.0: 0.6, 1.5: 0.4, 2.5: 0.2, 4.0: 0.04, 6.0: 0.02,
    },
}

PLI_TABELA_B9: Final[dict[str, dict[float, float]]] = {
    "ENERGIA": {1.0: 1.0, 1.5: 0.6, 2.5: 0.3, 4.0: 0.16, 6.0: 0.1},
    "SINAL": {1.0: 1.0, 1.5: 0.5, 2.5: 0.2, 4.0: 0.08, 6.0: 0.04},
}


def _fmt_valores(valores: tuple[float, ...]) -> str:
    return ", ".join(f"{v:g}".replace(".", ",") for v in valores)


def _normalizar_uw(uw_kv: float, permitidos: tuple[float, ...], tabela: str) -> float:
    """Retorna o UW tabelado, aceitando apenas pequenas diferenças de ponto flutuante."""
    valor = float(uw_kv)
    for permitido in permitidos:
        if isclose(valor, permitido, rel_tol=0.0, abs_tol=1e-9):
            return permitido
    raise ValueError(
        f"UW={valor:g} kV não é valor tabelado para {tabela}. "
        f"Use um destes valores: {_fmt_valores(permitidos)} kV."
    )


def validar_uw_linha_calculo_completo(uw_kv: float) -> float:
    """Valida UW para trechos usados no cálculo completo PLD + PLI."""
    return _normalizar_uw(uw_kv, UW_LINHA_CALCULO_COMPLETO, "o cálculo completo PLD/PLI")


def calcular_pld_tabela_b8(blindagem_rs: str, uw_kv: float) -> float:
    """Consulta exata da Tabela B.8 — sem interpolação ou valor mais próximo."""
    tabela = PLD_TABELA_B8.get(blindagem_rs)
    if tabela is None:
        raise ValueError(f"Condição de blindagem/roteamento inválida para PLD: {blindagem_rs!r}.")
    uw = _normalizar_uw(uw_kv, UW_PLD_TABELA, "a Tabela B.8/PLD")
    return tabela[uw]


def calcular_pli_tabela_b9(tipo_linha: str, uw_kv: float) -> float:
    """Consulta exata da Tabela B.9 — sem interpolação ou valor mais próximo."""
    tipo = str(tipo_linha).upper()
    tabela = PLI_TABELA_B9.get(tipo)
    if tabela is None:
        raise ValueError(f"Tipo de linha inválido para PLI: {tipo_linha!r}. Use ENERGIA ou SINAL.")
    uw = _normalizar_uw(uw_kv, UW_PLI_TABELA, "a Tabela B.9/PLI")
    return tabela[uw]
