"""
Endpoint legado de análise de risco MULTI-ZONA.

Mantém o contrato /api/v1/analise-risco/calcular-multi-zona, mas delega o
cálculo para app.engine.calculo_completo.calcular_pda, evitando duplicidade
normativa entre endpoints.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from app.engine.avaliacao import avaliar_conformidade, exige_protecao
from app.engine.calculo_completo import calcular_pda
from app.engine.riscos import RiscosConsolidados
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
from app.nbr5419.parte2_linhas import validar_uw_linha_calculo_completo
from app.nbr5419.parte2_tabelas import (
    FATOR_HZ,
    FATOR_RF,
    FATOR_RP,
    FATOR_RT,
    LF_L1_POR_ESTRUTURA,
    PROBABILIDADE_PB,
    PROBABILIDADE_PSPD,
)
from app.schemas.calcular import CalcRequest, EstAdjIn, EstruturaPDA, LinhaIn, TrechoSLIn, ZonaIn

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

    # Medidas de proteção por zona (mantidas por compatibilidade do endpoint legado)
    spda_nivel: NivelProtecao = NivelProtecao.NENHUM
    dps_coordenados_nivel: NivelProtecao = NivelProtecao.NENHUM
    habilitar_f: bool = True
    ft_sistema: float = Field(default=0.1, gt=0)
    zpr0a: bool = False


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

    @field_validator("tensao_UW_kV")
    @classmethod
    def validar_uw(cls, value: float) -> float:
        try:
            return validar_uw_linha_calculo_completo(value)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc


def _tipo_linha_calc(tipo_ct: TipoLinhaEletrica) -> str:
    """
    O contrato legado usa CT (BT_SINAL/AT_COM_TRAFO), não ENERGIA/SINAL.
    Mantém ENERGIA como padrão conservador para compatibilidade com o motor antigo.
    """
    return "ENERGIA"


def _build_calc_request(req: AnaliseMultiZonaRequest) -> CalcRequest:
    total_pessoas = max((z.numero_pessoas_total for z in req.zonas), default=1)
    tipo_estrutura = req.tipo_estrutura.value

    linha = LinhaIn(
        id="L01",
        nome="Linha principal",
        tipo_linha=_tipo_linha_calc(req.tipo_linha),
        ptu="NENHUMA",
        peb="NENHUM",
        cld_cli="AEREO_NAO_BLINDADO",
        trechos=[
            TrechoSLIn(
                id="L01-SL01",
                comprimento_m=req.comprimento_linha_m,
                instalacao_ci=req.instalacao_linha.value,
                tipo_ct=req.tipo_linha.value,
                ambiente_ce=req.ambiente_linha.value,
                blindagem_rs="AEREO_NAO_BLINDADO",
                uw_kv=req.tensao_UW_kV,
            )
        ],
        adj=EstAdjIn(),
    )

    zonas: list[ZonaIn] = []
    for zona in req.zonas:
        lf = LF_L1_POR_ESTRUTURA.get(req.tipo_estrutura, LF_L1_POR_ESTRUTURA[TipoEstrutura.OUTROS])
        zonas.append(
            ZonaIn(
                id=zona.id,
                nome=zona.nome,
                nz=zona.numero_pessoas_zona,
                tz_mode="h_ano",
                tz_valor=zona.horas_ano_presenca,
                rt=FATOR_RT[zona.tipo_piso],
                rf=FATOR_RF[zona.risco_incendio],
                rp=FATOR_RP[zona.providencias_incendio],
                hz=FATOR_HZ[zona.perigo_especial],
                lf_valor=lf,
                lf_custom=True,
                tem_lo=req.tipo_estrutura == TipoEstrutura.RISCO_EXPLOSAO,
                pspd=PROBABILIDADE_PSPD[zona.dps_coordenados_nivel],
                habilitar_f=zona.habilitar_f,
                ft_sistema=zona.ft_sistema,
                zpr0a=zona.zpr0a,
                pb=PROBABILIDADE_PB[zona.spda_nivel],
                pta=1.0,
                peb=zona.dps_coordenados_nivel.value if zona.dps_coordenados_nivel != NivelProtecao.NENHUM else "NENHUM",
            )
        )

    estrutura = EstruturaPDA(
        L=req.dimensoes["L"],
        W=req.dimensoes["W"],
        H=req.dimensoes["H"],
        NG=req.NG,
        loc=req.localizacao.value,
        pb=1.0,
        pta=1.0,
        nt=total_pessoas,
        tipo_estrutura=tipo_estrutura,
        tipo_construcao=TipoConstrucao.ALVENARIA_CONCRETO.value,
    )
    return CalcRequest(estrutura=estrutura, zonas=zonas, linhas=[linha])


@router.post("/analise-risco/calcular-multi-zona", deprecated=True)
async def calcular_multi_zona(req: AnaliseMultiZonaRequest) -> dict[str, Any]:
    """
    Adaptador multizona legado para o motor central /calcular.
    """
    calc_req = _build_calc_request(req)
    calc = calcular_pda(calc_req)

    riscos_total = RiscosConsolidados(
        R1=calc.R1_global,
        R3=calc.R3_global,
        R4=calc.R4_global,
        F=calc.F_global,
        FT=calc.FT_global,
        detalhes={"F_atende": calc.F_atende, "zonas_fora_ft": calc.zonas_fora_ft},
    )
    avaliacao = avaliar_conformidade(riscos_total)

    zonas_resultado: list[dict[str, Any]] = []
    for zin, zout in zip(calc_req.zonas, calc.zonas):
        zonas_resultado.append({
            "id": zout.id,
            "nome": zout.nome,
            "componentes": {
                "RA": zout.RA, "RB": zout.RB, "RC": zout.RC, "RM": zout.RM,
                "RU": zout.RU, "RV": zout.RV, "RW": zout.RW, "RZ": zout.RZ,
            },
            "R1_parcial": zout.R1,
            "R3_parcial": zout.R3,
            "F": zout.F,
            "FT": zin.ft_sistema,
            "linhas_contrib": [lc.model_dump() for lc in zout.linhas_contrib],
        })

    return {
        "nome_projeto": req.nome_projeto,
        "areas_m2": {"AD": calc.AD, "AM": calc.AM, "AL": calc.AL, "AI": calc.AI},
        "numeros_eventos": {
            "ND": calc.ND,
            "NM": calc.NM,
            "NL": sum(l.NL_total for l in calc.linhas),
            "NI": sum(l.NI_total for l in calc.linhas),
            "NDJ": sum(l.NDJ for l in calc.linhas),
        },
        "componentes_totais": {
            "RA": calc.RA_g, "RB": calc.RB_g, "RC": calc.RC_g, "RM": calc.RM_g,
            "RU": calc.RU_g, "RV": calc.RV_g, "RW": calc.RW_g, "RZ": calc.RZ_g,
        },
        "R1_total": calc.R1_global,
        "R3_total": calc.R3_global,
        "F_total": calc.F_global,
        "FT_global": calc.FT_global,
        "F_atende": calc.F_atende,
        "zonas_fora_ft": calc.zonas_fora_ft,
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
        "referencia_normativa": "NBR 5419-2:2026, Seções 6.7 a 6.9 e Seção 7",
        "calc_unificado": calc.model_dump(),
    }
