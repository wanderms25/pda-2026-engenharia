"""
Bootstrap do usuário administrador do sistema.

Executado no startup da aplicação. Se não existir nenhum usuário com role
ADMIN, cria o admin padrão com e-mail fixo e senha aleatória, imprimindo
a senha no console (que será capturada pelos logs do Docker).

O admin precisa trocar a senha no primeiro login (senha_temporaria=True).
"""
import logging
import sys
from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.auth import gerar_senha_aleatoria, hash_senha
from app.database import SessionLocal
from app.models.orm import Usuario

logger = logging.getLogger("pda.bootstrap")

ADMIN_EMAIL = "wanderson@wanderson.eng.br"
ADMIN_NOME = "Wanderson (Administrador)"


def bootstrap_admin() -> None:
    """
    Cria o usuário admin inicial se ainda não existir.

    Imprime a senha gerada em destaque no stdout para que o operador
    possa capturá-la nos logs do container Docker.
    """
    db: Session = SessionLocal()
    try:
        existente = (
            db.query(Usuario).filter(Usuario.role == "ADMIN").first()
        )
        if existente is not None:
            logger.info(
                "Admin já cadastrado (%s). Pulando bootstrap.", existente.email
            )
            return

        # Gera senha aleatória e cria o admin
        senha = gerar_senha_aleatoria(tamanho=12)
        admin = Usuario(
            id=uuid4(),
            email=ADMIN_EMAIL,
            nome=ADMIN_NOME,
            senha_hash=hash_senha(senha),
            registro_profissional=None,
            ativo=True,
            role="ADMIN",
            validade=None,  # admin não expira
            senha_temporaria=True,  # obriga troca no primeiro login
            criado_por=None,
            criado_em=datetime.utcnow(),
        )
        db.add(admin)
        db.commit()

        # Imprime com destaque no stdout (sys.stdout.write + flush garante
        # que sai mesmo em containers sem line buffering)
        banner = "=" * 72
        msg = (
            f"\n{banner}\n"
            f"  ADMIN INICIAL CRIADO\n"
            f"{banner}\n"
            f"  E-mail: {ADMIN_EMAIL}\n"
            f"  Senha:  {senha}\n"
            f"{banner}\n"
            f"  ATENÇÃO: esta senha é temporária e deve ser alterada no\n"
            f"  primeiro login. Anote-a agora — ela NÃO será exibida\n"
            f"  novamente nos logs.\n"
            f"{banner}\n"
        )
        sys.stdout.write(msg)
        sys.stdout.flush()
        logger.info("Admin '%s' criado com sucesso.", ADMIN_EMAIL)

    except Exception as exc:
        logger.exception("Falha no bootstrap do admin: %s", exc)
        db.rollback()
        raise
    finally:
        db.close()
