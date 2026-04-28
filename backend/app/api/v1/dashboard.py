"""
Endpoint de métricas agregadas para o dashboard.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.orm import AnaliseRisco, Cliente, FotoLaudo, Laudo, Projeto, Usuario
from app.nbr5419.ng_mapa import total_municipios_cadastrados
from app.services.checklist_inspecao import CHECKLIST_INSPECAO

router = APIRouter()


class DashboardMetrics(BaseModel):
    # Contadores principais
    total_clientes: int
    total_projetos: int
    total_analises: int
    total_laudos: int
    total_fotos: int

    # Conformidade
    analises_conformes: int
    analises_nao_conformes: int
    percentual_conformidade: float

    # Base normativa
    total_municipios_ng: int
    total_itens_checklist: int

    # Últimas análises (preview)
    ultimas_analises: list[dict]


@router.get("/dashboard/metricas", response_model=DashboardMetrics)
async def obter_metricas(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> DashboardMetrics:
    """
    Retorna métricas agregadas para o dashboard principal.

    Todas as consultas são protegidas por JWT.
    """
    total_clientes = db.scalar(select(func.count()).select_from(Cliente)) or 0
    total_projetos = db.scalar(select(func.count()).select_from(Projeto)) or 0
    total_analises = db.scalar(select(func.count()).select_from(AnaliseRisco)) or 0
    total_laudos = db.scalar(select(func.count()).select_from(Laudo)) or 0
    total_fotos = db.scalar(select(func.count()).select_from(FotoLaudo)) or 0

    conformes = db.scalar(
        select(func.count()).select_from(AnaliseRisco).where(AnaliseRisco.conforme == True)
    ) or 0
    nao_conformes = total_analises - conformes

    percentual = (conformes / total_analises * 100) if total_analises > 0 else 0.0

    # Últimas 5 análises
    ultimas = (
        db.query(AnaliseRisco)
        .order_by(AnaliseRisco.criado_em.desc())
        .limit(5)
        .all()
    )

    return DashboardMetrics(
        total_clientes=total_clientes,
        total_projetos=total_projetos,
        total_analises=total_analises,
        total_laudos=total_laudos,
        total_fotos=total_fotos,
        analises_conformes=conformes,
        analises_nao_conformes=nao_conformes,
        percentual_conformidade=percentual,
        total_municipios_ng=total_municipios_cadastrados(),
        total_itens_checklist=len(CHECKLIST_INSPECAO),
        ultimas_analises=[
            {
                "id": str(a.id),
                "estrutura_id": str(a.estrutura_id),
                "R1": a.R1,
                "R3": a.R3,
                "conforme": a.conforme,
                "criado_em": a.criado_em.isoformat(),
            }
            for a in ultimas
        ],
    )


@router.get("/dashboard/metricas-publicas")
async def obter_metricas_publicas() -> dict:
    """
    Métricas públicas (sem auth) — apenas estatísticas da base normativa.
    """
    return {
        "total_municipios_ng": total_municipios_cadastrados(),
        "total_itens_checklist": len(CHECKLIST_INSPECAO),
        "versao": "0.5.0",
        "norma": "ABNT NBR 5419:2026 (Partes 1, 2, 3 e 4)",
    }
