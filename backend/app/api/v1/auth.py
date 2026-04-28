"""
Endpoints de autenticação — /auth/login, /auth/me, /auth/trocar-senha. v0.7.0
"""
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, field_validator

from app.auth import criar_token_acesso, get_current_user, hash_senha, verificar_senha
from app.database import get_db
from app.models.orm import Usuario
from sqlalchemy.orm import Session

router = APIRouter()

UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
           "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]

def _so_digitos(v: str) -> str:
    return re.sub(r"\D", "", v or "")

def _validar_cpf(cpf: str) -> bool:
    d = _so_digitos(cpf)
    if len(d) != 11 or len(set(d)) == 1: return False
    for i in range(2):
        s = sum(int(d[j]) * (10 + i - j) for j in range(9 + i))
        r = (s * 10) % 11
        if r == 10: r = 0
        if r != int(d[9 + i]): return False
    return True

def _fmt_cpf(v: str) -> str:
    d = _so_digitos(v)
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:11]}" if len(d) == 11 else v

def _fmt_tel(v: str) -> str:
    d = _so_digitos(v)
    if len(d) == 11: return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10: return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: dict


class UsuarioOut(BaseModel):
    id: str
    email: str
    nome: str
    registro_profissional: Optional[str]
    empresa: Optional[str]
    logo_base64: Optional[str]
    uf_profissional: Optional[str]
    tipo_registro: Optional[str]
    numero_registro: Optional[str]
    telefone: Optional[str]
    cpf: Optional[str]
    endereco: Optional[str]
    role: str
    senha_temporaria: bool
    validade: Optional[datetime]


class TrocarSenhaRequest(BaseModel):
    senha_atual: str = Field(default="", min_length=0)  # opcional no primeiro acesso
    senha_nova: str = Field(min_length=8, max_length=128)


class AtualizarPerfilRequest(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=2, max_length=255)
    registro_profissional: Optional[str] = Field(default=None, max_length=60)
    empresa: Optional[str] = Field(default=None, max_length=255)
    logo_base64: Optional[str] = None
    uf_profissional: Optional[str] = None
    tipo_registro: Optional[str] = None
    numero_registro: Optional[str] = Field(default=None, max_length=50)
    telefone: Optional[str] = None
    cpf: Optional[str] = None
    endereco: Optional[str] = Field(default=None, max_length=500)

    @field_validator("uf_profissional")
    @classmethod
    def val_uf(cls, v):
        if v and v.upper() not in UF_LIST:
            raise ValueError("UF inválida.")
        return v.upper() if v else v

    @field_validator("cpf")
    @classmethod
    def val_cpf(cls, v):
        if v:
            if not _validar_cpf(v):
                raise ValueError("CPF inválido.")
            return _fmt_cpf(v)
        return v

    @field_validator("telefone")
    @classmethod
    def val_tel(cls, v):
        if v:
            d = _so_digitos(v)
            if len(d) not in (10, 11):
                raise ValueError("Telefone: 10 ou 11 dígitos com DDD.")
            return _fmt_tel(v)
        return v


def _usuario_para_dict(u: Usuario) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "nome": u.nome,
        "registro_profissional": u.registro_profissional,
        "empresa": u.empresa,
        "logo_base64": u.logo_base64,
        "uf_profissional": u.uf_profissional,
        "tipo_registro": u.tipo_registro,
        "numero_registro": u.numero_registro,
        "telefone": u.telefone,
        "cpf": u.cpf,
        "endereco": u.endereco,
        "role": u.role,
        "senha_temporaria": u.senha_temporaria,
        "validade": u.validade.isoformat() if u.validade else None,
    }


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == form.username).first()
    if not usuario or not verificar_senha(form.password, usuario.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="E-mail ou senha inválidos",
                            headers={"WWW-Authenticate": "Bearer"})
    if not usuario.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo.")
    if usuario.validade and usuario.validade < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cadastro expirado.")
    token = criar_token_acesso(subject=usuario.id)
    return TokenResponse(access_token=token, usuario=_usuario_para_dict(usuario))


@router.get("/me", response_model=UsuarioOut)
async def me(user: Usuario = Depends(get_current_user)):
    return UsuarioOut(**_usuario_para_dict(user))


@router.post("/trocar-senha", response_model=UsuarioOut)
async def trocar_senha(req: TrocarSenhaRequest, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    # Primeiro acesso com senha temporária: não exige confirmação da senha atual
    if not user.senha_temporaria:
        if not verificar_senha(req.senha_atual, user.senha_hash):
            raise HTTPException(status_code=400, detail="Senha atual incorreta")
        if req.senha_nova == req.senha_atual:
            raise HTTPException(status_code=400, detail="A nova senha deve ser diferente da atual")
    user.senha_hash = hash_senha(req.senha_nova)
    user.senha_temporaria = False
    db.add(user); db.commit(); db.refresh(user)
    return UsuarioOut(**_usuario_para_dict(user))


@router.patch("/me", response_model=UsuarioOut)
async def atualizar_perfil(req: AtualizarPerfilRequest, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    campos = ["nome","registro_profissional","empresa","logo_base64","uf_profissional",
              "tipo_registro","numero_registro","telefone","cpf","endereco"]
    for campo in campos:
        val = getattr(req, campo, None)
        if val is not None:
            setattr(user, campo, val or None if campo != "logo_base64" else val)
    db.add(user); db.commit(); db.refresh(user)
    return UsuarioOut(**_usuario_para_dict(user))
