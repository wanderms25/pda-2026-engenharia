"""
Utilitários de consulta: CEP e CNPJ via BrasilAPI.
Proxy seguro — evita exposição do IP do cliente e problemas de CORS.
Rate limiting: 1 requisição por segundo por IP (implementado via dependência).
"""
import httpx
from fastapi import APIRouter, HTTPException, Path
from fastapi.responses import JSONResponse
import re

router = APIRouter()

BRASILAPI = "https://brasilapi.com.br/api"
TIMEOUT = 8.0  # segundos

# Headers seguros para identificação
HEADERS = {
    "User-Agent": "PDA-NBR5419/1.0 (+https://pda-nbr5419.local)",
    "Accept": "application/json",
}


def _soDigitos(v: str) -> str:
    return re.sub(r"\D", "", v)


@router.get("/util/cep/{cep}", summary="Consulta CEP via BrasilAPI (proxy seguro)")
async def consultar_cep(
    cep: str = Path(description="CEP com ou sem formatação"),
):
    """
    Consulta endereço pelo CEP usando BrasilAPI v2.
    
    - Sanitiza a entrada (apenas dígitos)
    - Valida o formato antes de consultar
    - Retorna 404 se não encontrado
    - Retorna 502 se o serviço externo falhar
    """
    cep_limpo = _soDigitos(cep)
    if len(cep_limpo) != 8:
        raise HTTPException(status_code=422, detail="CEP deve ter 8 dígitos")
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(
                f"{BRASILAPI}/cep/v2/{cep_limpo}",
                headers=HEADERS,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout na consulta do CEP")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Erro na consulta: {str(e)[:100]}")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="CEP não encontrado")
    if not resp.is_success:
        raise HTTPException(status_code=502, detail="Serviço de CEP indisponível")

    data = resp.json()
    # Normaliza campos (BrasilAPI v2 usa nomes diferentes de v1)
    return {
        "cep": cep_limpo[:5] + "-" + cep_limpo[5:],
        "logradouro": data.get("street") or data.get("logradouro") or "",
        "complemento": data.get("complement") or data.get("complemento") or "",
        "bairro": data.get("neighborhood") or data.get("bairro") or "",
        "localidade": data.get("city") or data.get("localidade") or "",
        "uf": data.get("state") or data.get("uf") or "",
        "ibge": data.get("ibge") or "",
    }


@router.get("/util/cnpj/{cnpj}", summary="Consulta CNPJ via BrasilAPI (proxy seguro)")
async def consultar_cnpj(
    cnpj: str = Path(description="CNPJ com ou sem formatação"),
):
    """
    Consulta dados do CNPJ usando BrasilAPI.
    
    - Sanitiza a entrada (apenas dígitos)
    - Valida o formato (14 dígitos)
    - Não loga nem armazena o CNPJ consultado
    - Retorna 404 se não encontrado
    """
    cnpj_limpo = _soDigitos(cnpj)
    if len(cnpj_limpo) != 14:
        raise HTTPException(status_code=422, detail="CNPJ deve ter 14 dígitos")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(
                f"{BRASILAPI}/cnpj/v1/{cnpj_limpo}",
                headers=HEADERS,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout na consulta do CNPJ")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Erro na consulta: {str(e)[:100]}")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="CNPJ não encontrado")
    if not resp.is_success:
        raise HTTPException(status_code=502, detail="Serviço de CNPJ indisponível")

    data = resp.json()
    # Normaliza e sanitiza os campos retornados
    telefone_raw = data.get("ddd_telefone_1", "") or ""
    ddd = data.get("ddd_telefone_1", "")
    # Formata telefone: "11999999999" → "(11) 99999-9999"
    tel_digits = re.sub(r"\D", "", str(ddd))
    if len(tel_digits) == 11:
        telefone = f"({tel_digits[:2]}) {tel_digits[2:7]}-{tel_digits[7:]}"
    elif len(tel_digits) == 10:
        telefone = f"({tel_digits[:2]}) {tel_digits[2:6]}-{tel_digits[6:]}"
    else:
        telefone = tel_digits

    return {
        "razao_social": data.get("razao_social") or "",
        "nome_fantasia": data.get("nome_fantasia") or "",
        "email": data.get("email") or "",
        "telefone": telefone,
        "logradouro": data.get("logradouro") or "",
        "numero": data.get("numero") or "",
        "complemento": data.get("complemento") or "",
        "bairro": data.get("bairro") or "",
        "municipio": data.get("municipio") or "",
        "uf": data.get("uf") or "",
        "cep": data.get("cep") or "",
        "situacao_cadastral": data.get("descricao_situacao_cadastral") or "",
        "atividade_principal": (data.get("cnae_fiscal_descricao") or ""),
    }
