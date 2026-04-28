"""
Endpoint de geração de PDF do laudo de análise de risco. v0.7.1
Inclui logo e dados do profissional autenticado.
"""
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.auth import get_current_user
from app.models.orm import Usuario
from app.engine.areas import DimensoesEstrutura, calcular_AD, calcular_AI, calcular_AL, calcular_AM, calcular_AL_enterrada_alta_resistividade
from app.engine.avaliacao import avaliar_conformidade, exige_protecao
from app.engine.eventos import ParametrosLinha, calcular_ND, calcular_NI, calcular_NL, calcular_NM
from app.engine.perdas import EntradaPerdas, calcular_perdas_L1
from app.engine.probabilidades import EntradaProbabilidades, calcular_todas_probabilidades
from app.engine.frequencia_danos import calcular_frequencia_a_partir_de_probabilidades
from app.engine.riscos import EntradaComponentes, ComponentesRisco, RiscosConsolidados, avaliar_riscos, calcular_componentes
from app.nbr5419.enums import NivelProtecao, TipoInstalacaoLinha
from app.schemas.analise_risco import AnaliseRiscoRequest
from app.services.pdf_generator import EntradaLaudo, ProjetoInfo, ResponsavelTecnico, gerar_pdf_laudo
from urllib.parse import quote

router = APIRouter()


def _nivel_protecao_label(valor, prefixo="Nível"):
    """Converte enum/string de nível em rótulo técnico para laudos."""
    if valor is None:
        return "Nenhum"
    raw = getattr(valor, "value", valor)
    raw = str(raw).strip().upper()
    if raw in ("", "NENHUM", "NONE", "NULL"):
        return "Nenhum"
    if raw in ("I", "II", "III", "IV"):
        return f"{prefixo} {raw}"
    return str(raw)


def _label_peb_por_linhas(req):
    """Retorna o rótulo do DPS Classe I de entrada a partir do PEB efetivo das linhas."""
    fatores = []
    for linha in getattr(req, "linhas", []) or []:
        try:
            fatores.append(float(getattr(linha, "fator_peb", 1.0)))
        except Exception:
            pass
    if not fatores:
        return _nivel_protecao_label(getattr(getattr(req, "medidas", None), "dps_classe_I_entrada", "NENHUM"), "DPS Nível")
    v = min(fatores)
    if v >= 1:
        return "Nenhum"
    if v <= 0.001 + 1e-12:
        return "DPS Classe I — NP I máximo"
    if v <= 0.005 + 1e-12:
        return "DPS Classe I — NP I+"
    if v <= 0.01 + 1e-12:
        return "DPS Nível I"
    if v <= 0.02 + 1e-12:
        return "DPS Nível II"
    if v <= 0.05 + 1e-12:
        return "DPS Nível III-IV"
    return "Nenhum"


def _as_float_dict(d, key, default=0.0):
    """Lê número de dict/objeto com fallback seguro."""
    try:
        if isinstance(d, dict):
            value = d.get(key, default)
        else:
            value = getattr(d, key, default)
        return float(value if value is not None else default)
    except Exception:
        return float(default)




def _rs_info(tipo_construcao):
    raw = getattr(tipo_construcao, "value", tipo_construcao)
    raw = str(raw or "ALV_CONCRETO").upper()
    if raw == "MADEIRA":
        return 2.0, "Simples / madeira ou alvenaria simples"
    if raw == "METALICA":
        return 1.0, "Robusta / estrutura metálica"
    return 1.0, "Robusta / alvenaria-concreto"

def _sum_linhas(linhas, key):
    total = 0.0
    for linha in linhas or []:
        if isinstance(linha, dict):
            total += _as_float_dict(linha, key, 0.0)
        else:
            total += _as_float_dict(linha, key, 0.0)
    return total


def _executar_pipeline(req: AnaliseRiscoRequest):
    """
    Executa o pipeline legado apenas como fallback.

    Quando o frontend envia `valores_calculados`, esses valores são a fonte única
    do laudo. Isso evita divergência entre a aba Análises, o PDF e o Word.
    """
    dim = DimensoesEstrutura(
        L=req.dimensoes.L,
        W=req.dimensoes.W,
        H=req.dimensoes.H,
        H_saliencia=req.dimensoes.H_saliencia,
    )
    vc = getattr(req, "valores_calculados", None)

    AD = calcular_AD(dim)
    AM = calcular_AM(dim)
    AL = AI = NL = NI = 0.0
    NDJ = 0.0

    if req.linhas:
        linha = req.linhas[0]
        if linha.instalacao == TipoInstalacaoLinha.ENTERRADO and linha.resistividade_solo_ohm_m and linha.resistividade_solo_ohm_m > 400:
            AL = calcular_AL_enterrada_alta_resistividade(linha.comprimento_m, linha.resistividade_solo_ohm_m)
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

    ND = calcular_ND(req.NG, AD, req.localizacao)
    NM = calcular_NM(req.NG, AM)

    prob = calcular_todas_probabilidades(EntradaProbabilidades(
        spda_nivel=req.medidas.spda_nivel,
        dps_coordenados_nivel=req.medidas.dps_coordenados_nivel,
        dps_classe_I_nivel=req.medidas.dps_classe_I_entrada,
        avisos_alerta=req.medidas.aviso_alerta_toque_passo,
        isolacao_eletrica_descida=req.medidas.isolacao_eletrica_descida,
        malha_equipotencializacao_solo=req.medidas.malha_equipotencializacao_solo,
        descida_natural_estrutura_continua=req.medidas.descida_natural_estrutura_continua,
        tensao_UW_kV=req.linhas[0].tensao_suportavel_UW_kV if req.linhas else 2.5,
    ))

    f = req.fatores
    perdas_l1 = calcular_perdas_L1(EntradaPerdas(
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
    ))

    componentes = calcular_componentes(EntradaComponentes(
        ND=ND, NM=NM, NL=NL, NI=NI, NDJ=NDJ,
        PA=prob.PA, PB=prob.PB, PC=prob.PC, PM=prob.PM,
        PU=prob.PU, PV=prob.PV, PW=prob.PW, PZ=prob.PZ,
        LA=perdas_l1.LA, LB=perdas_l1.LB, LC=perdas_l1.LC, LM=perdas_l1.LM,
        LU=perdas_l1.LU, LV=perdas_l1.LV, LW=perdas_l1.LW, LZ=perdas_l1.LZ,
    ))

    riscos = avaliar_riscos(
        componentes,
        risco_explosao_ou_vida_imediata=f.risco_explosao_ou_vida_imediata,
        calcular_r4=req.calcular_r4,
    )

    freq = calcular_frequencia_a_partir_de_probabilidades(
        ND=ND, NM=NM, NL=NL, NI=NI, NDJ=NDJ, prob=prob
    )
    detalhes = dict(getattr(riscos, "detalhes", {}) or {})
    detalhes.update({
        "F": freq.F_total,
        "FB": freq.FB,
        "FC": freq.FC,
        "FM": freq.FM,
        "FV": freq.FV,
        "FW": freq.FW,
        "FZ": freq.FZ,
        "FT": 0.1,
        "FT_global": 0.1,
        "F_atende": freq.F_total <= 0.1,
    })

    if vc:
        # Sobrescreve áreas/eventos globais para que o laudo reflita exatamente
        # o retorno bruto de /api/v1/calcular.
        AD = _as_float_dict(vc, "AD", AD)
        AM = _as_float_dict(vc, "AM", AM)
        AL = _as_float_dict(vc, "AL", AL)
        AI = _as_float_dict(vc, "AI", AI)
        ND = _as_float_dict(vc, "ND", ND)
        NM = _as_float_dict(vc, "NM", NM)

        linhas_calc = vc.get("linhas", []) if isinstance(vc, dict) else []
        zonas_calc = vc.get("zonas", []) if isinstance(vc, dict) else []
        NL = _as_float_dict(vc, "NL", _sum_linhas(linhas_calc, "NL_total"))
        NI = _as_float_dict(vc, "NI", _sum_linhas(linhas_calc, "NI_total"))
        NDJ = _as_float_dict(vc, "NDJ", _sum_linhas(linhas_calc, "NDJ"))

        componentes = ComponentesRisco(
            RA=_as_float_dict(vc, "RA", componentes.RA),
            RB=_as_float_dict(vc, "RB", componentes.RB),
            RC=_as_float_dict(vc, "RC", componentes.RC),
            RM=_as_float_dict(vc, "RM", componentes.RM),
            RU=_as_float_dict(vc, "RU", componentes.RU),
            RV=_as_float_dict(vc, "RV", componentes.RV),
            RW=_as_float_dict(vc, "RW", componentes.RW),
            RZ=_as_float_dict(vc, "RZ", componentes.RZ),
        )

        R1 = _as_float_dict(vc, "R1", _as_float_dict(vc, "R1_global", riscos.R1))
        R3 = _as_float_dict(vc, "R3", _as_float_dict(vc, "R3_global", riscos.R3))
        R4 = _as_float_dict(vc, "R4", _as_float_dict(vc, "R4_global", riscos.R4 or 0.0))
        F = _as_float_dict(vc, "F", _as_float_dict(vc, "F_global", detalhes.get("F", 0.0)))
        FT = _as_float_dict(vc, "FT", _as_float_dict(vc, "FT_global", detalhes.get("FT_global", 0.1)))
        F_atende = bool(vc.get("F_atende", vc.get("F_conforme", F <= FT))) if isinstance(vc, dict) else (F <= FT)

        detalhes.update({
            "F": F,
            "R1": R1,
            "R3": R3,
            "R4": R4,
            "R1_global": _as_float_dict(vc, "R1_global", R1),
            "R3_global": _as_float_dict(vc, "R3_global", R3),
            "F_global": _as_float_dict(vc, "F_global", F),
            "FT": FT,
            "FT_global": FT,
            "F_atende": F_atende,
            "F_conforme": F_atende,
            "zonas_fora_ft": vc.get("zonas_fora_ft", []) if isinstance(vc, dict) else [],
            "ng_manual": bool(vc.get("ng_manual", False)) if isinstance(vc, dict) else False,
            "ng_origem": vc.get("ng_origem", "ANEXO_F") if isinstance(vc, dict) else "ANEXO_F",
            "R4_global": _as_float_dict(vc, "R4_global", R4),
            "linhas": linhas_calc,
            "zonas": zonas_calc,
            "componentes_globais": vc.get("componentes_globais", componentes.__dict__) if isinstance(vc, dict) else componentes.__dict__,
            "AD": AD,
            "AM": AM,
            "AL": AL,
            "AI": AI,
            "ND": ND,
            "NM": NM,
            "NL": NL,
            "NI": NI,
            "NDJ": NDJ,
        })

        riscos = RiscosConsolidados(R1=R1, R3=R3, R4=R4, F=F, FT=FT, detalhes=detalhes)
    else:
        riscos = RiscosConsolidados(
            R1=riscos.R1,
            R3=riscos.R3,
            R4=riscos.R4 or 0.0,
            F=detalhes.get("F", 0.0),
            FT=detalhes.get("FT_global", detalhes.get("FT", 0.1)),
            detalhes=detalhes,
        )

    avaliacao = avaliar_conformidade(riscos)
    exige = exige_protecao(avaliacao)
    return AD, AM, AL, AI, ND, NM, NL, NI, componentes, riscos, avaliacao, exige

@router.post("/laudo/pdf")
async def gerar_laudo_pdf(
    req: AnaliseRiscoRequest,
    user: Usuario = Depends(get_current_user),
) -> StreamingResponse:
    """Gera PDF do laudo com logo e dados do profissional autenticado."""
    AD, AM, AL, AI, ND, NM, NL, NI, componentes, riscos, avaliacao, exige = _executar_pipeline(req)

    # Monta ResponsavelTecnico a partir do usuário logado
    reg = ""
    conselho_padrao = user.tipo_registro if user.tipo_registro else "Conselho"
    
    if user.tipo_registro and user.numero_registro:
        uf = f"-{user.uf_profissional}" if user.uf_profissional else ""
        reg = f"{user.tipo_registro}{uf} Nº {user.numero_registro}"
    elif user.registro_profissional:
        reg = user.registro_profissional

    responsavel = ResponsavelTecnico(
        nome=user.nome,
        registro=reg or f"{conselho_padrao} nº ________",
        art=getattr(req, "numero_art", None) or "________",
        empresa=user.empresa or "",
        telefone=user.telefone or "",
        email=user.email or "",
        endereco=user.endereco or "",
        logo_base64=user.logo_base64 or "",
    )

    try:
        medidas_dict = {
            "spda_nivel": _nivel_protecao_label(req.medidas.spda_nivel, "Nível") if req.medidas else "Nenhum",
            "dps_coordenados_nivel": _nivel_protecao_label(req.medidas.dps_coordenados_nivel, "DPS Nível") if req.medidas else "Nenhum",
            "dps_classe_I_entrada": _label_peb_por_linhas(req) if req.medidas else "Nenhum",
            "aviso_alerta": getattr(req.medidas, "aviso_alerta_toque_passo", False),
            "isolacao_eletrica": getattr(req.medidas, "isolacao_eletrica_descida", False),
            "malha_equipotencializacao": getattr(req.medidas, "malha_equipotencializacao_solo", False),
        }

        rs_valor, rs_label = _rs_info(getattr(req.fatores, "tipo_construcao", "ALV_CONCRETO"))
        pdf_bytes = gerar_pdf_laudo(
            projeto=ProjetoInfo(nome=getattr(req,"nome_obra",None) or req.nome_projeto, endereco=getattr(req,"endereco_obra","") or ""),
            entrada=EntradaLaudo(
                NG=req.NG, L=req.dimensoes.L, W=req.dimensoes.W, H=req.dimensoes.H,
                localizacao=req.localizacao, tipo_estrutura=req.fatores.tipo_estrutura,
                rS=rs_valor, tipo_construcao_label=rs_label,
            ),
            areas={"AD": AD, "AM": AM, "AL": AL, "AI": AI},
            eventos={"ND": ND, "NM": NM, "NL": NL, "NI": NI},
            componentes=componentes,
            riscos=riscos,
            avaliacao=avaliacao,
            exige_protecao=exige,
            responsavel=responsavel,
            tem_spda=req.medidas.spda_nivel != NivelProtecao.NENHUM,
            tem_dps=req.medidas.dps_coordenados_nivel != NivelProtecao.NENHUM,
            medidas=medidas_dict,
            fotos=getattr(req, "fotos", None) or [],
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Limpeza do nome do arquivo para evitar erro latin-1 com travessões
    filename = f"laudo_{req.nome_projeto}.pdf".replace("—", "-")
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=utf-8''{quote(filename)}"},
    )


# ── PDF gerado a partir do resultado do wizard ──────────────────────────────

from pydantic import BaseModel as _BM

class WizardPDFRequest(_BM):
    """Wrapper para gerar PDF a partir do resultado do wizard."""
    wizard_input: dict  # os dados do wizard (obra, ART, etc)
    resultado: dict     # o resultado calculado pelo /analise-risco/wizard

@router.post("/laudo/pdf-wizard")
async def gerar_laudo_pdf_wizard(
    req: WizardPDFRequest,
    user: Usuario = Depends(get_current_user),
) -> StreamingResponse:
    """Gera PDF do laudo a partir dos resultados do wizard multi-zona."""
    wi = req.wizard_input   
    res = req.resultado     

    # Dinamização do conselho
    reg = ""
    conselho_padrao = user.tipo_registro if user.tipo_registro else "Conselho"

    if user.tipo_registro and user.numero_registro:
        uf = f"-{user.uf_profissional}" if user.uf_profissional else ""
        reg = f"{user.tipo_registro}{uf} Nº {user.numero_registro}"
    elif user.registro_profissional:
        reg = user.registro_profissional

    responsavel = ResponsavelTecnico(
        nome=user.nome,
        registro=reg or f"{conselho_padrao} nº ________",
        art=wi.get("art_rt_trt") or "________",
        empresa=user.empresa or "",
        telefone=user.telefone or "",
        email=user.email or "",
        endereco=user.endereco or "",
        logo_base64=user.logo_base64 or "",
    )

    from app.nbr5419.enums import LocalizacaoEstrutura, TipoEstrutura
    from app.nbr5419.parte2_tabelas import FATOR_LOCALIZACAO_CD
    loc_map = {k.value: k for k in LocalizacaoEstrutura}
    loc = loc_map.get(wi.get("localizacao", "CERCADA_MESMA_ALTURA"),
                       LocalizacaoEstrutura.CERCADA_MESMA_ALTURA)
    te_map = {k.value: k for k in TipoEstrutura}
    te = te_map.get(wi.get("lf_tipo", "OUTROS"), TipoEstrutura.OUTROS)

    from app.engine.riscos import RiscosConsolidados, ComponentesRisco
    from app.engine.avaliacao import avaliar_conformidade

    comp_global = res.get("componentes_globais", {})
    comp = ComponentesRisco(
        RA=comp_global.get("RA", 0), RB=comp_global.get("RB", 0),
        RC=comp_global.get("RC", 0), RM=comp_global.get("RM", 0),
        RU=comp_global.get("RU", 0), RV=comp_global.get("RV", 0),
        RW=comp_global.get("RW", 0), RZ=comp_global.get("RZ", 0),
    )
    
    # Preserva também F, R3, R4, zonas e linhas calculadas pelo wizard,
    # para que o template do laudo consiga exibir todos os resultados.
    F_wizard = (
        res.get("F_total", None)
        if res.get("F_total", None) is not None else
        res.get("F_global", None)
        if res.get("F_global", None) is not None else
        res.get("frequencia_danos_total", None)
        if res.get("frequencia_danos_total", None) is not None else
        res.get("F", 0)
    )
    R3_wizard = res.get("R3_total", res.get("R3_global", res.get("R3", 0)))
    FT_wizard = float(res.get("FT_global", res.get("FT", 0.1)) or 0.1)
    F_atende_wizard = bool(res.get("F_atende", res.get("atende_F", (F_wizard or 0) <= FT_wizard)))
    R4_wizard = res.get("R4_total", res.get("R4_global", res.get("R4", 0)))
    detalhes_wizard = {
        "F": F_wizard or 0,
        "F_global": F_wizard or 0,
        "FT": FT_wizard,
        "FT_global": FT_wizard,
        "F_atende": F_atende_wizard,
        "F_conforme": F_atende_wizard,
        "R1_global": res.get("R1_total", res.get("R1_global", res.get("R1", 0))),
        "R3_global": R3_wizard or 0,
        "R4_global": R4_wizard or 0,
        "zonas": res.get("zonas", res.get("zonas_calc", [])) or [],
        "linhas": res.get("linhas", res.get("linhas_calc", [])) or [],
        "componentes_globais": comp_global,
        "tem_R3": bool(res.get("tem_R3", (R3_wizard or 0) > 0)),
        "tem_R4": bool(res.get("tem_R4", (R4_wizard or 0) > 0)),
    }
    riscos = RiscosConsolidados(
        R1=res.get("R1_total", res.get("R1_global", res.get("R1", 0))),
        R3=R3_wizard or 0,
        R4=R4_wizard or 0,
        F=F_wizard or 0,
        FT=FT_wizard,
        detalhes=detalhes_wizard,
    )

    avaliacao = avaliar_conformidade(riscos)
    exige = exige_protecao(avaliacao)

    estrutura = res.get("estrutura", {})
    areas = {
        "AD": estrutura.get("AD", res.get("AD", 0)),
        "AM": estrutura.get("AM", res.get("AM", 0)),
        "AL": estrutura.get("AL", res.get("AL", 0)),
        "AI": estrutura.get("AI", res.get("AI", 0)),
    }
    eventos = res.get("eventos", {})
    eventos_dict = {
        "ND": eventos.get("ND", 0), "NM": eventos.get("NM", 0),
        "NL": sum(l.get("NL", 0) for l in eventos.get("por_linha", [])),
        "NI": sum(l.get("NI", 0) for l in eventos.get("por_linha", [])),
    }

    medidas_dict = {
        "spda_nivel": _nivel_protecao_label(wi.get("pb_nivel", "NENHUM"), "Nível"),
        "dps_coordenados_nivel": _nivel_protecao_label(wi.get("dps_coordenados_nivel", wi.get("pspd_nivel", "NENHUM")), "DPS Nível"),
        "dps_classe_I_entrada": _nivel_protecao_label(wi.get("dps_classe_I_entrada", wi.get("peb_nivel", "NENHUM")), "DPS Nível"),
        "aviso_alerta": wi.get("pta_tipo") == "AVISOS_ALERTA",
        "isolacao_eletrica": wi.get("pta_tipo") == "ISOLACAO_ELETRICA_DESCIDA",
        "malha_equipotencializacao": wi.get("pta_tipo") == "MALHA_EQUIPOTENCIALIZACAO_SOLO",
    }

    nome_projeto = wi.get("nome_analise") or wi.get("obra_cliente") or "Analise_de_Risco"

    try:
        rs_valor, rs_label = _rs_info(wi.get("rs_tipo", wi.get("tipo_construcao", "ALV_CONCRETO")))
        pdf_bytes = gerar_pdf_laudo(
            projeto=ProjetoInfo(
                nome=nome_projeto,
                cliente=wi.get("obra_cliente", ""),
                endereco=wi.get("endereco", ""),
            ),
            entrada=EntradaLaudo(
                NG=wi.get("NG", 1), L=wi.get("L", 1), W=wi.get("W", 1), H=wi.get("H", 1),
                localizacao=loc, tipo_estrutura=te,
                rS=rs_valor, tipo_construcao_label=rs_label,
            ),
            areas=areas,
            eventos=eventos_dict,
            componentes=comp,
            riscos=riscos,
            avaliacao=avaliacao,
            exige_protecao=exige,
            responsavel=responsavel,
            tem_spda=wi.get("pb_nivel", "NENHUM") != "NENHUM",
            tem_dps=(medidas_dict.get("dps_coordenados_nivel") != "Nenhum" or medidas_dict.get("dps_classe_I_entrada") != "Nenhum"),
            medidas=medidas_dict,
            fotos=[],
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Correção para o nome do arquivo no cabeçalho HTTP
    filename_pdf = f"laudo_{nome_projeto}.pdf".replace("—", "-")
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=utf-8''{quote(filename_pdf)}"},
    )