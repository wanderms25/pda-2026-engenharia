"""
Endpoint legado /api/v1/analise-risco/calcular.

Mantido por compatibilidade de API, mas sem motor próprio de cálculo.
Toda a apuração normativa é feita por app.engine.calculo_completo.calcular_pda.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.engine.avaliacao import avaliar_conformidade, exige_protecao
from app.engine.calculo_completo import calcular_pda
from app.engine.riscos import RiscosConsolidados
from app.nbr5419.enums import TipoConstrucao, TipoEstrutura
from app.nbr5419.parte2_tabelas import (
    FATOR_HZ,
    FATOR_RF,
    FATOR_RP,
    FATOR_RT,
    LF_L1_POR_ESTRUTURA,
    PROBABILIDADE_PB,
    PROBABILIDADE_PSPD,
    PROBABILIDADE_PTA,
)
from app.schemas.analise_risco import (
    AnaliseRiscoRequest,
    AnaliseRiscoResponse,
    ComponenteRiscoOut,
    ResultadoAvaliacaoOut,
)
from app.schemas.calcular import CalcRequest, EstAdjIn, EstruturaPDA, LinhaIn, TrechoSLIn, ZonaIn

router = APIRouter()


def _nivel_por_probabilidade_peb(valor: float) -> str:
    """Converte valor legado de PEB para a chave usada pelo motor central."""
    v = float(valor)
    if v <= 0.001:
        return "NP1_MAX"
    if v <= 0.005:
        return "NP1_PLUS"
    if v <= 0.01:
        return "I"
    if v <= 0.02:
        return "II"
    if v <= 0.05:
        return "IV"
    return "NENHUM"


def _ptu_por_fator(valor: float) -> str:
    """Converte valor legado de PTU/PTA para a chave usada pelo motor central."""
    v = float(valor)
    if v <= 0.0:
        return "RESTRICOES_FISICAS_FIXAS"
    if v <= 0.01:
        return "ISOLACAO_ELETRICA_DESCIDA"
    if v <= 0.1:
        return "AVISOS_ALERTA"
    return "NENHUMA"


def _blindagem_por_fator(valor: float) -> str:
    """
    Converte o fator legado de blindagem para a chave de CLD/CLI do motor central.
    O schema legado não guarda a chave original; por isso o mapeamento é conservador
    e preserva o comportamento anterior para ausência de blindagem.
    """
    v = float(valor)
    if v <= 0.0:
        return "AEREO_BLINDADO_ATERRADO"
    if v <= 0.1:
        return "AEREO_BLINDADO_NAO_ATERRADO"
    if v <= 0.3:
        return "ENTERRADO_BLINDADO_NAO_ATERRADO"
    return "AEREO_NAO_BLINDADO"


def _pta_from_medidas(req: AnaliseRiscoRequest) -> float:
    pta = 1.0
    m = req.medidas
    if m.aviso_alerta_toque_passo:
        pta *= PROBABILIDADE_PTA["AVISOS_ALERTA"]
    if m.isolacao_eletrica_descida:
        pta *= PROBABILIDADE_PTA["ISOLACAO_ELETRICA_DESCIDA"]
    if m.malha_equipotencializacao_solo:
        pta *= PROBABILIDADE_PTA["MALHA_EQUIPOTENCIALIZACAO_SOLO"]
    if m.descida_natural_estrutura_continua:
        pta *= PROBABILIDADE_PTA["ESTRUTURA_METALICA_DESCIDA_NATURAL"]
    return pta


def _tipo_linha_por_nome(nome: str) -> str:
    """
    O contrato legado não possui campo ENERGIA/SINAL. Mantém ENERGIA como padrão,
    mas reconhece nomes que contenham 'sinal', 'telecom' ou 'dados'.
    """
    n = (nome or "").lower()
    return "SINAL" if any(p in n for p in ("sinal", "telecom", "dados", "automação", "automacao")) else "ENERGIA"


def _build_calc_request(req: AnaliseRiscoRequest) -> CalcRequest:
    f = req.fatores
    m = req.medidas
    tipo_estrutura = f.tipo_estrutura.value if isinstance(f.tipo_estrutura, TipoEstrutura) else str(f.tipo_estrutura)
    tipo_construcao = f.tipo_construcao.value if isinstance(f.tipo_construcao, TipoConstrucao) else str(f.tipo_construcao)

    linhas: list[LinhaIn] = []
    for idx, linha in enumerate(req.linhas, start=1):
        blindagem_key = _blindagem_por_fator(linha.fator_blindagem)
        linhas.append(
            LinhaIn(
                id=f"L{idx:02d}",
                nome=linha.nome,
                tipo_linha=_tipo_linha_por_nome(linha.nome),
                ptu=_ptu_por_fator(linha.fator_ptu),
                peb=_nivel_por_probabilidade_peb(linha.fator_peb),
                cld_cli=blindagem_key,
                trechos=[
                    TrechoSLIn(
                        id=f"L{idx:02d}-SL01",
                        comprimento_m=linha.comprimento_m,
                        instalacao_ci=linha.instalacao.value,
                        tipo_ct=linha.tipo.value,
                        ambiente_ce=linha.ambiente.value,
                        blindagem_rs=blindagem_key,
                        uw_kv=linha.tensao_suportavel_UW_kV,
                    )
                ],
                adj=EstAdjIn(),
            )
        )

    pb = PROBABILIDADE_PB[m.spda_nivel]
    pta = _pta_from_medidas(req)
    pspd = PROBABILIDADE_PSPD[m.dps_coordenados_nivel]
    lf = LF_L1_POR_ESTRUTURA.get(f.tipo_estrutura, LF_L1_POR_ESTRUTURA[TipoEstrutura.OUTROS])

    zona = ZonaIn(
        id="ZS01",
        nome="Zona única",
        nz=f.numero_pessoas_zona,
        tz_mode="h_ano",
        tz_valor=f.horas_ano_presenca,
        rt=FATOR_RT[f.tipo_piso],
        rf=FATOR_RF[f.risco_incendio],
        rp=FATOR_RP[f.providencias_incendio],
        hz=FATOR_HZ[f.perigo_especial],
        lf_valor=lf,
        lf_custom=True,
        tem_lo=bool(f.risco_explosao_ou_vida_imediata or f.tipo_estrutura == TipoEstrutura.RISCO_EXPLOSAO),
        pspd=pspd,
        habilitar_f=True,
        ft_sistema=0.1,
        pb=pb,
        pta=pta,
        habilitar_l4=req.calcular_r4,
    )

    estrutura = EstruturaPDA(
        L=req.dimensoes.L,
        W=req.dimensoes.W,
        H=req.dimensoes.H,
        Hp=req.dimensoes.H_saliencia or 0.0,
        NG=req.NG,
        loc=req.localizacao.value,
        pb=pb,
        pta=pta,
        nt=f.numero_pessoas_total,
        tipo_estrutura=tipo_estrutura,
        tipo_construcao=tipo_construcao,
    )
    return CalcRequest(estrutura=estrutura, zonas=[zona], linhas=linhas)


def _avaliacao_from_calc(calc, calcular_r4: bool) -> list[ResultadoAvaliacaoOut]:
    riscos = RiscosConsolidados(
        R1=calc.R1_global,
        R3=calc.R3_global,
        R4=calc.R4_global if calcular_r4 else None,
        F=calc.F_global,
        FT=calc.FT_global,
        detalhes={"F_atende": calc.F_atende},
    )
    return [
        ResultadoAvaliacaoOut(
            tipo_risco=getattr(r.tipo_risco, "value", r.tipo_risco),
            valor_calculado=r.valor_calculado,
            valor_tolerado=r.valor_tolerado,
            status=r.status.value,
            mensagem=r.mensagem,
            razao=r.razao,
        )
        for r in avaliar_conformidade(riscos)
    ]


def _recomendacao_compat(calc) -> dict:
    """
    Mantém o contrato de resposta sem reimplementar busca de solução em outro motor.
    A seleção final de medidas deve ser feita pelo projetista a partir dos componentes dominantes.
    """
    ja_conforme = bool(calc.conforme_norma)
    componentes = {
        "RA": calc.RA_g, "RB": calc.RB_g, "RC": calc.RC_g, "RM": calc.RM_g,
        "RU": calc.RU_g, "RV": calc.RV_g, "RW": calc.RW_g, "RZ": calc.RZ_g,
    }
    dominante = max(componentes, key=componentes.get) if any(componentes.values()) else "RB"
    return {
        "ja_conforme": ja_conforme,
        "config_recomendada": None,
        "R1_antes": calc.R1_global,
        "R3_antes": calc.R3_global,
        "R1_depois": calc.R1_global,
        "R3_depois": calc.R3_global,
        "reducao_R1": 1.0,
        "reducao_R3": 1.0,
        "passos": [
            {
                "prioridade": 1 if not ja_conforme else 3,
                "acao": "Revisar medidas de proteção a partir do componente dominante" if not ja_conforme else "Manter inspeção e documentação periódica",
                "justificativa": f"Cálculo centralizado concluído; componente dominante: {dominante}.",
                "referencia_norma": "ABNT NBR 5419-2:2026, Seções 5.6 e 6.1",
                "impacto_estimado": "A seleção deve priorizar a redução dos componentes que mais contribuem para R e F.",
            }
        ],
        "alerta_nao_conforme": None if ja_conforme else "Estrutura não conforme no cálculo central. Selecionar medidas de proteção e recalcular.",
    }


@router.post("/calcular", response_model=AnaliseRiscoResponse, deprecated=True)
async def calcular_analise_risco(req: AnaliseRiscoRequest) -> AnaliseRiscoResponse:
    """
    Adaptador legado para o motor central /calcular.
    """
    calc_req = _build_calc_request(req)
    calc = calcular_pda(calc_req)
    avaliacao = _avaliacao_from_calc(calc, req.calcular_r4)

    return AnaliseRiscoResponse(
        nome_projeto=req.nome_projeto,
        areas_m2={"AD": calc.AD, "AM": calc.AM, "AL": calc.AL, "AI": calc.AI},
        numeros_eventos={
            "ND": calc.ND,
            "NM": calc.NM,
            "NL": sum(l.NL_total for l in calc.linhas),
            "NI": sum(l.NI_total for l in calc.linhas),
            "NDJ": sum(l.NDJ for l in calc.linhas),
        },
        componentes=ComponenteRiscoOut(
            RA=calc.RA_g, RB=calc.RB_g, RC=calc.RC_g, RM=calc.RM_g,
            RU=calc.RU_g, RV=calc.RV_g, RW=calc.RW_g, RZ=calc.RZ_g,
        ),
        R1=calc.R1_global,
        R3=calc.R3_global,
        R4=calc.R4_global if req.calcular_r4 else None,
        frequencia_danos_total=calc.F_global,
        avaliacao=avaliacao,
        exige_protecao=exige_protecao(avaliar_conformidade(RiscosConsolidados(
            R1=calc.R1_global, R3=calc.R3_global, R4=calc.R4_global if req.calcular_r4 else None,
            F=calc.F_global, FT=calc.FT_global, detalhes={"F_atende": calc.F_atende},
        ))),
        recomendacao=_recomendacao_compat(calc),
    )
