"""
Schemas Pydantic v2 — validação de entrada e saída da API de análise de risco.

Todo dado que o frontend envia ao backend passa por estas validações antes
de chegar ao motor de cálculo — garantindo que nenhum cálculo rode com
entrada fora do domínio da norma.
"""
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.nbr5419.parte2_linhas import validar_uw_linha_calculo_completo

from app.nbr5419.enums import (
    AmbienteLinha,
    LocalizacaoEstrutura,
    NivelProtecao,
    PerigoEspecial,
    ProvidenciasIncendio,
    RiscoIncendio,
    TipoConstrucao,
    TipoEstrutura,
    TipoInstalacaoLinha,
    TipoLinhaEletrica,
    TipoPiso,
)


class DimensoesSchema(BaseModel):
    """Dimensões da estrutura em metros."""
    L: float = Field(gt=0, description="Comprimento (m)")
    W: float = Field(gt=0, description="Largura (m)")
    H: float = Field(gt=0, description="Altura (m)")
    H_saliencia: float | None = Field(
        default=None, gt=0,
        description="Altura de saliência elevada na cobertura (opcional)",
    )


class LinhaEletricaSchema(BaseModel):
    """Uma linha elétrica conectada à estrutura (energia ou sinal)."""
    nome: str = Field(description="Identificação da linha (ex.: 'Energia BT')")
    comprimento_m: float = Field(
        default=1000.0, gt=0,
        description="Comprimento do trecho (m). Se desconhecido, usar 1000 m.",
    )
    instalacao: TipoInstalacaoLinha
    tipo: TipoLinhaEletrica
    ambiente: AmbienteLinha
    resistividade_solo_ohm_m: float | None = Field(
        default=None, gt=0,
        description="Usado para trechos enterrados com ρ > 400 Ω·m (correção AL)",
    )
    tensao_suportavel_UW_kV: float = Field(
        default=2.5,
        description="Tensão suportável de impulso dos equipamentos conectados (kV)",
    )

    @field_validator("tensao_suportavel_UW_kV")
    @classmethod
    def validar_uw_linha(cls, value: float) -> float:
        try:
            return validar_uw_linha_calculo_completo(value)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc

    # Proteção contra choque na linha (Tab B.6) — PTU
    # 0 = sem proteção, 0.01 = DPS NP I, etc.
    fator_ptu: float = Field(default=1.0, ge=0, le=1,
        description="PTU — proteção contra choque (Tab B.6): 1=sem, 0.01=DPS NP I")
    # DPS Classe I na entrada (Tab B.7) — PEB  
    fator_peb: float = Field(default=1.0, ge=0, le=1,
        description="PEB — DPS Classe I na entrada (Tab B.7): 1=sem, 0.01=NP I")
    # Blindagem/roteamento da linha (Tab B.4) — CLD (energia) ou CLI (sinal)
    fator_blindagem: float = Field(default=1.0, ge=0, le=1,
        description="CLD/CLI — blindagem linha (Tab B.4): 1=sem blindagem, 0.0001=malha metálica")


class MedidasProtecaoSchema(BaseModel):
    """Medidas de proteção instaladas (ou simuladas)."""
    spda_nivel: NivelProtecao = NivelProtecao.NENHUM
    dps_coordenados_nivel: NivelProtecao = NivelProtecao.NENHUM
    dps_classe_I_entrada: NivelProtecao = NivelProtecao.NENHUM
    aviso_alerta_toque_passo: bool = False
    isolacao_eletrica_descida: bool = False
    malha_equipotencializacao_solo: bool = False
    descida_natural_estrutura_continua: bool = False


class FatoresPerdaSchema(BaseModel):
    """Fatores que afetam o cálculo das perdas LA..LZ."""
    tipo_estrutura: TipoEstrutura
    tipo_piso: TipoPiso = TipoPiso.TERRA_CONCRETO
    risco_incendio: RiscoIncendio = RiscoIncendio.NORMAL
    providencias_incendio: ProvidenciasIncendio = ProvidenciasIncendio.NENHUMA
    perigo_especial: PerigoEspecial = PerigoEspecial.NENHUM
    tipo_construcao: TipoConstrucao = TipoConstrucao.ALVENARIA_CONCRETO
    risco_explosao_ou_vida_imediata: bool = False

    numero_pessoas_zona: int = Field(default=0, ge=0)
    numero_pessoas_total: int = Field(default=1, ge=1)
    horas_ano_presenca: float = Field(default=8760.0, ge=0, le=8760.0)


class AnaliseRiscoRequest(BaseModel):
    """Entrada completa para uma análise de risco de uma estrutura (sem zonas)."""
    nome_projeto: str
    NG: float = Field(
        gt=0,
        description="Densidade de descargas NG (1/km²/ano) — Anexo F da NBR 5419-2:2026",
    )
    dimensoes: DimensoesSchema
    localizacao: LocalizacaoEstrutura
    linhas: list[LinhaEletricaSchema] = Field(default_factory=list)
    fatores: FatoresPerdaSchema
    medidas: MedidasProtecaoSchema = Field(default_factory=MedidasProtecaoSchema)
    calcular_r4: bool = False
    numero_art: str | None = None  # ART/RRT do responsável técnico (opcional)
    fotos: list[dict] = Field(default_factory=list)  # Fotos em base64 da obra
    # Campos de identificação para o laudo
    nome_obra: str | None = None
    municipio_uf: str | None = None
    endereco_obra: str | None = None
    # Valores pré-calculados pelo frontend — quando presentes, o PDF usa esses diretamente
    # evitando discrepância entre o cálculo do frontend e o laudo gerado
    valores_calculados: dict | None = None


class ComponenteRiscoOut(BaseModel):
    RA: float
    RB: float
    RC: float
    RM: float
    RU: float
    RV: float
    RW: float
    RZ: float


class ResultadoAvaliacaoOut(BaseModel):
    tipo_risco: str
    valor_calculado: float
    valor_tolerado: float
    status: str
    mensagem: str
    razao: float


class AnaliseRiscoResponse(BaseModel):
    """
    Resposta completa da análise de risco, com recomendação automática
    da configuração mínima para atingir 100% de conformidade.
    """
    nome_projeto: str
    areas_m2: dict[str, float]
    numeros_eventos: dict[str, float]
    componentes: ComponenteRiscoOut
    R1: float
    R3: float
    R4: float | None
    frequencia_danos_total: float
    avaliacao: list[ResultadoAvaliacaoOut]
    exige_protecao: bool
    recomendacao: dict[str, Any] = Field(
        description="Recomendação automática de proteção mínima para 100% de conformidade",
    )