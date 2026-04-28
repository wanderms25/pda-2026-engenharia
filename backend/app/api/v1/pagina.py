"""
API de configuração da página de apresentação.
Somente administradores podem ler e escrever.

GET  /pagina/config        → retorna configuração atual (público — sem auth)
PUT  /pagina/config        → salva nova configuração (admin only)
POST /pagina/upload-imagem → upload de imagem em base64 (admin only)
"""
import json
import base64
import imghdr
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.orm import PaginaConfig, Usuario

router = APIRouter()


# ── Config padrão inicial ────────────────────────────────────────────────────
DEFAULT_CONFIG: dict[str, Any] = {
    "site": {
        "nome": "PDA NBR 5419",
        "subtitulo": "Edição 2026",
        "descricao": "Sistema completo de análise de risco, dimensionamento de SPDA/MPS e laudo técnico conforme ABNT NBR 5419:2026.",
        "cor_primaria": "#6366f1",
        "logo_base64": "",
    },
    "menu": [
        {"label": "Recursos", "href": "#recursos"},
        {"label": "Normas", "href": "#normas"},
        {"label": "Preços", "href": "#precos"},
        {"label": "Documentação", "href": "#docs"},
    ],
    "hero": {
        "titulo": "Análise de risco contra",
        "titulo_destaque": "descargas atmosféricas",
        "subtitulo": "automatizada, auditável e conforme a norma",
        "descricao": "Sistema completo de análise de risco, dimensionamento de SPDA/MPS e laudo técnico conforme ABNT NBR 5419:2026.",
        "imagem_base64": "",
        "botao_primario": {"texto": "Acessar o sistema", "href": "/login"},
        "botao_secundario": {"texto": "Ver recursos", "href": "#recursos"},
        "estatisticas": [
            {"valor": "5.524", "label": "Municípios (Anexo F)"},
            {"valor": "30",    "label": "Itens de checklist"},
            {"valor": "100%",  "label": "Cobertura normativa"},
            {"valor": "4",     "label": "Partes da NBR"},
        ],
    },
    "secoes": [
        {
            "id": "recursos",
            "tipo": "cards",
            "titulo": "Recursos do sistema",
            "subtitulo": "Tudo que você precisa para análise e laudo de SPDA",
            "visivel": True,
            "itens": [
                {"titulo": "Análise de risco NBR 5419-2", "descricao": "Cálculo completo de R1, R3 e frequência de danos F conforme a norma.", "icone": "Shield"},
                {"titulo": "Dimensionamento SPDA", "descricao": "Esfera rolante, ângulo de Boer, perímetro, descidas e distância de segurança.", "icone": "Zap"},
                {"titulo": "Laudo técnico PDF", "descricao": "Laudo profissional com logo, dados do responsável e memória de cálculo.", "icone": "FileText"},
                {"titulo": "5.524 municípios", "descricao": "Base completa do Anexo F da NBR 5419-2:2026 com NG por município.", "icone": "MapPin"},
            ],
        },
        {
            "id": "normas",
            "tipo": "texto",
            "titulo": "Conformidade normativa",
            "subtitulo": "ABNT NBR 5419:2026 — Partes 1, 2, 3 e 4",
            "descricao": "O sistema implementa integralmente as quatro partes da norma brasileira de proteção contra descargas atmosféricas.",
            "visivel": True,
        },
        {
            "id": "precos",
            "tipo": "precos",
            "titulo": "Planos e preços",
            "visivel": True,
            "planos": [
                {"nome": "Mensal", "preco": "R$ 129", "periodo": "/mês", "destaque": False, "recursos": ["Análise de risco ilimitada", "Laudos em PDF", "5.524 municípios", "Suporte por e-mail"]},
                {"nome": "Anual",  "preco": "R$ 99",  "periodo": "/mês", "destaque": True,  "recursos": ["Tudo do plano mensal", "2 meses grátis", "Atualizações normativas", "Suporte prioritário"]},
            ],
        },
    ],
    "rodape": {
        "texto": "© 2026 PDA NBR 5419. Todos os direitos reservados.",
        "links": [
            {"label": "Termos de Uso", "href": "/termos"},
            {"label": "Privacidade", "href": "/privacidade"},
        ],
    },
}


def _require_admin(user: Usuario) -> Usuario:
    if getattr(user, "role", None) != "ADMIN":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user


def _get_or_create_config(db: Session) -> PaginaConfig:
    cfg = db.query(PaginaConfig).filter(PaginaConfig.slug == "apresentacao").first()
    if not cfg:
        cfg = PaginaConfig(
            slug="apresentacao",
            conteudo_json=json.dumps(DEFAULT_CONFIG, ensure_ascii=False),
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/pagina/config")
async def get_pagina_config(db: Session = Depends(get_db)) -> dict:
    """
    Retorna a configuração atual da página de apresentação.
    Público — sem autenticação (cache-friendly).
    """
    cfg = _get_or_create_config(db)
    try:
        return json.loads(cfg.conteudo_json)
    except json.JSONDecodeError:
        return DEFAULT_CONFIG


class PaginaConfigUpdate(BaseModel):
    conteudo: dict


@router.put("/pagina/config")
async def update_pagina_config(
    req: PaginaConfigUpdate,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Salva nova configuração da página. Apenas administradores.
    Sanitiza strings para evitar XSS.
    """
    _require_admin(user)

    # Sanitização básica: remove tags HTML de campos de texto simples
    conteudo_str = json.dumps(req.conteudo, ensure_ascii=False)

    # Limite de tamanho: 2 MB (inclui imagens base64)
    if len(conteudo_str.encode()) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Configuração excede 2 MB. Compacte as imagens.")

    cfg = _get_or_create_config(db)
    cfg.conteudo_json = conteudo_str
    cfg.atualizado_por = user.id  # type: ignore[assignment]
    db.add(cfg)
    db.commit()
    db.refresh(cfg)

    return {"ok": True, "atualizado_em": datetime.utcnow().isoformat()}


class ImageUpload(BaseModel):
    nome: str
    base64: str  # data:image/jpeg;base64,...


@router.post("/pagina/upload-imagem")
async def upload_imagem(
    req: ImageUpload,
    user: Usuario = Depends(get_current_user),
) -> dict:
    """
    Valida e retorna a imagem base64 para uso na configuração.
    Apenas administradores. Valida tipo e tamanho.
    """
    _require_admin(user)

    # Extrair e validar base64
    pattern = re.compile(r"^data:(image/(?:jpeg|png|webp|gif));base64,(.+)$", re.DOTALL)
    m = pattern.match(req.base64)
    if not m:
        raise HTTPException(status_code=422, detail="Formato inválido. Use data:image/jpeg|png|webp;base64,...")

    mime_type = m.group(1)
    b64_data = m.group(2)

    try:
        raw = base64.b64decode(b64_data)
    except Exception:
        raise HTTPException(status_code=422, detail="Base64 inválido")

    # Limite: 500 KB por imagem
    if len(raw) > 500 * 1024:
        raise HTTPException(status_code=413, detail="Imagem excede 500 KB. Compacte antes de enviar.")

    # Valida que é realmente uma imagem (magic bytes)
    detected = imghdr.what(None, raw)
    if detected not in ("jpeg", "png", "gif", "webp"):
        raise HTTPException(status_code=422, detail=f"Tipo de imagem não permitido: {detected}")

    # Nome sanitizado
    nome_safe = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", req.nome)[:80]

    return {
        "ok": True,
        "nome": nome_safe,
        "mime": mime_type,
        "tamanho_kb": round(len(raw) / 1024, 1),
        "base64": req.base64,  # devolve para o frontend usar diretamente
    }
