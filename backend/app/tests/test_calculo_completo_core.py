"""Testes de fumaça e regressão numérica do motor central de cálculo.

Esses testes calculam valores esperados por fórmulas explícitas nos próprios
testes, sem reaproveitar as funções internas do motor, para capturar regressões
em áreas, eventos, probabilidades, perdas, riscos, frequência F, L3 e L4.
"""
from __future__ import annotations

import math

import pytest

from app.engine.calculo_completo import calcular_pda
from app.schemas.calcular import CalcRequest, EstAdjIn, EstruturaPDA, LinhaIn, TrechoSLIn, ZonaIn


def assert_close(valor: float, esperado: float, *, rel: float = 1e-10, abs: float = 1e-15) -> None:
    assert math.isclose(valor, esperado, rel_tol=rel, abs_tol=abs), f"{valor=} != {esperado=}"


def base_request(
    *,
    estrutura: EstruturaPDA | None = None,
    zona: ZonaIn | None = None,
    linhas: list[LinhaIn] | None = None,
) -> CalcRequest:
    return CalcRequest(
        estrutura=estrutura or EstruturaPDA(
            L=10.0,
            W=5.0,
            H=4.0,
            Hp=0.0,
            NG=2.0,
            loc="ISOLADA",
            pb=0.2,
            pta=0.1,
            nt=100,
            tipo_estrutura="OUTROS",
            tipo_construcao="ALV_CONCRETO",
        ),
        zonas=[zona or ZonaIn(
            id="Z1",
            nome="Zona 1",
            nz=50,
            tz_mode="h_ano",
            tz_valor=4380.0,
            rt=0.001,
            rf=0.01,
            rp=0.5,
            hz=2.0,
            lf_valor=0.02,
            lf_custom=True,
            tem_lo=False,
            lo=0.0,
            pspd=0.05,
            blindagem=False,
            wm1=5.0,
            wm2=0.0,
            ks3=0.5,
            ks3_energia=0.5,
            ks3_sinal=0.5,
            uw_equip=2.0,
            habilitar_f=True,
            ft_sistema=1.0,
            zpr0a=False,
        )],
        linhas=linhas or [LinhaIn(
            id="L1",
            nome="Linha energia",
            tipo_linha="ENERGIA",
            ptu="AVISOS_ALERTA",
            peb="II",
            cld_cli="AEREO_NAO_BLINDADO",
            trechos=[TrechoSLIn(
                id="SL1",
                comprimento_m=100.0,
                instalacao_ci="AEREO",
                tipo_ct="BT_SINAL",
                ambiente_ce="RURAL",
                blindagem_rs="BLINDADO_1_5_OHM_KM",
                uw_kv=4.0,
            )],
            adj=EstAdjIn(),
        )],
    )


def test_motor_central_area_eventos_linha_perdas_r1_e_f_sem_d3_l1() -> None:
    req = base_request()
    calc = calcular_pda(req)
    zona = calc.zonas[0]
    linha = calc.linhas[0]
    trecho = linha.trechos[0]

    AD = 10.0 * 5.0 + 2 * 3 * 4.0 * (10.0 + 5.0) + math.pi * (3 * 4.0) ** 2
    AM = 2 * 500.0 * (10.0 + 5.0) + math.pi * 500.0**2
    ND = 2.0 * AD * 1.0 * 1e-6
    NM = 2.0 * AM * 1e-6
    AL = 40.0 * 100.0
    AI = 4000.0 * 100.0
    NL = 2.0 * AL * 1.0 * 1.0 * 1.0 * 1e-6
    NI = 2.0 * AI * 1.0 * 1.0 * 1.0 * 1e-6
    PLD = 0.3
    PLI = 0.16
    NL_PLD = NL * PLD
    NI_PLI = NI * PLI

    fp = (50.0 / 100.0) * (4380.0 / 8760.0)
    LA = 0.001 * 1e-2 * fp * 1.0
    LB = 0.5 * 0.01 * 2.0 * 0.02 * fp * 1.0
    LC = 0.0

    PA = 0.1 * 0.2
    PC = 0.05 * 1.0
    KS1 = 0.12 * 5.0
    KS2 = 1.0
    KS3 = 0.5
    KS4 = 1.0 / 2.0
    PMS = (KS1 * KS2 * KS3 * KS4) ** 2
    PM = 0.05 * PMS

    RA = ND * PA * LA
    RB = ND * 0.2 * LB
    RC = ND * PC * LC
    RM = NM * PM * LC
    RU = 0.1 * 0.02 * 1.0 * NL_PLD * LA
    RV = 0.02 * 1.0 * NL_PLD * LB
    RW = 0.05 * 1.0 * NL_PLD * LC
    RZ = 0.05 * 1.0 * NI_PLI * LC
    R1 = RA + RB + RU + RV

    FC = ND * PC
    FM = NM * PM
    FV = 0.02 * NL
    FW = 0.05 * 1.0 * NL_PLD
    FZ = 0.05 * 1.0 * NI_PLI
    F = FC + FM + FV + FW + FZ

    assert_close(calc.AD, AD)
    assert_close(calc.AM, AM)
    assert_close(calc.ND, ND)
    assert_close(calc.NM, NM)
    assert_close(trecho.AL, AL)
    assert_close(trecho.AI, AI)
    assert_close(trecho.NL, NL)
    assert_close(trecho.NI, NI)
    assert_close(trecho.PLD, PLD)
    assert_close(trecho.PLI, PLI)
    assert_close(linha.NL_total, NL)
    assert_close(linha.NI_total, NI)

    assert_close(zona.LA, LA)
    assert_close(zona.LB, LB)
    assert_close(zona.LC, LC)
    assert_close(zona.PC_calc, PC)
    assert_close(zona.PMS_calc, PMS)
    assert_close(zona.PM_calc, PM)
    assert_close(zona.KS1_calc, KS1)
    assert_close(zona.KS2_calc, KS2)
    assert_close(zona.KS4_calc, KS4)

    assert_close(zona.RA, RA)
    assert_close(zona.RB, RB)
    assert_close(zona.RC, RC)
    assert_close(zona.RM, RM)
    assert_close(zona.RU, RU)
    assert_close(zona.RV, RV)
    assert_close(zona.RW, RW)
    assert_close(zona.RZ, RZ)
    assert_close(zona.R1, R1)

    assert_close(zona.FB, 0.0)
    assert_close(zona.FC, FC)
    assert_close(zona.FM, FM)
    assert_close(zona.FV, FV)
    assert_close(zona.FW, FW)
    assert_close(zona.FZ, FZ)
    assert_close(zona.F, F)

    assert_close(calc.R1_global, R1)
    assert_close(calc.F_global, F)
    assert_close(calc.RA_g, RA)
    assert_close(calc.RB_g, RB)
    assert_close(calc.RU_g, RU)
    assert_close(calc.RV_g, RV)


def test_d3_l1_automaticamente_aplicavel_para_risco_de_explosao() -> None:
    estrutura = EstruturaPDA(
        L=10.0,
        W=5.0,
        H=4.0,
        NG=2.0,
        loc="ISOLADA",
        pb=0.2,
        pta=0.1,
        nt=100,
        tipo_estrutura="RISCO_EXPLOSAO",
        tipo_construcao="ALV_CONCRETO",
    )
    zona = base_request().zonas[0].model_copy(update={"tem_lo": False, "lo": 0.0})
    calc = calcular_pda(base_request(estrutura=estrutura, zona=zona))
    z = calc.zonas[0]

    fp = (50.0 / 100.0) * (4380.0 / 8760.0)
    # Para risco de explosão, LO típico de L1 = 1e-1 mesmo sem lo customizado.
    assert_close(z.LC, 1e-1 * fp)
    assert z.RC > 0
    assert z.RM > 0
    assert z.RW > 0
    assert z.RZ > 0
    assert_close(z.R1, z.RA + z.RB + z.RC + z.RM + z.RU + z.RV + z.RW + z.RZ)


def test_lc_customizado_e_d3_l1_entram_no_r1_quando_tem_lo() -> None:
    zona = base_request().zonas[0].model_copy(update={"tem_lo": True, "lo": 0.004})
    calc = calcular_pda(base_request(zona=zona))
    z = calc.zonas[0]

    fp = (50.0 / 100.0) * (4380.0 / 8760.0)
    assert_close(z.LC, 0.004 * fp)
    assert z.RC > 0
    assert z.RM > 0
    assert z.RW > 0
    assert z.RZ > 0
    assert_close(z.R1, z.RA + z.RB + z.RC + z.RM + z.RU + z.RV + z.RW + z.RZ)


def test_frequencia_fb_so_aparece_com_equipamento_em_zpr0a() -> None:
    req_sem_fb = base_request()
    req_com_fb = base_request(zona=req_sem_fb.zonas[0].model_copy(update={"zpr0a": True}))

    sem_fb = calcular_pda(req_sem_fb)
    com_fb = calcular_pda(req_com_fb)

    esperado_fb = sem_fb.ND * req_sem_fb.estrutura.pb
    assert_close(sem_fb.zonas[0].FB, 0.0)
    assert_close(com_fb.zonas[0].FB, esperado_fb)
    assert_close(com_fb.zonas[0].F - sem_fb.zonas[0].F, esperado_fb)


def test_area_ad_com_saliencia_usa_maior_area_equivalente() -> None:
    estrutura = base_request().estrutura.model_copy(update={"Hp": 100.0})
    calc = calcular_pda(base_request(estrutura=estrutura))
    esperado = math.pi * (3 * 100.0) ** 2
    assert_close(calc.AD, esperado)
    assert_close(calc.ND, 2.0 * esperado * 1e-6)


def test_multiplos_trechos_usam_somas_ponderadas_por_pld_pli_e_ndj() -> None:
    linha = LinhaIn(
        id="L1",
        nome="Energia com dois trechos",
        tipo_linha="ENERGIA",
        ptu="NENHUMA",
        peb="II",
        cld_cli="AEREO_NAO_BLINDADO",
        trechos=[
            TrechoSLIn(
                id="SL1",
                comprimento_m=100.0,
                instalacao_ci="AEREO",
                tipo_ct="BT_SINAL",
                ambiente_ce="RURAL",
                blindagem_rs="BLINDADO_1_5_OHM_KM",
                uw_kv=4.0,
            ),
            TrechoSLIn(
                id="SL2",
                comprimento_m=200.0,
                instalacao_ci="ENTERRADO",
                tipo_ct="BT_SINAL",
                ambiente_ce="URBANO",
                blindagem_rs="BLINDADO_MENOS_1_OHM_KM",
                uw_kv=6.0,
            ),
        ],
        adj=EstAdjIn(l_adj=8.0, w_adj=6.0, h_adj=4.0, cdj="ISOLADA", ct_adj="BT_SINAL"),
    )
    req = base_request(linhas=[linha])
    calc = calcular_pda(req)
    z = calc.zonas[0]
    out_linha = calc.linhas[0]

    # Trecho 1: CI=1, CE=1, PLD=0,3, PLI=0,16.
    nl1 = 2.0 * (40.0 * 100.0) * 1.0 * 1.0 * 1.0 * 1e-6
    ni1 = 2.0 * (4000.0 * 100.0) * 1.0 * 1.0 * 1.0 * 1e-6
    # Trecho 2: CI=0,5, CE=0,1, PLD=0,02, PLI=0,1.
    nl2 = 2.0 * (40.0 * 200.0) * 0.5 * 1.0 * 0.1 * 1e-6
    ni2 = 2.0 * (4000.0 * 200.0) * 0.5 * 1.0 * 0.1 * 1e-6
    nl_pld = nl1 * 0.3 + nl2 * 0.02
    ni_pli = ni1 * 0.16 + ni2 * 0.1
    adj_area = 8.0 * 6.0 + 2 * 3 * 4.0 * (8.0 + 6.0) + math.pi * (3 * 4.0) ** 2
    ndj = 2.0 * adj_area * 1.0 * 1.0 * 1e-6
    ndj_pld = ndj * 0.3  # max(PLD) dos trechos

    assert_close(out_linha.NL_total, nl1 + nl2)
    assert_close(out_linha.NI_total, ni1 + ni2)
    assert_close(out_linha.NDJ, ndj)

    expected_fv = 0.02 * ((nl1 + nl2) + ndj)
    expected_fw = 0.05 * 1.0 * (nl_pld + ndj_pld)
    expected_fz = 0.05 * 1.0 * ni_pli
    assert_close(z.FV, expected_fv)
    assert_close(z.FW, expected_fw)
    assert_close(z.FZ, expected_fz)


def test_pc_e_pm_combinam_multiplas_linhas_e_sistemas_internos() -> None:
    linhas = [
        LinhaIn(
            id="E",
            nome="Energia",
            tipo_linha="ENERGIA",
            cld_cli="AEREO_NAO_BLINDADO",
            trechos=[TrechoSLIn(id="E1", uw_kv=4.0)],
        ),
        LinhaIn(
            id="S",
            nome="Sinal",
            tipo_linha="SINAL",
            cld_cli="AEREO_BLINDADO_NAO_ATERRADO",
            trechos=[TrechoSLIn(id="S1", uw_kv=4.0)],
        ),
    ]
    zona = base_request().zonas[0].model_copy(update={
        "pspd": 0.05,
        "wm1": 5.0,
        "blindagem": True,
        "wm2": 2.0,
        "ks3_energia": 0.5,
        "ks3_sinal": 0.25,
        "uw_equip": 2.0,
    })
    calc = calcular_pda(base_request(zona=zona, linhas=linhas))
    z = calc.zonas[0]

    # PC = 1 - Π(1 - PSPD×CLD_i). CLD = 1 para ambas as linhas neste caso.
    expected_pc = 1.0 - (1.0 - 0.05 * 1.0) * (1.0 - 0.05 * 1.0)
    assert_close(z.PC_calc, expected_pc)

    ks1 = 0.12 * 5.0
    ks2 = 0.12 * 2.0
    ks4 = 1.0 / 2.0
    pms_energy = (ks1 * ks2 * 0.5 * ks4) ** 2
    pms_signal = (ks1 * ks2 * 0.25 * ks4) ** 2
    expected_pms = 1.0 - (1.0 - pms_energy) * (1.0 - pms_signal)
    expected_pm = 1.0 - (1.0 - 0.05 * pms_energy) * (1.0 - 0.05 * pms_signal)
    assert_close(z.PMS_calc, expected_pms)
    assert_close(z.PM_calc, expected_pm)


def test_r3_patrimonio_cultural_soma_rb3_e_rv3() -> None:
    zona = base_request().zonas[0].model_copy(update={"tem_l3": True, "cp_l3": 0.4})
    calc = calcular_pda(base_request(zona=zona))
    z = calc.zonas[0]

    ND = calc.ND
    NL = calc.linhas[0].NL_total
    PLD = calc.linhas[0].trechos[0].PLD
    LB3 = 0.5 * 0.01 * 1e-1 * 0.4
    expected_rb3 = ND * 0.2 * LB3
    expected_rv3 = (NL * PLD) * 0.02 * 1.0 * LB3
    assert_close(z.RB3, expected_rb3)
    assert_close(z.RV3, expected_rv3)
    assert_close(z.R3, expected_rb3 + expected_rv3)
    assert_close(calc.R3_global, z.R3)


def test_r4_relacoes_economicas_calcula_componentes_d1_d2_d3() -> None:
    zona = base_request().zonas[0].model_copy(update={
        "habilitar_l4": True,
        "l4_usar_relacoes_valor": True,
        "tipo_estrutura_l4": "OUTROS",
        "val_animais": 100.0,
        "val_edificio": 200.0,
        "val_conteudo": 300.0,
        "val_sistemas": 400.0,
    })
    calc = calcular_pda(base_request(zona=zona))
    z = calc.zonas[0]

    ct = 1000.0
    fator_d1 = 100.0 / ct
    fator_d2 = 1.0
    fator_d3 = 400.0 / ct
    LA4 = 0.001 * 1e-2 * fator_d1
    LB4 = 0.5 * 0.01 * 0.1 * fator_d2
    LC4 = 1e-4 * fator_d3

    ND = calc.ND
    NM = calc.NM
    NL_PLD = calc.linhas[0].NL_total * calc.linhas[0].trechos[0].PLD
    NI_PLI = calc.linhas[0].NI_total * calc.linhas[0].trechos[0].PLI
    PA = 0.1 * 0.2
    PC = z.PC_calc
    PM = z.PM_calc

    expected = {
        "RA4": ND * PA * LA4,
        "RB4": ND * 0.2 * LB4,
        "RC4": ND * PC * LC4,
        "RM4": NM * PM * LC4,
        "RU4": 0.1 * 0.02 * 1.0 * NL_PLD * LA4,
        "RV4": 0.02 * 1.0 * NL_PLD * LB4,
        "RW4": 0.05 * 1.0 * NL_PLD * LC4,
        "RZ4": 0.05 * 1.0 * NI_PLI * LC4,
    }
    for campo, esperado in expected.items():
        assert_close(getattr(z, campo), esperado)
    assert_close(z.R4, sum(expected.values()))
    assert_close(calc.R4_global, z.R4)


def test_r4_representativo_zerar_d1_quando_nao_ha_animais() -> None:
    zona = base_request().zonas[0].model_copy(update={
        "habilitar_l4": True,
        "l4_usar_relacoes_valor": False,
        "tipo_estrutura_l4": "OUTROS",
        "val_animais": 0.0,
    })
    calc = calcular_pda(base_request(zona=zona))
    z = calc.zonas[0]

    assert_close(z.RA4, 0.0)
    assert_close(z.RU4, 0.0)
    assert z.RB4 > 0
    assert z.RV4 > 0
    assert z.R4 > 0


def test_multizona_globais_sao_somas_das_zonas_e_ft_global_eh_o_mais_restritivo() -> None:
    zona1 = base_request().zonas[0].model_copy(update={"id": "Z1", "nome": "Zona 1", "ft_sistema": 0.5})
    zona2 = base_request().zonas[0].model_copy(update={
        "id": "Z2",
        "nome": "Zona 2",
        "nz": 25,
        "tz_valor": 2190.0,
        "ft_sistema": 0.05,
        "zpr0a": True,
    })
    req = base_request()
    req = CalcRequest(estrutura=req.estrutura, zonas=[zona1, zona2], linhas=req.linhas)
    calc = calcular_pda(req)

    assert_close(calc.R1_global, sum(z.R1 for z in calc.zonas))
    assert_close(calc.R3_global, sum(z.R3 for z in calc.zonas))
    assert_close(calc.R4_global, sum(z.R4 for z in calc.zonas))
    assert_close(calc.F_global, sum(z.F for z in calc.zonas))
    assert_close(calc.FT_global, 0.05)
    assert calc.zonas[1].FB > 0


def test_valida_l4_com_relacoes_exige_ct_global_maior_que_zero() -> None:
    zona = base_request().zonas[0].model_copy(update={
        "habilitar_l4": True,
        "l4_usar_relacoes_valor": True,
        "val_animais": 0.0,
        "val_edificio": 0.0,
        "val_conteudo": 0.0,
        "val_sistemas": 0.0,
    })
    with pytest.raises(Exception, match="ct > 0"):
        calcular_pda(base_request(zona=zona))
