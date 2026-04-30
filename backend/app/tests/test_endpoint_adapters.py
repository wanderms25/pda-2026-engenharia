"""Testes para garantir que endpoints legados seguem usando o motor central."""
from __future__ import annotations

import asyncio
import math

from app.api.v1.calcular import calcular as endpoint_calcular
from app.api.v1.wizard_analise import (
    EstruturaAdjacenteInput,
    LinhaWizardInput,
    TrechoInput,
    WizardRequest,
    ZonaWizardInput,
    _build_calc_request as build_wizard_calc_request,
    calcular_wizard,
)
from app.api.v1.analise_multi_zona import (
    AnaliseMultiZonaRequest,
    ZonaInput,
    _build_calc_request as build_multi_calc_request,
    calcular_multi_zona,
)
from app.engine.calculo_completo import calcular_pda
from app.nbr5419.enums import (
    AmbienteLinha,
    LocalizacaoEstrutura,
    NivelProtecao,
    PerigoEspecial,
    ProvidenciasIncendio,
    RiscoIncendio,
    TipoConstrucao,
    TipoEstrutura,
    TipoInstalacaoLinha,
    TipoLinhaEletrica,
    TipoPiso,
)
from app.schemas.calcular import CalcRequest, EstAdjIn, EstruturaPDA, LinhaIn, TrechoSLIn, ZonaIn


def assert_close(valor: float, esperado: float, *, rel: float = 1e-10, abs: float = 1e-15) -> None:
    assert math.isclose(valor, esperado, rel_tol=rel, abs_tol=abs), f"{valor=} != {esperado=}"


def request_central() -> CalcRequest:
    return CalcRequest(
        estrutura=EstruturaPDA(L=20, W=10, H=8, NG=6, loc="ISOLADA", pb=0.1, pta=0.1, nt=100),
        zonas=[ZonaIn(id="Z1", nome="Zona", nz=50, tz_valor=4380, pspd=0.05, ft_sistema=1.0)],
        linhas=[LinhaIn(
            id="L1",
            nome="Energia",
            tipo_linha="ENERGIA",
            ptu="NENHUMA",
            peb="III",
            cld_cli="AEREO_NAO_BLINDADO",
            trechos=[TrechoSLIn(id="SL1", comprimento_m=100, uw_kv=4.0)],
            adj=EstAdjIn(),
        )],
    )


def test_endpoint_calcular_e_apenas_adaptador_do_motor_central() -> None:
    req = request_central()
    direto = calcular_pda(req)
    via_endpoint = endpoint_calcular(req)

    assert_close(via_endpoint.R1_global, direto.R1_global)
    assert_close(via_endpoint.F_global, direto.F_global)
    assert_close(via_endpoint.R4_global, direto.R4_global)
    assert via_endpoint.model_dump() == direto.model_dump()


def test_wizard_adapter_retorna_calc_unificado_equivalente_ao_motor_central() -> None:
    req = WizardRequest(
        nome_projeto="Teste wizard",
        NG=6,
        L=20,
        W=10,
        H=8,
        localizacao="ISOLADA",
        pb_nivel="III",
        nt=100,
        lf_tipo="OUTROS",
        pta_tipo="AVISOS_ALERTA",
        linhas=[LinhaWizardInput(
            id="L1",
            nome="Energia",
            tipo_linha="ENERGIA",
            ptu="NENHUMA",
            peb="III",
            cld_cli="AEREO_NAO_BLINDADO",
            trechos=[TrechoInput(comprimento_m=100, uw_kv=4.0)],
            adjacente=EstruturaAdjacenteInput(),
        )],
        zonas=[ZonaWizardInput(
            id="Z1",
            nome="Zona",
            nz=50,
            tz_horas_ano=4380,
            pspd="III",
            sistema_interno_ft=1.0,
        )],
    )
    calc_req = build_wizard_calc_request(req)
    direto = calcular_pda(calc_req)
    via_wizard = asyncio.run(calcular_wizard(req))

    assert_close(via_wizard["R1_total"], direto.R1_global)
    assert_close(via_wizard["F_total"], direto.F_global)
    assert_close(via_wizard["calc_unificado"]["R1_global"], direto.R1_global)
    assert_close(via_wizard["calc_unificado"]["F_global"], direto.F_global)
    assert via_wizard["zonas_resultado"][0]["id"] == "Z1"


def test_multi_zona_adapter_retorna_calc_unificado_equivalente_ao_motor_central() -> None:
    req = AnaliseMultiZonaRequest(
        nome_projeto="Teste multizona",
        NG=6,
        localizacao=LocalizacaoEstrutura.ISOLADA,
        dimensoes={"L": 20.0, "W": 10.0, "H": 8.0},
        tipo_estrutura=TipoEstrutura.OUTROS,
        comprimento_linha_m=100.0,
        instalacao_linha=TipoInstalacaoLinha.AEREO,
        tipo_linha=TipoLinhaEletrica.BT_SINAL,
        ambiente_linha=AmbienteLinha.RURAL,
        tensao_UW_kV=4.0,
        zonas=[ZonaInput(
            id="Z1",
            nome="Zona 1",
            tipo_piso=TipoPiso.MARMORE_CERAMICA,
            risco_incendio=RiscoIncendio.NORMAL,
            providencias_incendio=ProvidenciasIncendio.NENHUMA,
            perigo_especial=PerigoEspecial.NENHUM,
            tipo_construcao=TipoConstrucao.ALVENARIA_CONCRETO,
            numero_pessoas_zona=50,
            horas_ano_presenca=4380,
            spda_nivel=NivelProtecao.III,
            dps_coordenados_nivel=NivelProtecao.III,
            habilitar_f=True,
            ft_sistema=1.0,
        )],
    )
    calc_req = build_multi_calc_request(req)
    direto = calcular_pda(calc_req)
    via_multi = asyncio.run(calcular_multi_zona(req))

    assert_close(via_multi["R1_total"], direto.R1_global)
    assert_close(via_multi["F_total"], direto.F_global)
    assert_close(via_multi["calc_unificado"]["R1_global"], direto.R1_global)
    assert_close(via_multi["calc_unificado"]["F_global"], direto.F_global)
    assert via_multi["zonas"][0]["id"] == "Z1"
