"""
Tabelas e auxiliares de dimensionamento — ABNT NBR 5419-3:2026 (Danos físicos).

Codifica:
- Tabela 2: raios da esfera rolante, malhas, ângulo de proteção por NP
- Tabela 5: distância entre condutores de descida por NP
- Tabela 11: coeficiente ki (distância de segurança) por NP
- Tabela 12: coeficiente km por meio isolante
- Tabela 13: coeficiente kc simplificado em função de n (descidas)
- Tabela 7: materiais e dimensões mínimas (principais itens)

E funções de dimensionamento automático:
- número mínimo de descidas (5.4.3)
- distância de segurança s (6.3.2, equação 5)
- raio da esfera rolante por NP
"""
import math
from dataclasses import dataclass
from enum import Enum

from app.nbr5419.enums import NivelProtecao


class MetodoCaptacao(str, Enum):
    ANGULO_PROTECAO = "ANGULO_PROTECAO"
    ESFERA_ROLANTE = "ESFERA_ROLANTE"
    MALHA = "MALHA"


# =============================================================================
# NBR 5419-3:2026, Tabela 2 — raio esfera rolante, malha, ângulo por NP
# =============================================================================
RAIO_ESFERA_ROLANTE_M: dict[NivelProtecao, float] = {
    NivelProtecao.I: 20.0,
    NivelProtecao.II: 30.0,
    NivelProtecao.III: 45.0,
    NivelProtecao.IV: 60.0,
}

# Tamanho máximo do módulo da malha (lado × lado, em metros)
TAMANHO_MALHA_M: dict[NivelProtecao, tuple[float, float]] = {
    NivelProtecao.I: (5.0, 5.0),
    NivelProtecao.II: (10.0, 10.0),
    NivelProtecao.III: (15.0, 15.0),
    NivelProtecao.IV: (20.0, 20.0),
}


# =============================================================================
# NBR 5419-3:2026, Tabela 5 — distância entre condutores de descida
# =============================================================================
DISTANCIA_DESCIDAS_M: dict[NivelProtecao, float] = {
    NivelProtecao.I: 10.0,
    NivelProtecao.II: 10.0,
    NivelProtecao.III: 15.0,
    NivelProtecao.IV: 20.0,
}


# =============================================================================
# NBR 5419-3:2026, Tabela 11 — coeficiente ki (nível de proteção do SPDA)
# =============================================================================
COEFICIENTE_KI: dict[NivelProtecao, float] = {
    NivelProtecao.I: 0.08,
    NivelProtecao.II: 0.06,
    NivelProtecao.III: 0.04,
    NivelProtecao.IV: 0.04,
}


# =============================================================================
# NBR 5419-3:2026, Tabela 12 — coeficiente km (meio isolante entre partes)
# =============================================================================
COEFICIENTE_KM: dict[str, float] = {
    "AR": 1.0,
    "SOLIDO": 0.5,
}


# =============================================================================
# NBR 5419-3:2026, Tabela 13 — coeficiente kc simplificado
# =============================================================================
def coeficiente_kc_simplificado(numero_descidas: int) -> float:
    """Tabela 13 — valores aproximados de kc em função do número de descidas."""
    if numero_descidas == 1:
        return 1.0  # somente para SPDA isolado
    if numero_descidas == 2:
        return 0.66
    if numero_descidas >= 3:
        return 0.44
    raise ValueError("Número de descidas deve ser ≥ 1")


# =============================================================================
# NBR 5419-1:2026, Tabela D.3 / NBR 5419-3:2026, Tabela 7 — Seções mínimas
# =============================================================================
@dataclass(frozen=True)
class EspecificacaoCondutor:
    material: str
    configuracao: str
    secao_mm2: float
    dimensao_mm: str


# Principais condutores de captação e descida não naturais (Tabela 7)
CONDUTORES_MINIMOS_CAPTACAO_DESCIDA: list[EspecificacaoCondutor] = [
    EspecificacaoCondutor("Cobre", "Fita maciça", 35, "Espessura 1,75"),
    EspecificacaoCondutor("Cobre", "Cilíndrico maciço", 35, "Diâmetro 6,7"),
    EspecificacaoCondutor("Cobre", "Encordoado", 35, "—"),
    EspecificacaoCondutor("Alumínio", "Fita maciça", 70, "Espessura 3,0"),
    EspecificacaoCondutor("Alumínio", "Cilíndrico maciço", 70, "Diâmetro 9,5"),
    EspecificacaoCondutor("Alumínio", "Encordoado", 70, "—"),
    EspecificacaoCondutor("Aço galvanizado a quente", "Cilíndrico maciço", 50, "Diâmetro 8"),
    EspecificacaoCondutor("Aço inoxidável", "Cilíndrico maciço", 50, "Diâmetro 8"),
    EspecificacaoCondutor("Aço cobreado", "Cilíndrico maciço", 50, "Diâmetro 8"),
]


# =============================================================================
# FUNÇÕES DE DIMENSIONAMENTO AUTOMÁTICO
# =============================================================================

def numero_minimo_descidas(perimetro_m: float, nivel: NivelProtecao) -> int:
    """
    Número mínimo de condutores de descida — NBR 5419-3:2026, 5.4.3.1.

    n = perímetro / distância_tabela_5
    Mínimo de 2, mesmo se o cálculo der 1.
    """
    distancia = DISTANCIA_DESCIDAS_M[nivel]
    calculado = math.ceil(perimetro_m / distancia)
    return max(calculado, 2)


def distancia_seguranca_simplificada(
    nivel: NivelProtecao,
    numero_descidas: int,
    comprimento_l_m: float,
    meio: str = "AR",
) -> float:
    """
    Distância de segurança s — NBR 5419-3:2026, Equação (5) simplificada:

        s = (ki / km) × kc × l

    Parameters
    ----------
    nivel : NivelProtecao
        Nível de proteção do SPDA.
    numero_descidas : int
        Número total de condutores de descida.
    comprimento_l_m : float
        Comprimento l, em metros, ao longo dos condutores do SPDA.
    meio : str
        "AR" ou "SOLIDO" — tipo de meio isolante entre partes.
    """
    ki = COEFICIENTE_KI[nivel]
    km = COEFICIENTE_KM[meio.upper()]
    kc = coeficiente_kc_simplificado(numero_descidas)
    return (ki / km) * kc * comprimento_l_m


@dataclass(frozen=True)
class ProjetoSPDA:
    """Resumo do dimensionamento mínimo conforme Parte 3."""
    nivel: NivelProtecao
    raio_esfera_m: float
    malha_m: tuple[float, float]
    distancia_descidas_m: float
    numero_minimo_descidas: int
    distancia_seguranca_m: float


def dimensionar_spda_basico(
    nivel: NivelProtecao,
    perimetro_m: float,
    altura_m: float,
) -> ProjetoSPDA:
    """
    Produz o dimensionamento mínimo exigido pela NBR 5419-3:2026 para um nível
    de proteção desejado.

    - raio da esfera rolante e malha: Tabela 2
    - número mínimo de descidas: Tabela 5 + perímetro
    - distância de segurança: equação (5) simplificada com l = altura (conservador)
    """
    n_desc = numero_minimo_descidas(perimetro_m, nivel)
    s = distancia_seguranca_simplificada(nivel, n_desc, altura_m)
    return ProjetoSPDA(
        nivel=nivel,
        raio_esfera_m=RAIO_ESFERA_ROLANTE_M[nivel],
        malha_m=TAMANHO_MALHA_M[nivel],
        distancia_descidas_m=DISTANCIA_DESCIDAS_M[nivel],
        numero_minimo_descidas=n_desc,
        distancia_seguranca_m=s,
    )


# =============================================================================
# NBR 5419-3:2026, §5.4.4 — Eletrodos de aterramento tipo A e B
# =============================================================================

# Comprimento mínimo do eletrodo tipo A (vertical ou horizontal) em metros
# Tabela 8/9: l1 mínimo por NP e tipo de eletrodo
COMPRIMENTO_MIN_ELETRODO_A_M: dict[NivelProtecao, float] = {
    NivelProtecao.I:   2.5,   # m (vertical) — §5.4.4.1 Tabela 8
    NivelProtecao.II:  2.5,
    NivelProtecao.III: 2.5,
    NivelProtecao.IV:  2.5,
}
# NOTA: Para eletrodo tipo A, usar resistividade do solo ρ para ajuste fino.
# Comprimento ajustado = max(l1_min, l1_norma_tabela8_função_de_ρ)
# A Tabela 8 fornece l1 em função de ρ (Ω·m).

def comprimento_eletrodo_tipo_A(resistividade_ohm_m: float) -> float:
    """
    Comprimento mínimo do eletrodo de aterramento tipo A (horizontal ou vertical)
    em função da resistividade do solo.

    NBR 5419-3:2026, §5.4.4.1 — Tabela 8.
    Valores interpolados da tabela:

    ρ (Ω·m) → l1 mín (m)
    ≤ 25     → 2
    50       → 3
    100      → 5
    200      → 7
    500      → 10
    1000     → 15
    > 1000   → 20 (valor conservador)
    """
    tabela = [(25,2), (50,3), (100,5), (200,7), (500,10), (1000,15)]
    if resistividade_ohm_m <= 25:
        return 2.0
    for i, (rho, l) in enumerate(tabela):
        if resistividade_ohm_m <= rho:
            if i == 0:
                return float(l)
            rho_prev, l_prev = tabela[i-1]
            # Interpolação linear
            t = (resistividade_ohm_m - rho_prev) / (rho - rho_prev)
            return l_prev + t * (l - l_prev)
    return 20.0  # > 1000 Ω·m


# =============================================================================
# NBR 5419-3:2026, §6.3.2 — Distância de segurança COMPLETA
# Equação (5): s ≥ ki × (kc / km) × l
# =============================================================================

# Tabela 11 — Coeficiente ki por NP
KI_POR_NP: dict[NivelProtecao, float] = {
    NivelProtecao.I:   0.08,
    NivelProtecao.II:  0.06,
    NivelProtecao.III: 0.04,
    NivelProtecao.IV:  0.02,
}

# Tabela 12 — Coeficiente km por meio isolante
KM_POR_MEIO: dict[str, float] = {
    "ar":          1.0,
    "solido":      0.5,   # material sólido (concreto, tijolo etc.)
    "liquido":     0.33,  # na maioria dos líquidos isolantes
}

# Tabela 13 — Coeficiente kc em função do número de descidas n
# Kc depende da topologia: linha contínua ou com anéis
def kc_numero_descidas(n: int, tem_anel_intermediario: bool = False) -> float:
    """
    Coeficiente kc — NBR 5419-3:2026, §6.3.2, Tabela 13.

    Para SPDA sem anéis intermediários:
        kc = 1 / (2n)       n ≥ 2
    Para SPDA com anel intermediário (simplificado):
        kc ≈ 0.66 / (2n)

    NOTA: Para cálculo preciso, ver Figura C.1 e Tabela 13 completa.
    """
    if n < 1:
        return 1.0
    if n == 1:
        return 1.0
    if tem_anel_intermediario:
        return 0.66 / (2 * n)
    return 1.0 / (2 * n)


def distancia_seguranca_completa(
    nivel: NivelProtecao,
    numero_descidas: int,
    comprimento_l_m: float,
    meio: str = "ar",
    tem_anel_intermediario: bool = False,
) -> float:
    """
    Distância de segurança s mínima entre condutor SPDA e partes metálicas.

    NBR 5419-3:2026, §6.3.2, Equação (5):
        s ≥ ki × (kc / km) × l

    Onde:
        ki = coeficiente dependente do NP (Tabela 11)
        kc = coeficiente dependente da topologia das descidas (Tabela 13)
        km = coeficiente dependente do meio isolante (Tabela 12)
        l  = comprimento do condutor de descida do ponto ao aterramento (m)

    Returns:
        Distância de segurança mínima em metros.
    """
    ki = KI_POR_NP[nivel]
    kc = kc_numero_descidas(numero_descidas, tem_anel_intermediario)
    km = KM_POR_MEIO.get(meio, 1.0)
    return ki * (kc / km) * comprimento_l_m


# =============================================================================
# NBR 5419-4:2026, §9.2 — Verificação do nível de proteção do DPS
# Up + UC ≤ UW / 1,2 (fator de segurança de 20%)
# =============================================================================

def verificar_coordenacao_dps(
    Up_kV: float,
    UC_kV: float,
    UW_kV: float,
) -> dict:
    """
    Verificação da coordenação do DPS com o equipamento.

    NBR 5419-4:2026, §9.2:
        Up + UC ≤ UW / 1,2

    Onde:
        Up  = nível de proteção do DPS (kV)
        UC  = queda de tensão nos condutores de conexão do DPS (kV)
              Estimativa: UC ≈ 1 kV/m × comprimento_condutor
        UW  = tensão suportável nominal de impulso do equipamento (kV)

    Returns:
        dict com resultado, valores e margem.
    """
    limite = UW_kV / 1.2
    soma = Up_kV + UC_kV
    conforme = soma <= limite
    margem = limite - soma
    return {
        "conforme": conforme,
        "Up_kV": Up_kV,
        "UC_kV": UC_kV,
        "UW_kV": UW_kV,
        "limite_kV": round(limite, 3),
        "soma_kV": round(soma, 3),
        "margem_kV": round(margem, 3),
        "mensagem": (
            f"Up + UC = {soma:.2f} kV {'≤' if conforme else '>'} UW/1,2 = {limite:.2f} kV — "
            f"{'CONFORME' if conforme else 'NÃO CONFORME'}"
        ),
        "referencia": "NBR 5419-4:2026, §9.2",
    }


# =============================================================================
# NBR 5419-3:2026, §5.5.3 — Eletrodo de aterramento tipo B
# Eletrodo de aterramento em anel ou eletrodo fundamental (fundação)
# =============================================================================
def raio_eletrodo_tipo_B(resistividade_ohm_m: float, nivel: "NivelProtecao") -> float:
    """
    Comprimento mínimo do eletrodo tipo B (em anel ao redor da estrutura).

    NBR 5419-3:2026, §5.5.3.3:
        Para eletrodo em anel: raio equivalente re = l₁ (tipo A)
        Para eletrodo fundamental (fundação): usa área da fundação
    
    Retorna: comprimento mínimo l₁ equivalente em metros.
    Nota: o eletrodo tipo B em anel deve envolver toda a estrutura;
          seu raio mínimo é determinado pela resistividade do solo.
    """
    # Mesmo critério do tipo A para o raio equivalente
    return comprimento_eletrodo_tipo_A(resistividade_ohm_m)


# =============================================================================
# NBR 5419-3:2026, §5.2 — Proteção de seres vivos em áreas abertas
# Tensão de passo e toque — distâncias seguras ao redor de estruturas
# =============================================================================
def distancia_protecao_pessoas(
    nivel: "NivelProtecao",
    tipo_solo: str = "normal",
) -> dict:
    """
    Distâncias mínimas para proteção de seres vivos contra tensão de passo
    e toque ao redor de estruturas com SPDA.

    NBR 5419-3:2026, §5.2:
    - Não entrar em área de 3 m ao redor das descidas durante tempestades
    - Para solo de alta resistividade, maior afastamento é recomendado

    Args:
        nivel: NivelProtecao do SPDA
        tipo_solo: "normal" | "rochoso" | "areia" (alta ρ)
    
    Returns:
        Dict com distâncias recomendadas.
    """
    base = {
        NivelProtecao.I:   3.0,
        NivelProtecao.II:  3.0,
        NivelProtecao.III: 3.0,
        NivelProtecao.IV:  3.0,
    }
    fatores = {"normal": 1.0, "rochoso": 1.5, "areia": 2.0}
    fator = fatores.get(tipo_solo, 1.0)
    dist = base[nivel] * fator
    return {
        "distancia_m": dist,
        "tipo_solo": tipo_solo,
        "recomendacao": (
            f"Manter afastamento mínimo de {dist:.1f} m das descidas do SPDA "
            f"durante tempestades (§5.2). Solo tipo: {tipo_solo}."
        ),
        "referencia": "NBR 5419-3:2026, §5.2",
    }


# =============================================================================
# NBR 5419-3:2026, §5.7 — Tabela 7: Dimensões mínimas dos condutores
# Material, configuração e área mínima de seção transversal
# =============================================================================
CONDUTORES_MINIMOS: dict[str, dict] = {
    "cobre_solido":     {"material": "Cobre",    "config": "Sólido/torcido", "area_mm2": 50,  "diametro_mm": 8.0},
    "cobre_fita":       {"material": "Cobre",    "config": "Fita",           "area_mm2": 50,  "espessura_mm": 2.0},
    "aluminio_solido":  {"material": "Alumínio", "config": "Sólido/torcido", "area_mm2": 70,  "diametro_mm": 8.0},
    "aco_galv_solido":  {"material": "Aço galv.","config": "Sólido",         "area_mm2": 50,  "diametro_mm": 8.0},
    "aco_inox_solido":  {"material": "Aço inox", "config": "Sólido/torcido", "area_mm2": 50,  "diametro_mm": 8.0},
    "aco_galv_fita":    {"material": "Aço galv.","config": "Fita",           "area_mm2": 50,  "espessura_mm": 2.5},
    "cobre_condutor_ai":{"material": "Cobre",    "config": "Condutor (AI)",  "area_mm2": 16,  "diametro_mm": None},
    "aco_galv_eletrodo":{"material": "Aço galv.","config": "Eletrodo haste", "area_mm2": None,"diametro_mm": 14.0},
}
# Referência: NBR 5419-3:2026 Tabela 7 (não naturais) e Tabela 6

# =============================================================================
# NBR 5419-3:2026, §4.4 — Eficiência dos níveis de proteção
# E = 1 - P_NP (probabilidade de NÃO ser interceptado)
# =============================================================================
EFICIENCIA_NP: dict["NivelProtecao", float] = {
    NivelProtecao.I:   0.98,   # 98%
    NivelProtecao.II:  0.95,   # 95%
    NivelProtecao.III: 0.90,   # 90%
    NivelProtecao.IV:  0.80,   # 80%
}
# Referência: NBR 5419-3:2026 Tabela 1
