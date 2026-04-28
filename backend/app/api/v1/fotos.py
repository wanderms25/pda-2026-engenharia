"""
Endpoints de upload e gestão de fotos do laudo de inspeção.

As fotos são armazenadas em base64 no banco para simplicidade. Cada foto é
associada a um laudo e a um código de item do checklist.
"""
import base64
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.orm import FotoLaudo, Laudo, Usuario

router = APIRouter()

MAX_IMAGE_SIZE_MB = 5
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


class FotoOut(BaseModel):
    id: str
    laudo_id: str
    codigo_item: str
    legenda: str | None
    nome_arquivo: str | None
    latitude: float | None
    longitude: float | None
    data_foto: datetime | None
    criado_em: datetime


def _to_out(f: FotoLaudo) -> FotoOut:
    return FotoOut(
        id=str(f.id),
        laudo_id=str(f.laudo_id),
        codigo_item=f.codigo_item,
        legenda=f.legenda,
        nome_arquivo=f.nome_arquivo,
        latitude=f.latitude,
        longitude=f.longitude,
        data_foto=f.data_foto,
        criado_em=f.criado_em,
    )


@router.post(
    "/laudos/{laudo_id}/fotos",
    response_model=FotoOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_foto(
    laudo_id: UUID,
    codigo_item: str = Form(...),
    legenda: str | None = Form(default=None),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> FotoOut:
    """
    Upload de uma foto para um item do checklist do laudo.

    Aceita JPEG/PNG/WebP com no máximo 5 MB.
    """
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Laudo não encontrado")

    if arquivo.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Tipo de arquivo não suportado: {arquivo.content_type}. "
            f"Aceitos: {', '.join(ALLOWED_MIME_TYPES)}",
        )

    conteudo = await arquivo.read()
    if len(conteudo) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Arquivo maior que o limite de {MAX_IMAGE_SIZE_MB} MB",
        )

    arquivo_base64 = base64.b64encode(conteudo).decode("utf-8")
    data_uri = f"data:{arquivo.content_type};base64,{arquivo_base64}"

    foto = FotoLaudo(
        id=uuid4(),
        laudo_id=laudo_id,
        codigo_item=codigo_item,
        legenda=legenda,
        arquivo_base64=data_uri,
        nome_arquivo=arquivo.filename,
        latitude=latitude,
        longitude=longitude,
        data_foto=datetime.utcnow(),
        criado_em=datetime.utcnow(),
    )
    db.add(foto)
    db.commit()
    db.refresh(foto)
    return _to_out(foto)


@router.get("/laudos/{laudo_id}/fotos", response_model=list[FotoOut])
async def listar_fotos(
    laudo_id: UUID,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> list[FotoOut]:
    """Lista todas as fotos de um laudo (sem o conteúdo base64 para economia)."""
    fotos = (
        db.query(FotoLaudo)
        .filter(FotoLaudo.laudo_id == laudo_id)
        .order_by(FotoLaudo.codigo_item, FotoLaudo.criado_em)
        .all()
    )
    return [_to_out(f) for f in fotos]


@router.get("/fotos/{foto_id}/conteudo")
async def obter_conteudo_foto(
    foto_id: UUID,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> dict:
    """Retorna o conteúdo base64 de uma foto específica (para exibição)."""
    foto = db.query(FotoLaudo).filter(FotoLaudo.id == foto_id).first()
    if not foto:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foto não encontrada")
    return {
        "id": str(foto.id),
        "codigo_item": foto.codigo_item,
        "legenda": foto.legenda,
        "data_uri": foto.arquivo_base64,
    }


@router.delete("/fotos/{foto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletar_foto(
    foto_id: UUID,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> None:
    foto = db.query(FotoLaudo).filter(FotoLaudo.id == foto_id).first()
    if not foto:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foto não encontrada")
    db.delete(foto)
    db.commit()
