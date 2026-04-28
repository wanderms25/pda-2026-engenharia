"""
Serviço de geração de PDF do laudo de inspeção (Partes 3 e 4 da NBR 5419:2026).

Diferente do `pdf_generator.py` (que gera o PDF da análise de risco), este
módulo gera o PDF da inspeção em campo, com:
- Checklist item-a-item com status
- Plano de remediação agrupado por prioridade
- Anexo fotográfico organizado por categoria/item
- Cálculo da próxima inspeção conforme NBR 5419-3:2026, 7.3.2.f
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.services.checklist_inspecao import (
    CHECKLIST_INSPECAO,
    agrupar_por_categoria,
    periodicidade_inspecao,
)
from app.services.laudo_remediador import (
    PrioridadeAcao,
    ResultadoRemediacao,
    analisar_laudo,
)
from app.services.pdf_generator import ProjetoInfo, ResponsavelTecnico

TEMPLATES_DIR = Path(__file__).parent / "templates"

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

CATEGORIA_LABELS: dict[str, str] = {
    "DOCUMENTACAO": "Documentação",
    "CAPTACAO": "Subsistema de Captação",
    "DESCIDA": "Subsistema de Descida",
    "ATERRAMENTO": "Subsistema de Aterramento",
    "EQUIPOTENCIALIZACAO": "Equipotencialização",
    "DISTANCIAS_SEGURANCA": "Distâncias de Segurança",
    "MPS_DPS": "MPS e DPS",
    "ENSAIOS": "Ensaios",
}


@dataclass
class FotoLaudoContext:
    """Foto pronta para renderização no template."""
    codigo_item: str
    legenda: str
    data_uri: str
    latitude: float | None = None
    longitude: float | None = None
    categoria: str = ""


@dataclass
class ContextoLaudoInspecao:
    """Contexto completo necessário para renderizar o PDF do laudo."""
    projeto: ProjetoInfo
    responsavel: ResponsavelTecnico
    respostas: dict[str, str]
    fotos: list[FotoLaudoContext] = field(default_factory=list)

    # Flags para calcular periodicidade
    area_classificada: bool = False
    atmosfera_agressiva: bool = False
    servico_essencial: bool = False

    # Dados de dimensionamento e proteção para incluir no laudo
    spda_nivel: str = "NENHUM"
    dps_nivel: str = "NENHUM"
    dps_classe_I: str = "NENHUM"
    perimetro_m: float = 0.0
    num_descidas: int = 0
    altura_estrutura: float = 0.0
    area_estrutura: float = 0.0


def _mapear_fotos_por_categoria(
    fotos: list[FotoLaudoContext],
    codigo_to_categoria: dict[str, str],
) -> dict[str, list[FotoLaudoContext]]:
    """Agrupa as fotos pela categoria do item do checklist."""
    agrupado: dict[str, list[FotoLaudoContext]] = {}
    for foto in fotos:
        categoria = codigo_to_categoria.get(foto.codigo_item, "OUTROS")
        foto.categoria = categoria
        agrupado.setdefault(categoria, []).append(foto)
    return agrupado


def _extrair_acoes_por_prioridade(
    resultado: ResultadoRemediacao,
) -> tuple[list, list, list]:
    """Separa as ações em 3 listas conforme prioridade."""
    imediatas = [a for a in resultado.acoes if a.prioridade == PrioridadeAcao.IMEDIATO]
    curto_prazo = [a for a in resultado.acoes if a.prioridade == PrioridadeAcao.CURTO_PRAZO]
    preventivas = [a for a in resultado.acoes if a.prioridade == PrioridadeAcao.PREVENTIVO]
    return imediatas, curto_prazo, preventivas


def gerar_html_laudo_inspecao(contexto: ContextoLaudoInspecao) -> str:
    """Renderiza o template HTML do laudo de inspeção."""

    # 1. Analisa o laudo para gerar o plano de remediação
    resultado = analisar_laudo(
        respostas=contexto.respostas,
        itens_checklist_total=len(CHECKLIST_INSPECAO),
    )

    # 2. Agrupa o checklist por categoria (para exibir tudo no laudo)
    checklist_agrupado = {
        cat.value: itens
        for cat, itens in agrupar_por_categoria().items()
    }

    # 3. Mapa código → categoria (para agrupar fotos)
    codigo_to_categoria = {
        item.codigo: item.categoria.value for item in CHECKLIST_INSPECAO
    }

    # 4. Agrupa fotos por categoria
    fotos_por_categoria = _mapear_fotos_por_categoria(
        contexto.fotos, codigo_to_categoria
    )

    # 5. Separa ações por prioridade
    imediatas, curto_prazo, preventivas = _extrair_acoes_por_prioridade(resultado)

    # 6. Calcula periodicidade da próxima inspeção
    anos_proxima = periodicidade_inspecao(
        tem_area_classificada=contexto.area_classificada,
        atmosfera_agressiva=contexto.atmosfera_agressiva,
        servico_essencial=contexto.servico_essencial,
    )
    data_hoje = datetime.now()
    proxima_data = data_hoje + timedelta(days=365 * anos_proxima)

    # 7. Monta contexto do template
    template_ctx: dict[str, Any] = {
        "projeto": contexto.projeto,
        "responsavel": contexto.responsavel,
        "respostas": contexto.respostas,
        "resultado": resultado,
        "checklist_agrupado": checklist_agrupado,
        "categoria_labels": CATEGORIA_LABELS,
        "fotos": contexto.fotos,
        "fotos_por_categoria": fotos_por_categoria,
        "spda_nivel": contexto.spda_nivel,
        "dps_nivel": contexto.dps_nivel,
        "dps_classe_I": contexto.dps_classe_I,
        "perimetro_m": contexto.perimetro_m,
        "num_descidas": contexto.num_descidas,
        "altura_estrutura": contexto.altura_estrutura,
        "area_estrutura": contexto.area_estrutura,
        "acoes_imediatas": imediatas,
        "acoes_curto_prazo": curto_prazo,
        "acoes_preventivas": preventivas,
        "data_inspecao": data_hoje.strftime("%d/%m/%Y"),
        "numero_documento": f"INSP-{data_hoje.strftime('%Y%m%d%H%M%S')}",
        "proxima_inspecao_anos": anos_proxima,
        "proxima_inspecao_data": proxima_data.strftime("%d/%m/%Y"),
    }

    template = _jinja_env.get_template("laudo_inspecao.html")
    return template.render(**template_ctx)


def gerar_pdf_laudo_inspecao(contexto: ContextoLaudoInspecao) -> bytes:
    """
    Gera o PDF completo do laudo de inspeção usando WeasyPrint.

    Retorna os bytes do PDF prontos para StreamingResponse.
    """
    html_content = gerar_html_laudo_inspecao(contexto)

    try:
        from weasyprint import HTML  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "WeasyPrint não instalado. Rodar `pip install weasyprint` e "
            "garantir as dependências de sistema (libpango, libcairo)."
        ) from exc

    return HTML(string=html_content).write_pdf()
