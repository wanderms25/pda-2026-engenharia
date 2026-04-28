"""Esquema inicial — clientes, projetos, estruturas, linhas, análises, laudos, usuários

Revision ID: 20260414_0001
Revises:
Create Date: 2026-04-14 22:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260414_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================================
    # usuarios — autenticação JWT
    # =========================================================================
    op.create_table(
        "usuarios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column("registro_profissional", sa.String(60)),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("role", sa.String(20), nullable=False, server_default="USER"),
        sa.Column("validade", sa.DateTime, nullable=True),
        sa.Column("senha_temporaria", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("criado_por", UUID(as_uuid=True), nullable=True),
        sa.Column("criado_em", sa.DateTime, nullable=False),
    )
    op.create_index("ix_usuarios_email", "usuarios", ["email"])

    # =========================================================================
    # clientes
    # =========================================================================
    op.create_table(
        "clientes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("razao_social", sa.String(255), nullable=False),
        sa.Column("cnpj", sa.String(20), unique=True),
        sa.Column("contato_nome", sa.String(255)),
        sa.Column("contato_email", sa.String(255)),
        sa.Column("contato_telefone", sa.String(32)),
        sa.Column("criado_em", sa.DateTime, nullable=False),
    )

    # =========================================================================
    # projetos
    # =========================================================================
    op.create_table(
        "projetos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cliente_id", UUID(as_uuid=True), sa.ForeignKey("clientes.id"), nullable=False),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("endereco", sa.Text),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("uf", sa.String(2)),
        sa.Column("municipio", sa.String(120)),
        sa.Column("criado_em", sa.DateTime, nullable=False),
        sa.Column("atualizado_em", sa.DateTime, nullable=False),
    )
    op.create_index("ix_projetos_cliente_id", "projetos", ["cliente_id"])

    # =========================================================================
    # estruturas
    # =========================================================================
    op.create_table(
        "estruturas",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("projeto_id", UUID(as_uuid=True), sa.ForeignKey("projetos.id"), nullable=False),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("comprimento_L_m", sa.Float, nullable=False),
        sa.Column("largura_W_m", sa.Float, nullable=False),
        sa.Column("altura_H_m", sa.Float, nullable=False),
        sa.Column("NG", sa.Float, nullable=False),
        sa.Column("tipo_estrutura", sa.String(40), nullable=False),
        sa.Column("localizacao", sa.String(40), nullable=False),
        sa.Column("criado_em", sa.DateTime, nullable=False),
    )
    op.create_index("ix_estruturas_projeto_id", "estruturas", ["projeto_id"])

    # =========================================================================
    # linhas_eletricas
    # =========================================================================
    op.create_table(
        "linhas_eletricas",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("estrutura_id", UUID(as_uuid=True), sa.ForeignKey("estruturas.id"), nullable=False),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("comprimento_m", sa.Float, nullable=False),
        sa.Column("instalacao", sa.String(40), nullable=False),
        sa.Column("tipo", sa.String(40), nullable=False),
        sa.Column("ambiente", sa.String(40), nullable=False),
        sa.Column("tensao_UW_kV", sa.Float, server_default="2.5"),
    )

    # =========================================================================
    # analises_risco — imutáveis (versionadas)
    # =========================================================================
    op.create_table(
        "analises_risco",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("estrutura_id", UUID(as_uuid=True), sa.ForeignKey("estruturas.id"), nullable=False),
        sa.Column("versao", sa.Integer, nullable=False, server_default="1"),
        sa.Column("entrada_json", sa.JSON, nullable=False),
        sa.Column("resultado_json", sa.JSON, nullable=False),
        sa.Column("R1", sa.Float, nullable=False),
        sa.Column("R3", sa.Float, nullable=False),
        sa.Column("R4", sa.Float),
        sa.Column("conforme", sa.Boolean, nullable=False),
        sa.Column("criado_em", sa.DateTime, nullable=False),
        sa.Column("criado_por", sa.String(120)),
    )
    op.create_index("ix_analises_risco_estrutura_id", "analises_risco", ["estrutura_id"])

    # =========================================================================
    # laudos
    # =========================================================================
    op.create_table(
        "laudos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("estrutura_id", UUID(as_uuid=True), sa.ForeignKey("estruturas.id"), nullable=False),
        sa.Column("data_inspecao", sa.DateTime, nullable=False),
        sa.Column("inspetor_nome", sa.String(255), nullable=False),
        sa.Column("inspetor_registro", sa.String(60)),
        sa.Column("art", sa.String(60)),
        sa.Column("respostas_json", sa.JSON, nullable=False),
        sa.Column("total_conformes", sa.Integer, server_default="0"),
        sa.Column("total_nao_conformes", sa.Integer, server_default="0"),
        sa.Column("total_na", sa.Integer, server_default="0"),
        sa.Column("observacoes", sa.Text),
        sa.Column("criado_em", sa.DateTime, nullable=False),
    )
    op.create_index("ix_laudos_estrutura_id", "laudos", ["estrutura_id"])

    # =========================================================================
    # fotos — anexo fotográfico do laudo
    # =========================================================================
    op.create_table(
        "fotos_laudo",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("laudo_id", UUID(as_uuid=True), sa.ForeignKey("laudos.id"), nullable=False),
        sa.Column("codigo_item", sa.String(20), nullable=False),
        sa.Column("legenda", sa.Text),
        sa.Column("arquivo_base64", sa.Text, nullable=False),
        sa.Column("nome_arquivo", sa.String(255)),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("data_foto", sa.DateTime),
        sa.Column("criado_em", sa.DateTime, nullable=False),
    )
    op.create_index("ix_fotos_laudo_laudo_id", "fotos_laudo", ["laudo_id"])


def downgrade() -> None:
    op.drop_table("fotos_laudo")
    op.drop_table("laudos")
    op.drop_table("analises_risco")
    op.drop_table("linhas_eletricas")
    op.drop_table("estruturas")
    op.drop_table("projetos")
    op.drop_table("clientes")
    op.drop_table("usuarios")
