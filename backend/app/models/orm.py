"""
Models ORM — SQLAlchemy 2.x (declarative + Mapped). v0.7.0
"""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    registro_profissional: Mapped[str | None] = mapped_column(String(60))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="USER", nullable=False)
    validade: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    senha_temporaria: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_por: Mapped[UUID | None] = mapped_column(PgUUID(as_uuid=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Perfil profissional (v0.7.0)
    empresa: Mapped[str | None] = mapped_column(String(255), nullable=True)
    logo_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    uf_profissional: Mapped[str | None] = mapped_column(String(2), nullable=True)
    tipo_registro: Mapped[str | None] = mapped_column(String(20), nullable=True)
    numero_registro: Mapped[str | None] = mapped_column(String(50), nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cpf: Mapped[str | None] = mapped_column(String(14), nullable=True)
    endereco: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Cliente(Base):
    __tablename__ = "clientes"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    razao_social: Mapped[str] = mapped_column(String(255), nullable=False)
    cnpj: Mapped[str | None] = mapped_column(String(20), unique=True)
    contato_nome: Mapped[str | None] = mapped_column(String(255))
    contato_email: Mapped[str | None] = mapped_column(String(255))
    contato_telefone: Mapped[str | None] = mapped_column(String(32))
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Cadastro completo (v0.7.0)
    tipo_pessoa: Mapped[str | None] = mapped_column(String(2), nullable=True, default="PF")
    cpf_cnpj: Mapped[str | None] = mapped_column(String(18), nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    endereco: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cidade: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uf_cliente: Mapped[str | None] = mapped_column(String(2), nullable=True)
    cep: Mapped[str | None] = mapped_column(String(9), nullable=True)
    responsavel: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nome_fantasia: Mapped[str | None] = mapped_column(String(255), nullable=True)

    projetos: Mapped[list["Projeto"]] = relationship(back_populates="cliente", cascade="all, delete-orphan")


class Projeto(Base):
    __tablename__ = "projetos"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    cliente_id: Mapped[UUID] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    endereco: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    uf: Mapped[str | None] = mapped_column(String(2))
    municipio: Mapped[str | None] = mapped_column(String(120))
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cliente: Mapped[Cliente] = relationship(back_populates="projetos")
    estruturas: Mapped[list["Estrutura"]] = relationship(back_populates="projeto", cascade="all, delete-orphan")


class Estrutura(Base):
    __tablename__ = "estruturas"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    projeto_id: Mapped[UUID] = mapped_column(ForeignKey("projetos.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    comprimento_L_m: Mapped[float] = mapped_column(Float, nullable=False)
    largura_W_m: Mapped[float] = mapped_column(Float, nullable=False)
    altura_H_m: Mapped[float] = mapped_column(Float, nullable=False)
    NG: Mapped[float] = mapped_column(Float, nullable=False)
    tipo_estrutura: Mapped[str] = mapped_column(String(40), nullable=False)
    localizacao: Mapped[str] = mapped_column(String(40), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    projeto: Mapped[Projeto] = relationship(back_populates="estruturas")
    linhas: Mapped[list["LinhaEletrica"]] = relationship(back_populates="estrutura", cascade="all, delete-orphan")
    analises: Mapped[list["AnaliseRisco"]] = relationship(back_populates="estrutura", cascade="all, delete-orphan")
    laudos: Mapped[list["Laudo"]] = relationship(back_populates="estrutura", cascade="all, delete-orphan")


class LinhaEletrica(Base):
    __tablename__ = "linhas_eletricas"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    estrutura_id: Mapped[UUID] = mapped_column(ForeignKey("estruturas.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    comprimento_m: Mapped[float] = mapped_column(Float, nullable=False)
    instalacao: Mapped[str] = mapped_column(String(40), nullable=False)
    tipo: Mapped[str] = mapped_column(String(40), nullable=False)
    ambiente: Mapped[str] = mapped_column(String(40), nullable=False)
    tensao_UW_kV: Mapped[float] = mapped_column(Float, default=2.5)

    estrutura: Mapped[Estrutura] = relationship(back_populates="linhas")


class AnaliseRisco(Base):
    __tablename__ = "analises_risco"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    estrutura_id: Mapped[UUID] = mapped_column(ForeignKey("estruturas.id"), nullable=False)
    versao: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    entrada_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    resultado_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    R1: Mapped[float] = mapped_column(Float, nullable=False)
    R3: Mapped[float] = mapped_column(Float, nullable=False)
    R4: Mapped[float | None] = mapped_column(Float)
    conforme: Mapped[bool] = mapped_column(Boolean, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    criado_por: Mapped[str | None] = mapped_column(String(120))

    estrutura: Mapped[Estrutura] = relationship(back_populates="analises")


class Laudo(Base):
    __tablename__ = "laudos"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    estrutura_id: Mapped[UUID] = mapped_column(ForeignKey("estruturas.id"), nullable=False)
    data_inspecao: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    inspetor_nome: Mapped[str] = mapped_column(String(255), nullable=False)
    inspetor_registro: Mapped[str | None] = mapped_column(String(60))
    art: Mapped[str | None] = mapped_column(String(60))
    respostas_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    total_conformes: Mapped[int] = mapped_column(Integer, default=0)
    total_nao_conformes: Mapped[int] = mapped_column(Integer, default=0)
    total_na: Mapped[int] = mapped_column(Integer, default=0)
    observacoes: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    estrutura: Mapped[Estrutura] = relationship(back_populates="laudos")
    fotos: Mapped[list["FotoLaudo"]] = relationship(back_populates="laudo", cascade="all, delete-orphan")


class FotoLaudo(Base):
    __tablename__ = "fotos_laudo"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    laudo_id: Mapped[UUID] = mapped_column(ForeignKey("laudos.id"), nullable=False, index=True)
    codigo_item: Mapped[str] = mapped_column(String(20), nullable=False)
    legenda: Mapped[str | None] = mapped_column(Text)
    arquivo_base64: Mapped[str] = mapped_column(Text, nullable=False)
    nome_arquivo: Mapped[str | None] = mapped_column(String(255))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    data_foto: Mapped[datetime | None] = mapped_column(DateTime)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    laudo: Mapped[Laudo] = relationship(back_populates="fotos")

class PaginaConfig(Base):
    """
    Configuração dinâmica da página de apresentação (landing page).
    Editável somente por administradores. Armazena JSON com seções,
    menus, imagens e textos.
    """
    __tablename__ = "pagina_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, default="apresentacao")
    conteudo_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    atualizado_por: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )

