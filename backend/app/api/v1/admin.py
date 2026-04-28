"""
Endpoints administrativos — gerenciamento de usuários (somente ADMIN).

- POST /admin/usuarios           → cria usuário com senha aleatória
- GET  /admin/usuarios           → lista usuários
- DELETE /admin/usuarios/{id}    → remove usuário
- POST /admin/usuarios/{id}/reset-senha → gera nova senha aleatória
"""
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.auth import gerar_senha_aleatoria, hash_senha, require_admin
from app.database import get_db
from app.models.orm import Usuario

router = APIRouter()


class CriarUsuarioRequest(BaseModel):
    email: EmailStr
    nome: str = Field(min_length=2, max_length=255)
    registro_profissional: str | None = None
    validade: datetime | None = Field(
        default=None,
        description="Data de expiração do cadastro. Se None, não expira.",
    )
    role: str = Field(default="USER", pattern="^(ADMIN|USER)$")


class UsuarioCriadoResponse(BaseModel):
    """Response especial que inclui a senha gerada (mostrar só uma vez)."""
    id: str
    email: str
    nome: str
    role: str
    validade: datetime | None
    senha_gerada: str = Field(
        description="Senha temporária gerada. Passe ao usuário de forma segura. Não será exibida novamente."
    )


class UsuarioListItem(BaseModel):
    id: str
    email: str
    nome: str
    registro_profissional: str | None
    role: str
    ativo: bool
    validade: datetime | None
    senha_temporaria: bool
    criado_em: datetime


@router.post(
    "/usuarios",
    response_model=UsuarioCriadoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_usuario(
    req: CriarUsuarioRequest,
    admin: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UsuarioCriadoResponse:
    """
    Cria um novo usuário com senha aleatória.

    A senha é gerada pelo sistema e retornada UMA ÚNICA VEZ na resposta.
    O usuário deverá trocá-la no primeiro login.
    """
    # E-mail duplicado?
    existente = db.query(Usuario).filter(Usuario.email == req.email).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail já cadastrado",
        )

    senha = gerar_senha_aleatoria(tamanho=12)
    usuario = Usuario(
        id=uuid4(),
        email=req.email,
        nome=req.nome,
        senha_hash=hash_senha(senha),
        registro_profissional=req.registro_profissional,
        ativo=True,
        role=req.role,
        validade=req.validade,
        senha_temporaria=True,
        criado_por=admin.id,
        criado_em=datetime.utcnow(),
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    return UsuarioCriadoResponse(
        id=str(usuario.id),
        email=usuario.email,
        nome=usuario.nome,
        role=usuario.role,
        validade=usuario.validade,
        senha_gerada=senha,
    )


@router.get("/usuarios", response_model=list[UsuarioListItem])
async def listar_usuarios(
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[UsuarioListItem]:
    """Lista todos os usuários do sistema."""
    usuarios = db.query(Usuario).order_by(Usuario.criado_em.desc()).all()
    return [
        UsuarioListItem(
            id=str(u.id),
            email=u.email,
            nome=u.nome,
            registro_profissional=u.registro_profissional,
            role=u.role,
            ativo=u.ativo,
            validade=u.validade,
            senha_temporaria=u.senha_temporaria,
            criado_em=u.criado_em,
        )
        for u in usuarios
    ]


@router.post("/usuarios/{usuario_id}/reset-senha", response_model=UsuarioCriadoResponse)
async def reset_senha(
    usuario_id: UUID,
    admin: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UsuarioCriadoResponse:
    """
    Gera uma nova senha aleatória para o usuário.

    Usado quando o usuário esqueceu a senha. O usuário deverá trocá-la
    no próximo login.
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")

    senha = gerar_senha_aleatoria(tamanho=12)
    usuario.senha_hash = hash_senha(senha)
    usuario.senha_temporaria = True
    db.commit()
    db.refresh(usuario)

    return UsuarioCriadoResponse(
        id=str(usuario.id),
        email=usuario.email,
        nome=usuario.nome,
        role=usuario.role,
        validade=usuario.validade,
        senha_gerada=senha,
    )


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_usuario(
    usuario_id: UUID,
    admin: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Remove um usuário (não pode ser o próprio admin logado)."""
    if str(usuario_id) == str(admin.id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Você não pode deletar sua própria conta",
        )
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")
    db.delete(usuario)
    db.commit()
