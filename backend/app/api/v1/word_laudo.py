"""
Endpoint de geração de laudo Word (.docx) — espelha 100% o pipeline do PDF.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from io import BytesIO
from urllib.parse import quote

from app.api.v1.laudo import _executar_pipeline
from app.auth import get_current_user
from app.models.orm import Usuario
from app.schemas.analise_risco import AnaliseRiscoRequest
from app.services.pdf_generator import EntradaLaudo, ProjetoInfo, ResponsavelTecnico
from app.services.word_generator import gerar_word_laudo
from app.nbr5419.enums import LocalizacaoEstrutura, TipoEstrutura, NivelProtecao

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




def _rs_info(tipo_construcao):
    raw = getattr(tipo_construcao, "value", tipo_construcao)
    raw = str(raw or "ALV_CONCRETO").upper()
    if raw == "MADEIRA":
        return 2.0, "Simples / madeira ou alvenaria simples"
    if raw == "METALICA":
        return 1.0, "Robusta / estrutura metálica"
    return 1.0, "Robusta / alvenaria-concreto"

@router.post("/laudo/word")
async def gerar_laudo_word(
    req: AnaliseRiscoRequest,
    user: Usuario = Depends(get_current_user),
):
    """Gera laudo de análise de risco em formato Word (.docx) — mesmo conteúdo do PDF."""

    AD, AM, AL, AI, ND, NM, NL, NI, componentes, riscos, avaliacao, exige = _executar_pipeline(req)

    # Responsável técnico — idêntico ao endpoint PDF
    reg = ""
    conselho_padrao = user.tipo_registro if user.tipo_registro else "Conselho"
    if user.tipo_registro and user.numero_registro:
        uf_suf = f"-{user.uf_profissional}" if user.uf_profissional else ""
        reg = f"{user.tipo_registro}{uf_suf} Nº {user.numero_registro}"
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

    rs_valor, rs_label = _rs_info(getattr(req.fatores, "tipo_construcao", "ALV_CONCRETO"))
    entrada = EntradaLaudo(
        NG=req.NG,
        L=req.dimensoes.L,
        W=req.dimensoes.W,
        H=req.dimensoes.H,
        localizacao=LocalizacaoEstrutura(req.localizacao),
        tipo_estrutura=TipoEstrutura(req.fatores.tipo_estrutura),
        rS=rs_valor,
        tipo_construcao_label=rs_label,
    )

    nome_obra = getattr(req, "nome_obra", None) or req.nome_projeto
    projeto = ProjetoInfo(
        nome=nome_obra,
        endereco=getattr(req, "endereco_obra", "") or "",
    )

    medidas_dict = {
        "spda_nivel": _nivel_protecao_label(req.medidas.spda_nivel, "Nível"),
        "dps_coordenados_nivel": _nivel_protecao_label(req.medidas.dps_coordenados_nivel, "DPS Nível"),
        "dps_classe_I_entrada": _label_peb_por_linhas(req),
        "aviso_alerta": req.medidas.aviso_alerta_toque_passo,
        "isolacao_eletrica": req.medidas.isolacao_eletrica_descida,
        "malha_equipotencializacao": req.medidas.malha_equipotencializacao_solo,
    }

    word_bytes = gerar_word_laudo(
        projeto=projeto,
        entrada=entrada,
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
        linhas_info=[
            {"nome": l.nome, "tipo": l.tipo.value, "instalacao": l.instalacao.value}
            for l in req.linhas
        ],
    )

    nome_arquivo = quote(f"laudo-{nome_obra or 'pda'}.docx")
    return StreamingResponse(
        BytesIO(word_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{nome_arquivo}"},
    )