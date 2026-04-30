"""Testes de tabelas normativas codificadas no backend.

Objetivo: travar valores tabelados usados pelo motor central, evitando regressões
silenciosas em PLD, PLI, coeficientes do SPDA e validação de UW.
"""
from __future__ import annotations

import math

import pytest
from pydantic import ValidationError

from app.nbr5419.enums import NivelProtecao
from app.nbr5419.parte2_linhas import (
    PLD_TABELA_B8,
    PLI_TABELA_B9,
    calcular_pld_tabela_b8,
    calcular_pli_tabela_b9,
    validar_uw_linha_calculo_completo,
)
from app.nbr5419.parte3_spda import (
    COEFICIENTE_KI,
    DISTANCIA_DESCIDAS_M,
    RAIO_ESFERA_ROLANTE_M,
    TAMANHO_MALHA_M,
    coeficiente_kc_simplificado,
    distancia_seguranca_simplificada,
    numero_minimo_descidas,
)
from app.schemas.calcular import LinhaIn, TrechoSLIn


def assert_close(valor: float, esperado: float, *, rel: float = 1e-12, abs: float = 1e-15) -> None:
    assert math.isclose(valor, esperado, rel_tol=rel, abs_tol=abs), f"{valor=} != {esperado=}"


@pytest.mark.parametrize("blindagem, uw, esperado", [
    (blindagem, uw, esperado)
    for blindagem, linha in PLD_TABELA_B8.items()
    for uw, esperado in linha.items()
])
def test_tabela_b8_pld_consulta_exata(blindagem: str, uw: float, esperado: float) -> None:
    assert_close(calcular_pld_tabela_b8(blindagem, uw), esperado)


@pytest.mark.parametrize("tipo_linha, uw, esperado", [
    (tipo_linha, uw, esperado)
    for tipo_linha, linha in PLI_TABELA_B9.items()
    for uw, esperado in linha.items()
])
def test_tabela_b9_pli_consulta_exata(tipo_linha: str, uw: float, esperado: float) -> None:
    assert_close(calcular_pli_tabela_b9(tipo_linha, uw), esperado)


def test_uw_calculo_completo_rejeita_valor_fora_do_dominio_comum_pld_pli() -> None:
    # 0,5 kV existe em PLD/B.8, mas não no domínio de PLI/B.9; por isso o
    # cálculo completo deve rejeitar esse valor em trecho de linha.
    with pytest.raises(ValueError, match="UW=0.5 kV"):
        validar_uw_linha_calculo_completo(0.5)

    with pytest.raises(ValidationError, match="cálculo completo PLD/PLI"):
        LinhaIn(
            id="L1",
            nome="Energia",
            tipo_linha="ENERGIA",
            trechos=[TrechoSLIn(id="SL1", uw_kv=0.5)],
        )


def test_uw_pld_individual_aceita_035_e_05_quando_consultado_apenas_b8() -> None:
    assert_close(calcular_pld_tabela_b8("BLINDADO_MENOS_1_OHM_KM", 0.35), 1.0)
    assert_close(calcular_pld_tabela_b8("BLINDADO_MENOS_1_OHM_KM", 0.5), 0.85)


def test_tabela_11_ki_np_iv_corrigido() -> None:
    assert_close(COEFICIENTE_KI[NivelProtecao.I], 0.08)
    assert_close(COEFICIENTE_KI[NivelProtecao.II], 0.06)
    assert_close(COEFICIENTE_KI[NivelProtecao.III], 0.04)
    assert_close(COEFICIENTE_KI[NivelProtecao.IV], 0.04)


def test_tabela_2_e_tabela_5_spda_por_nivel() -> None:
    assert RAIO_ESFERA_ROLANTE_M[NivelProtecao.I] == 20.0
    assert RAIO_ESFERA_ROLANTE_M[NivelProtecao.II] == 30.0
    assert RAIO_ESFERA_ROLANTE_M[NivelProtecao.III] == 45.0
    assert RAIO_ESFERA_ROLANTE_M[NivelProtecao.IV] == 60.0

    assert TAMANHO_MALHA_M[NivelProtecao.I] == (5.0, 5.0)
    assert TAMANHO_MALHA_M[NivelProtecao.II] == (10.0, 10.0)
    assert TAMANHO_MALHA_M[NivelProtecao.III] == (15.0, 15.0)
    assert TAMANHO_MALHA_M[NivelProtecao.IV] == (20.0, 20.0)

    assert DISTANCIA_DESCIDAS_M[NivelProtecao.I] == 10.0
    assert DISTANCIA_DESCIDAS_M[NivelProtecao.II] == 10.0
    assert DISTANCIA_DESCIDAS_M[NivelProtecao.III] == 15.0
    assert DISTANCIA_DESCIDAS_M[NivelProtecao.IV] == 20.0


def test_descidas_kc_e_distancia_de_seguranca_simplificada() -> None:
    assert numero_minimo_descidas(perimetro_m=39.9, nivel=NivelProtecao.IV) == 2
    assert numero_minimo_descidas(perimetro_m=40.1, nivel=NivelProtecao.IV) == 3

    assert_close(coeficiente_kc_simplificado(1), 1.0)
    assert_close(coeficiente_kc_simplificado(2), 0.66)
    assert_close(coeficiente_kc_simplificado(3), 0.44)
    assert_close(coeficiente_kc_simplificado(12), 0.44)

    # s = (ki/km) × kc × l; NP IV, ar, >=3 descidas, l = 10 m
    assert_close(
        distancia_seguranca_simplificada(
            nivel=NivelProtecao.IV,
            numero_descidas=3,
            comprimento_l_m=10.0,
            meio="AR",
        ),
        0.04 * 0.44 * 10.0,
    )

    # Meio sólido usa km = 0,5.
    assert_close(
        distancia_seguranca_simplificada(
            nivel=NivelProtecao.IV,
            numero_descidas=3,
            comprimento_l_m=10.0,
            meio="SOLIDO",
        ),
        (0.04 / 0.5) * 0.44 * 10.0,
    )
