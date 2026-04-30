"""
Entrada principal da API FastAPI — sistema PDA-NBR5419.

No startup:
- Cria o usuário admin inicial se não existir (imprime senha nos logs)
"""
import logging
from contextlib import asynccontextmanager
from app.database import engine
from app.models.orm import Base
from app.bootstrap import bootstrap_admin

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import (
    wizard_analise,
    util,
    admin,
    analise_multi_zona,
    analise_risco,
    auth,
    dashboard,
    fotos,
    calcular,
    laudo,
    laudo_analise,
    word_laudo,
    pagina,
    projetos,
    spda,
    pie,
)
from app.bootstrap import bootstrap_admin
from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. A MÁGICA AQUI: Cria todas as tabelas no banco de dados se elas não existirem!
    Base.metadata.create_all(bind=engine)
    
    # 2. Agora sim, com a tabela "usuarios" criada, o bootstrap funciona perfeitamente
    bootstrap_admin()
    
    yield


app = FastAPI(
    title="PDA-NBR5419 API",
    description=(
        "Sistema completo de análise de risco, projeto de SPDA/MPS e laudo "
        "técnico conforme ABNT NBR 5419:2026 (Partes 1 a 4)."
    ),
    version="0.6.0",
    contact={"name": "Engenharia PDA"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://167.126.14.213",
        "https://pda.wanderops.com.br",
        "http://pda.wanderson.eng.br",
        "https://pda.wanderson.eng.br",

    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Rotas públicas (auth) ===
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Autenticação"])

# === Rotas protegidas por ADMIN ===
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

# === Rotas de cálculo ===
app.include_router(
    analise_risco.router,
    prefix="/api/v1/analise-risco",
    tags=["Análise de Risco (NBR 5419-2)"],
)
app.include_router(
    wizard_analise.router,
    prefix="/api/v1",
    tags=["Wizard Análise de Risco"],
)
app.include_router(
    analise_multi_zona.router,
    prefix="/api/v1",
    tags=["Análise Multi-Zona"],
)
app.include_router(
    spda.router,
    prefix="/api/v1",
    tags=["SPDA e Inspeção (NBR 5419-3 e 4)"],
)
app.include_router(
    laudo.router,
    prefix="/api/v1",
    tags=["Geração de Laudo PDF"],
)
app.include_router(
    calcular.router,
    prefix="/api/v1",
    tags=["Cálculo"],
)
app.include_router(
    word_laudo.router,
    prefix="/api/v1",
    tags=["Laudo Word"],
)
app.include_router(
    laudo_analise.router,
    prefix="/api/v1",
    tags=["Remediação de Laudo"],
)

app.include_router(
    pie.router,
    prefix="/api/v1",
    tags=["Prontuário de Instalações Elétricas"],
)

# === Rotas protegidas por JWT ===
app.include_router(
    projetos.router,
    prefix="/api/v1",
    tags=["Projetos e Clientes"],
)
app.include_router(
    fotos.router,
    prefix="/api/v1",
    tags=["Fotos do Laudo"],
)
app.include_router(
    pagina.router,
    prefix="/api/v1",
    tags=["Página de Apresentação"],
)
app.include_router(
    util.router,
    prefix="/api/v1",
    tags=["Utilitários (CEP/CNPJ)"],
)
app.include_router(
    dashboard.router,
    prefix="/api/v1",
    tags=["Dashboard"],
)


@app.get("/", tags=["Saúde"])
async def health() -> dict[str, str | int]:
    from app.nbr5419.ng_mapa import total_municipios_cadastrados
    from app.services.checklist_inspecao import CHECKLIST_INSPECAO
    return {
        "status": "ok",
        "sistema": "PDA-NBR5419",
        "versao": "0.6.0",
        "norma": "ABNT NBR 5419:2026 (Partes 1, 2, 3 e 4)",
        "ambiente": settings.ENVIRONMENT,
        "municipios_ng": total_municipios_cadastrados(),
        "itens_checklist": len(CHECKLIST_INSPECAO),
    }