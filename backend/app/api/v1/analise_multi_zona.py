"""
Endpoint de cálculo de análise de risco MULTI-ZONA.

Permite dividir a estrutura em zonas de estudo (ZS) conforme NBR 5419-2:2026,
Seção 6.7, e calcular os componentes de risco somados de todas as zonas.
"""
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.engine.areas import DimensoesEstrutura, calcular_AD, calcular_AI, calcular_AL, calcular_AM
from app.engine.avaliacao import avaliar_conformidade, exige_protecao
from app.engine.eventos import ParametrosLinha, calcular_ND, calcular_NI, calcular_NL, calcular_NM
from app.engine.perdas import EntradaPerdas, calcular_perdas_L1
from app.engine.probabilidades import EntradaProbabilidades, calcular_todas_probabilidades
from app.engine.frequencia_danos import calcular_frequencia_a_partir_de_probabilidades
from app.engine.riscos import ComponentesRisco, EntradaComponentes, RiscosConsolidados, avaliar_riscos, calcular_componentes
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

router = APIRouter()


class ZonaInput(BaseModel):
    """Uma zona de estudo ZS dentro da estrutura."""
    id: str
    nome: str
    tipo_piso: TipoPiso
    risco_incendio: RiscoIncendio = RiscoIncendio.NORMAL
    providencias_incendio: ProvidenciasIncendio = ProvidenciasIncendio.NENHUMA
    perigo_especial: PerigoEspecial = PerigoEspecial.NENHUM
    tipo_construcao: TipoConstrucao = TipoConstrucao.ALVENARIA_CONCRETO
    numero_pessoas_zona: int = Field(default=0, ge=0)
    numero_pessoas_total: int = Field(default=1, ge=1)
    horas_ano_presenca: float = Field(default=8760.0, ge=0, le=8760.0)

    # Medidas de proteção por zona (podem ser diferentes)
    spda_nivel: NivelProtecao = NivelProtecao.NENHUM
    dps_coordenados_nivel: NivelProtecao = NivelProtecao.NENHUM
    habilitar_f: bool = True
    ft_sistema: float = Field(default=0.1, gt=0)


class AnaliseMultiZonaRequest(BaseModel):
    nome_projeto: str
    NG: float = Field(gt=0)
    dimensoes: dict[str, float]  # L, W, H
    localizacao: LocalizacaoEstrutura
    tipo_estrutura: TipoEstrutura

    # Linha elétrica principal (compartilhada entre zonas)
    comprimento_linha_m: float = 1000
    instalacao_linha: TipoInstalacaoLinha = TipoInstalacaoLinha.AEREO
    tipo_linha: TipoLinhaEletrica = TipoLinhaEletrica.BT_SINAL
    ambiente_linha: AmbienteLinha = AmbienteLinha.URBANO
    tensao_UW_kV: float = 2.5

    zonas: list[ZonaInput]


@router.post("/analise-risco/calcular-multi-zona")
async def calcular_multi_zona(req: AnaliseMultiZonaRequest) -> dict[str, Any]:
    """
    Calcula a análise de risco para uma estrutura dividida em N zonas.

    Conforme NBR 5419-2:2026, 6.9.3: "O risco total R da estrutura é a soma
    dos componentes de risco aplicáveis para as várias zonas de estudo ZS".

    Retorna:
    - Componentes de risco consolidados (somados de todas as zonas)
    - R1 e R3 totais
    - Avaliação de conformidade
    - Detalhamento por zona
    """
    # 1. Áreas e eventos globais (aplicam-se a todas as zonas)
    dim = DimensoesEstrutura(
        L=req.dimensoes["L"], W=req.dimensoes["W"], H=req.dimensoes["H"],
    )
    AD = calcular_AD(dim)
    AM = calcular_AM(dim)
    AL = calcular_AL(req.comprimento_linha_m)
    AI = calcular_AI(req.comprimento_linha_m)

    params_linha = ParametrosLinha(
        comprimento_m=req.comprimento_linha_m,
        instalacao=req.instalacao_linha,
        tipo=req.tipo_linha,
        ambiente=req.ambiente_linha,
    )

    ND = calcular_ND(req.NG, AD, req.localizacao)
    NM = calcular_NM(req.NG, AM)
    NL = calcular_NL(req.NG, AL, params_linha)
    NI = calcular_NI(req.NG, AI, params_linha)

    # 2. Para cada zona: calcula Px, Lx, componentes de risco
    zonas_resultado: list[dict[str, Any]] = []
    soma_componentes = {
        "RA": 0.0, "RB": 0.0, "RC": 0.0, "RM": 0.0,
        "RU": 0.0, "RV": 0.0, "RW": 0.0, "RZ": 0.0,
    }
    F_total = 0.0
    zonas_fora_ft: list[str] = []

    for zona in req.zonas:
        # Probabilidades dessa zona (medidas de proteção específicas)
        ent_prob = EntradaProbabilidades(
            spda_nivel=zona.spda_nivel,
            dps_coordenados_nivel=zona.dps_coordenados_nivel,
            dps_classe_I_nivel=zona.dps_coordenados_nivel,
            tipo_roteamento_linha="AEREO_NAO_BLINDADO",
            tensao_UW_kV=req.tensao_UW_kV,
        )
        prob = calcular_todas_probabilidades(ent_prob)

        # Perdas dessa zona
        ent_perdas = EntradaPerdas(
            tipo_estrutura=req.tipo_estrutura,
            tipo_piso=zona.tipo_piso,
            risco_incendio=zona.risco_incendio,
            providencias_incendio=zona.providencias_incendio,
            perigo_especial=zona.perigo_especial,
            tipo_construcao=zona.tipo_construcao,
            numero_pessoas_zona=zona.numero_pessoas_zona,
            numero_pessoas_total=zona.numero_pessoas_total,
            horas_ano_presenca=zona.horas_ano_presenca,
        )
        perdas = calcular_perdas_L1(ent_perdas)

        # Componentes de risco da zona
        entrada = EntradaComponentes(
            ND=ND, NM=NM, NL=NL, NI=NI, NDJ=0,
            PA=prob.PA, PB=prob.PB, PC=prob.PC, PM=prob.PM,
            PU=prob.PU, PV=prob.PV, PW=prob.PW, PZ=prob.PZ,
            LA=perdas.LA, LB=perdas.LB, LC=perdas.LC, LM=perdas.LM,
            LU=perdas.LU, LV=perdas.LV, LW=perdas.LW, LZ=perdas.LZ,
        )
        comp_zona = calcular_componentes(entrada)

        # Frequência de danos da zona (Seção 7)
        freq_zona = calcular_frequencia_a_partir_de_probabilidades(
            ND=ND, NM=NM, NL=NL, NI=NI, NDJ=0, prob=prob,
        )
        F_zona = freq_zona.F_total if zona.habilitar_f else 0.0
        if zona.habilitar_f:
            F_total += F_zona
            if F_zona > zona.ft_sistema:
                zonas_fora_ft.append(f"{zona.nome}: F={F_zona:.3e} > FT={zona.ft_sistema:.3e}")

        # Acumula no total
        for k in soma_componentes:
            soma_componentes[k] += getattr(comp_zona, k)

        zonas_resultado.append({
            "id": zona.id,
            "nome": zona.nome,
            "componentes": comp_zona.resumo(),
            "R1_parcial": (
                comp_zona.RA + comp_zona.RB + comp_zona.RC
                + comp_zona.RM + comp_zona.RU + comp_zona.RV
                + comp_zona.RW + comp_zona.RZ
            ),
            "F": F_zona,
            "FT": zona.ft_sistema,
        })

    # 3. Risco total = soma dos componentes
    componentes_total = ComponentesRisco(**soma_componentes)
    riscos_base = avaliar_riscos(componentes_total, False, False)
    FT_global = min((z.ft_sistema for z in req.zonas if z.habilitar_f), default=0.1)
    F_atende = len(zonas_fora_ft) == 0
    riscos_total = RiscosConsolidados(
        R1=riscos_base.R1, R3=riscos_base.R3, R4=riscos_base.R4,
        F=F_total, FT=FT_global,
        detalhes={"F": F_total, "F_global": F_total, "FT": FT_global, "FT_global": FT_global, "F_atende": F_atende, "zonas_fora_ft": zonas_fora_ft},
    )
    avaliacao = avaliar_conformidade(riscos_total)

    return {
        "nome_projeto": req.nome_projeto,
        "areas_m2": {"AD": AD, "AM": AM, "AL": AL, "AI": AI},
        "numeros_eventos": {"ND": ND, "NM": NM, "NL": NL, "NI": NI},
        "componentes_totais": componentes_total.resumo(),
        "R1_total": riscos_total.R1,
        "R3_total": riscos_total.R3,
        "F_total": F_total,
        "FT_global": FT_global,
        "F_atende": F_atende,
        "zonas_fora_ft": zonas_fora_ft,
        "zonas": zonas_resultado,
        "avaliacao": [
            {
                "tipo_risco": getattr(r.tipo_risco, "value", r.tipo_risco),
                "valor_calculado": r.valor_calculado,
                "valor_tolerado": r.valor_tolerado,
                "status": r.status.value,
                "mensagem": r.mensagem,
                "razao": r.razao,
            }
            for r in avaliacao
        ],
        "exige_protecao": exige_protecao(avaliacao),
        "referencia_normativa": "NBR 5419-2:2026, Seção 6.7 a 6.9",
    }
