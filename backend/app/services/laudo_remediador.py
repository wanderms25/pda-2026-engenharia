"""
Motor de remediação do laudo de inspeção.

Dado um laudo com itens não-conformes, gera ações específicas e citadas
normativamente para o cliente atingir 100% de conformidade.

Estratégia:
    Para cada código de item do checklist (DOC-01, CAP-01, DES-01, etc.),
    existe um "playbook" normativo: o que significa aquela não-conformidade,
    o que deve ser feito para corrigir, com que prioridade e citando a norma.

Prioridade (NBR 5419-3:2026, 7.4.2 — "do imediato ao preventivo"):
    1 = IMEDIATO — corrigir antes de liberar a instalação; compromete segurança à vida
    2 = CURTO PRAZO — corrigir em até 30 dias; compromete eficácia do SPDA
    3 = PREVENTIVO — incluir em próxima manutenção programada
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class PrioridadeAcao(int, Enum):
    IMEDIATO = 1
    CURTO_PRAZO = 2
    PREVENTIVO = 3


@dataclass
class AcaoCorretiva:
    codigo_item: str
    descricao_nao_conformidade: str
    acao_recomendada: str
    prazo: str
    referencia_norma: str
    prioridade: PrioridadeAcao
    custo_relativo: str          # "BAIXO", "MEDIO", "ALTO"

    def para_dict(self) -> dict[str, Any]:
        return {
            "codigo_item": self.codigo_item,
            "descricao_nao_conformidade": self.descricao_nao_conformidade,
            "acao_recomendada": self.acao_recomendada,
            "prazo": self.prazo,
            "referencia_norma": self.referencia_norma,
            "prioridade": self.prioridade.value,
            "prioridade_label": self.prioridade.name,
            "custo_relativo": self.custo_relativo,
        }


# =============================================================================
# PLAYBOOK — para cada código de checklist, a ação corretiva padrão
# =============================================================================
PLAYBOOK_REMEDIACAO: dict[str, dict[str, Any]] = {
    # ------ DOCUMENTAÇÃO --------------------------------------------------
    "DOC-01": {
        "descricao": "Documentação técnica as-built ausente ou desatualizada",
        "acao": (
            "Elaborar ou atualizar a documentação técnica 'as built' contendo, no mínimo: "
            "desenhos em escala dos subsistemas de captação, descida e aterramento; "
            "lista de materiais com configurações e seções (Tabela 7); "
            "memorial descritivo do método de posicionamento dos captores; "
            "cálculo das distâncias de segurança."
        ),
        "prazo": "Antes da próxima inspeção periódica",
        "norma": "NBR 5419-3:2026, 7.5.1 e 7.5.3",
        "prioridade": PrioridadeAcao.CURTO_PRAZO,
        "custo": "BAIXO",
    },
    "DOC-02": {
        "descricao": "Relatório de inspeção anterior não disponível",
        "acao": (
            "Resgatar ou reconstituir o histórico de inspeções anteriores. "
            "Manter cópia física no local e backup digital. Se inexistente, "
            "iniciar novo histórico a partir desta inspeção."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 7.5 e 7.3.3.b",
        "prioridade": PrioridadeAcao.CURTO_PRAZO,
        "custo": "BAIXO",
    },
    "DOC-03": {
        "descricao": "ART do profissional responsável ausente",
        "acao": (
            "Providenciar ART/RRT do engenheiro responsável pelo projeto ou pela "
            "última reforma do SPDA junto ao conselho de classe (CREA/CFT). "
            "Anexar ao dossiê do SPDA."
        ),
        "prazo": "Até 30 dias",
        "norma": "NBR 5419-3:2026, 7.5.3.a",
        "prioridade": PrioridadeAcao.CURTO_PRAZO,
        "custo": "BAIXO",
    },
    "DOC-04": {
        "descricao": "Memorial descritivo não define método de posicionamento",
        "acao": (
            "Revisar o memorial descritivo definindo explicitamente: SPDA isolado "
            "ou não isolado; método(s) de posicionamento dos captores utilizados "
            "(esfera rolante, malha ou ângulo); raio da esfera rolante aplicado "
            "(20/30/45/60 m conforme NP); tamanho da malha (5/10/15/20 m)."
        ),
        "prazo": "Antes da próxima inspeção",
        "norma": "NBR 5419-3:2026, 5.3.2 e 7.5.3.e",
        "prioridade": PrioridadeAcao.CURTO_PRAZO,
        "custo": "BAIXO",
    },

    # ------ CAPTAÇÃO ------------------------------------------------------
    "CAP-01": {
        "descricao": "Corrosão ou deterioração no subsistema de captação",
        "acao": (
            "Substituir imediatamente os componentes corroídos por material "
            "adequado ao ambiente (ver Tabela 6 da Parte 3 — resistência à corrosão). "
            "Para ambientes litorâneos ou agressivos, preferir aço inoxidável AISI 304 "
            "ou cobre. Verificar compatibilidade galvânica nas conexões."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 7.3.3.c e Tabela 6",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "MEDIO",
    },
    "CAP-02": {
        "descricao": "Posicionamento dos captores não respeita o método do projeto",
        "acao": (
            "Reposicionar captores conforme método definido no projeto. Para o método "
            "da esfera rolante, nenhum ponto da estrutura a proteger pode ser tocado "
            "pela esfera fictícia rolando ao redor. Para o método das malhas, o módulo "
            "da malha não pode exceder: 5×5 (NP I), 10×10 (NP II), 15×15 (NP III) ou "
            "20×20 m (NP IV). Verificar também captores nas platibandas e saliências."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 5.3.2 e Tabela 2",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "ALTO",
    },
    "CAP-03": {
        "descricao": "Saliências ou equipamentos na cobertura fora do volume de proteção",
        "acao": (
            "Instalar captores adicionais (mini-captores, mastros) para cobrir as "
            "saliências não protegidas. Lembrar que a área de exposição de uma saliência "
            "elevada é calculada como A'D = π·(3·Hp)² (Equação A.2 da Parte 2)."
        ),
        "prazo": "Até 30 dias",
        "norma": "NBR 5419-3:2026, 5.3.2.6 e Anexo A",
        "prioridade": PrioridadeAcao.CURTO_PRAZO,
        "custo": "MEDIO",
    },
    "CAP-04": {
        "descricao": "Seção ou material dos condutores de captação fora da Tabela 7",
        "acao": (
            "Substituir os condutores por material e seção conforme Tabela 7 da "
            "NBR 5419-3:2026. Seções mínimas: cobre 35 mm² (fita 1,75 mm ou cilíndrico "
            "Ø 6,7 mm); alumínio 70 mm² (fita 3,0 mm ou cilíndrico Ø 9,5 mm); aço "
            "galvanizado 50 mm² (Ø 8 mm)."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 5.7.2 e Tabela 7",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "MEDIO",
    },
    "CAP-05": {
        "descricao": "Evidência fotográfica da captação não fornecida",
        "acao": "Registrar fotografias gerais e de detalhe do subsistema de captação durante a inspeção.",
        "prazo": "Próxima inspeção",
        "norma": "NBR 5419-3:2026, 7.3.3",
        "prioridade": PrioridadeAcao.PREVENTIVO,
        "custo": "BAIXO",
    },

    # ------ DESCIDA -------------------------------------------------------
    "DES-01": {
        "descricao": "Condutores de descida corroídos, soltos ou mal fixados",
        "acao": (
            "Substituir trechos corroídos. Refazer a fixação respeitando os "
            "espaçamentos máximos: 1,0 m para condutores flexíveis na horizontal, "
            "1,5 m na vertical; 1,0 m para condutores rígidos na horizontal, "
            "1,5 m na vertical."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 5.6.2",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "BAIXO",
    },
    "DES-02": {
        "descricao": "Número de descidas abaixo do mínimo (Tabela 5)",
        "acao": (
            "Instalar descidas adicionais de forma a atender: n = perímetro / d, "
            "onde d = 10 m (NP I e II), 15 m (NP III) ou 20 m (NP IV). Mínimo absoluto "
            "de 2 descidas, preferencialmente nos cantos da estrutura, com "
            "espaçamento o mais uniforme possível."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 5.4.3.1 e Tabela 5",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "ALTO",
    },
    "DES-03": {
        "descricao": "Descidas com laços excessivos ou não instaladas em linha reta",
        "acao": (
            "Reinstalar os condutores de descida em linha reta vertical, "
            "constituindo o caminho mais curto e direto para o solo. Se um laço "
            "for inevitável, calcular a distância de segurança entre os pontos A e B "
            "conforme 6.3.1 e ajustar o comprimento."
        ),
        "prazo": "Até 30 dias",
        "norma": "NBR 5419-3:2026, 5.4.4.2",
        "prioridade": PrioridadeAcao.CURTO_PRAZO,
        "custo": "MEDIO",
    },
    "DES-04": {
        "descricao": "Ausência de conector para ensaios nas descidas",
        "acao": (
            "Instalar conectores para ensaio em cada descida, no ponto próximo "
            "à caixa de inspeção, permitindo a desconexão do eletrodo para ensaios "
            "de continuidade isolados."
        ),
        "prazo": "Até 30 dias",
        "norma": "NBR 5419-3:2026, 5.4.6",
        "prioridade": PrioridadeAcao.CURTO_PRAZO,
        "custo": "BAIXO",
    },
    "DES-05": {
        "descricao": "Fotos dos pontos de descida não fornecidas",
        "acao": "Registrar fotografias de cada ponto de descida identificando P1, P2, ... Pn.",
        "prazo": "Próxima inspeção",
        "norma": "NBR 5419-3:2026, 7.3.3",
        "prioridade": PrioridadeAcao.PREVENTIVO,
        "custo": "BAIXO",
    },

    # ------ ATERRAMENTO ---------------------------------------------------
    "ATR-01": {
        "descricao": "Eletrodo de aterramento corroído ou caixa de inspeção inacessível",
        "acao": (
            "Substituir eletrodos corroídos. Garantir acessibilidade das caixas "
            "de inspeção (sem entulho ou vegetação). Conexões enterradas devem ser "
            "em solda exotérmica ou compressão; qualquer outro tipo de conexão deve "
            "estar em caixa de inspeção acessível."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 5.6.3.3",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "MEDIO",
    },
    "ATR-02": {
        "descricao": "Anel perimetral de aterramento incompleto ou inexistente",
        "acao": (
            "Instalar ou completar o anel perimetral de aterramento interligando "
            "todos os eletrodos em caixas de inspeção. Seção mínima conforme Tabela "
            "do SPDA (Parte 3, Tabela 7)."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 5.5",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "ALTO",
    },
    "ATR-03": {
        "descricao": "Valor de resistência de aterramento informado (opcional)",
        "acao": (
            "NOTA: conforme NBR 5419-3:2026, item 7.1.4, a medição de resistência "
            "de aterramento NÃO é mais necessária para verificar a eficácia do SPDA. "
            "O valor é apenas informativo. Se o cliente solicitar acompanhamento "
            "histórico, manter registro sem transformar em critério de conformidade."
        ),
        "prazo": "—",
        "norma": "NBR 5419-3:2026, 7.1.4",
        "prioridade": PrioridadeAcao.PREVENTIVO,
        "custo": "BAIXO",
    },
    "ATR-04": {
        "descricao": "Fotos das caixas de inspeção não fornecidas",
        "acao": "Registrar fotografias internas e externas de cada caixa de inspeção.",
        "prazo": "Próxima inspeção",
        "norma": "NBR 5419-3:2026, 7.3.3",
        "prioridade": PrioridadeAcao.PREVENTIVO,
        "custo": "BAIXO",
    },

    # ------ EQUIPOTENCIALIZAÇÃO ------------------------------------------
    "EQP-01": {
        "descricao": "Barramento de equipotencialização principal (BEP) ausente ou não identificado",
        "acao": (
            "Instalar BEP dimensionado conforme NBR 5419-4:2026, Seção 5, em local "
            "acessível e identificado por placa. O BEP deve ser o ponto único de "
            "referência de potencial para todas as instalações metálicas, blindagens "
            "e DPS da estrutura."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-4:2026, Seção 5",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "MEDIO",
    },
    "EQP-02": {
        "descricao": "Instalações metálicas externas não interligadas ao BEP",
        "acao": (
            "Interligar todas as instalações metálicas externas (tubulações de água, "
            "gás, alambrados, postes, estruturas metálicas) ao BEP via barras de "
            "equipotencialização local. Usar condutores com seção conforme a Parte 4."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 6.2 e NBR 5419-4:2026, Seção 5",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "MEDIO",
    },
    "EQP-03": {
        "descricao": "Blindagens de cabos não interligadas ao BEP",
        "acao": (
            "Interligar as blindagens de todos os cabos de sinal e energia ao BEP "
            "nos dois extremos (entrada e saída das zonas de proteção), garantindo "
            "continuidade elétrica e referência comum de potencial."
        ),
        "prazo": "Até 30 dias",
        "norma": "NBR 5419-4:2026, 9.2.5.c",
        "prioridade": PrioridadeAcao.CURTO_PRAZO,
        "custo": "MEDIO",
    },

    # ------ DISTÂNCIAS DE SEGURANÇA ---------------------------------------
    "DST-01": {
        "descricao": "Distância de segurança s não atendida entre SPDA e instalações internas",
        "acao": (
            "Reposicionar instalações afetadas OU interligar ao SPDA via condutor "
            "de equipotencialização. O cálculo de s usa s = (ki/km)·kc·l, com "
            "ki = 0,08/0,06/0,04 (NP I/II/III-IV), km = 1 (ar) ou 0,5 (sólido), "
            "kc dependendo do número de descidas."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 6.3 e Equação (5)",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "ALTO",
    },
    "DST-02": {
        "descricao": "Distância de SPDA a aberturas (portas/janelas) não respeitada",
        "acao": (
            "Afastar os condutores de descida das aberturas com acesso de pessoas "
            "respeitando a distância de segurança s calculada conforme 6.3."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 5.4.4.4",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "MEDIO",
    },

    # ------ MPS E DPS -----------------------------------------------------
    "MPS-01": {
        "descricao": "DPS classe I não instalado no ponto de entrada das linhas elétricas",
        "acao": (
            "Instalar DPS classe I (Iimp 10/350 μs) no ponto de entrada do "
            "QGBT/QDG, capaz de suportar a corrente parcial direta da descarga. "
            "Iimp mínimo recomendado por NP: I = 25 kA, II = 20 kA, III = 15 kA, "
            "IV = 12,5 kA (por polo)."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-4:2026, Anexo C e Anexo B.4",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "MEDIO",
    },
    "MPS-02": {
        "descricao": "DPS com indicação de fim de vida útil ou danos visíveis",
        "acao": (
            "Substituir imediatamente os DPS danificados por modelos equivalentes "
            "ou superiores. Verificar também se o dispositivo de proteção de "
            "sobrecorrente a montante foi acionado — se sim, substituir também."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-4:2026, 9.2.5.e",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "BAIXO",
    },
    "MPS-03": {
        "descricao": "Dispositivo de sobrecorrente a montante do DPS com problemas",
        "acao": (
            "Substituir o dispositivo de proteção de sobrecorrente a montante "
            "por modelo compatível com o DPS, seguindo as especificações do fabricante "
            "e da NBR 5419-4 (Anexo C)."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-4:2026, 9.2.5.f",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "BAIXO",
    },
    "MPS-04": {
        "descricao": "Contador de raios com integridade física comprometida",
        "acao": "Substituir o contador de raios e registrar qualquer atuação anterior.",
        "prazo": "Até 30 dias",
        "norma": "NBR 5419-3:2026, 7.3.3.h",
        "prioridade": PrioridadeAcao.CURTO_PRAZO,
        "custo": "BAIXO",
    },
    "MPS-05": {
        "descricao": "Fotos dos DPS e quadros não fornecidas",
        "acao": "Registrar fotografias de todos os DPS e quadros de origem.",
        "prazo": "Próxima inspeção",
        "norma": "NBR 5419-4:2026, 9.2",
        "prioridade": PrioridadeAcao.PREVENTIVO,
        "custo": "BAIXO",
    },

    # ------ ENSAIOS -------------------------------------------------------
    "ENS-01": {
        "descricao": "Ensaio de continuidade elétrica não realizado ou com valor alto",
        "acao": (
            "Realizar ensaio de continuidade elétrica nos condutores não naturais "
            "do SPDA (captação, descida, equipotencialização) conforme Anexo F da "
            "Parte 3. Valores muito altos indicam mau contato — refazer conexões "
            "por solda exotérmica ou compressão. Objetivo: verificar integridade "
            "física, não valor absoluto."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-3:2026, 7.3.4 e Anexo F",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "BAIXO",
    },
    "ENS-02": {
        "descricao": "Ensaio de continuidade entre BEP e eletrodo de aterramento não realizado",
        "acao": (
            "Medir a continuidade entre o barramento de equipotencialização e o "
            "eletrodo de aterramento. Se não for possível detectar visualmente, "
            "verificar conforme Anexo F da Parte 3. Corrigir trechos com "
            "descontinuidade."
        ),
        "prazo": "Imediato",
        "norma": "NBR 5419-4:2026, 9.2.6.2 e NBR 5419-3:2026, Anexo F",
        "prioridade": PrioridadeAcao.IMEDIATO,
        "custo": "BAIXO",
    },
}


# =============================================================================
# FUNÇÃO PRINCIPAL
# =============================================================================
@dataclass
class ResultadoRemediacao:
    """Resultado da análise de não-conformidades do laudo."""
    total_itens: int
    conformes: int
    nao_conformes: int
    na: int
    percentual_conformidade: float
    acoes: list[AcaoCorretiva] = field(default_factory=list)

    @property
    def ja_conforme_100(self) -> bool:
        return self.nao_conformes == 0

    @property
    def prazo_mais_urgente(self) -> PrioridadeAcao | None:
        if not self.acoes:
            return None
        return min(a.prioridade for a in self.acoes)

    def acoes_por_prioridade(self) -> dict[str, list[AcaoCorretiva]]:
        agrupado: dict[str, list[AcaoCorretiva]] = {"IMEDIATO": [], "CURTO_PRAZO": [], "PREVENTIVO": []}
        for acao in self.acoes:
            agrupado[acao.prioridade.name].append(acao)
        return agrupado

    def para_dict(self) -> dict[str, Any]:
        return {
            "total_itens": self.total_itens,
            "conformes": self.conformes,
            "nao_conformes": self.nao_conformes,
            "na": self.na,
            "percentual_conformidade": self.percentual_conformidade,
            "ja_conforme_100": self.ja_conforme_100,
            "prazo_mais_urgente": self.prazo_mais_urgente.name if self.prazo_mais_urgente else None,
            "acoes": [a.para_dict() for a in self.acoes],
            "acoes_por_prioridade": {
                k: [a.para_dict() for a in v]
                for k, v in self.acoes_por_prioridade().items()
            },
        }


def analisar_laudo(
    respostas: dict[str, str],
    itens_checklist_total: int,
) -> ResultadoRemediacao:
    """
    Analisa as respostas do laudo e gera o plano de remediação.

    Parameters
    ----------
    respostas : dict[str, str]
        Mapa código_item → status ("CONFORME" | "NAO_CONFORME" | "NA")
    itens_checklist_total : int
        Total de itens no checklist (para calcular percentual correto).
    """
    conformes = sum(1 for s in respostas.values() if s == "CONFORME")
    nao_conformes = sum(1 for s in respostas.values() if s == "NAO_CONFORME")
    na = sum(1 for s in respostas.values() if s == "NA")

    base_conformidade = conformes + nao_conformes
    percentual = (conformes / base_conformidade * 100) if base_conformidade > 0 else 100.0

    acoes: list[AcaoCorretiva] = []
    for codigo, status in respostas.items():
        if status != "NAO_CONFORME":
            continue
        playbook = PLAYBOOK_REMEDIACAO.get(codigo)
        if not playbook:
            acoes.append(AcaoCorretiva(
                codigo_item=codigo,
                descricao_nao_conformidade="Item não conforme (sem playbook específico)",
                acao_recomendada="Revisar conforme norma aplicável e corrigir.",
                prazo="A definir",
                referencia_norma="NBR 5419:2026",
                prioridade=PrioridadeAcao.CURTO_PRAZO,
                custo_relativo="MEDIO",
            ))
            continue
        acoes.append(AcaoCorretiva(
            codigo_item=codigo,
            descricao_nao_conformidade=playbook["descricao"],
            acao_recomendada=playbook["acao"],
            prazo=playbook["prazo"],
            referencia_norma=playbook["norma"],
            prioridade=playbook["prioridade"],
            custo_relativo=playbook["custo"],
        ))

    # Ordenar por prioridade (IMEDIATO primeiro)
    acoes.sort(key=lambda a: a.prioridade.value)

    return ResultadoRemediacao(
        total_itens=itens_checklist_total,
        conformes=conformes,
        nao_conformes=nao_conformes,
        na=na,
        percentual_conformidade=percentual,
        acoes=acoes,
    )
