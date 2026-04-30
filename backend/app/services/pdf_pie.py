"""
Serviço de geração de PDF para o Prontuário de Instalações Elétricas (PIE).

O PDF é renderizado a partir dos dados preenchidos na aba
`/prontuario-instalacoes-eletricas`, usando Jinja2 + WeasyPrint, no mesmo
padrão dos laudos técnicos existentes do sistema.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).parent / "templates"

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


@dataclass
class ResponsavelPIE:
    nome: str = ""
    registro: str = ""
    art: str = ""
    empresa: str = ""
    telefone: str = ""
    email: str = ""
    endereco: str = ""
    logo_base64: str = ""
    data: str = ""


@dataclass
class ContextoPIE:
    dados: dict[str, Any]
    responsavel: ResponsavelPIE
    numero_documento: str = field(default_factory=lambda: f"PIE-{datetime.now().strftime('%Y%m%d%H%M%S')}")
    data_emissao: str = field(default_factory=lambda: datetime.now().strftime("%d/%m/%Y"))


def _status_label(value: Any) -> str:
    labels = {
        "sim": "Sim",
        "nao": "Não",
        "na": "N/A",
        "adequado": "Adequado",
        "nao_adequado": "Não adequado",
        "baixo": "Baixo",
        "medio": "Médio",
        "alto": "Alto",
        "conforme": "Conformes com a NR-10",
        "parcial": "Parcialmente conformes",
        "nao_conforme": "Não conformes",
        "pendente": "Pendente",
        "andamento": "Andamento",
        "concluido": "Concluído",
        "": "Pendente",
        None: "Pendente",
    }
    return labels.get(value, str(value) if value is not None else "")


def _status_class(value: Any) -> str:
    if value in ("sim", "adequado", "baixo", "conforme", "concluido"):
        return "ok"
    if value in ("medio", "parcial", "andamento", "pendente", "", None, "na"):
        return "warn"
    return "bad"


def _bool_label(value: Any) -> str:
    return "Sim" if bool(value) else "Não"


def _fmt_date(value: Any) -> str:
    if not value:
        return ""
    text = str(value)
    try:
        return datetime.fromisoformat(text).strftime("%d/%m/%Y")
    except ValueError:
        return text


def _first(*values: Any) -> str:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


_jinja_env.filters["status_label"] = _status_label
_jinja_env.filters["status_class"] = _status_class
_jinja_env.filters["bool_label"] = _bool_label
_jinja_env.filters["fmt_date"] = _fmt_date
_jinja_env.globals["first"] = _first


def gerar_html_pie(contexto: ContextoPIE) -> str:
    """Renderiza o HTML do Prontuário de Instalações Elétricas."""
    template = _jinja_env.get_template("prontuario_pie.html")
    return template.render(
        dados=contexto.dados,
        responsavel=contexto.responsavel,
        numero_documento=contexto.numero_documento,
        data_emissao=contexto.data_emissao,
    )


def gerar_pdf_pie(contexto: ContextoPIE) -> bytes:
    """Gera o PDF do PIE e retorna os bytes prontos para envio HTTP."""
    html_content = gerar_html_pie(contexto)

    try:
        from weasyprint import HTML  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "WeasyPrint não instalado. Rodar `pip install weasyprint` e garantir "
            "as dependências de sistema necessárias."
        ) from exc

    return HTML(string=html_content).write_pdf()
