"""
Parte 4 — Sistemas elétricos e eletrônicos internos à estrutura.

ABNT NBR 5419-4:2026.

Este módulo codifica os conceitos principais da Parte 4 que são usados pelo
motor de cálculo e pelo módulo de projeto de MPS:
- Zonas de proteção contra raios (ZPR)
- Classes de DPS (I, II, III)
- Fluxo de projeto de MPS (Anexo B.3)
- Relação entre NP do SPDA e NP dos DPS coordenados
"""
from dataclasses import dataclass
from enum import Enum

from app.nbr5419.enums import NivelProtecao


class ZonaProtecao(str, Enum):
    """
    Zonas de Proteção contra Raios (ZPR) — NBR 5419-4:2026, 4.3.

    ZPR 0A: zona onde a ameaça é devida à queda direta e ao campo
            eletromagnético total. Sistemas internos podem estar sujeitos à
            corrente total ou parcial da descarga.
    ZPR 0B: zona protegida contra queda direta, mas exposta ao campo
            eletromagnético total. Sistemas internos sujeitos à corrente
            parcial.
    ZPR 1:  zona onde a corrente é limitada por divisão e aplicação de
            interfaces isolantes, ligações equipotenciais e DPS na fronteira.
            Blindagem espacial pode atenuar o campo.
    ZPR 2+: zonas com nova divisão e nova atenuação.
    """
    ZPR_0A = "ZPR_0A"
    ZPR_0B = "ZPR_0B"
    ZPR_1 = "ZPR_1"
    ZPR_2 = "ZPR_2"
    ZPR_3 = "ZPR_3"


class ClasseDPS(str, Enum):
    """
    Classes de ensaio dos DPS — NBR 5419-4:2026, Anexo C.

    Classe I  (Iimp, 10/350 µs): instalado no ponto de entrada (fronteira
              ZPR 0/1), suporta corrente parcial da descarga.
    Classe II (In, 8/20 µs):     instalado em quadros intermediários
              (fronteira ZPR 1/2).
    Classe III: instalado próximo a equipamentos sensíveis (ZPR 2/3).
    """
    I = "CLASSE_I"
    II = "CLASSE_II"
    III = "CLASSE_III"


@dataclass(frozen=True)
class DPS:
    """Representação de um DPS instalado no projeto de MPS."""
    classe: ClasseDPS
    localizacao: str                # ex.: "QGBT", "Quadro TI"
    zona_entrada: ZonaProtecao
    zona_saida: ZonaProtecao
    tensao_protecao_UP_kV: float
    corrente_Iimp_kA: float | None = None  # para classe I
    corrente_In_kA: float | None = None    # para classe II


@dataclass(frozen=True)
class SistemaCoordenadoDPS:
    """
    Sistema coordenado de DPS — NBR 5419-4:2026, Anexo C.

    Um sistema coordenado é adequado como medida de proteção que reduz
    as probabilidades PC, PM, PW e PZ (conforme Tabela B.3 da Parte 2).
    """
    nivel_protecao_spda: NivelProtecao
    dispositivos: list[DPS]

    def e_sistema_completo(self) -> bool:
        """Verifica se há pelo menos um DPS classe I na entrada de energia."""
        return any(d.classe == ClasseDPS.I for d in self.dispositivos)


# =============================================================================
# NBR 5419-4:2026, Anexo B.3 — Etapas do projeto de MPS
# =============================================================================
ETAPAS_PROJETO_MPS: list[str] = [
    "1. Obter dados da estrutura e realizar análise de risco (NBR 5419-2)",
    "2. Verificar se MPS são necessárias. Se não, FIM.",
    "3. Definir ZPR",
    "4. Projetar sistema básico de equipotencialização (Seção 5)",
    "5. Projetar medidas básicas de proteção para ZPR 1 (B.4.1)",
    "6. Projetar medidas básicas de proteção para ZPR 2 (B.4.2)",
    "7. Projetar medidas básicas de proteção para ZPR 3 (B.4.3)",
    "8. Projetar sistema coordenado de DPS",
    "9. Projetar medidas adicionais de proteção (B.10, B.11)",
    "10. Projetar medidas de proteção para equipamentos externos (B.12)",
    "11. Melhorar interconexões entre estruturas (B.13)",
]


# =============================================================================
# Relação NP do SPDA ↔ Iimp mínimo do DPS classe I
# NBR 5419-4:2026, C.2 / Parte 1, Tabela 3
# =============================================================================
IIMP_MINIMO_POR_NP_KA: dict[NivelProtecao, float] = {
    NivelProtecao.I: 25.0,   # 10/350 µs por polo (linha trifásica típica)
    NivelProtecao.II: 20.0,
    NivelProtecao.III: 15.0,
    NivelProtecao.IV: 12.5,
}


def recomendar_iimp_minimo(np: NivelProtecao) -> float:
    """Retorna o Iimp mínimo recomendado para DPS classe I por NP do SPDA."""
    return IIMP_MINIMO_POR_NP_KA[np]
