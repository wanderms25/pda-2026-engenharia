"""Endpoints do Prontuário de Instalações Elétricas (PIE)."""
from __future__ import annotations

from io import BytesIO
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.models.orm import Usuario
from app.services.pdf_pie import ContextoPIE, ResponsavelPIE, gerar_pdf_pie

router = APIRouter()


class PiePDFRequest(BaseModel):
    """Payload flexível do formulário PIE preenchido no frontend."""
    dados: dict[str, Any] = Field(default_factory=dict)


def _fmt_registro(user: Usuario) -> str:
    tipo = getattr(user, "tipo_registro", None)
    num = getattr(user, "numero_registro", None)
    uf = getattr(user, "uf_profissional", None)
    if tipo and num and uf:
        return f"{tipo}-{uf} Nº {num}"
    if tipo and num:
        return f"{tipo} Nº {num}"
    return getattr(user, "registro_profissional", "") or ""


def _clean_filename(value: str) -> str:
    value = value.strip().lower() or "instalacao"
    allowed = []
    for char in value:
        if char.isalnum():
            allowed.append(char)
        elif char in (" ", "-", "_", "."):
            allowed.append("-")
    filename = "".join(allowed).strip("-") or "instalacao"
    while "--" in filename:
        filename = filename.replace("--", "-")
    return filename


@router.post("/pie/pdf")
async def gerar_pdf_pie_endpoint(
    req: PiePDFRequest,
    user: Usuario = Depends(get_current_user),
) -> StreamingResponse:
    """
    Gera o PDF do Prontuário de Instalações Elétricas (PIE) com os dados do
    formulário e com os dados do responsável técnico logado como fallback.
    """
    dados = req.dados or {}
    ident = dados.get("identificacao", {}) or {}
    resp_form = dados.get("responsavel", {}) or {}

    responsavel = ResponsavelPIE(
        nome=resp_form.get("nome") or ident.get("responsavelTecnico") or user.nome or "",
        registro=resp_form.get("crea") or ident.get("crea") or _fmt_registro(user),
        art=resp_form.get("art") or "",
        empresa=resp_form.get("empresa") or getattr(user, "empresa", "") or "",
        telefone=resp_form.get("telefone") or getattr(user, "telefone", "") or "",
        email=resp_form.get("email") or user.email or "",
        endereco=getattr(user, "endereco", "") or "",
        logo_base64=getattr(user, "logo_base64", "") or "",
        data=resp_form.get("data") or "",
    )

    contexto = ContextoPIE(dados=dados, responsavel=responsavel)
    pdf_bytes = gerar_pdf_pie(contexto)

    nome = ident.get("condominio") or "instalacao"
    filename = f"pie-{_clean_filename(str(nome))}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
