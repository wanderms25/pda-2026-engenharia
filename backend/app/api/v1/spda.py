"""
Endpoints auxiliares — Parte 3 e Parte 4 da NBR 5419:2026.

- /spda/dimensionar: calcula o projeto mínimo (esfera rolante, malha, descidas)
- /spda/checklist: retorna o checklist normativo de inspeção
- /ng/por-uf: consulta aproximada do NG por UF (placeholder do Anexo F)
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.nbr5419.enums import NivelProtecao
from app.nbr5419.ng_mapa import (
    buscar_municipios,
    consultar_NG_por_municipio,
    consultar_NG_por_uf,
    total_municipios_cadastrados,
)
from app.nbr5419.parte3_spda import dimensionar_spda_basico
from app.services.checklist_inspecao import (
    CHECKLIST_INSPECAO,
    agrupar_por_categoria,
    periodicidade_inspecao,
)

router = APIRouter()


class DimensionamentoRequest(BaseModel):
    nivel: NivelProtecao
    perimetro_m: float = Field(gt=0, description="Perímetro da estrutura em metros")
    altura_m: float = Field(gt=0, description="Altura da estrutura em metros")


class DimensionamentoResponse(BaseModel):
    nivel: NivelProtecao
    raio_esfera_m: float
    malha_m: tuple[float, float]
    distancia_descidas_m: float
    numero_minimo_descidas: int
    distancia_seguranca_m: float
    observacoes: list[str]


@router.post("/spda/dimensionar", response_model=DimensionamentoResponse)
async def dimensionar(req: DimensionamentoRequest) -> DimensionamentoResponse:
    """
    Dimensionamento mínimo de um SPDA conforme NBR 5419-3:2026.

    Retorna raio da esfera rolante, malha, número de descidas e distância
    de segurança simplificada para o nível de proteção solicitado.
    """
    projeto = dimensionar_spda_basico(
        nivel=req.nivel,
        perimetro_m=req.perimetro_m,
        altura_m=req.altura_m,
    )
    return DimensionamentoResponse(
        nivel=projeto.nivel,
        raio_esfera_m=projeto.raio_esfera_m,
        malha_m=projeto.malha_m,
        distancia_descidas_m=projeto.distancia_descidas_m,
        numero_minimo_descidas=projeto.numero_minimo_descidas,
        distancia_seguranca_m=projeto.distancia_seguranca_m,
        observacoes=[
            "Dimensionamento conforme NBR 5419-3:2026, Tabelas 2 e 5.",
            "A distância de segurança é um valor simplificado (Equação 5 / Tabela 13). "
            "Em projeto executivo, usar o cálculo completo da Seção 6.3 e Anexo C.",
            "Para estruturas acima de 60 m de altura, verificar proteção lateral "
            "conforme 5.3.2.14.2.",
        ],
    )


class InspecaoChecklistItemOut(BaseModel):
    codigo: str
    descricao: str
    referencia_normativa: str
    norma: str
    categoria: str
    tipo_resposta: str
    obrigatorio: bool
    observacoes: str


@router.get("/spda/checklist")
async def obter_checklist() -> dict[str, list[InspecaoChecklistItemOut]]:
    """
    Retorna o checklist normativo completo de inspeção, agrupado por categoria.
    """
    agrupado = agrupar_por_categoria()
    return {
        categoria.value: [
            InspecaoChecklistItemOut(
                codigo=item.codigo,
                descricao=item.descricao,
                referencia_normativa=item.referencia_normativa,
                norma=item.norma.value,
                categoria=item.categoria.value,
                tipo_resposta=item.tipo_resposta.value,
                obrigatorio=item.obrigatorio,
                observacoes=item.observacoes,
            )
            for item in itens
        ]
        for categoria, itens in agrupado.items()
    }


@router.get("/spda/periodicidade")
async def obter_periodicidade(
    area_classificada: bool = False,
    atmosfera_agressiva: bool = False,
    servico_essencial: bool = False,
) -> dict[str, int | str]:
    """
    Periodicidade máxima entre inspeções — NBR 5419-3:2026, 7.3.2.f.
    """
    intervalo = periodicidade_inspecao(
        tem_area_classificada=area_classificada,
        atmosfera_agressiva=atmosfera_agressiva,
        servico_essencial=servico_essencial,
    )
    return {
        "intervalo_anos": intervalo,
        "referencia": "NBR 5419-3:2026, 7.3.2.f",
    }


@router.get("/ng/por-uf/{uf}")
async def consultar_ng(uf: str) -> dict[str, str | float]:
    """Consulta NG representativo por UF (pré-preenchimento)."""
    resultado = consultar_NG_por_uf(uf)
    return {
        "uf": uf.upper(),
        "NG": resultado.NG,
        "fonte": resultado.fonte,
        "nota": resultado.nota,
    }


@router.get("/ng/por-municipio/{municipio_uf}")
async def consultar_ng_municipio(municipio_uf: str) -> dict:
    """
    Consulta NG oficial do Anexo F da NBR 5419-2:2026 por município.

    Formato: "Nome-UF" (ex.: "São Paulo-SP").
    """
    resultado = consultar_NG_por_municipio(municipio_uf)
    return {
        "municipio_uf": municipio_uf,
        "NG": resultado.NG,
        "fonte": resultado.fonte,
        "nota": resultado.nota,
    }


@router.get("/ng/buscar")
async def buscar_ng(q: str, limit: int = 20, uf: str | None = None) -> dict:
    """
    Busca municípios por nome (busca parcial, case-insensitive).
    Parâmetro uf opcional filtra por estado (ex: uf=SP).
    """
    resultados = buscar_municipios(q, limit=limit, uf=uf)
    return {
        "query": q,
        "uf": uf,
        "total_base": total_municipios_cadastrados(),
        "resultados": resultados,
    }

class DistanciaSegurancaRequest(BaseModel):
    nivel: NivelProtecao
    numero_descidas: int = Field(ge=1)
    comprimento_l_m: float = Field(gt=0)
    meio: str = Field(default="ar", description="ar | solido | liquido")
    tem_anel_intermediario: bool = False


class EletrodoRequest(BaseModel):
    resistividade_ohm_m: float = Field(gt=0, description="Resistividade do solo (Ω·m)")


class DpsCoordRequest(BaseModel):
    Up_kV: float = Field(gt=0, description="Nível de proteção do DPS (kV)")
    UC_kV: float = Field(ge=0, description="Queda nos condutores (kV). Estimativa: 1kV/m")
    UW_kV: float = Field(gt=0, description="Tensão suportável do equipamento (kV)")


@router.post("/spda/distancia-seguranca")
async def distancia_seguranca_completa_endpoint(req: DistanciaSegurancaRequest):
    """
    Distância de segurança mínima — NBR 5419-3:2026, §6.3.2, Equação (5).
    s ≥ ki × (kc / km) × l
    """
    from app.nbr5419.parte3_spda import distancia_seguranca_completa, KI_POR_NP, KM_POR_MEIO, kc_numero_descidas
    s = distancia_seguranca_completa(
        nivel=req.nivel,
        numero_descidas=req.numero_descidas,
        comprimento_l_m=req.comprimento_l_m,
        meio=req.meio,
        tem_anel_intermediario=req.tem_anel_intermediario,
    )
    ki = KI_POR_NP[req.nivel]
    km = KM_POR_MEIO.get(req.meio, 1.0)
    kc = kc_numero_descidas(req.numero_descidas, req.tem_anel_intermediario)
    return {
        "distancia_seguranca_m": round(s, 3),
        "ki": ki,
        "kc": round(kc, 4),
        "km": km,
        "l_m": req.comprimento_l_m,
        "formula": "s = ki × (kc/km) × l",
        "referencia": "NBR 5419-3:2026, §6.3.2, Equação (5)",
    }


@router.post("/spda/eletrodo-tipo-a")
async def calcular_eletrodo_tipo_a(req: EletrodoRequest):
    """
    Comprimento mínimo do eletrodo de aterramento tipo A.
    NBR 5419-3:2026, §5.4.4.1, Tabela 8.
    """
    from app.nbr5419.parte3_spda import comprimento_eletrodo_tipo_A
    l1 = comprimento_eletrodo_tipo_A(req.resistividade_ohm_m)
    return {
        "comprimento_min_m": round(l1, 1),
        "resistividade_ohm_m": req.resistividade_ohm_m,
        "tipo_eletrodo": "Tipo A (horizontal ou vertical)",
        "referencia": "NBR 5419-3:2026, §5.4.4.1, Tabela 8",
    }


@router.post("/spda/verificar-dps")
async def verificar_dps(req: DpsCoordRequest):
    """
    Verifica coordenação do DPS com o equipamento.
    NBR 5419-4:2026, §9.2: Up + UC ≤ UW/1,2
    """
    from app.nbr5419.parte3_spda import verificar_coordenacao_dps
    return verificar_coordenacao_dps(req.Up_kV, req.UC_kV, req.UW_kV)