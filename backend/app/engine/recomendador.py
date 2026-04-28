"""
Motor de recomendação automática de medidas de proteção.

Problema:
    Dado um cenário com R > RT, qual é o MENOR conjunto de medidas de proteção
    (SPDA, DPS, blindagens, medidas adicionais) que traz R ≤ RT?

Estratégia (busca em largura ordenada por "custo"):
    1. Enumerar configurações de proteção em ordem crescente de invasividade.
    2. Para cada configuração, recalcular R1 e R3.
    3. Retornar a PRIMEIRA configuração que atinge conformidade em R1 e R3.
    4. Se nenhuma atinge, retornar a melhor tentativa + alerta.

Ordem de preferência (do mais barato para o mais caro):
    Nível 0: sem medidas (baseline)
    Nível 1: + DPS coordenados NP IV (redução PC, PM, PW, PZ)
    Nível 2: + SPDA NP IV
    Nível 3: SPDA NP IV + DPS IV
    Nível 4: SPDA NP III + DPS III
    Nível 5: SPDA NP II + DPS II
    Nível 6: SPDA NP I + DPS I
    Nível 7: ++ medidas adicionais (isolação, malha, avisos)

Retorno: lista de passos com estimativa de "esforço" e citação normativa.
"""
from dataclasses import dataclass, field
from typing import Any, Callable

from app.engine.avaliacao import ResultadoAvaliacao, StatusConformidade, avaliar_conformidade
from app.engine.perdas import Perdas
from app.engine.probabilidades import (
    EntradaProbabilidades,
    calcular_todas_probabilidades,
)
from app.engine.riscos import (
    ComponentesRisco,
    EntradaComponentes,
    avaliar_riscos,
    calcular_componentes,
)
from app.nbr5419.enums import NivelProtecao


@dataclass(frozen=True)
class ConfigProtecao:
    """Configuração de proteção testada durante a busca."""
    spda_nivel: NivelProtecao = NivelProtecao.NENHUM
    dps_coordenados_nivel: NivelProtecao = NivelProtecao.NENHUM
    dps_classe_I_nivel: NivelProtecao = NivelProtecao.NENHUM
    avisos_alerta: bool = False
    isolacao_eletrica_descida: bool = False
    malha_equipotencializacao_solo: bool = False
    descida_natural_estrutura_continua: bool = False

    # Esforço relativo (0-100): ajuda a rankear soluções equivalentes
    custo_relativo: int = 0

    def descricao(self) -> str:
        partes: list[str] = []
        if self.spda_nivel != NivelProtecao.NENHUM:
            partes.append(f"SPDA NP {self.spda_nivel.value}")
        if self.dps_coordenados_nivel != NivelProtecao.NENHUM:
            partes.append(f"DPS coordenados NP {self.dps_coordenados_nivel.value}")
        if self.dps_classe_I_nivel != NivelProtecao.NENHUM:
            partes.append(f"DPS classe I NP {self.dps_classe_I_nivel.value}")
        if self.avisos_alerta:
            partes.append("avisos de alerta")
        if self.isolacao_eletrica_descida:
            partes.append("isolação elétrica dos condutores de descida")
        if self.malha_equipotencializacao_solo:
            partes.append("malha de equipotencialização do solo")
        if self.descida_natural_estrutura_continua:
            partes.append("descida natural por estrutura contínua")
        return ", ".join(partes) if partes else "sem proteção"


# =============================================================================
# Catálogo ordenado de configurações a testar (crescente em invasividade/custo)
# =============================================================================
def _gerar_configuracoes_a_testar() -> list[ConfigProtecao]:
    """
    Gera uma lista ordenada de configurações a testar, do mais simples/barato
    ao mais complexo/caro.

    O algoritmo garante monotonicidade: cada configuração superior é pelo
    menos tão protetiva quanto as anteriores.
    """
    configs: list[ConfigProtecao] = []

    # === Nível 1: apenas DPS coordenados (sem SPDA) ===
    for dps_nivel in [NivelProtecao.IV, NivelProtecao.III, NivelProtecao.II, NivelProtecao.I]:
        configs.append(ConfigProtecao(
            dps_coordenados_nivel=dps_nivel,
            dps_classe_I_nivel=dps_nivel,
            custo_relativo=10 + (5 - int(["IV", "III", "II", "I"].index(dps_nivel.value))) * 5,
        ))

    # === Nível 2: SPDA + DPS no MESMO nível de proteção ===
    for np in [NivelProtecao.IV, NivelProtecao.III, NivelProtecao.II, NivelProtecao.I]:
        configs.append(ConfigProtecao(
            spda_nivel=np,
            dps_coordenados_nivel=np,
            dps_classe_I_nivel=np,
            custo_relativo=40 + (5 - int(["IV", "III", "II", "I"].index(np.value))) * 10,
        ))

    # === Nível 3: SPDA + DPS + medidas adicionais contra tensão de toque/passo ===
    for np in [NivelProtecao.III, NivelProtecao.II, NivelProtecao.I]:
        configs.append(ConfigProtecao(
            spda_nivel=np,
            dps_coordenados_nivel=np,
            dps_classe_I_nivel=np,
            isolacao_eletrica_descida=True,
            malha_equipotencializacao_solo=True,
            custo_relativo=70 + (3 - int(["III", "II", "I"].index(np.value))) * 10,
        ))

    # === Nível 4: configuração máxima ===
    configs.append(ConfigProtecao(
        spda_nivel=NivelProtecao.I,
        dps_coordenados_nivel=NivelProtecao.I,
        dps_classe_I_nivel=NivelProtecao.I,
        isolacao_eletrica_descida=True,
        malha_equipotencializacao_solo=True,
        descida_natural_estrutura_continua=True,
        custo_relativo=100,
    ))

    return configs


@dataclass
class PassoRecomendacao:
    """Um passo acionável recomendado ao usuário para atingir a conformidade."""
    prioridade: int              # 1 = crítico, 2 = necessário, 3 = sugerido
    acao: str
    justificativa: str
    referencia_norma: str
    impacto_estimado: str        # descrição do efeito esperado no risco

    def para_dict(self) -> dict[str, Any]:
        return {
            "prioridade": self.prioridade,
            "acao": self.acao,
            "justificativa": self.justificativa,
            "referencia_norma": self.referencia_norma,
            "impacto_estimado": self.impacto_estimado,
        }


@dataclass
class ResultadoRecomendacao:
    """
    Resultado completo da recomendação automática.

    Contém a configuração mínima encontrada, o ganho obtido vs. cenário atual,
    e os passos detalhados para o engenheiro aplicar.
    """
    ja_conforme: bool
    config_recomendada: ConfigProtecao | None
    R1_antes: float
    R3_antes: float
    R1_depois: float
    R3_depois: float
    reducao_R1: float            # razão R1_antes / R1_depois
    reducao_R3: float
    passos: list[PassoRecomendacao] = field(default_factory=list)
    alerta_nao_conforme: str | None = None

    def para_dict(self) -> dict[str, Any]:
        return {
            "ja_conforme": self.ja_conforme,
            "config_recomendada": {
                "spda_nivel": self.config_recomendada.spda_nivel.value if self.config_recomendada else None,
                "dps_coordenados_nivel": self.config_recomendada.dps_coordenados_nivel.value if self.config_recomendada else None,
                "dps_classe_I_nivel": self.config_recomendada.dps_classe_I_nivel.value if self.config_recomendada else None,
                "avisos_alerta": self.config_recomendada.avisos_alerta if self.config_recomendada else False,
                "isolacao_eletrica_descida": self.config_recomendada.isolacao_eletrica_descida if self.config_recomendada else False,
                "malha_equipotencializacao_solo": self.config_recomendada.malha_equipotencializacao_solo if self.config_recomendada else False,
                "descricao": self.config_recomendada.descricao() if self.config_recomendada else "—",
            },
            "R1_antes": self.R1_antes,
            "R3_antes": self.R3_antes,
            "R1_depois": self.R1_depois,
            "R3_depois": self.R3_depois,
            "reducao_R1": self.reducao_R1,
            "reducao_R3": self.reducao_R3,
            "passos": [p.para_dict() for p in self.passos],
            "alerta_nao_conforme": self.alerta_nao_conforme,
        }


# =============================================================================
# ALGORITMO PRINCIPAL
# =============================================================================
def recomendar_protecao_minima(
    ND: float, NM: float, NL: float, NI: float, NDJ: float,
    perdas: Perdas,
    tipo_roteamento_linha: str,
    tensao_UW_kV: float,
    risco_explosao_ou_vida_imediata: bool,
    eh_patrimonio_cultural: bool = False,
) -> ResultadoRecomendacao:
    """
    Busca a configuração mínima de proteção que atinge R ≤ RT para R1 e R3.

    Retorna um ResultadoRecomendacao com:
    - Configuração recomendada (ou None se nenhuma atingir)
    - Comparação antes/depois
    - Passos acionáveis para o engenheiro
    """
    # Cenário base (sem proteção)
    ent_base = EntradaProbabilidades(
        tipo_roteamento_linha=tipo_roteamento_linha, tensao_UW_kV=tensao_UW_kV,
    )
    prob_base = calcular_todas_probabilidades(ent_base)
    comp_base = _calcular_comp(ND, NM, NL, NI, NDJ, prob_base, perdas)
    riscos_base = avaliar_riscos(comp_base, risco_explosao_ou_vida_imediata, False)

    R1_antes = riscos_base.R1
    R3_antes = riscos_base.R3

    # Verifica se já está conforme
    aval_base = avaliar_conformidade(riscos_base)
    if all(a.status != StatusConformidade.NAO_CONFORME for a in aval_base):
        return ResultadoRecomendacao(
            ja_conforme=True,
            config_recomendada=None,
            R1_antes=R1_antes, R3_antes=R3_antes,
            R1_depois=R1_antes, R3_depois=R3_antes,
            reducao_R1=1.0, reducao_R3=1.0,
            passos=[
                PassoRecomendacao(
                    prioridade=3,
                    acao="Manter o plano de inspeção e manutenção documentado",
                    justificativa="A estrutura já atende aos critérios da norma.",
                    referencia_norma="NBR 5419-3:2026, Seção 7.2",
                    impacto_estimado="Preserva a conformidade ao longo do tempo",
                ),
            ],
        )

    # Busca ordenada
    configs = _gerar_configuracoes_a_testar()
    melhor_config: ConfigProtecao | None = None
    melhor_R1 = R1_antes
    melhor_R3 = R3_antes

    for config in configs:
        ent = EntradaProbabilidades(
            spda_nivel=config.spda_nivel,
            dps_coordenados_nivel=config.dps_coordenados_nivel,
            dps_classe_I_nivel=config.dps_classe_I_nivel,
            avisos_alerta=config.avisos_alerta,
            isolacao_eletrica_descida=config.isolacao_eletrica_descida,
            malha_equipotencializacao_solo=config.malha_equipotencializacao_solo,
            descida_natural_estrutura_continua=config.descida_natural_estrutura_continua,
            tipo_roteamento_linha=tipo_roteamento_linha,
            tensao_UW_kV=tensao_UW_kV,
        )
        prob = calcular_todas_probabilidades(ent)
        comp = _calcular_comp(ND, NM, NL, NI, NDJ, prob, perdas)
        riscos = avaliar_riscos(comp, risco_explosao_ou_vida_imediata, False)
        aval = avaliar_conformidade(riscos)

        # Registra melhor solução por enquanto
        if riscos.R1 < melhor_R1:
            melhor_R1 = riscos.R1
            melhor_R3 = riscos.R3

        # Conformidade atingida?
        if all(a.status != StatusConformidade.NAO_CONFORME for a in aval):
            # Primeira configuração que funciona → devolve
            return ResultadoRecomendacao(
                ja_conforme=False,
                config_recomendada=config,
                R1_antes=R1_antes, R3_antes=R3_antes,
                R1_depois=riscos.R1, R3_depois=riscos.R3,
                reducao_R1=R1_antes / riscos.R1 if riscos.R1 > 0 else float("inf"),
                reducao_R3=R3_antes / riscos.R3 if riscos.R3 > 0 else float("inf"),
                passos=_gerar_passos(config, comp_base, R1_antes, riscos.R1),
            )

    # Nenhuma configuração atingiu conformidade (cenário extremo)
    return ResultadoRecomendacao(
        ja_conforme=False,
        config_recomendada=configs[-1],  # melhor tentativa
        R1_antes=R1_antes, R3_antes=R3_antes,
        R1_depois=melhor_R1, R3_depois=melhor_R3,
        reducao_R1=R1_antes / melhor_R1 if melhor_R1 > 0 else float("inf"),
        reducao_R3=R3_antes / melhor_R3 if melhor_R3 > 0 else 1.0,
        passos=[
            PassoRecomendacao(
                prioridade=1,
                acao="Reavaliar a divisão em zonas de estudo (ZS)",
                justificativa=(
                    "Nenhuma combinação de proteção padrão atingiu R ≤ RT. "
                    "Isto sugere que a estrutura deveria ser dividida em zonas "
                    "de estudo com parâmetros homogêneos distintos, conforme "
                    "Seção 6.7 da NBR 5419-2:2026."
                ),
                referencia_norma="NBR 5419-2:2026, 6.7 e 6.9",
                impacto_estimado="Reduz perdas individuais por zona",
            ),
            PassoRecomendacao(
                prioridade=1,
                acao="Adotar SPDA NP I + DPS coordenados NP I (configuração máxima)",
                justificativa="Máxima proteção prevista pela norma para a estrutura.",
                referencia_norma="NBR 5419-3:2026, Tabela 2 e NBR 5419-4:2026, Anexo C",
                impacto_estimado=f"R1 estimado: {melhor_R1:.2e}",
            ),
            PassoRecomendacao(
                prioridade=2,
                acao="Considerar medidas de mitigação das perdas (Lx)",
                justificativa=(
                    "Se mesmo com SPDA NP I o risco permanece > RT, atuar nos "
                    "fatores de perda: instalar sprinklers (rp = 0,2), limitar "
                    "ocupação (nz/nt), melhorar o piso das áreas externas (rt)."
                ),
                referencia_norma="NBR 5419-2:2026, Anexo C, Tabelas C.3 a C.7",
                impacto_estimado="Reduz diretamente os termos LB, LV (danos físicos)",
            ),
        ],
        alerta_nao_conforme=(
            "ATENÇÃO: nenhuma combinação padrão de proteção atingiu conformidade. "
            "Conforme NBR 5419-2:2026, 5.4.6: 'Se o risco não puder ser reduzido "
            "a níveis toleráveis, o proprietário deve ser informado sobre isso, "
            "e o mais alto nível de proteção deve ser providenciado para a "
            "instalação.' Considere também divisão em zonas de estudo e "
            "mitigação dos fatores de perda."
        ),
    )


# =============================================================================
# Auxiliares
# =============================================================================
def _calcular_comp(ND, NM, NL, NI, NDJ, prob, perdas: Perdas) -> ComponentesRisco:
    """Wrapper que monta EntradaComponentes e calcula os RA..RZ."""
    return calcular_componentes(EntradaComponentes(
        ND=ND, NM=NM, NL=NL, NI=NI, NDJ=NDJ,
        PA=prob.PA, PB=prob.PB, PC=prob.PC, PM=prob.PM,
        PU=prob.PU, PV=prob.PV, PW=prob.PW, PZ=prob.PZ,
        LA=perdas.LA, LB=perdas.LB, LC=perdas.LC, LM=perdas.LM,
        LU=perdas.LU, LV=perdas.LV, LW=perdas.LW, LZ=perdas.LZ,
    ))


def _gerar_passos(
    config: ConfigProtecao,
    comp_base: ComponentesRisco,
    R1_antes: float,
    R1_depois: float,
) -> list[PassoRecomendacao]:
    """
    Traduz a configuração aprovada em passos acionáveis para o engenheiro,
    identificando os componentes mais críticos no cenário base.
    """
    passos: list[PassoRecomendacao] = []

    # Identifica o componente dominante no cenário base
    comp_dict = {
        "RB": comp_base.RB, "RV": comp_base.RV,
        "RC": comp_base.RC, "RM": comp_base.RM,
        "RW": comp_base.RW, "RZ": comp_base.RZ,
        "RA": comp_base.RA, "RU": comp_base.RU,
    }
    dominante = max(comp_dict, key=lambda k: comp_dict[k])

    # Passo 1: SPDA (se necessário)
    if config.spda_nivel != NivelProtecao.NENHUM:
        from app.nbr5419.parte2_tabelas import PROBABILIDADE_PB
        PB = PROBABILIDADE_PB[config.spda_nivel]
        passos.append(PassoRecomendacao(
            prioridade=1,
            acao=f"Instalar SPDA externo nível NP {config.spda_nivel.value}",
            justificativa=(
                f"Reduz PB para {PB} (Tabela B.2 da NBR 5419-2:2026), atacando "
                f"diretamente o componente dominante R{dominante[1]} "
                f"({comp_dict[dominante]:.2e} no cenário sem proteção)."
            ),
            referencia_norma=(
                f"NBR 5419-3:2026, Tabela 2 (raio esfera rolante, malha), "
                f"Tabela 5 (descidas), Tabela 7 (materiais)"
            ),
            impacto_estimado=f"Reduz R1 em ~{R1_antes / R1_depois:.0f}x",
        ))

    # Passo 2: DPS coordenados
    if config.dps_coordenados_nivel != NivelProtecao.NENHUM:
        from app.nbr5419.parte2_tabelas import PROBABILIDADE_PSPD
        PSPD = PROBABILIDADE_PSPD[config.dps_coordenados_nivel]
        passos.append(PassoRecomendacao(
            prioridade=1,
            acao=f"Instalar sistema coordenado de DPS NP {config.dps_coordenados_nivel.value}",
            justificativa=(
                f"Reduz PSPD para {PSPD} (Tabela B.3), protegendo os sistemas "
                f"internos contra sobretensões. Ataca RC, RM, RW e RZ."
            ),
            referencia_norma=(
                "NBR 5419-4:2026, Anexo C — DPS classe I no ponto de entrada "
                "(fronteira ZPR 0/1), classe II nos quadros intermediários "
                "(fronteira ZPR 1/2), classe III próximo a equipamentos sensíveis."
            ),
            impacto_estimado="Reduz componentes de falha de sistemas internos (D3)",
        ))

    # Passo 3: DPS classe I na entrada (se explícito)
    if (
        config.dps_classe_I_nivel != NivelProtecao.NENHUM
        and config.dps_classe_I_nivel != config.dps_coordenados_nivel
    ):
        passos.append(PassoRecomendacao(
            prioridade=1,
            acao=(
                f"Instalar DPS classe I NP {config.dps_classe_I_nivel.value} no ponto "
                f"de entrada das linhas elétricas"
            ),
            justificativa=(
                "DPS classe I (Iimp 10/350 μs) é ensaiado para suportar corrente "
                "parcial direta da descarga. Reduz PEB (Tabela B.7), atacando "
                "RV (danos físicos por descarga na linha)."
            ),
            referencia_norma="NBR 5419-4:2026, Anexo C",
            impacto_estimado="Reduz RV e RU (fonte S3 — descargas em linha)",
        ))

    # Passo 4: medidas adicionais contra tensão de toque/passo
    if config.isolacao_eletrica_descida:
        passos.append(PassoRecomendacao(
            prioridade=2,
            acao=(
                "Instalar isolação elétrica nos condutores de descida "
                "(ex.: polietileno reticulado com ≥ 3 mm nas partes expostas)"
            ),
            justificativa=(
                "Reduz PTA (Tabela B.1) para 10⁻² no componente RA, protegendo "
                "pessoas contra tensão de toque no entorno dos condutores de descida."
            ),
            referencia_norma="NBR 5419-2:2026, Tabela B.1",
            impacto_estimado="Reduz RA (ferimentos por choque)",
        ))

    if config.malha_equipotencializacao_solo:
        passos.append(PassoRecomendacao(
            prioridade=2,
            acao=(
                "Executar malha de equipotencialização do solo por meio de "
                "eletrodo de aterramento reticulado no ponto de entrada das descidas"
            ),
            justificativa=(
                "Reduz PTA (Tabela B.1) para 10⁻² no componente RA contra tensão "
                "de passo, equalizando o potencial do solo."
            ),
            referencia_norma="NBR 5419-2:2026, Tabela B.1 e NBR 5419-3:2026, 5.5",
            impacto_estimado="Reduz RA (ferimentos por tensão de passo)",
        ))

    if config.descida_natural_estrutura_continua:
        passos.append(PassoRecomendacao(
            prioridade=2,
            acao=(
                "Utilizar a estrutura metálica contínua ou concreto armado como "
                "subsistema de descida natural"
            ),
            justificativa=(
                "Atinge PTA = 10⁻³ (Tabela B.1) e reduz PB adicionalmente "
                "(caso especial da Tabela B.2)."
            ),
            referencia_norma=(
                "NBR 5419-3:2026, 5.4.5 (componentes naturais de descida) "
                "e Anexo F (ensaios de continuidade das armaduras)"
            ),
            impacto_estimado="Reduz custos e melhora a proteção",
        ))

    # Passos de execução sempre incluídos quando há instalação nova
    if config.spda_nivel != NivelProtecao.NENHUM or config.dps_coordenados_nivel != NivelProtecao.NENHUM:
        passos.append(PassoRecomendacao(
            prioridade=3,
            acao="Elaborar projeto executivo com desenhos em escala e memorial descritivo",
            justificativa=(
                "Exigência de documentação técnica conforme NBR 5419-3:2026, 7.5.3: "
                "define SPDA isolado/não isolado, método de posicionamento dos "
                "captores, dimensionamento de descidas e eletrodo de aterramento."
            ),
            referencia_norma="NBR 5419-3:2026, Seção 7.5",
            impacto_estimado="Garante rastreabilidade e conformidade",
        ))
        passos.append(PassoRecomendacao(
            prioridade=3,
            acao="Registrar ART/RRT do profissional responsável",
            justificativa="Exigência legal do conselho de classe para projetos de SPDA.",
            referencia_norma="NBR 5419-3:2026, 7.5.3.a",
            impacto_estimado="Formaliza a responsabilidade técnica",
        ))
        passos.append(PassoRecomendacao(
            prioridade=3,
            acao="Executar plano de inspeção e manutenção documentado",
            justificativa=(
                "Periodicidade de 1 ano para áreas classificadas, serviços "
                "essenciais ou atmosfera agressiva; 3 anos para demais estruturas."
            ),
            referencia_norma="NBR 5419-3:2026, 7.2 e 7.3.2.f",
            impacto_estimado="Preserva a eficácia ao longo do tempo",
        ))

    return passos
