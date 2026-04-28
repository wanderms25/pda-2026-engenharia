"""
Endpoint principal de análise de risco com recomendação automática.

Retorna não só o cálculo do R1/R3/F, mas também a configuração mínima de
proteção que atinge 100% de conformidade e os passos acionáveis para o
engenheiro aplicar.
"""
from fastapi import APIRouter

from app.engine.areas import (
    DimensoesEstrutura, calcular_AD, calcular_AI, calcular_AL,
    calcular_AL_enterrada_alta_resistividade, calcular_AM,
)
from app.engine.avaliacao import avaliar_conformidade, exige_protecao
from app.engine.eventos import (
    ParametrosLinha, calcular_ND, calcular_NI, calcular_NL, calcular_NM,
)
from app.engine.frequencia_danos import calcular_frequencia_a_partir_de_probabilidades
from app.engine.perdas import EntradaPerdas, calcular_perdas_L1
from app.engine.probabilidades import (
    EntradaProbabilidades, calcular_todas_probabilidades,
)
from app.engine.recomendador import recomendar_protecao_minima
from app.engine.riscos import (
    EntradaComponentes, RiscosConsolidados, avaliar_riscos, calcular_componentes,
)
from app.nbr5419.enums import TipoInstalacaoLinha
from app.schemas.analise_risco import (
    AnaliseRiscoRequest,
    AnaliseRiscoResponse,
    ComponenteRiscoOut,
    ResultadoAvaliacaoOut,
)

router = APIRouter()


@router.post("/calcular", response_model=AnaliseRiscoResponse)
async def calcular_analise_risco(req: AnaliseRiscoRequest) -> AnaliseRiscoResponse:
    """
    Calcula a análise de risco completa para uma estrutura conforme NBR 5419-2:2026.

    Além do resultado, já devolve automaticamente a recomendação de proteção
    mínima para atingir 100% de conformidade (se a estrutura não estiver conforme).
    """
    # 1. Áreas (Anexo A)
    dim = DimensoesEstrutura(
        L=req.dimensoes.L, W=req.dimensoes.W, H=req.dimensoes.H,
        H_saliencia=req.dimensoes.H_saliencia,
    )
    AD = calcular_AD(dim)
    AM = calcular_AM(dim)

    AL = AI = NL = NI = 0.0
    if req.linhas:
        linha = req.linhas[0]
        if (
            linha.instalacao == TipoInstalacaoLinha.ENTERRADO
            and linha.resistividade_solo_ohm_m
            and linha.resistividade_solo_ohm_m > 400
        ):
            AL = calcular_AL_enterrada_alta_resistividade(
                linha.comprimento_m, linha.resistividade_solo_ohm_m
            )
        else:
            AL = calcular_AL(linha.comprimento_m)
        AI = calcular_AI(linha.comprimento_m)
        params_linha = ParametrosLinha(
            comprimento_m=linha.comprimento_m,
            instalacao=linha.instalacao,
            tipo=linha.tipo,
            ambiente=linha.ambiente,
        )
        NL = calcular_NL(req.NG, AL, params_linha)
        NI = calcular_NI(req.NG, AI, params_linha)

    # 2. Eventos
    ND = calcular_ND(req.NG, AD, req.localizacao)
    NM = calcular_NM(req.NG, AM)
    NDJ = 0.0

    # 3. Probabilidades (cenário atual do usuário)
    ent_prob = EntradaProbabilidades(
        spda_nivel=req.medidas.spda_nivel,
        dps_coordenados_nivel=req.medidas.dps_coordenados_nivel,
        dps_classe_I_nivel=req.medidas.dps_classe_I_entrada,
        avisos_alerta=req.medidas.aviso_alerta_toque_passo,
        isolacao_eletrica_descida=req.medidas.isolacao_eletrica_descida,
        malha_equipotencializacao_solo=req.medidas.malha_equipotencializacao_solo,
        descida_natural_estrutura_continua=req.medidas.descida_natural_estrutura_continua,
        tensao_UW_kV=req.linhas[0].tensao_suportavel_UW_kV if req.linhas else 2.5,
    )
    prob = calcular_todas_probabilidades(ent_prob)

    # 4. Perdas
    f = req.fatores
    ent_perdas = EntradaPerdas(
        tipo_estrutura=f.tipo_estrutura,
        tipo_piso=f.tipo_piso,
        risco_incendio=f.risco_incendio,
        providencias_incendio=f.providencias_incendio,
        perigo_especial=f.perigo_especial,
        tipo_construcao=f.tipo_construcao,
        numero_pessoas_zona=f.numero_pessoas_zona,
        numero_pessoas_total=f.numero_pessoas_total,
        horas_ano_presenca=f.horas_ano_presenca,
        risco_vida_imediato_por_falha=f.risco_explosao_ou_vida_imediata,
        calcular_l4=req.calcular_r4,
    )
    perdas_l1 = calcular_perdas_L1(ent_perdas)

    # 5. Componentes e riscos
    entrada = EntradaComponentes(
        ND=ND, NM=NM, NL=NL, NI=NI, NDJ=NDJ,
        PA=prob.PA, PB=prob.PB, PC=prob.PC, PM=prob.PM,
        PU=prob.PU, PV=prob.PV, PW=prob.PW, PZ=prob.PZ,
        LA=perdas_l1.LA, LB=perdas_l1.LB, LC=perdas_l1.LC, LM=perdas_l1.LM,
        LU=perdas_l1.LU, LV=perdas_l1.LV, LW=perdas_l1.LW, LZ=perdas_l1.LZ,
    )
    componentes = calcular_componentes(entrada)
    riscos = avaliar_riscos(
        componentes,
        risco_explosao_ou_vida_imediata=f.risco_explosao_ou_vida_imediata,
        calcular_r4=req.calcular_r4,
    )

    # 6. Frequência de danos F
    freq = calcular_frequencia_a_partir_de_probabilidades(
        ND=ND, NM=NM, NL=NL, NI=NI, NDJ=NDJ, prob=prob,
    )

    # 7. Avaliação de conformidade
    detalhes_freq = dict(getattr(riscos, "detalhes", {}) or {})
    detalhes_freq.update({"F": freq.F_total, "F_global": freq.F_total, "FT": 0.1, "FT_global": 0.1, "F_atende": freq.F_total <= 0.1})
    riscos = RiscosConsolidados(R1=riscos.R1, R3=riscos.R3, R4=riscos.R4, F=freq.F_total, FT=0.1, detalhes=detalhes_freq)
    avaliacao = avaliar_conformidade(riscos)
    exige = exige_protecao(avaliacao)

    # 8. RECOMENDAÇÃO AUTOMÁTICA — sempre executa para mostrar o caminho ao 100%
    recomendacao = recomendar_protecao_minima(
        ND=ND, NM=NM, NL=NL, NI=NI, NDJ=NDJ,
        perdas=perdas_l1,
        tipo_roteamento_linha=req.linhas[0].instalacao.value if req.linhas else "AEREO_NAO_BLINDADO",
        tensao_UW_kV=req.linhas[0].tensao_suportavel_UW_kV if req.linhas else 2.5,
        risco_explosao_ou_vida_imediata=f.risco_explosao_ou_vida_imediata,
    )

    return AnaliseRiscoResponse(
        nome_projeto=req.nome_projeto,
        areas_m2={"AD": AD, "AM": AM, "AL": AL, "AI": AI},
        numeros_eventos={"ND": ND, "NM": NM, "NL": NL, "NI": NI},
        componentes=ComponenteRiscoOut(**componentes.resumo()),
        R1=riscos.R1,
        R3=riscos.R3,
        R4=riscos.R4,
        frequencia_danos_total=freq.F_total,
        avaliacao=[
            ResultadoAvaliacaoOut(
                tipo_risco=getattr(r.tipo_risco, "value", r.tipo_risco),
                valor_calculado=r.valor_calculado,
                valor_tolerado=r.valor_tolerado,
                status=r.status.value,
                mensagem=r.mensagem,
                razao=r.razao,
            )
            for r in avaliacao
        ],
        exige_protecao=exige,
        recomendacao=recomendacao.para_dict(),
    )
