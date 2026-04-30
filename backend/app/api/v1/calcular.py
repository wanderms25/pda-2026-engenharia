"""
Endpoint /api/v1/calcular.

A lógica normativa fica centralizada em app.engine.calculo_completo.calcular_pda.
Este arquivo deve permanecer apenas como camada HTTP, para evitar divergência
entre endpoints e motores de cálculo.
"""
from fastapi import APIRouter

from app.engine.calculo_completo import calcular_pda
from app.schemas.calcular import CalcRequest, CalcResponse

router = APIRouter()


@router.post("/calcular", response_model=CalcResponse)
def calcular(req: CalcRequest) -> CalcResponse:
    return calcular_pda(req)
