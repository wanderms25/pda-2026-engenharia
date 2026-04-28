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
from app.engine.riscos import EntradaComponentes, avaliar_riscos, calcular_componentes
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


def _executar_pipeline(req: AnaliseRiscoRequest):
    dim = DimensoesEstrutura(L=req.dimensoes.L, W=req.dimensoes.W, H=req.dimensoes.H, H_saliencia=req.dimensoes.H_saliencia)
    # Se o frontend enviou valores pré-calculados, usá-los diretamente
    vc = getattr(req, "valores_calculados", None)
    AD = calcular_AD(dim)
    AM = calcular_AM(dim)
    AL = AI = NL = NI = 0.0

    if req.linhas:
        linha = req.linhas[0]
        if linha.instalacao == TipoInstalacaoLinha.ENTERRADO and linha.resistividade_solo_ohm_m and linha.resistividade_solo_ohm_m > 400:
            AL = calcular_AL_enterrada_alta_resistividade(linha.comprimento_m, linha.resistividade_solo_ohm_m)
        else:
            AL = calcular_AL(linha.comprimento_m)
        AI = calcular_AI(linha.comprimento_m)
        params_linha = ParametrosLinha(comprimento_m=linha.comprimento_m, instalacao=linha.instalacao, tipo=linha.tipo, ambiente=linha.ambiente)
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
        tipo_estrutura=f.tipo_estrutura, tipo_piso=f.tipo_piso,
        risco_incendio=f.risco_incendio, providencias_incendio=f.providencias_incendio,
        perigo_especial=f.perigo_especial, tipo_construcao=f.tipo_construcao,
        numero_pessoas_zona=f.numero_pessoas_zona, numero_pessoas_total=f.numero_pessoas_total,
        horas_ano_presenca=f.horas_ano_presenca, risco_vida_imediato_por_falha=f.risco_explosao_ou_vida_imediata,
    ))

    componentes = calcular_componentes(EntradaComponentes(
        ND=ND, NM=NM, NL=NL, NI=NI, NDJ=0.0,
        PA=prob.PA, PB=prob.PB, PC=prob.PC, PM=prob.PM,
        PU=prob.PU, PV=prob.PV, PW=prob.PW, PZ=prob.PZ,
        LA=perdas_l1.LA, LB=perdas_l1.LB, LC=perdas_l1.LC, LM=perdas_l1.LM,
        LU=perdas_l1.LU, LV=perdas_l1.LV, LW=perdas_l1.LW, LZ=perdas_l1.LZ,
    ))

    riscos = avaliar_riscos(componentes, risco_explosao_ou_vida_imediata=f.risco_explosao_ou_vida_imediata, calcular_r4=req.calcular_r4)

    # Override com valores pré-calculados pelo frontend (garantia de consistência)
    if vc:
        from app.engine.riscos import ComponentesRisco, RiscosConsolidados
        componentes = ComponentesRisco(
            RA=float(vc.get("RA", componentes.RA)),
            RB=float(vc.get("RB", componentes.RB)),
            RC=float(vc.get("RC", componentes.RC)),
            RM=float(vc.get("RM", componentes.RM)),
            RU=float(vc.get("RU", componentes.RU)),
            RV=float(vc.get("RV", componentes.RV)),
            RW=float(vc.get("RW", componentes.RW)),
            RZ=float(vc.get("RZ", componentes.RZ)),
        )
        R1 = float(vc.get("R1", riscos.R1))
        F  = float(vc.get("F",  riscos.detalhes.get("F", 0.0) if riscos.detalhes else 0.0))  # F salvo junto
        riscos = RiscosConsolidados(
            R1=R1,
            R3=float(vc.get("R3", riscos.R3)),
            R4=float(vc.get("R4", riscos.R4 or 0.0)),
            detalhes={**riscos.detalhes, "F": F},
        )
        # Recalcular avaliação com valores reais do frontend
        from app.engine.avaliacao import avaliar_conformidade, exige_protecao
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

        pdf_bytes = gerar_pdf_laudo(
            projeto=ProjetoInfo(nome=getattr(req,"nome_obra",None) or req.nome_projeto, endereco=getattr(req,"endereco_obra","") or ""),
            entrada=EntradaLaudo(
                NG=req.NG, L=req.dimensoes.L, W=req.dimensoes.W, H=req.dimensoes.H,
                localizacao=req.localizacao, tipo_estrutura=req.fatores.tipo_estrutura,
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
    
    # R4 e frequencia_danos_total removidos para evitar TypeError no __init__
    riscos = RiscosConsolidados(
        R1=res.get("R1_total", 0),
        R3=res.get("R3_total", 0),
        R4=0
    )
    
    avaliacao = avaliar_conformidade(riscos)
    exige = res.get("R1_total", 0) > 1e-5

    estrutura = res.get("estrutura", {})
    areas = {"AD": estrutura.get("AD", 0), "AM": estrutura.get("AM", 0), "AL": 0, "AI": 0}
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
        pdf_bytes = gerar_pdf_laudo(
            projeto=ProjetoInfo(
                nome=nome_projeto,
                cliente=wi.get("obra_cliente", ""),
                endereco=wi.get("endereco", ""),
            ),
            entrada=EntradaLaudo(
                NG=wi.get("NG", 1), L=wi.get("L", 1), W=wi.get("W", 1), H=wi.get("H", 1),
                localizacao=loc, tipo_estrutura=te,
            ),
            areas=areas,
            eventos=eventos_dict,
            componentes=comp,
            riscos=riscos,
            avaliacao=avaliacao,
            exige_protecao=exige,
            responsavel=responsavel,
            tem_spda=wi.get("pb_nivel", "NENHUM") != "NENHUM",
            tem_dps=False,
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