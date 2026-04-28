"""
Endpoints do módulo de laudo de inspeção:

- POST /laudo/analisar   → recebe respostas do checklist, devolve plano de remediação
- POST /laudo/inspecao/pdf → gera PDF do laudo de inspeção com anexo fotográfico
"""
from io import BytesIO
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.auth import get_current_user
from app.models.orm import Usuario
from pydantic import BaseModel, Field

from app.services.checklist_inspecao import CHECKLIST_INSPECAO
from app.services.laudo_remediador import analisar_laudo
from app.services.pdf_generator import ProjetoInfo, ResponsavelTecnico
from app.services.pdf_inspecao import (
    ContextoLaudoInspecao,
    FotoLaudoContext,
    gerar_pdf_laudo_inspecao,
)

router = APIRouter()


class AnaliseLaudoRequest(BaseModel):
    """
    Entrada para análise de remediação do laudo.

    respostas: mapa código_item → status ("CONFORME" | "NAO_CONFORME" | "NA")
    """
    respostas: dict[str, str] = Field(
        description="Respostas do checklist: código → CONFORME/NAO_CONFORME/NA",
    )


@router.post("/laudo/analisar")
async def analisar_laudo_endpoint(req: AnaliseLaudoRequest) -> dict:
    """
    Analisa as respostas do checklist e devolve o plano de remediação.

    Para cada item marcado como NAO_CONFORME, gera automaticamente uma ação
    corretiva específica com referência normativa, prazo e estimativa de custo.
    """
    resultado = analisar_laudo(
        respostas=req.respostas,
        itens_checklist_total=len(CHECKLIST_INSPECAO),
    )
    return resultado.para_dict()


class FotoInput(BaseModel):
    codigo_item: str
    legenda: str = ""
    data_uri: str
    latitude: float | None = None
    longitude: float | None = None


class ResponsavelInput(BaseModel):
    nome: str = "Engenheiro(a) Responsável"
    registro: str = "CREA/CFT nº ________"
    art: str = "________"


class ProjetoInput(BaseModel):
    nome: str
    cliente: str = ""
    endereco: str = ""


class LaudoInspecaoPDFRequest(BaseModel):
    projeto: ProjetoInput
    responsavel: ResponsavelInput = Field(default_factory=ResponsavelInput)
    respostas: dict[str, str]
    fotos: list[FotoInput] = Field(default_factory=list)
    area_classificada: bool = False
    atmosfera_agressiva: bool = False
    servico_essencial: bool = False
    # Dados do SPDA/DPS para incluir no laudo
    spda_nivel: str = "NENHUM"          # NP do SPDA instalado (I/II/III/IV/NENHUM)
    dps_nivel: str = "NENHUM"           # Nível DPS coordenados
    dps_classe_I: str = "NENHUM"        # DPS Classe I
    perimetro_m: float = 0.0            # Perímetro da estrutura
    num_descidas: int = 0               # Número de descidas
    altura_estrutura: float = 0.0       # Altura da estrutura em metros
    area_estrutura: float = 0.0         # Área da cobertura em m²



def _fmt_registro(user: "Usuario") -> str:
    tipo = getattr(user, "tipo_registro", None)
    num  = getattr(user, "numero_registro", None)
    uf   = getattr(user, "uf_profissional", None)
    if tipo and num and uf:
        return f"{tipo}-{uf} Nº {num}"
    if tipo and num:
        return f"{tipo} Nº {num}"
    return getattr(user, "registro_profissional", "") or ""

@router.post("/laudo/inspecao/pdf")
async def gerar_pdf_inspecao(
    req: LaudoInspecaoPDFRequest,
    user: Usuario = Depends(get_current_user),
) -> StreamingResponse:
    """
    Gera o PDF do laudo de inspeção (NBR 5419-3 e 5419-4:2026) com:
    - Checklist item-a-item
    - Plano de remediação agrupado por prioridade
    - Anexo fotográfico organizado por categoria
    - Cálculo automático da próxima inspeção
    """
    contexto = ContextoLaudoInspecao(
        projeto=ProjetoInfo(
            nome=req.projeto.nome,
            cliente=req.projeto.cliente,
            endereco=req.projeto.endereco,
        ),
        responsavel=ResponsavelTecnico(
            nome=user.nome or req.responsavel.nome,
            registro=_fmt_registro(user) or req.responsavel.registro,
            art=req.responsavel.art or "________",
            empresa=getattr(user, "empresa", "") or "",
            telefone=getattr(user, "telefone", "") or "",
            email=user.email or "",
            endereco=getattr(user, "endereco", "") or "",
            logo_base64=getattr(user, "logo_base64", "") or "",
        ),
        respostas=req.respostas,
        fotos=[
            FotoLaudoContext(
                codigo_item=f.codigo_item,
                legenda=f.legenda,
                data_uri=f.data_uri,
                latitude=f.latitude,
                longitude=f.longitude,
            )
            for f in req.fotos
        ],
        area_classificada=req.area_classificada,
        atmosfera_agressiva=req.atmosfera_agressiva,
        servico_essencial=req.servico_essencial,
        spda_nivel=req.spda_nivel,
        dps_nivel=req.dps_nivel,
        dps_classe_I=req.dps_classe_I,
        perimetro_m=req.perimetro_m,
        num_descidas=req.num_descidas,
        altura_estrutura=req.altura_estrutura,
        area_estrutura=req.area_estrutura,
    )

    pdf_bytes = gerar_pdf_laudo_inspecao(contexto)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="laudo_inspecao_{req.projeto.nome}.pdf"',
        },
    )
