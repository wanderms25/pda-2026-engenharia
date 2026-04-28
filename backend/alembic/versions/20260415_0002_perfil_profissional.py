"""perfil_profissional_e_cliente_completo

Revision ID: 20260415_0002
Revises: 20260414_0001_inicial
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa

revision = "20260415_0002"
down_revision = "20260414_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Usuário – perfil profissional
    op.add_column("usuarios", sa.Column("empresa",         sa.String(255), nullable=True))
    op.add_column("usuarios", sa.Column("logo_base64",     sa.Text(),      nullable=True))
    op.add_column("usuarios", sa.Column("uf_profissional", sa.String(2),   nullable=True))
    op.add_column("usuarios", sa.Column("tipo_registro",   sa.String(20),  nullable=True))
    op.add_column("usuarios", sa.Column("numero_registro", sa.String(50),  nullable=True))
    op.add_column("usuarios", sa.Column("telefone",        sa.String(20),  nullable=True))
    op.add_column("usuarios", sa.Column("cpf",             sa.String(14),  nullable=True))
    op.add_column("usuarios", sa.Column("endereco",        sa.String(500), nullable=True))

    # Cliente – cadastro completo
    op.add_column("clientes", sa.Column("tipo_pessoa",   sa.String(2),   nullable=True, server_default="PF"))
    op.add_column("clientes", sa.Column("cpf_cnpj",      sa.String(18),  nullable=True))
    op.add_column("clientes", sa.Column("telefone",      sa.String(20),  nullable=True))
    op.add_column("clientes", sa.Column("email",         sa.String(255), nullable=True))
    op.add_column("clientes", sa.Column("endereco",      sa.String(500), nullable=True))
    op.add_column("clientes", sa.Column("cidade",        sa.String(100), nullable=True))
    op.add_column("clientes", sa.Column("uf_cliente",    sa.String(2),   nullable=True))
    op.add_column("clientes", sa.Column("cep",           sa.String(9),   nullable=True))
    op.add_column("clientes", sa.Column("responsavel",   sa.String(255), nullable=True))
    op.add_column("clientes", sa.Column("nome_fantasia", sa.String(255), nullable=True))


def downgrade() -> None:
    for col in ["empresa","logo_base64","uf_profissional","tipo_registro",
                "numero_registro","telefone","cpf","endereco"]:
        op.drop_column("usuarios", col)
    for col in ["tipo_pessoa","cpf_cnpj","telefone","email","endereco",
                "cidade","uf_cliente","cep","responsavel","nome_fantasia"]:
        op.drop_column("clientes", col)
