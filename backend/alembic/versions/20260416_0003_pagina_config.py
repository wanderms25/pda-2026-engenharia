"""Add pagina_config table for dynamic landing page editor

Revision ID: 20260416_0003_pagina_config
Revises: 20260415_0002
Create Date: 2026-04-16 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260416_0003_pagina_config"
down_revision = "20260415_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pagina_config",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(60), unique=True, nullable=False, server_default="apresentacao"),
        sa.Column("conteudo_json", sa.Text, nullable=False, server_default="{}"),
        sa.Column("atualizado_em", sa.DateTime, server_default=sa.text("NOW()")),
        # UUID to match usuarios.id type
        sa.Column("atualizado_por", UUID(as_uuid=True), sa.ForeignKey("usuarios.id"), nullable=True),
    )
    op.execute("""
        INSERT INTO pagina_config (id, slug, conteudo_json)
        VALUES (1, 'apresentacao', '{}')
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("pagina_config")
