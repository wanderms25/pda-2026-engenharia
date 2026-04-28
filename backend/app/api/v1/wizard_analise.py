"""
Endpoint wizard — Análise de risco completa multi-zona com múltiplas linhas.
Suporta trechos SL, estrutura adjacente, L1/L3/L4 por zona, frequência F.
"""
import math
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.models.orm import Usuario
from app.engine.areas import (
    DimensoesEstrutura, calcular_AD, calcular_AI, calcular_AL, calcular_AM,
)
from app.engine.avaliacao import avaliar_conformidade
from app.engine.eventos import ParametrosLinha, calcular_ND, calcular_NI, calcular_NL, calcular_NM
from app.engine.perdas import EntradaPerdas, calcular_perdas_L1
from app.engine.probabilidades import EntradaProbabilidades, calcular_todas_probabilidades
from app.engine.riscos import EntradaComponentes, ComponentesRisco, calcular_componentes, RiscosConsolidados
from app.engine.frequencia_danos import calcular_frequencia_a_partir_de_probabilidades
from app.nbr5419.enums import (
    AmbienteLinha, LocalizacaoEstrutura, NivelProtecao, PerigoEspecial,
    ProvidenciasIncendio, RiscoIncendio, TipoConstrucao, TipoEstrutura,
    TipoInstalacaoLinha, TipoLinhaEletrica, TipoPiso,
)
from app.nbr5419.parte2_tabelas import (
    FATOR_LOCALIZACAO_CD,
    PROBABILIDADE_PB_CAPTACAO_NP1_ESTRUTURA_CONTINUA,
    PROBABILIDADE_PB_COBERTURA_METALICA_ESTRUTURA_CONTINUA,
    PROBABILIDADE_PTA,
    LF_L1_POR_ESTRUTURA,
)

router = APIRouter()


class TrechoInput(BaseModel):
    comprimento_m: float = 1000
    instalacao_ci: str = "AEREO"
    tipo_ct: str = "BT_SINAL"
    ambiente_ce: str = "URBANO_ALTAS"
    blindagem_rs: str = "AEREO_NAO_BLINDADO"
    uw_kv: float = 1.5


class EstruturaAdjacenteInput(BaseModel):
    l_adj: float = 0
    w_adj: float = 0
    h_adj: float = 0
    cdj: str = "CERCADA_MESMA_ALTURA"
    ct_adj: str = "BT_SINAL"


class LinhaWizardInput(BaseModel):
    id: str
    nome: str
    tipo_linha: str = "ENERGIA"
    ptu: str = "NENHUMA"
    peb: str = "NENHUM"
    cld_cli: str = "AEREO_NAO_BLINDADO"
    trechos: list[TrechoInput] = Field(default_factory=list)
    adjacente: EstruturaAdjacenteInput = Field(default_factory=EstruturaAdjacenteInput)


class ZonaWizardInput(BaseModel):
    id: str
    nome: str
    blindagem_espacial: bool = False
    ks3_energia: float = 1.0
    ks3_sinal: float = 1.0
    pspd: str = "NENHUM"
    hz: str = "NENHUM"
    nz: int = 0
    tz_horas_ano: float = 8760.0
    lf_tipo: str | None = None
    lo: float = 0.0
    rt: str = "MARMORE_CERAMICA"
    rf: str = "NORMAL"
    rp: str = "NENHUMA"
    habilitar_f: bool = True
    sistema_interno_ft: float = 0.1


class WizardRequest(BaseModel):
    nome_projeto: str = ""
    obra_cliente: str = ""
    responsavel_tecnico: str = ""
    art_rt_trt: str = ""
    endereco: str = ""
    NG: float = Field(gt=0)
    L: float = Field(gt=0)
    W: float = Field(gt=0)
    H: float = Field(gt=0)
    Hp: float = 0.0
    fachada_vidro: bool = False
    localizacao: str = "CERCADA_MESMA_ALTURA"
    pb_nivel: str = "NENHUM"
    pb_especial: str | None = None
    rs_tipo: str = "ALVENARIA_CONCRETO"
    nt: int = 1
    lf_tipo: str = "OUTROS"
    pta_tipo: str = "NENHUMA"
    linhas: list[LinhaWizardInput] = Field(default_factory=list)
    zonas: list[ZonaWizardInput] = Field(default_factory=list)


# ── Enum helpers ──────────────────────────────────────────────────────────────

_LOC = {k.value: k for k in LocalizacaoEstrutura}
_TE  = {k.value: k for k in TipoEstrutura}
_TP  = {k.value: k for k in TipoPiso}
_RI  = {k.value: k for k in RiscoIncendio}
_RP  = {k.value: k for k in ProvidenciasIncendio}
_PE  = {k.value: k for k in PerigoEspecial}
_NP  = {k.value: k for k in NivelProtecao}
_TC  = {k.value: k for k in TipoConstrucao}
_INST= {k.value: k for k in TipoInstalacaoLinha}
_TL  = {k.value: k for k in TipoLinhaEletrica}
_AMB = {k.value: k for k in AmbienteLinha}


def _pb_value(req: WizardRequest) -> float:
    if req.pb_especial == "NP1_METALICA":
        return PROBABILIDADE_PB_CAPTACAO_NP1_ESTRUTURA_CONTINUA
    if req.pb_especial == "COBERTURA_METALICA":
        return PROBABILIDADE_PB_COBERTURA_METALICA_ESTRUTURA_CONTINUA
    return {
        "NENHUM": 1.0, "IV": 0.20, "III": 0.10, "II": 0.05, "I": 0.02,
    }.get(req.pb_nivel, 1.0)


def _rs_value(req: WizardRequest) -> float:
    return {"ALVENARIA_CONCRETO": 1.0, "MADEIRA": 2.0}.get(req.rs_tipo, 1.0)


def _calc_trecho_events(NG: float, t: TrechoInput):
    inst = _INST.get(t.instalacao_ci, TipoInstalacaoLinha.AEREO)
    tipo = _TL.get(t.tipo_ct, TipoLinhaEletrica.BT_SINAL)
    amb  = _AMB.get(t.ambiente_ce, AmbienteLinha.URBANO_ESTRUTURAS_ALTAS)
    AL = calcular_AL(t.comprimento_m)
    AI = calcular_AI(t.comprimento_m)
    params = ParametrosLinha(comprimento_m=t.comprimento_m, instalacao=inst, tipo=tipo, ambiente=amb)
    return calcular_NL(NG, AL, params), calcular_NI(NG, AI, params)


def _calc_ndj(NG: float, adj: EstruturaAdjacenteInput) -> float:
    if adj.l_adj <= 0 or adj.w_adj <= 0 or adj.h_adj <= 0:
        return 0.0
    try:
        from app.engine.areas import calcular_ADJ
        from app.engine.eventos import calcular_NDJ
        dim_adj = DimensoesEstrutura(L=adj.l_adj, W=adj.w_adj, H=adj.h_adj)
        ADJ = calcular_ADJ(dim_adj)
        loc_adj = _LOC.get(adj.cdj, LocalizacaoEstrutura.CERCADA_MESMA_ALTURA)
        return calcular_NDJ(NG, ADJ, loc_adj)
    except Exception:
        return 0.0


@router.post("/analise-risco/wizard")
async def calcular_wizard(req: WizardRequest) -> dict[str, Any]:
    """Cálculo completo multi-zona com múltiplas linhas — wizard NBR 5419-2:2026."""

    # ── Áreas e eventos globais ───────────────────────────────────────────────
    dim = DimensoesEstrutura(
        L=req.L, W=req.W, H=req.H,
        H_saliencia=req.Hp if req.Hp > 0 else None,
    )
    AD = calcular_AD(dim)
    AM = calcular_AM(dim)

    loc = _LOC.get(req.localizacao, LocalizacaoEstrutura.CERCADA_MESMA_ALTURA)
    CD  = FATOR_LOCALIZACAO_CD[loc]
    ND  = calcular_ND(req.NG, AD, loc)
    NM  = calcular_NM(req.NG, AM)

    # ── Eventos por linha ─────────────────────────────────────────────────────
    linhas_ev: list[dict] = []
    for linha in req.linhas:
        NL_l = NI_l = AL_l = AI_l = 0.0
        for t in linha.trechos:
            nl, ni = _calc_trecho_events(req.NG, t)
            NL_l += nl
            NI_l += ni
            AL_l += calcular_AL(t.comprimento_m)
            AI_l += calcular_AI(t.comprimento_m)
        NDJ_l = _calc_ndj(req.NG, linha.adjacente)
        linhas_ev.append({
            "id": linha.id, "nome": linha.nome, "tipo": linha.tipo_linha,
            "AL": AL_l, "AI": AI_l,
            "NL": NL_l, "NI": NI_l, "NDJ": NDJ_l,
        })

    NL_total  = sum(e["NL"]  for e in linhas_ev)
    NI_total  = sum(e["NI"]  for e in linhas_ev)
    NDJ_total = sum(e["NDJ"] for e in linhas_ev)

    # ── Fatores globais ───────────────────────────────────────────────────────
    PB  = _pb_value(req)
    rs  = _rs_value(req)
    pta = PROBABILIDADE_PTA.get(req.pta_tipo, 1.0)
    te  = _TE.get(req.lf_tipo, TipoEstrutura.OUTROS)
    LF_global = LF_L1_POR_ESTRUTURA.get(te, 1e-2)

    # ── Zonas ─────────────────────────────────────────────────────────────────
    zonas = req.zonas if req.zonas else [ZonaWizardInput(id="ZS01", nome="Zona 01")]

    R1_total = 0.0
    F_total  = 0.0
    zonas_resultado: list[dict] = []
    comp_global = {k: 0.0 for k in ["RA","RB","RC","RM","RU","RV","RW","RZ"]}

    for zona in zonas:
        tp  = _TP.get(zona.rt, TipoPiso.MARMORE_CERAMICA)
        ri  = _RI.get(zona.rf, RiscoIncendio.NORMAL)
        rp  = _RP.get(zona.rp, ProvidenciasIncendio.NENHUMA)
        pe  = _PE.get(zona.hz, PerigoEspecial.NENHUM)
        pspd_np = _NP.get(zona.pspd, NivelProtecao.NENHUM)

        te_z = _TE.get(zona.lf_tipo, te) if zona.lf_tipo else te
        nt_z = max(req.nt, zona.nz) if req.nt > 0 else max(1, zona.nz)

        # Probabilidades
        ent_prob = EntradaProbabilidades(
            spda_nivel=NivelProtecao.NENHUM,
            dps_coordenados_nivel=pspd_np,
            avisos_alerta=(req.pta_tipo == "AVISOS_ALERTA"),
            isolacao_eletrica_descida=(req.pta_tipo == "ISOLACAO_ELETRICA_DESCIDA"),
            malha_equipotencializacao_solo=(req.pta_tipo == "MALHA_EQUIPOTENCIALIZACAO_SOLO"),
            descida_natural_estrutura_continua=(req.pta_tipo == "ESTRUTURA_METALICA_DESCIDA_NATURAL"),
            restricoes_fisicas_fixas=(req.pta_tipo == "RESTRICOES_FISICAS_FIXAS"),
        )
        probs = calcular_todas_probabilidades(ent_prob)
        # Override PB com valor calculado (inclui casos especiais)
        from dataclasses import replace as dc_replace
        probs = dc_replace(probs, PB=PB)

        # Perdas L1
        ent_perdas = EntradaPerdas(
            tipo_estrutura=te_z,
            tipo_piso=tp,
            risco_incendio=ri,
            providencias_incendio=rp,
            perigo_especial=pe,
            tipo_construcao=_TC.get(req.rs_tipo, TipoConstrucao.ALVENARIA_CONCRETO),
            risco_vida_imediato_por_falha=False,
            numero_pessoas_zona=zona.nz,
            numero_pessoas_total=nt_z,
            horas_ano_presenca=zona.tz_horas_ano,
        )
        perdas = calcular_perdas_L1(ent_perdas)

        # Componentes de risco
        ent_comp = EntradaComponentes(
            ND=ND, NM=NM, NL=NL_total, NI=NI_total, NDJ=NDJ_total,
            PA=probs.PA, PB=probs.PB, PC=probs.PC, PM=probs.PM,
            PU=probs.PU, PV=probs.PV, PW=probs.PW, PZ=probs.PZ,
            LA=perdas.LA, LB=perdas.LB, LC=perdas.LC, LM=perdas.LM,
            LU=perdas.LU, LV=perdas.LV, LW=perdas.LW, LZ=perdas.LZ,
        )
        comp = calcular_componentes(ent_comp)
        R1_zona = comp.RA+comp.RB+comp.RC+comp.RM+comp.RU+comp.RV+comp.RW+comp.RZ

        # Frequência F
        F_zona = 0.0
        if zona.habilitar_f:
            freq_result = calcular_frequencia_a_partir_de_probabilidades(
                ND, NM, NL_total, NI_total, NDJ_total, probs,
            )
            F_zona = freq_result.F_total

        # Contribuição por linha
        contrib = []
        for le in linhas_ev:
            ent_l = EntradaComponentes(
                ND=0, NM=0, NL=le["NL"], NI=le["NI"], NDJ=le["NDJ"],
                PA=probs.PA, PB=probs.PB, PC=probs.PC, PM=probs.PM,
                PU=probs.PU, PV=probs.PV, PW=probs.PW, PZ=probs.PZ,
                LA=perdas.LA, LB=perdas.LB, LC=perdas.LC, LM=perdas.LM,
                LU=perdas.LU, LV=perdas.LV, LW=perdas.LW, LZ=perdas.LZ,
            )
            cl = calcular_componentes(ent_l)
            contrib.append({
                "nome": le["nome"], "tipo": le["tipo"],
                "RU": cl.RU, "RV": cl.RV, "RW": cl.RW, "RZ": cl.RZ,
                # Frequências parciais conforme Tabela 7: FV usa PEB, não PV.
                "FV": (le["NL"] + le["NDJ"]) * probs.PEB,
                "FW": (le["NL"] + le["NDJ"]) * probs.PW,
                "FZ": le["NI"] * probs.PZ,
            })

        for k, v in {"RA":comp.RA,"RB":comp.RB,"RC":comp.RC,"RM":comp.RM,
                     "RU":comp.RU,"RV":comp.RV,"RW":comp.RW,"RZ":comp.RZ}.items():
            comp_global[k] += v

        R1_total += R1_zona
        F_total  += F_zona

        zonas_resultado.append({
            "id": zona.id, "nome": zona.nome,
            "R1": R1_zona, "F": F_zona, "FT": zona.sistema_interno_ft,
            "componentes": {
                "RA":comp.RA,"RB":comp.RB,"RC":comp.RC,"RM":comp.RM,
                "RU":comp.RU,"RV":comp.RV,"RW":comp.RW,"RZ":comp.RZ,
            },
            "perdas": {
                "LA":perdas.LA,"LB":perdas.LB,"LC":perdas.LC,"LO":0.0,
                "rf":0.0,"rp":0.0,"rt":0.0,"fp":zona.tz_horas_ano/8760,"rS":rs,
            },
            "contribuicao_linhas": contrib,
        })

    # ── Avaliação ─────────────────────────────────────────────────────────────
    RT = 1e-5
    FT_global = min((z.sistema_interno_ft for z in zonas if z.habilitar_f), default=0.1)
    atende_R1 = R1_total <= RT
    atende_F  = F_total  <= FT_global

    # Componente dominante
    dom = max(comp_global, key=lambda k: comp_global[k])
    dom_msgs = {
        "RB": "RB domina — verifique NP do SPDA, DPS Classe I, rf e rp.",
        "RM": "RM domina — verifique blindagem espacial e DPS coordenados.",
        "RW": "RW domina — verifique blindagem da linha e DPS na entrada.",
        "RC": "RC domina — instale DPS coordenados NP I e blindagem espacial.",
        "RU": "RU domina — verifique PTU e ligações equipotenciais.",
        "RV": "RV domina — DPS Classe I e blindagem da linha exterior.",
        "RZ": "RZ domina — DPS internos e blindagem da linha.",
        "RA": "RA domina — avisos de alerta e malha equipotencial.",
    }
    recomendacoes = []
    if not atende_R1:
        recomendacoes.append(
            f"R1={R1_total:.2e} > RT={RT:.0e}: Adote medidas de proteção. "
            + dom_msgs.get(dom, "")
        )
    if not atende_F:
        recomendacoes.append(
            f"F={F_total:.2e} > FT={FT_global:.0e}: Verifique SPDA, DPS, blindagem espacial."
        )

    return {
        "R1_total": R1_total,
        "F_total":  F_total,
        "R3_total": 0.0,
        "RT": RT,
        "FT_global": FT_global,
        "atende_R1": atende_R1,
        "atende_F":  atende_F,
        "areas": {"AD": AD, "AM": AM, "AL": sum(e["AL"] for e in linhas_ev), "AI": sum(e["AI"] for e in linhas_ev)},
        "eventos": {
            "ND": ND, "NM": NM,
            "por_linha": [
                {"nome": e["nome"], "tipo": e["tipo"],
                 "AL": e["AL"], "AI": e["AI"],
                 "NL": e["NL"], "NI": e["NI"], "NDJ": e["NDJ"]}
                for e in linhas_ev
            ],
        },
        "estrutura": {
            "L": req.L, "W": req.W, "H": req.H, "Hp": req.Hp,
            "CD": CD, "PB": PB, "rS": rs, "nt": req.nt, "NG": req.NG,
            "AD": AD, "ND": ND, "AM": AM, "NM": NM,
            "AL": sum(e["AL"] for e in linhas_ev), "AI": sum(e["AI"] for e in linhas_ev),
        },
        "zonas_resultado": zonas_resultado,
        "componentes_globais": comp_global,
        "dominante": dom,
        "recomendacoes": recomendacoes,
    }
