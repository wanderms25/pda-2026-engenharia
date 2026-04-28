"""
Autenticação JWT do sistema PDA-NBR5419.

- Hash de senha via `bcrypt` direto (sem passlib, que está desatualizado)
- JWT (HS256) via python-jose
- Truncagem automática a 72 bytes (limite do bcrypt)
- Roles: ADMIN e USER
- get_current_user / require_admin como dependencies do FastAPI
"""
import secrets
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.orm import Usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ALGORITMO = "HS256"


# =============================================================================
# HASH DE SENHA
# =============================================================================
def _truncar(senha: str) -> bytes:
    """Bcrypt aceita no máximo 72 bytes. Truncar preserva compatibilidade."""
    return senha.encode("utf-8")[:72]


def hash_senha(senha: str) -> str:
    """Hash bcrypt da senha. Usa 12 rounds (boa segurança + performance)."""
    return bcrypt.hashpw(_truncar(senha), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verificar_senha(senha: str, senha_hash: str) -> bool:
    """Verifica se a senha em texto confere com o hash armazenado."""
    try:
        return bcrypt.checkpw(_truncar(senha), senha_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def gerar_senha_aleatoria(tamanho: int = 12) -> str:
    """
    Gera uma senha aleatória segura (URL-safe base64).

    12 bytes ≈ 16 caracteres — suficiente para entropia alta mas ainda
    possível de ditar por telefone se necessário.
    """
    return secrets.token_urlsafe(tamanho)


# =============================================================================
# JWT
# =============================================================================
def criar_token_acesso(
    subject: str | UUID,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """
    Cria JWT assinado com SECRET_KEY.

    `extra_claims` permite incluir metadados (ex: role, senha_temporaria).
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": datetime.utcnow() + expires_delta,
        "iat": datetime.utcnow(),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITMO)


def decodificar_token(token: str) -> dict[str, Any]:
    """Valida e decodifica um JWT. Lança JWTError se inválido."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITMO])


# =============================================================================
# DEPENDENCIES
# =============================================================================
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Dependency que recupera o usuário autenticado a partir do JWT.

    Também valida:
    - Usuário está ativo
    - Validade do cadastro não expirou
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou expiradas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decodificar_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
    if usuario is None or not usuario.ativo:
        raise credentials_exception

    # Valida expiração do cadastro
    if usuario.validade is not None and usuario.validade < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cadastro expirado. Contate o administrador.",
        )

    return usuario


def require_admin(user: Usuario = Depends(get_current_user)) -> Usuario:
    """Dependency que exige role ADMIN."""
    if user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem acessar este recurso.",
        )
    return user
