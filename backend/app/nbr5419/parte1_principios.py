"""
Constantes normativas — ABNT NBR 5419-1:2026 (Princípios gerais).

Esta Parte define a terminologia, os níveis de proteção (NP I-IV) e os
parâmetros das correntes das descargas atmosféricas usados no dimensionamento
das medidas de proteção descritas nas Partes 3 e 4.
"""
from app.nbr5419.enums import NivelProtecao


# =============================================================================
# NBR 5419-1:2026, Tabela 5 — Probabilidades para os limites dos parâmetros
# das correntes das descargas atmosféricas em função do NP.
# =============================================================================
PROBABILIDADE_CORRENTE_ABAIXO_DO_MAXIMO: dict[NivelProtecao, float] = {
    NivelProtecao.I: 0.99,
    NivelProtecao.II: 0.98,
    NivelProtecao.III: 0.95,
    NivelProtecao.IV: 0.95,
}

PROBABILIDADE_CORRENTE_ACIMA_DO_MINIMO: dict[NivelProtecao, float] = {
    NivelProtecao.I: 0.99,
    NivelProtecao.II: 0.97,
    NivelProtecao.III: 0.91,
    NivelProtecao.IV: 0.84,
}


# =============================================================================
# NBR 5419-1:2026, Tabela 3 — Valores máximos dos parâmetros da corrente
# das descargas atmosféricas para cada nível de proteção.
# Valores utilizados no dimensionamento das medidas de proteção (Parte 3/4).
# =============================================================================
PARAMETROS_MAXIMOS_CORRENTE: dict[NivelProtecao, dict[str, float]] = {
    NivelProtecao.I: {
        "I_pico_kA": 200.0,
        "Q_longa_C": 200.0,
        "W_R_kJ_por_ohm": 10_000.0,
        "di_dt_kA_por_us": 200.0,
    },
    NivelProtecao.II: {
        "I_pico_kA": 150.0,
        "Q_longa_C": 150.0,
        "W_R_kJ_por_ohm": 5_600.0,
        "di_dt_kA_por_us": 150.0,
    },
    NivelProtecao.III: {
        "I_pico_kA": 100.0,
        "Q_longa_C": 100.0,
        "W_R_kJ_por_ohm": 2_500.0,
        "di_dt_kA_por_us": 100.0,
    },
    NivelProtecao.IV: {
        "I_pico_kA": 100.0,
        "Q_longa_C": 100.0,
        "W_R_kJ_por_ohm": 2_500.0,
        "di_dt_kA_por_us": 100.0,
    },
}


# =============================================================================
# NBR 5419-1:2026, Tabela 4 — Valores mínimos dos parâmetros da corrente,
# usados para dimensionar o raio da esfera rolante (método do modelo eletrogeométrico).
# =============================================================================
PARAMETROS_MINIMOS_CORRENTE: dict[NivelProtecao, dict[str, float]] = {
    NivelProtecao.I: {
        "I_pico_min_kA": 3.0,
        "raio_esfera_rolante_m": 20.0,
    },
    NivelProtecao.II: {
        "I_pico_min_kA": 5.0,
        "raio_esfera_rolante_m": 30.0,
    },
    NivelProtecao.III: {
        "I_pico_min_kA": 10.0,
        "raio_esfera_rolante_m": 45.0,
    },
    NivelProtecao.IV: {
        "I_pico_min_kA": 16.0,
        "raio_esfera_rolante_m": 60.0,
    },
}
