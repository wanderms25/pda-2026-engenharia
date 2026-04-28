"""
Endpoints de CRUD de clientes, projetos, estruturas e histórico de análises.

Todas as rotas são protegidas por JWT (Depends(get_current_user)).
"""
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.orm import AnaliseRisco, Cliente, Estrutura, Projeto, Usuario

router = APIRouter()


# =============================================================================
# CLIENTES
# =============================================================================
class ClienteIn(BaseModel):
    razao_social: str = Field(min_length=2, max_length=255)
    cnpj: str | None = None
    contato_nome: str | None = None
    contato_email: str | None = None
    contato_telefone: str | None = None


class ClienteOut(BaseModel):
    id: str
    razao_social: str
    cnpj: str | None
    contato_nome: str | None
    contato_email: str | None
    contato_telefone: str | None


def _cliente_to_out(c: Cliente) -> ClienteOut:
    return ClienteOut(
        id=str(c.id),
        razao_social=c.razao_social,
        cnpj=c.cnpj,
        contato_nome=c.contato_nome,
        contato_email=c.contato_email,
        contato_telefone=c.contato_telefone,
    )


@router.get("/clientes", response_model=list[ClienteOut])
async def listar_clientes(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> list[ClienteOut]:
    clientes = db.query(Cliente).order_by(Cliente.razao_social).all()
    return [_cliente_to_out(c) for c in clientes]


@router.post("/clientes", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
async def criar_cliente(
    req: ClienteIn,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> ClienteOut:
    cliente = Cliente(
        id=uuid4(),
        razao_social=req.razao_social,
        cnpj=req.cnpj,
        contato_nome=req.contato_nome,
        contato_email=req.contato_email,
        contato_telefone=req.contato_telefone,
        criado_em=datetime.utcnow(),
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return _cliente_to_out(cliente)


@router.delete("/clientes/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_cliente(
    cliente_id: UUID,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> None:
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    db.delete(cliente)
    db.commit()


# =============================================================================
# PROJETOS
# =============================================================================
class ProjetoIn(BaseModel):
    cliente_id: UUID
    nome: str = Field(min_length=2, max_length=255)
    endereco: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    uf: str | None = Field(default=None, max_length=2)
    municipio: str | None = None


class ProjetoOut(BaseModel):
    id: str
    cliente_id: str
    nome: str
    endereco: str | None
    latitude: float | None
    longitude: float | None
    uf: str | None
    municipio: str | None
    criado_em: datetime


def _projeto_to_out(p: Projeto) -> ProjetoOut:
    return ProjetoOut(
        id=str(p.id),
        cliente_id=str(p.cliente_id),
        nome=p.nome,
        endereco=p.endereco,
        latitude=p.latitude,
        longitude=p.longitude,
        uf=p.uf,
        municipio=p.municipio,
        criado_em=p.criado_em,
    )


@router.get("/projetos", response_model=list[ProjetoOut])
async def listar_projetos(
    cliente_id: UUID | None = None,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> list[ProjetoOut]:
    query = db.query(Projeto)
    if cliente_id:
        query = query.filter(Projeto.cliente_id == cliente_id)
    projetos = query.order_by(Projeto.atualizado_em.desc()).all()
    return [_projeto_to_out(p) for p in projetos]


@router.post("/projetos", response_model=ProjetoOut, status_code=status.HTTP_201_CREATED)
async def criar_projeto(
    req: ProjetoIn,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> ProjetoOut:
    cliente = db.query(Cliente).filter(Cliente.id == req.cliente_id).first()
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")

    projeto = Projeto(
        id=uuid4(),
        cliente_id=req.cliente_id,
        nome=req.nome,
        endereco=req.endereco,
        latitude=req.latitude,
        longitude=req.longitude,
        uf=req.uf,
        municipio=req.municipio,
        criado_em=datetime.utcnow(),
        atualizado_em=datetime.utcnow(),
    )
    db.add(projeto)
    db.commit()
    db.refresh(projeto)
    return _projeto_to_out(projeto)


@router.get("/projetos/{projeto_id}", response_model=ProjetoOut)
async def obter_projeto(
    projeto_id: UUID,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> ProjetoOut:
    projeto = db.query(Projeto).filter(Projeto.id == projeto_id).first()
    if not projeto:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto não encontrado")
    return _projeto_to_out(projeto)


@router.delete("/projetos/{projeto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_projeto(
    projeto_id: UUID,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> None:
    projeto = db.query(Projeto).filter(Projeto.id == projeto_id).first()
    if not projeto:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto não encontrado")
    db.delete(projeto)
    db.commit()


# =============================================================================
# HISTÓRICO DE ANÁLISES DE UMA ESTRUTURA
# =============================================================================
class AnaliseHistoricoOut(BaseModel):
    id: str
    versao: int
    R1: float
    R3: float
    conforme: bool
    criado_em: datetime


@router.get(
    "/estruturas/{estrutura_id}/analises",
    response_model=list[AnaliseHistoricoOut],
)
async def listar_analises_estrutura(
    estrutura_id: UUID,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> list[AnaliseHistoricoOut]:
    """
    Lista o histórico de análises de risco de uma estrutura.

    Atende ao requisito de auditoria da NBR 5419-3:2026, 7.5 (documentação técnica).
    """
    analises = (
        db.query(AnaliseRisco)
        .filter(AnaliseRisco.estrutura_id == estrutura_id)
        .order_by(AnaliseRisco.criado_em.desc())
        .all()
    )
    return [
        AnaliseHistoricoOut(
            id=str(a.id),
            versao=a.versao,
            R1=a.R1,
            R3=a.R3,
            conforme=a.conforme,
            criado_em=a.criado_em,
        )
        for a in analises
    ]
