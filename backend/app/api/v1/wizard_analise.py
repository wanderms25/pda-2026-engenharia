"""
Endpoint wizard — compatibilidade de API para análise de risco multi-zona.

A partir desta versão, este endpoint NÃO possui motor próprio de cálculo.
Ele apenas converte o payload legado do wizard para o contrato de /calcular,
chama app.engine.calculo_completo.calcular_pda e adapta a resposta para o
formato que telas/laudos antigos esperam.

Regra de manutenção: qualquer alteração normativa deve ser feita em
app.engine.calculo_completo, nunca neste adaptador.
"""
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field, model_validator

from app.engine.calculo_completo import calcular_pda
from app.nbr5419.enums import (
    PerigoEspecial,
    ProvidenciasIncendio,
    RiscoIncendio,
    TipoConstrucao,
    TipoEstrutura,
    TipoPiso,
)
from app.nbr5419.parte2_linhas import validar_uw_linha_calculo_completo
from app.nbr5419.parte2_tabelas import (
    FATOR_HZ,
    FATOR_RF,
    FATOR_RP,
    FATOR_RS,
    FATOR_RT,
    LF_L1_POR_ESTRUTURA,
    PROBABILIDADE_PB_CAPTACAO_NP1_ESTRUTURA_CONTINUA,
    PROBABILIDADE_PB_COBERTURA_METALICA_ESTRUTURA_CONTINUA,
    PROBABILIDADE_PTA,
)
from app.schemas.calcular import (
    CalcRequest,
    CalcResponse,
    EstAdjIn,
    EstruturaPDA,
    LinhaIn,
    TrechoSLIn,
    ZonaIn,
)

router = APIRouter()


# Tabela B.3 — PSPD por nível do sistema coordenado de DPS.
_CD_MAP: dict[str, float] = {
    "CERCADA_OBJETOS_MAIS_ALTOS": 0.25,
    "CERCADA_MESMA_ALTURA": 0.50,
    "ISOLADA": 1.00,
    "ISOLADA_TOPO_COLINA": 2.00,
}


_PSPD_MAP: dict[str, float] = {
    "NENHUM": 1.0,
    "IV": 0.05,
    "III": 0.05,
    "II": 0.02,
    "I": 0.01,
    "NP1_PLUS": 0.005,
    "NP1_MAX": 0.001,
}

# O wizard antigo usava este texto, mas o schema unificado usa o valor do enum.
_TIPO_CONSTRUCAO_ALIASES: dict[str, str] = {
    "ALVENARIA_CONCRETO": TipoConstrucao.ALVENARIA_CONCRETO.value,
    "ALV_CONCRETO": TipoConstrucao.ALVENARIA_CONCRETO.value,
    "METALICA": TipoConstrucao.METALICA.value,
    "MADEIRA": TipoConstrucao.MADEIRA.value,
}


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

    @model_validator(mode="after")
    def validar_tensoes_uw_trechos(self):
        for idx, trecho in enumerate(self.trechos, start=1):
            try:
                validar_uw_linha_calculo_completo(trecho.uw_kv)
            except ValueError as exc:
                raise ValueError(f"Linha {self.id}, trecho {idx}: {exc}") from exc
        return self


class ZonaWizardInput(BaseModel):
    id: str
    nome: str

    # KS1/KS2 — blindagem espacial/malha.
    wm1: float = 0.0
    blindagem_espacial: bool = False
    wm2: float = 0.0

    # KS3 por sistema interno.
    ks3_energia: float = 1.0
    ks3_sinal: float = 1.0

    # KS4 — tensão suportável do equipamento.
    uw_equip_kv: float = 1.5

    # Tabela B.3 — DPS coordenados.
    pspd: str = "NENHUM"

    # Fatores de perda L1.
    hz: str = "NENHUM"
    nz: int = 0
    tz_horas_ano: float = 8760.0
    lf_tipo: str | None = None
    lo: float = 0.0
    rt: str = "MARMORE_CERAMICA"
    rf: str = "NORMAL"
    rp: str = "NENHUMA"

    # Frequência F.
    habilitar_f: bool = True
    sistema_interno_ft: float = 0.1
    zpr0a: bool = False


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


def _enum_value(enum_cls, value: str, default: str) -> str:
    """Aceita tanto o nome do enum quanto o valor serializado."""
    if value in enum_cls.__members__:
        return enum_cls[value].value
    for member in enum_cls:
        if member.value == value:
            return member.value
    return default


def _enum_member(enum_cls, value: str, default_member):
    if value in enum_cls.__members__:
        return enum_cls[value]
    for member in enum_cls:
        if member.value == value:
            return member
    return default_member


def _tipo_estrutura_value(value: str | None) -> str:
    return _enum_value(TipoEstrutura, value or TipoEstrutura.OUTROS.value, TipoEstrutura.OUTROS.value)


def _tipo_construcao_value(value: str) -> str:
    return _TIPO_CONSTRUCAO_ALIASES.get(value, TipoConstrucao.ALVENARIA_CONCRETO.value)


def _pb_value(req: WizardRequest) -> float:
    if req.pb_especial == "NP1_METALICA":
        return PROBABILIDADE_PB_CAPTACAO_NP1_ESTRUTURA_CONTINUA
    if req.pb_especial == "COBERTURA_METALICA":
        return PROBABILIDADE_PB_COBERTURA_METALICA_ESTRUTURA_CONTINUA
    return {"NENHUM": 1.0, "IV": 0.20, "III": 0.10, "II": 0.05, "I": 0.02}.get(req.pb_nivel, 1.0)


def _lf_l1_value(tipo_estrutura: str) -> float:
    member = _enum_member(TipoEstrutura, tipo_estrutura, TipoEstrutura.OUTROS)
    return LF_L1_POR_ESTRUTURA.get(member, 1e-2)


def _build_calc_request(req: WizardRequest) -> CalcRequest:
    tipo_estrutura_global = _tipo_estrutura_value(req.lf_tipo)
    tipo_construcao = _tipo_construcao_value(req.rs_tipo)

    linhas: list[LinhaIn] = []
    for linha in req.linhas:
        trechos = [
            TrechoSLIn(
                id=f"{linha.id}-SL{idx}",
                comprimento_m=t.comprimento_m,
                instalacao_ci=t.instalacao_ci,
                tipo_ct=t.tipo_ct,
                ambiente_ce=t.ambiente_ce,
                blindagem_rs=t.blindagem_rs,
                uw_kv=t.uw_kv,
            )
            for idx, t in enumerate(linha.trechos, start=1)
        ]
        linhas.append(
            LinhaIn(
                id=linha.id,
                nome=linha.nome,
                tipo_linha=linha.tipo_linha,
                ptu=linha.ptu,
                peb=linha.peb,
                cld_cli=linha.cld_cli,
                trechos=trechos,
                adj=EstAdjIn(
                    l_adj=linha.adjacente.l_adj,
                    w_adj=linha.adjacente.w_adj,
                    h_adj=linha.adjacente.h_adj,
                    cdj=linha.adjacente.cdj,
                    ct_adj=linha.adjacente.ct_adj,
                ),
            )
        )

    zonas_in = req.zonas if req.zonas else [ZonaWizardInput(id="ZS01", nome="Zona 01")]
    zonas: list[ZonaIn] = []
    for zona in zonas_in:
        tipo_zona = _tipo_estrutura_value(zona.lf_tipo) if zona.lf_tipo else tipo_estrutura_global
        tipo_piso = _enum_member(TipoPiso, zona.rt, TipoPiso.MARMORE_CERAMICA)
        risco_incendio = _enum_member(RiscoIncendio, zona.rf, RiscoIncendio.NORMAL)
        providencia = _enum_member(ProvidenciasIncendio, zona.rp, ProvidenciasIncendio.NENHUMA)
        perigo = _enum_member(PerigoEspecial, zona.hz, PerigoEspecial.NENHUM)
        construcao = _enum_member(TipoConstrucao, tipo_construcao, TipoConstrucao.ALVENARIA_CONCRETO)

        zonas.append(
            ZonaIn(
                id=zona.id,
                nome=zona.nome,
                nz=zona.nz,
                tz_mode="h_ano",
                tz_valor=zona.tz_horas_ano,
                rt=FATOR_RT[tipo_piso],
                rf=FATOR_RF[risco_incendio],
                rp=FATOR_RP[providencia],
                hz=FATOR_HZ[perigo],
                lf_valor=_lf_l1_value(tipo_zona),
                lf_custom=bool(zona.lf_tipo),
                lo=max(float(zona.lo), 0.0),
                tem_lo=zona.lo > 0,
                pspd=_PSPD_MAP.get(zona.pspd, 1.0),
                blindagem=zona.blindagem_espacial,
                ks3_energia=zona.ks3_energia,
                ks3_sinal=zona.ks3_sinal,
                wm1=zona.wm1,
                wm2=zona.wm2,
                uw_equip=zona.uw_equip_kv,
                habilitar_f=zona.habilitar_f,
                ft_sistema=zona.sistema_interno_ft,
                zpr0a=zona.zpr0a,
            )
        )

    estrutura = EstruturaPDA(
        L=req.L,
        W=req.W,
        H=req.H,
        Hp=req.Hp,
        NG=req.NG,
        loc=req.localizacao,
        pb=_pb_value(req),
        pta=PROBABILIDADE_PTA.get(req.pta_tipo, 1.0),
        nt=req.nt,
        tipo_estrutura=tipo_estrutura_global,
        tipo_construcao=tipo_construcao,
    )

    # Validação de consistência: se algum fator de construção foi recebido, ele precisa estar mapeado.
    _ = FATOR_RS[_enum_member(TipoConstrucao, tipo_construcao, TipoConstrucao.ALVENARIA_CONCRETO)]
    return CalcRequest(estrutura=estrutura, zonas=zonas, linhas=linhas)


def _dominante(componentes: dict[str, float]) -> str:
    return max(componentes, key=lambda k: componentes[k]) if any(v > 0 for v in componentes.values()) else "RB"


def _wizard_response(req: WizardRequest, calc_req: CalcRequest, calc: CalcResponse) -> dict[str, Any]:
    comp_global = {
        "RA": calc.RA_g,
        "RB": calc.RB_g,
        "RC": calc.RC_g,
        "RM": calc.RM_g,
        "RU": calc.RU_g,
        "RV": calc.RV_g,
        "RW": calc.RW_g,
        "RZ": calc.RZ_g,
    }
    dom = _dominante(comp_global)

    linhas_eventos = []
    for linha in calc.linhas:
        nl_x_pld = sum(t.NL * t.PLD for t in linha.trechos)
        ni_x_pli = sum(t.NI * t.PLI for t in linha.trechos)
        pld_max = max((t.PLD for t in linha.trechos), default=1.0)
        linhas_eventos.append({
            "nome": linha.nome,
            "tipo": linha.tipo_linha,
            "AL": linha.AL_total,
            "AI": linha.AI_total,
            "NL": linha.NL_total,
            "NI": linha.NI_total,
            "NDJ": linha.NDJ,
            "nl_x_pld": nl_x_pld,
            "ni_x_pli": ni_x_pli,
            "ndj_x_pld": linha.NDJ * pld_max,
        })

    zonas_resultado = []
    for zin, zout in zip(calc_req.zonas, calc.zonas):
        tz_h = min(zin.tz_valor if zin.tz_mode == "h_ano" else zin.tz_valor * 365, 8760.0)
        fp = (zin.nz / max(calc_req.estrutura.nt, 1)) * (tz_h / 8760.0)
        zonas_resultado.append({
            "id": zout.id,
            "nome": zout.nome,
            "R1": zout.R1,
            "R3": zout.R3,
            "R4": zout.R4,
            "F": zout.F,
            "FT": zin.ft_sistema,
            "componentes": {
                "RA": zout.RA,
                "RB": zout.RB,
                "RC": zout.RC,
                "RM": zout.RM,
                "RU": zout.RU,
                "RV": zout.RV,
                "RW": zout.RW,
                "RZ": zout.RZ,
            },
            "probabilidades": {
                "PA": calc_req.estrutura.pta * calc_req.estrutura.pb,
                "PB": calc_req.estrutura.pb,
                "PC": zout.PC_calc,
                "PM": zout.PM_calc,
                "PMS": zout.PMS_calc,
                "KS1": zout.KS1_calc,
                "KS2": zout.KS2_calc,
                "KS4": zout.KS4_calc,
                "PSPD": zin.pspd,
            },
            "perdas": {
                "LA": zout.LA,
                "LB": zout.LB,
                "LC": zout.LC,
                "fp": fp,
                "rS": FATOR_RS[_enum_member(TipoConstrucao, calc_req.estrutura.tipo_construcao, TipoConstrucao.ALVENARIA_CONCRETO)],
                "FB": zout.FB,
                "FC": zout.FC,
                "FM": zout.FM,
                "FV": zout.FV,
                "FW": zout.FW,
                "FZ": zout.FZ,
            },
            "contribuicao_linhas": [c.model_dump() for c in zout.linhas_contrib],
        })

    RT = 1e-5
    atende_R1 = calc.R1_global <= RT
    recomendacoes: list[str] = []
    if not atende_R1:
        recomendacoes.append(f"R1={calc.R1_global:.2e} > RT={RT:.0e}: revisar medidas de proteção; componente dominante: {dom}.")
    if not calc.F_atende:
        recomendacoes.append("F acima do FT em uma ou mais zonas: verificar SPDA, DPS coordenados, blindagem/roteamento de linhas e ZPR0A.")

    return {
        "R1_total": calc.R1_global,
        "F_total": calc.F_global,
        "R3_total": calc.R3_global,
        "R4_total": calc.R4_global,
        "RT": RT,
        "FT_global": calc.FT_global,
        "atende_R1": atende_R1,
        "atende_F": calc.F_atende,
        "areas": {"AD": calc.AD, "AM": calc.AM, "AL": calc.AL, "AI": calc.AI},
        "eventos": {"ND": calc.ND, "NM": calc.NM, "por_linha": linhas_eventos},
        "estrutura": {
            "L": req.L,
            "W": req.W,
            "H": req.H,
            "Hp": req.Hp,
            "CD": _CD_MAP.get(req.localizacao, 1.0),
            "PB": calc_req.estrutura.pb,
            "PA": calc_req.estrutura.pta * calc_req.estrutura.pb,
            "rS": FATOR_RS[_enum_member(TipoConstrucao, calc_req.estrutura.tipo_construcao, TipoConstrucao.ALVENARIA_CONCRETO)],
            "nt": req.nt,
            "NG": req.NG,
            "AD": calc.AD,
            "ND": calc.ND,
            "AM": calc.AM,
            "NM": calc.NM,
            "AL": calc.AL,
            "AI": calc.AI,
        },
        "zonas_resultado": zonas_resultado,
        "componentes_globais": comp_global,
        "dominante": dom,
        "recomendacoes": recomendacoes,
        "calc_unificado": calc.model_dump(),
    }


@router.post("/analise-risco/wizard")
async def calcular_wizard(req: WizardRequest) -> dict[str, Any]:
    """
    Adaptador do wizard legado para o motor central /calcular.
    """
    calc_req = _build_calc_request(req)
    calc = calcular_pda(calc_req)
    return _wizard_response(req, calc_req, calc)
