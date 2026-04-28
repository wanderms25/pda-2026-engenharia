"""
Enumerações normativas da ABNT NBR 5419:2026.

Cada enum corresponde a uma classificação fixa prevista na norma.
Usar apenas estes valores garante aderência normativa em todo o sistema.
"""
from enum import Enum


class NivelProtecao(str, Enum):
    """
    Nível de Proteção (NP) da PDA — NBR 5419-1:2026, Tabela 1 e Tabela 5.
    """
    I = "I"
    II = "II"
    III = "III"
    IV = "IV"
    NENHUM = "NENHUM"


class FonteDano(str, Enum):
    """
    Fontes de danos — NBR 5419-2:2026, Tabela 1.

    S1: descarga atmosférica na estrutura
    S2: descarga atmosférica próximo da estrutura
    S3: descarga atmosférica na linha elétrica conectada à estrutura
    S4: descarga atmosférica próximo de uma linha elétrica conectada
    """
    S1 = "S1"
    S2 = "S2"
    S3 = "S3"
    S4 = "S4"


class TipoDano(str, Enum):
    """
    Tipos de danos — NBR 5419-2:2026, 4.1.2.

    D1: ferimentos em seres vivos por choque elétrico
    D2: danos físicos à estrutura
    D3: falhas de sistemas eletroeletrônicos
    """
    D1 = "D1"
    D2 = "D2"
    D3 = "D3"


class TipoPerda(str, Enum):
    """
    Tipos de perdas — NBR 5419-2:2026, 4.1.3.

    Na edição 2026:
    - L1 e L3 são obrigatórios para validar necessidade de proteção.
    - L4 é informativo (Anexo D).
    - L2 foi REMOVIDO; substituído pelo conceito de frequência de danos F.
    """
    L1 = "L1"  # perda de vida humana (inclui ferimentos permanentes)
    L3 = "L3"  # perda de patrimônio cultural
    L4 = "L4"  # perda de valor econômico (informativo)


class TipoEstrutura(str, Enum):
    """
    Classificação da estrutura pelo uso — usada em Tabelas C.2, D.2 e outras.
    """
    HOSPITAL = "HOSPITAL"
    HOTEL = "HOTEL"
    ESCOLA = "ESCOLA"
    EDIFICIO_CIVICO = "EDIFICIO_CIVICO"
    ENTRETENIMENTO_PUBLICO = "ENTRETENIMENTO_PUBLICO"
    IGREJA = "IGREJA"
    MUSEU = "MUSEU"
    INDUSTRIAL = "INDUSTRIAL"
    COMERCIAL = "COMERCIAL"
    RESIDENCIAL = "RESIDENCIAL"
    AGRICULTURA = "AGRICULTURA"
    ESCRITORIO = "ESCRITORIO"
    RISCO_EXPLOSAO = "RISCO_EXPLOSAO"
    OUTROS = "OUTROS"


class LocalizacaoEstrutura(str, Enum):
    """
    Fator CD — NBR 5419-2:2026, Tabela A.1.
    """
    CERCADA_OBJETOS_MAIS_ALTOS = "CERCADA_OBJETOS_MAIS_ALTOS"  # CD = 0,25
    CERCADA_MESMA_ALTURA = "CERCADA_MESMA_ALTURA"              # CD = 0,50
    ISOLADA = "ISOLADA"                                        # CD = 1,00
    ISOLADA_TOPO_COLINA = "ISOLADA_TOPO_COLINA"                # CD = 2,00


class TipoInstalacaoLinha(str, Enum):
    """
    Fator CI — NBR 5419-2:2026, Tabela A.2.
    """
    AEREO = "AEREO"                       # CI = 1,00
    ENTERRADO = "ENTERRADO"                # CI = 0,50
    ENTERRADO_MALHA_ATERRAMENTO = "ENT_MALHA"  # CI = 0,01


class TipoLinhaEletrica(str, Enum):
    """
    Fator CT — NBR 5419-2:2026, Tabela A.3.
    """
    BT_SINAL = "BT_SINAL"              # CT = 1,00
    AT_COM_TRAFO = "AT_COM_TRAFO"      # CT = 0,20


class AmbienteLinha(str, Enum):
    """
    Fator CE — NBR 5419-2:2026, Tabela A.4.
    """
    RURAL = "RURAL"                             # CE = 1,00
    SUBURBANO = "SUBURBANO"                     # CE = 0,50
    URBANO = "URBANO"                           # CE = 0,10
    URBANO_ESTRUTURAS_ALTAS = "URBANO_ALTAS"    # CE = 0,01 (estruturas > 20 m)


class TipoPiso(str, Enum):
    """
    Fator rt — NBR 5419-2:2026, Tabela C.3. Reduz perda de vida humana por tensão de toque/passo.
    """
    TERRA_CONCRETO = "TERRA_CONCRETO"     # rt = 10^-2
    MARMORE_CERAMICA = "MARMORE_CERAMICA" # rt = 10^-3
    BRITA_CARPETE = "BRITA_CARPETE"       # rt = 10^-4
    ASFALTO_LINOLEO_MADEIRA = "ASFALTO"   # rt = 10^-5


class ProvidenciasIncendio(str, Enum):
    """
    Fator rp — NBR 5419-2:2026, Tabela C.4.
    Providências para reduzir consequências de incêndio.
    """
    NENHUMA = "NENHUMA"                        # rp = 1
    EXTINTORES_MANUAIS = "EXTINTORES"          # rp = 0,5
    HIDRANTES = "HIDRANTES"                    # rp = 0,5
    INSTALACAO_FIXA_AUTOMATICA = "AUTOMATICA"  # rp = 0,2
    PROTECAO_OPERADA_AUTOMATICA = "OPERADA"    # rp = 0,2


class RiscoIncendio(str, Enum):
    """
    Fator rf — NBR 5419-2:2026, Tabela C.5.
    """
    EXPLOSAO = "EXPLOSAO"     # rf = 1
    ALTO = "ALTO"             # rf = 10^-1
    NORMAL = "NORMAL"         # rf = 10^-2
    BAIXO = "BAIXO"           # rf = 10^-3
    NENHUM = "NENHUM"         # rf = 0


class PerigoEspecial(str, Enum):
    """
    Fator hz — NBR 5419-2:2026, Tabela C.6.
    Aumenta a perda quando há situação especial de risco à vida.
    """
    NENHUM = "NENHUM"                        # hz = 1
    BAIXO_NIVEL_PANICO = "PANICO_BAIXO"      # hz = 2
    MEDIO_NIVEL_PANICO = "PANICO_MEDIO"      # hz = 5
    ALTO_NIVEL_PANICO = "PANICO_ALTO"        # hz = 10
    DIFICULDADE_EVACUACAO = "EVAC_DIFICIL"   # hz = 5
    CONTAMINACAO_AMBIENTAL = "CONTAM_AMB"    # hz = 20


class TipoConstrucao(str, Enum):
    """
    Fator rs — NBR 5419-2:2026, Tabela C.7.
    Aumenta a perda conforme o tipo construtivo afeta ferimentos por choque.
    """
    ALVENARIA_CONCRETO = "ALV_CONCRETO"  # rs padrão
    MADEIRA = "MADEIRA"                  # rs maior
    METALICA = "METALICA"                # rs menor
