"""
Zonas de estudo ZS — NBR 5419-2:2026, 6.7 a 6.9.

Uma ZS é uma parte da estrutura com características HOMOGÊNEAS na qual somente
um conjunto de parâmetros está envolvido na taxa de um componente de risco
(definição 3.136 da Parte 3).

Zonas típicas são especificadas por:
- tipo de solo ou piso (afeta RA, RU)
- compartimentos à prova de fogo (afeta RB, RV)
- blindagem espacial (afeta RC, RM)
- leiaute dos sistemas internos
- medidas de proteção existentes ou a instalar
- valores de perdas distintos

O risco total R de uma estrutura é a SOMA dos componentes calculados para cada ZS.
"""
from dataclasses import dataclass, field

from app.engine.perdas import EntradaPerdas
from app.engine.probabilidades import EntradaProbabilidades
from app.engine.riscos import ComponentesRisco


@dataclass
class ZonaEstudo:
    """
    Representa uma zona de estudo ZS.

    Cada zona tem suas próprias medidas de proteção, perdas e pode ter fator
    de ocupação diferente (razão de pessoas presentes).
    """
    id: str
    nome: str
    entrada_probabilidades: EntradaProbabilidades
    entrada_perdas: EntradaPerdas

    # Cada zona produz seu próprio conjunto de componentes
    componentes_calculados: ComponentesRisco | None = None


@dataclass
class EstruturaMultiZona:
    """
    Estrutura dividida em múltiplas zonas de estudo.

    NBR 5419-2:2026, 6.9.3 — o risco total é a soma dos componentes de risco
    de cada zona.
    """
    nome: str
    zonas: list[ZonaEstudo] = field(default_factory=list)

    def somar_componentes(self) -> ComponentesRisco:
        """
        Soma os componentes de risco de todas as zonas já calculadas.
        NBR 5419-2:2026, 6.6.4: "O risco total R da estrutura é a soma das
        componentes de risco aplicáveis para as várias zonas de estudo ZS".
        """
        totais = {
            "RA": 0.0, "RB": 0.0, "RC": 0.0, "RM": 0.0,
            "RU": 0.0, "RV": 0.0, "RW": 0.0, "RZ": 0.0,
        }
        for zona in self.zonas:
            if zona.componentes_calculados is None:
                raise RuntimeError(
                    f"Zona '{zona.id}' ainda não teve seus componentes calculados."
                )
            for k in totais:
                totais[k] += getattr(zona.componentes_calculados, k)
        return ComponentesRisco(**totais)
