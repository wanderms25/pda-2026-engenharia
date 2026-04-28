"""
Checklist normativo de inspeção — NBR 5419-3:2026, Seção 7, e NBR 5419-4:2026, 9.2.

Todos os itens abaixo são derivados DIRETAMENTE do texto das normas fornecido:
- Parte 3, 7.3.3 (inspeções periódicas)
- Parte 3, 7.3.4 (ensaio de continuidade)
- Parte 4, 9.2.5 (inspeção visual das MPS)
- Parte 4, 9.2.6 (medições)
- Parte 3, 7.5.3 (documentação mínima)

Lembrete importante da edição 2026 (Parte 3, 7.1.4):
    "Não é necessária a realização de medição de resistência de aterramento
     para a verificação da eficácia do SPDA."
Por isso, no checklist abaixo, a medição de resistência é OPCIONAL — pode
ser executada a pedido do cliente, mas não é critério de conformidade.
"""
from dataclasses import dataclass, field
from enum import Enum


class NormaReferencia(str, Enum):
    NBR_5419_3 = "NBR 5419-3:2026"
    NBR_5419_4 = "NBR 5419-4:2026"


class CategoriaInspecao(str, Enum):
    DOCUMENTACAO = "DOCUMENTACAO"
    CAPTACAO = "CAPTACAO"
    DESCIDA = "DESCIDA"
    ATERRAMENTO = "ATERRAMENTO"
    EQUIPOTENCIALIZACAO = "EQUIPOTENCIALIZACAO"
    DISTANCIAS_SEGURANCA = "DISTANCIAS_SEGURANCA"
    MPS_DPS = "MPS_DPS"
    ENSAIOS = "ENSAIOS"


class TipoResposta(str, Enum):
    SIM_NAO = "SIM_NAO"           # Conforme / Não conforme / N/A
    NUMERICO = "NUMERICO"          # valor medido com unidade
    TEXTO = "TEXTO"                # observação livre
    FOTO = "FOTO"                  # evidência fotográfica obrigatória


@dataclass(frozen=True)
class ItemChecklist:
    codigo: str
    descricao: str
    referencia_normativa: str
    norma: NormaReferencia
    categoria: CategoriaInspecao
    tipo_resposta: TipoResposta
    obrigatorio: bool = True
    observacoes: str = ""


# =============================================================================
# CHECKLIST COMPLETO DE INSPEÇÃO
# =============================================================================
CHECKLIST_INSPECAO: list[ItemChecklist] = [
    # -- DOCUMENTAÇÃO (Parte 3, 7.3.3 a e b, 7.5.3) ------------------------
    ItemChecklist(
        codigo="DOC-01",
        descricao="Documentação técnica disponível no local (projeto ou as-built)",
        referencia_normativa="7.3.3.a e 7.5.3",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DOCUMENTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="DOC-02",
        descricao="Relatório de inspeção vigente e anteriores (se existirem) disponíveis",
        referencia_normativa="7.3.3.b",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DOCUMENTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="DOC-03",
        descricao="ART do profissional responsável pelo projeto disponível",
        referencia_normativa="7.5.3.a",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DOCUMENTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="DOC-04",
        descricao="Memorial descritivo define SPDA isolado ou não isolado, método de posicionamento",
        referencia_normativa="7.5.3.e",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DOCUMENTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),

    # -- CAPTAÇÃO (Parte 3, 7.3.3.c, 5.3) ----------------------------------
    ItemChecklist(
        codigo="CAP-01",
        descricao="Subsistema de captação sem sinais de corrosão ou deterioração",
        referencia_normativa="7.3.3.c",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="CAP-02",
        descricao="Posicionamento dos captores conforme método do projeto "
                  "(esfera rolante, malha ou ângulo) — Tabela 2",
        referencia_normativa="5.3.2.2 e Tabela 2",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="CAP-03",
        descricao="Saliências e equipamentos na cobertura estão dentro do volume de proteção",
        referencia_normativa="5.3.2.6 e Anexo A",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="CAP-04",
        descricao="Seção e materiais dos condutores de captação conforme Tabela 7",
        referencia_normativa="7.3.3.e e Tabela 7",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="CAP-05",
        descricao="Foto do sistema de captação (visão geral e detalhes)",
        referencia_normativa="7.3.3",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.FOTO,
    ),

    # -- DESCIDA (Parte 3, 7.3.3.c, 5.4) ------------------------------------

    # --- Itens adicionais captores (baseados na norma e sistema VVS) ---
    ItemChecklist(
        codigo="CAP-06",
        descricao="Tipo de SPDA definido: isolado (suportes com distância de segurança s) ou não isolado (captor fixado na estrutura)",
        referencia_normativa="NBR 5419-3:2026 §5.2",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=True,
    ),
    ItemChecklist(
        codigo="CAP-07",
        descricao="Não há elementos metálicos acima ou além da zona de proteção dos captores",
        referencia_normativa="NBR 5419-3:2026 §5.2",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=True,
    ),
    ItemChecklist(
        codigo="CAP-08",
        descricao="Anel perimetral (gaiola horizontal) disponível e em boas condições",
        referencia_normativa="NBR 5419-3:2026 §5.2.1",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=False,
    ),
    ItemChecklist(
        codigo="CAP-09",
        descricao="Anel do ático (nível intermediário) disponível quando altura > 20m",
        referencia_normativa="NBR 5419-3:2026 §5.2.1",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=False,
    ),
    ItemChecklist(
        codigo="CAP-10",
        descricao="Luz piloto / indicador de funcionamento disponível e operacional",
        referencia_normativa="NBR 5419-3:2026 §7.3",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.CAPTACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=False,
    ),
        ItemChecklist(
        codigo="DES-01",
        descricao="Condutores de descida íntegros, sem corrosão e fixados conforme 5.6.2",
        referencia_normativa="7.3.3.c e 5.6.2",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DESCIDA,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="DES-02",
        descricao="Número de descidas atende Tabela 5 (perímetro ÷ distância_NP)",
        referencia_normativa="5.4.3.1 e Tabela 5",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DESCIDA,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="DES-03",
        descricao="Descidas instaladas em linha reta vertical pelo caminho mais curto",
        referencia_normativa="5.4.4.2",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DESCIDA,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="DES-04",
        descricao="Conector para ensaios presente em cada descida",
        referencia_normativa="5.4.6",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DESCIDA,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="DES-05",
        descricao="Foto de cada ponto de descida",
        referencia_normativa="7.3.3",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DESCIDA,
        tipo_resposta=TipoResposta.FOTO,
    ),

    # -- ATERRAMENTO (Parte 3, 7.3.3.c, 5.5) --------------------------------

    # --- Itens adicionais descidas ---
    ItemChecklist(
        codigo="DES-06",
        descricao="Isoladores/suportes das descidas disponíveis e em boas condições (sem oxidação ou ruptura)",
        referencia_normativa="NBR 5419-3:2026 §5.3",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DESCIDA,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=True,
    ),
    ItemChecklist(
        codigo="DES-07",
        descricao="Emendas das descidas disponíveis e em boas condições (sem oxidação, frouxas ou rompidas)",
        referencia_normativa="NBR 5419-3:2026 §5.3",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DESCIDA,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=True,
    ),
    ItemChecklist(
        codigo="DES-08",
        descricao="Espaçamento entre descidas convencionais ≤ distância máxima por NP (10/15/20/25m conforme Tabela 6)",
        referencia_normativa="NBR 5419-3:2026 §5.3.2 Tabela 6",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DESCIDA,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=True,
    ),
    ItemChecklist(
        codigo="DES-09",
        descricao="Descidas mantêm distância > 3m de tubulações de gás e saídas de ventilação",
        referencia_normativa="NBR 5419-3:2026 §5.3.4",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DESCIDA,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=True,
    ),
        ItemChecklist(
        codigo="ATR-01",
        descricao="Eletrodo de aterramento sem corrosão e com caixa de inspeção acessível",
        referencia_normativa="7.3.3.c e 5.6.3.3",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.ATERRAMENTO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="ATR-02",
        descricao="Anel perimetral de aterramento conectado conforme projeto",
        referencia_normativa="5.5",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.ATERRAMENTO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="ATR-03",
        descricao="Medição de resistência de aterramento (OPCIONAL — não é mais "
                  "requisito para eficácia do SPDA conforme 7.1.4 da NBR 5419-3:2026)",
        referencia_normativa="7.1.4",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.ATERRAMENTO,
        tipo_resposta=TipoResposta.NUMERICO,
        obrigatorio=False,
        observacoes="Informar valor em Ω e condições climáticas no momento da medição.",
    ),
    ItemChecklist(
        codigo="ATR-04",
        descricao="Foto das caixas de inspeção de aterramento",
        referencia_normativa="7.3.3",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.ATERRAMENTO,
        tipo_resposta=TipoResposta.FOTO,
    ),

    # -- EQUIPOTENCIALIZAÇÃO (Parte 3, 6 / Parte 4, 5) ----------------------
    ItemChecklist(
        codigo="EQP-01",
        descricao="Barramento de equipotencialização principal (BEP) instalado e identificado",
        referencia_normativa="Parte 4, Seção 5",
        norma=NormaReferencia.NBR_5419_4,
        categoria=CategoriaInspecao.EQUIPOTENCIALIZACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="EQP-02",
        descricao="Todas as instalações metálicas externas interligadas ao BEP",
        referencia_normativa="Parte 3, 6.2 e Parte 4, 5",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.EQUIPOTENCIALIZACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="EQP-03",
        descricao="Blindagens de cabos interligadas ao BEP",
        referencia_normativa="Parte 4, 9.2.5.c",
        norma=NormaReferencia.NBR_5419_4,
        categoria=CategoriaInspecao.EQUIPOTENCIALIZACAO,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),

    # -- DISTÂNCIAS DE SEGURANÇA (Parte 3, 6.3) ------------------------------
    ItemChecklist(
        codigo="DST-01",
        descricao="Distância de segurança s atendida entre SPDA e instalações internas",
        referencia_normativa="7.3.3.d e 6.3",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DISTANCIAS_SEGURANCA,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="DST-02",
        descricao="Distâncias de SPDA até aberturas com acesso (portas, janelas) respeitadas",
        referencia_normativa="5.4.4.4",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.DISTANCIAS_SEGURANCA,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),

    # -- MPS E DPS (Parte 4, 9.2.5) ------------------------------------------
    ItemChecklist(
        codigo="MPS-01",
        descricao="DPS classe I instalado no ponto de entrada das linhas elétricas",
        referencia_normativa="Parte 4, Anexo B.4",
        norma=NormaReferencia.NBR_5419_4,
        categoria=CategoriaInspecao.MPS_DPS,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="MPS-02",
        descricao="DPS sem indicação de fim de vida útil ou dano visível",
        referencia_normativa="9.2.5.e",
        norma=NormaReferencia.NBR_5419_4,
        categoria=CategoriaInspecao.MPS_DPS,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="MPS-03",
        descricao="Dispositivos de proteção de sobrecorrente a montante dos DPS íntegros",
        referencia_normativa="9.2.5.f e 7.3.3.g (Parte 3)",
        norma=NormaReferencia.NBR_5419_4,
        categoria=CategoriaInspecao.MPS_DPS,
        tipo_resposta=TipoResposta.SIM_NAO,
    ),
    ItemChecklist(
        codigo="MPS-04",
        descricao="Contadores de raios (se existirem): integridade física e atuações registradas",
        referencia_normativa="Parte 3, 7.3.3.h",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.MPS_DPS,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=False,
    ),
    ItemChecklist(
        codigo="MPS-05",
        descricao="Foto de cada DPS e do quadro onde está instalado",
        referencia_normativa="9.2",
        norma=NormaReferencia.NBR_5419_4,
        categoria=CategoriaInspecao.MPS_DPS,
        tipo_resposta=TipoResposta.FOTO,
    ),

    # -- ENSAIOS DE CONTINUIDADE (Parte 3, 7.3.4 e Anexo F) ------------------

    # --- Itens adicionais MPS/DPS ---
    ItemChecklist(
        codigo="MPS-06",
        descricao="Classe do DPS correta para a posição de instalação (Classe I na entrada, Classe II em QD intermediários, Classe III em equipamentos)",
        referencia_normativa="NBR 5419-4:2026 §8.3",
        norma=NormaReferencia.NBR_5419_4,
        categoria=CategoriaInspecao.MPS_DPS,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=True,
    ),
    ItemChecklist(
        codigo="MPS-07",
        descricao="SPDA interligado ao BEP (barramento de equalização de potencial) principal",
        referencia_normativa="NBR 5419-3:2026 §5.5.1",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.MPS_DPS,
        tipo_resposta=TipoResposta.SIM_NAO,
        obrigatorio=True,
    ),
        ItemChecklist(
        codigo="ENS-01",
        descricao="Ensaio de continuidade dos condutores não naturais "
                  "(captação, descida, equipotencialização) — valor em mΩ",
        referencia_normativa="7.3.4 e Anexo F",
        norma=NormaReferencia.NBR_5419_3,
        categoria=CategoriaInspecao.ENSAIOS,
        tipo_resposta=TipoResposta.NUMERICO,
    ),
    ItemChecklist(
        codigo="ENS-02",
        descricao="Ensaio de continuidade entre barras de equipotencialização e eletrodo de aterramento",
        referencia_normativa="Parte 4, 9.2.6.2",
        norma=NormaReferencia.NBR_5419_4,
        categoria=CategoriaInspecao.ENSAIOS,
        tipo_resposta=TipoResposta.NUMERICO,
    ),
]


@dataclass
class RespostaItem:
    codigo_item: str
    resposta: str                       # 'CONFORME', 'NAO_CONFORME', 'NA' ou valor
    valor_numerico: float | None = None
    unidade: str = ""
    observacao: str = ""
    fotos_base64: list[str] = field(default_factory=list)
    data_iso: str = ""
    inspetor: str = ""


def agrupar_por_categoria() -> dict[CategoriaInspecao, list[ItemChecklist]]:
    """Agrupa o checklist por categoria para exibição no frontend."""
    resultado: dict[CategoriaInspecao, list[ItemChecklist]] = {}
    for item in CHECKLIST_INSPECAO:
        resultado.setdefault(item.categoria, []).append(item)
    return resultado


def periodicidade_inspecao(
    tem_area_classificada: bool = False,
    atmosfera_agressiva: bool = False,
    servico_essencial: bool = False,
) -> int:
    """
    Intervalo máximo entre inspeções periódicas — NBR 5419-3:2026, 7.3.2.f.

    - 1 ano: áreas classificadas 0/1/20/21, explosivos, corrosão severa,
             atmosfera agressiva ou serviços essenciais
             (energia, água, sinais, apoio à vida etc.).
    - 3 anos: demais estruturas.
    """
    if tem_area_classificada or atmosfera_agressiva or servico_essencial:
        return 1
    return 3
