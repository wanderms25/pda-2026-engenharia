"""
Serviço de geração de PDF do laudo de análise de risco.

Usa Jinja2 + WeasyPrint para produzir um documento A4 profissional a partir
do resultado da análise de risco.

Fluxo:
    resultado + metadata -> contexto Jinja -> HTML -> WeasyPrint -> PDF bytes

O template está em `app/services/templates/laudo_analise_risco.html` e pode
ser customizado sem tocar neste código.
"""
import math
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from types import SimpleNamespace

def _to_ns(d):
    """Convert dict to namespace for dot-access in Jinja templates."""
    if isinstance(d, dict):
        return SimpleNamespace(**{k: _to_ns(v) for k, v in d.items()})
    return d

from app.engine.riscos import ComponentesRisco, RiscosConsolidados
from app.engine.avaliacao import ResultadoAvaliacao, StatusConformidade
from app.nbr5419.enums import LocalizacaoEstrutura, TipoEstrutura
from app.nbr5419.parte2_tabelas import FATOR_LOCALIZACAO_CD


TEMPLATES_DIR = Path(__file__).parent / "templates"

def _jinja_sin(x): return math.sin(x)
def _jinja_cos(x): return math.cos(x)

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)
_jinja_env.filters["sin"] = _jinja_sin
_jinja_env.filters["cos"] = _jinja_cos




def _normalizar_formulas_visuais(html: str) -> str:
    """Corrige apenas strings demonstrativas do laudo, sem alterar cálculos."""
    rw_dup_plain = "RW" + "* + " + "RW" + "*"
    rv4_dup_plain = "RV4 + " + "RV4"
    ndj_erro = "ND" + "]"
    substituicoes = {
        "R1=RA+RB+RU+RV+RC^{*}+" + "RW^{*}+" + "RW^{*}+RZ^{*}": "R1=RA+RB+RU+RV+RC^{*}+RM^{*}+RW^{*}+RZ^{*}",
        "R1 = RA + RB + RU + RV + RC* + " + rw_dup_plain + " + RZ*": "R1 = RA + RB + RU + RV + RC* + RM* + RW* + RZ*",
        "R1=RA+RB+RU+RV+RC*+" + "RW*+" + "RW*+RZ*": "R1=RA+RB+RU+RV+RC*+RM*+RW*+RZ*",
        "R4=RA4+RB4+RC4+RM4+RU4+" + "RV4+" + "RV4+RW4+RZ4": "R4=RA4+RB4+RC4+RM4+RU4+RV4+RW4+RZ4",
        "R4 = RA4 + RB4 + RC4 + RM4 + RU4 + " + rv4_dup_plain + " + RW4 + RZ4": "R4 = RA4 + RB4 + RC4 + RM4 + RU4 + RV4 + RW4 + RZ4",
        "RW4=Σ[(NL+" + ndj_erro + ")×PW×LW4]": "RW4=Σ[(NL+NDJ)×PW×LW4]",
        "RW4 = Σ[(NL + " + ndj_erro + ") × PW × LW4]": "RW4 = Σ[(NL + NDJ) × PW × LW4]",
        "FW=Σ[(NL+" + ndj_erro + ")×PW]": "FW=Σ[(NL+NDJ)×PW]",
        "FW = Σ[(NL + " + ndj_erro + ") × PW]": "FW = Σ[(NL + NDJ) × PW]",
        ndj_erro: "NDJ",
    }
    for antigo, novo in substituicoes.items():
        html = html.replace(antigo, novo)
    return html


@dataclass
class ProjetoInfo:
    nome: str
    cliente: str = ""
    endereco: str = ""


@dataclass
class ResponsavelTecnico:
    nome: str = "Engenheiro(a) Responsável"
    registro: str = "CREA/CFT nº ________"
    art: str = "________"
    empresa: str = ""
    telefone: str = ""
    email: str = ""
    endereco: str = ""
    logo_base64: str = ""


@dataclass
class EntradaLaudo:
    NG: float
    L: float
    W: float
    H: float
    localizacao: LocalizacaoEstrutura
    tipo_estrutura: TipoEstrutura
    CD: float = 1.0
    localizacao_label: str = ""
    tipo_estrutura_label: str = ""
    rS: float = 1.0
    tipo_construcao_label: str = "Robusta / alvenaria-concreto"

    def __post_init__(self) -> None:
        self.CD = FATOR_LOCALIZACAO_CD[self.localizacao]
        if not self.localizacao_label:
            self.localizacao_label = {
                LocalizacaoEstrutura.CERCADA_OBJETOS_MAIS_ALTOS: "Cercada por objetos significativamente mais altos",
                LocalizacaoEstrutura.CERCADA_MESMA_ALTURA: "Cercada por objetos da mesma altura ou ligeiramente mais baixos",
                LocalizacaoEstrutura.ISOLADA: "Estrutura isolada — nenhum objeto nas vizinhanças",
                LocalizacaoEstrutura.ISOLADA_TOPO_COLINA: "Isolada no topo de uma colina ou monte",
            }[self.localizacao]
        if not self.tipo_estrutura_label:
            self.tipo_estrutura_label = self.tipo_estrutura.value.replace("_", " ").title()


def _formatar_risco(valor: float) -> str:
    """Formata em notação científica com vírgula decimal."""
    if valor == 0:
        return "0"
    return f"{valor:.2e}".replace("e", " × 10^").replace(".", ",")


def _gerar_recomendacoes(
    exige_protecao: bool,
    componentes: ComponentesRisco,
    tem_spda: bool,
    tem_dps: bool,
) -> list[str]:
    """Gera recomendações automáticas baseadas no resultado."""
    recs: list[str] = []

    if not exige_protecao:
        recs.append(
            "Manter o plano de inspeção e manutenção conforme NBR 5419-3:2026, "
            "Seção 7.2, com periodicidade de 3 anos para estruturas comuns ou "
            "1 ano para áreas classificadas, serviços essenciais ou atmosfera agressiva."
        )
        return recs

    # Identifica quais componentes são críticos
    comp_dict = {
        "RB": componentes.RB,
        "RV": componentes.RV,
        "RC": componentes.RC,
        "RM": componentes.RM,
        "RW": componentes.RW,
        "RZ": componentes.RZ,
        "RA": componentes.RA,
        "RU": componentes.RU,
    }
    maior = max(comp_dict, key=lambda k: comp_dict[k])

    if maior in ("RB", "RV") and not tem_spda:
        recs.append(
            "Instalar SPDA externo conforme NBR 5419-3:2026 dimensionado para "
            "o nível de proteção mínimo que reduza R1 abaixo do risco tolerável "
            "(10⁻⁵). Recomenda-se iniciar simulação com NP III e elevar se necessário."
        )

    if maior in ("RC", "RM", "RW", "RZ") and not tem_dps:
        recs.append(
            "Instalar sistema coordenado de DPS conforme NBR 5419-4:2026, com "
            "DPS classe I no ponto de entrada das linhas elétricas (fronteira ZPR 0/1) "
            "e DPS classe II nos quadros intermediários (fronteira ZPR 1/2)."
        )

    if maior in ("RA", "RU"):
        recs.append(
            "Adotar medidas adicionais de proteção contra tensões de toque e passo "
            "conforme Tabela B.1 da NBR 5419-2:2026: isolação elétrica dos condutores "
            "de descida, malha de equipotencialização do solo ou avisos de alerta."
        )

    if tem_spda:
        recs.append(
            "Após instalação, elaborar documentação 'as built' conforme NBR 5419-3:2026, "
            "item 7.5, incluindo memória de cálculo, desenhos em escala, posicionamento "
            "dos captores, descidas e eletrodo de aterramento."
        )

    recs.append(
        "Prever plano de inspeção e manutenção documentado (NBR 5419-3:2026, 7.2) "
        "com periodicidade conforme 7.3.2.f (1 ou 3 anos)."
    )

    return recs


def _np_atual_from_medidas(medidas: dict | None) -> str | None:
    """Extrai o NP declarado sem colisão de substring.

    Antes a verificação procurava "NÍVEL I" antes de "NÍVEL III"/"NÍVEL IV".
    Como "NÍVEL III" contém o texto "NÍVEL I", o laudo podia trocar NP III por NP I.
    """
    import re

    raw = str((medidas or {}).get("spda_nivel", "") or "").upper().strip()
    if not raw:
        return None

    direto = raw.split(":", 1)[0].strip()
    if direto in ("I", "II", "III", "IV"):
        return direto

    match = re.search(r"\bN[ÍI]VEL\s+(IV|III|II|I)\b", raw)
    if match:
        return match.group(1)

    match = re.search(r"\bNP\s*(IV|III|II|I)\b", raw)
    if match:
        return match.group(1)

    return None


def _np_por_razao(razao: float, atual: str | None) -> str:
    if atual not in ("I", "II", "III", "IV"):
        if razao > 4:
            return "I"
        if razao > 2:
            return "II"
        return "III"
    if razao > 4:
        return "I"
    if razao > 2 and atual in ("III", "IV"):
        return "II"
    if razao > 1 and atual == "IV":
        return "III"
    return atual


def _parametros_np(np: str) -> dict[str, Any]:
    cfg = {
        "I": {"raio": 20, "malha": "5 x 5 m", "descida": 10, "hmax": 20},
        "II": {"raio": 30, "malha": "10 x 10 m", "descida": 10, "hmax": 30},
        "III": {"raio": 45, "malha": "15 x 15 m", "descida": 15, "hmax": 45},
        "IV": {"raio": 60, "malha": "20 x 20 m", "descida": 20, "hmax": 60},
    }
    return cfg.get(np, cfg["III"])


def _gerar_plano_aprovacao(
    entrada: EntradaLaudo,
    componentes: ComponentesRisco,
    riscos: RiscosConsolidados,
    medidas: dict | None,
    painel_resultados: list[dict[str, Any]],
    geral_aprovado: bool,
    componentes_f: list[dict[str, Any]],
    tem_r3: bool,
) -> dict[str, Any]:
    """Gera o plano de adequação exibido no laudo de análise de risco.

    O plano não recalcula a norma nem substitui o projeto executivo: ele identifica
    quais medidas devem ser simuladas/executadas e recalculadas até que R <= RT e
    F <= FT, conforme NBR 5419-2:2026, 5.5 e 5.6.
    """
    def num(v: Any, default: float = 0.0) -> float:
        try:
            return float(v if v is not None else default)
        except Exception:
            return default

    r1 = num(getattr(riscos, "R1", 0.0))
    ft = num(getattr(riscos, "FT", None), num((getattr(riscos, "detalhes", {}) or {}).get("FT_global", 0.1), 0.1)) or 0.1
    f_val = num((getattr(riscos, "detalhes", {}) or {}).get("F", getattr(riscos, "F", 0.0)))
    r3_val = num(getattr(riscos, "R3", 0.0))
    r1_ok = r1 <= 1e-5
    r3_ok = (not tem_r3) or r3_val <= 1e-4
    razao_max = max([num(item.get("valor")) / num(item.get("limite"), 1.0) for item in painel_resultados if not item.get("informativo") and num(item.get("limite")) > 0] + [1.0])
    np = _np_por_razao(razao_max, _np_atual_from_medidas(medidas))
    cfg_np = _parametros_np(np)
    L = num(getattr(entrada, "L", 0.0))
    W = num(getattr(entrada, "W", 0.0))
    H = num(getattr(entrada, "H", 0.0))
    perimetro = 2 * max(0.0, L + W)
    descidas_min = max(2, math.ceil(perimetro / cfg_np["descida"])) if perimetro > 0 else 2
    metodo = "método do ângulo de proteção" if H <= cfg_np["hmax"] and L * W < 400 else ("método da esfera rolante" if H > cfg_np["hmax"] else "método combinado: malhas + verificação por esfera/ângulo")

    comp_dict = {
        "RA": num(componentes.RA), "RB": num(componentes.RB), "RC": num(componentes.RC), "RM": num(componentes.RM),
        "RU": num(componentes.RU), "RV": num(componentes.RV), "RW": num(componentes.RW), "RZ": num(componentes.RZ),
    }
    dominantes = [
        {"codigo": k, "valor": v, "percentual_r1": (v / r1 * 100 if r1 > 0 else 0.0)}
        for k, v in sorted(comp_dict.items(), key=lambda kv: kv[1], reverse=True) if v > 0
    ][:4]

    cf = {c.get("codigo"): num(c.get("valor")) for c in componentes_f}
    dano_fisico = comp_dict["RB"] + comp_dict["RV"] + cf.get("FB", 0.0) + cf.get("FV", 0.0)
    toque_passo = comp_dict["RA"] + comp_dict["RU"]
    sistemas = comp_dict["RC"] + comp_dict["RM"] + comp_dict["RW"] + comp_dict["RZ"] + cf.get("FC", 0.0) + cf.get("FM", 0.0) + cf.get("FW", 0.0) + cf.get("FZ", 0.0)

    def _linha_critica() -> dict[str, Any] | None:
        melhor: dict[str, Any] | None = None
        detalhes = getattr(riscos, "detalhes", {}) or {}
        for zona in detalhes.get("zonas", []) or []:
            if not isinstance(zona, dict):
                continue
            for linha in zona.get("linhas_contrib", []) or []:
                if not isinstance(linha, dict):
                    continue
                total = sum(num(linha.get(k, 0.0)) for k in ("RU", "RV", "RW", "RZ", "FV", "FW", "FZ"))
                if melhor is None or total > melhor["valor"]:
                    melhor = {"nome": str(linha.get("nome") or linha.get("id") or "Linha"), "valor": total}
        return melhor

    linha_critica = _linha_critica()

    acoes: list[dict[str, Any]] = []

    def add(prioridade: str, categoria: str, acao: str, justificativa: str, efeito: str, ref: str, comps: list[str]) -> None:
        if any(a["categoria"] == categoria and a["acao"] == acao for a in acoes):
            return
        prioridade_class = {"Obrigatória": "obrigatoria", "Alta": "alta", "Média": "media", "Monitoramento": "monitoramento"}.get(prioridade, "media")
        acoes.append({
            "prioridade": prioridade,
            "prioridade_class": prioridade_class,
            "categoria": categoria,
            "acao": acao,
            "justificativa": justificativa,
            "efeito": efeito,
            "referencia": ref,
            "componentes": comps,
        })

    if not geral_aprovado or dano_fisico > 0:
        add(
            "Obrigatória" if (not r1_ok or not r3_ok) else "Alta",
            "SPDA externo e subsistema de captação",
            f"Instalar ou adequar o SPDA externo para NP {np}, com captação por {metodo}. Adotar raio da esfera de {cfg_np['raio']} m, malha máxima {cfg_np['malha']} e pelo menos {descidas_min} condutores de descida para o perímetro informado.",
            "As componentes ligadas a dano físico e interceptação da descarga são reduzidas por SPDA dimensionado e posicionado conforme a Parte 3.",
            "Reduzir PB/PV e, consequentemente, RB/RV, além das parcelas FB/FV e de R3 quando aplicável.",
            "ABNT NBR 5419-2:2026, 5.5 e 5.6; ABNT NBR 5419-3:2026, 5.3.2 e Tabela 2.",
            ["RB", "RV", "FB", "FV", "R3"],
        )

    if sistemas > 0 or f_val > ft:
        add(
            "Obrigatória" if f_val > ft else "Alta",
            "MPS, DPS coordenados e ZPR",
            "Implantar ou revisar as MPS: DPS coordenados nas linhas de energia e sinal, DPS na entrada da ZPR, equipotencialização, blindagem e roteamento das linhas internas/externas quando aplicável.",
            "As falhas de sistemas internos são influenciadas por surtos conduzidos e campos eletromagnéticos; a Parte 4 define as MPS básicas para reduzi-las.",
            "Reduzir PC, PM, PW e PZ, atuando sobre RC/RM/RW/RZ e FC/FM/FW/FZ.",
            "ABNT NBR 5419-4:2026, 4.4.1 a 4.4.4 e Seção 7.",
            ["RC", "RM", "RW", "RZ", "FC", "FM", "FW", "FZ"],
        )

    if toque_passo > 0:
        add(
            "Alta" if not geral_aprovado else "Média",
            "Tensões de toque e passo",
            "Aplicar isolação das descidas, malha de equipotencialização do solo, restrições físicas e avisos quando aplicáveis.",
            "Essas medidas reduzem a probabilidade de ferimentos por tensões de toque e passo.",
            "Reduzir PA/PTA e PU/PTU, diminuindo RA e RU.",
            "ABNT NBR 5419-1:2026, 7.2; ABNT NBR 5419-3:2026, Seção 8.",
            ["RA", "RU"],
        )

    if linha_critica and linha_critica["valor"] > 0:
        add(
            "Alta" if (f_val > ft or not r1_ok) else "Média",
            "Linhas externas",
            f"Revisar a proteção das linhas externas, com atenção especial para \"{linha_critica['nome']}\"; avaliar DPS Classe I na entrada, equipotencialização, blindagem/interligação e roteamento dos cabos.",
            "Linhas que entram na estrutura podem transferir correntes e surtos, afetando RU/RV/RW/RZ e as frequências FV/FW/FZ.",
            "Reduzir PU, PV, PW e PZ por meio de PEB, CLD/CLI, PLD/PLI e MPS adequadas.",
            "ABNT NBR 5419-2:2026, Anexos A e B; ABNT NBR 5419-4:2026, 4.4 e 7.",
            ["RU", "RV", "RW", "RZ", "FV", "FW", "FZ"],
        )

    if tem_r3 and r3_val > 1e-4:
        add(
            "Obrigatória",
            "Patrimônio cultural",
            "Priorizar medidas que reduzam danos físicos associados a RB3 e RV3 e recalcular R3 após a adequação.",
            "R3 representa perda inaceitável de patrimônio cultural e deve atender ao limite tolerável aplicável.",
            "Reduzir R3 por redução de PB/PV e perdas consequentes aplicáveis.",
            "ABNT NBR 5419-2:2026, Tabela 4 e Anexo C.",
            ["RB3", "RV3", "R3"],
        )

    if geral_aprovado:
        add(
            "Monitoramento",
            "Manutenção da conformidade",
            "Manter documentação, inspeções e manutenção do SPDA/MPS, e repetir a análise quando houver alteração de uso, características construtivas ou instalação elétrica.",
            "A conformidade depende da manutenção das medidas declaradas.",
            "Preservar R e F dentro dos limites adotados.",
            "ABNT NBR 5419-1:2026; ABNT NBR 5419-3:2026, Seção 7; ABNT NBR 5419-4:2026, Seção 9.",
            ["R", "F"],
        )
    else:
        add(
            "Obrigatória",
            "Revalidação obrigatória",
            "Após executar as adequações, recalcular a análise até que R1, R3 quando aplicável, e F atendam aos limites toleráveis.",
            "A aprovação só pode ser emitida quando os indicadores obrigatórios estiverem dentro dos limites selecionados.",
            "Comprovar numericamente R <= RT e F <= FT.",
            "ABNT NBR 5419-2:2026, 5.4, 5.5 e 5.6.",
            ["R1", "R3", "F"],
        )

    ordem = {"Obrigatória": 0, "Alta": 1, "Média": 2, "Monitoramento": 3}
    acoes.sort(key=lambda a: ordem.get(a["prioridade"], 9))
    observacoes = []
    if H > cfg_np["hmax"]:
        observacoes.append(f"Para H acima de {cfg_np['hmax']} m no NP {np}, o método do ângulo não deve ser usado como critério único; aplicar esfera rolante ou malhas.")
    if H > 60:
        observacoes.append("Altura superior a 60 m: verificar proteção complementar contra descargas laterais nas partes superiores da estrutura.")
    return {
        "aprovado": geral_aprovado,
        "titulo": "Sistema aprovado pelos indicadores calculados" if geral_aprovado else "Sistema ainda não aprovado - plano de adequação necessário",
        "resumo": "Os indicadores obrigatórios atendem aos limites toleráveis; manter rastreabilidade, inspeção e documentação." if geral_aprovado else "As ações abaixo indicam o caminho técnico para adequação. Após executá-las, a análise deve ser recalculada para confirmar a aprovação.",
        "np_recomendado": np,
        "metodo": metodo,
        "raio_esfera": cfg_np["raio"],
        "malha": cfg_np["malha"],
        "distancia_descidas": cfg_np["descida"],
        "descidas_minimas": descidas_min,
        "dominantes": dominantes,
        "acoes": acoes,
        "observacoes": observacoes,
    }



def gerar_html_laudo(
    projeto: ProjetoInfo,
    entrada: EntradaLaudo,
    areas: dict[str, float],
    eventos: dict[str, float],
    componentes: ComponentesRisco,
    riscos: RiscosConsolidados,
    avaliacao: list[ResultadoAvaliacao],
    exige_protecao: bool,
    responsavel: ResponsavelTecnico | None = None,
    tem_spda: bool = False,
    tem_dps: bool = False,
    logo_data_uri: str | None = None,
    fotos: list[dict] | None = None,
    medidas: dict | None = None,
    dimensionamento: dict | None = None,
) -> str:
    """
    Renderiza o template HTML do laudo com o contexto completo.
    """
    responsavel = responsavel or ResponsavelTecnico()

    # Prepara dados de avaliação para as barras de risco
    avaliacao_render: list[dict[str, Any]] = []
    for a in avaliacao:
        # Normaliza razão para 0-100% (clampado em 200% para visualização)
        razao_clamp = min(a.razao, 2.0)
        largura = min(razao_clamp * 50, 100)  # razão 1 -> 50%, razão 2 -> 100%
        if a.status == StatusConformidade.CONFORME:
            cor = "#16a34a"
        elif a.status == StatusConformidade.NAO_CONFORME:
            cor = "#dc2626"
        else:
            cor = "#6366f1"

        avaliacao_render.append({
            "tipo_risco": getattr(a.tipo_risco, "value", a.tipo_risco),
            "valor_calculado_fmt": _formatar_risco(a.valor_calculado),
            "valor_tolerado_fmt": _formatar_risco(a.valor_tolerado),
            "status": a.status.value,
            "mensagem": a.mensagem,
            "largura_percent": largura,
            "cor": cor,
        })

    recomendacoes = _gerar_recomendacoes(
        exige_protecao=exige_protecao,
        componentes=componentes,
        tem_spda=tem_spda,
        tem_dps=tem_dps,
    )

    # Calcula distribuição percentual dos componentes de risco
    comps_dict = {
        "RA": componentes.RA, "RB": componentes.RB,
        "RC": componentes.RC, "RM": componentes.RM,
        "RU": componentes.RU, "RV": componentes.RV,
        "RW": componentes.RW, "RZ": componentes.RZ,
    } if hasattr(componentes, "RA") else {}
    total_r1 = sum(v for k, v in comps_dict.items() if k in ("RA","RB","RC","RM"))
    total_r3 = sum(v for k, v in comps_dict.items() if k in ("RU","RV","RW","RZ"))
    dist_r1 = {k: (v/total_r1*100 if total_r1 > 0 else 0) for k, v in comps_dict.items() if k in ("RA","RB","RC","RM")}
    dist_r3 = {k: (v/total_r3*100 if total_r3 > 0 else 0) for k, v in comps_dict.items() if k in ("RU","RV","RW","RZ")}


    # ── Pre-compute gauge SVG data (R1 and F) ─────────────────────────────────
    def _gauge_data(valor: float, referencia: float, max_razao: float = 2.5) -> dict:
        """Gera dados para gauge SVG semicircular.
        SVG viewBox="0 0 200 120". Semicírculo: centro(100,95) raio 75.
        Arco: esquerda(25,95) → topo(100,20) → direita(175,95).
        Ângulo θ = π*(1-pct): π em pct=0 (esquerda), 0 em pct=1 (direita).
        """
        razao = min(valor / referencia, max_razao) if referencia > 0 else 0.0
        pct = min(razao / max_razao, 1.0)
        angle = math.pi * (1.0 - pct)                          # θ correto
        cx, cy, arc_r, pont_r = 100.0, 95.0, 75.0, 58.0

        # Ponto final do arco ativo (fórmula correta)
        arc_x = round(cx + arc_r * math.cos(angle), 1)
        arc_y = round(cy - arc_r * math.sin(angle), 1)

        # Ponteiro
        x2 = round(cx + pont_r * math.cos(angle), 1)
        y2 = round(cy - pont_r * math.sin(angle), 1)

        large = 1 if pct > 0.5 else 0

        # Pontos fixos das zonas do arco (1/3 = 1×ref, 2/3 = 2×ref)
        def pt(p):
            a = math.pi * (1.0 - p)
            return round(cx + arc_r * math.cos(a), 1), round(cy - arc_r * math.sin(a), 1)

        z1x, z1y = pt(1/3)   # 1×referencia
        z2x, z2y = pt(2/3)   # 2×referencia

        # Cor semáforo
        cor = "#dc2626" if valor > referencia else "#eab308" if valor > referencia * 0.5 else "#16a34a"

        return {
            "razao": round(razao, 3),
            "pct": round(pct * 100, 1),
            "cor": cor,
            "cx": cx, "cy": cy,
            "x2": x2, "y2": y2,
            "arc_x": arc_x, "arc_y": arc_y,
            "z1x": z1x, "z1y": z1y,
            "z2x": z2x, "z2y": z2y,
            "large": large,
            "atende": valor <= referencia,
        }

    detalhes = getattr(riscos, "detalhes", {}) or {}
    zonas_calc = detalhes.get("zonas", []) or []
    linhas_calc = detalhes.get("linhas", []) or []
    componentes_globais = detalhes.get("componentes_globais", {}) or {}
    r1_valor = float(getattr(riscos, "R1", 0.0) or 0.0)
    f_valor = getattr(riscos, "frequencia_danos_total", None)
    if f_valor is None or float(f_valor or 0.0) == 0.0:
        f_valor = detalhes.get("F", 0.0)
    f_valor = float(f_valor or 0.0)
    r3_valor = float(getattr(riscos, "R3", 0.0) or detalhes.get("R3", detalhes.get("R3_global", 0.0)) or 0.0)
    r4_valor = float(getattr(riscos, "R4", 0.0) or detalhes.get("R4", detalhes.get("R4_global", 0.0)) or 0.0)

    ft_valor = float(detalhes.get("FT_global", detalhes.get("FT", getattr(riscos, "FT", 0.1))) or 0.1)
    f_atende = bool(detalhes.get("F_atende", detalhes.get("F_conforme", f_valor <= ft_valor)))
    limites_normativos = {"R1": 1e-5, "F": ft_valor, "R3": 1e-4, "R4": 1e-3}
    painel_resultados = [
        {"codigo": "R1", "pilar": "R1 — Proteção à Vida", "valor": r1_valor, "limite": limites_normativos["R1"], "atende": r1_valor <= limites_normativos["R1"], "informativo": False},
        {"codigo": "F",  "pilar": "F — Frequência de danos", "valor": f_valor, "limite": limites_normativos["F"], "atende": f_atende, "informativo": False},
    ]
    tem_r3 = bool(detalhes.get("tem_R3")) or r3_valor > 0 or any(
        (isinstance(z, dict) and (z.get("R3", 0) or z.get("RB3", 0) or z.get("RV3", 0))) for z in zonas_calc
    )
    tem_r4 = bool(detalhes.get("tem_R4")) or r4_valor > 0 or any(
        isinstance(z, dict) and any(z.get(k, 0) for k in ("R4","RA4","RB4","RC4","RM4","RU4","RV4","RW4","RZ4")) for z in zonas_calc
    )
    if tem_r3:
        painel_resultados.append({"codigo": "R3", "pilar": "R3 — Patrimônio Cultural", "valor": r3_valor, "limite": limites_normativos["R3"], "atende": r3_valor <= limites_normativos["R3"], "informativo": False})
    if tem_r4:
        painel_resultados.append({"codigo": "R4", "pilar": "R4 — Perdas Econômicas (informativo)", "valor": r4_valor, "limite": limites_normativos["R4"], "atende": r4_valor <= limites_normativos["R4"], "informativo": True})
    geral_aprovado = all(item["atende"] for item in painel_resultados if not item.get("informativo"))
    falhas_conformidade = [item for item in painel_resultados if (not item["atende"] and not item.get("informativo"))]

    def _num(value: Any, default: float = 0.0) -> float:
        try:
            return float(value if value is not None else default)
        except Exception:
            return default

    def _zget(z: Any, key: str, default: float = 0.0) -> float:
        if isinstance(z, dict):
            return _num(z.get(key, default), default)
        return _num(getattr(z, key, default), default)

    def _sum_zonas(key: str, default_key: str | None = None) -> float:
        total = sum(_zget(z, key, 0.0) for z in zonas_calc)
        if total == 0.0 and default_key:
            total = _num(detalhes.get(default_key, 0.0), 0.0)
        return total

    componentes_f = [
        {"codigo": "FB", "nome": "FB — dano físico por descarga na estrutura", "valor": _sum_zonas("FB", "FB")},
        {"codigo": "FC", "nome": "FC — falha de sistema por descarga na estrutura", "valor": _sum_zonas("FC", "FC")},
        {"codigo": "FM", "nome": "FM — falha por descarga próxima à estrutura", "valor": _sum_zonas("FM", "FM")},
        {"codigo": "FV", "nome": "FV — dano físico por descarga na linha", "valor": _sum_zonas("FV", "FV")},
        {"codigo": "FW", "nome": "FW — falha por surto conduzido na linha", "valor": _sum_zonas("FW", "FW")},
        {"codigo": "FZ", "nome": "FZ — falha por descarga próxima à linha", "valor": _sum_zonas("FZ", "FZ")},
    ]
    componentes_r3 = [
        {"codigo": "RB3", "nome": "RB3 — dano físico na estrutura", "valor": _sum_zonas("RB3", "RB3")},
        {"codigo": "RV3", "nome": "RV3 — dano físico por linha externa", "valor": _sum_zonas("RV3", "RV3")},
    ]
    componentes_r4 = [
        {"codigo": "RA4", "nome": "RA4 — choque na estrutura", "valor": _sum_zonas("RA4", "RA4")},
        {"codigo": "RB4", "nome": "RB4 — dano físico na estrutura", "valor": _sum_zonas("RB4", "RB4")},
        {"codigo": "RC4", "nome": "RC4 — falha de sistema na estrutura", "valor": _sum_zonas("RC4", "RC4")},
        {"codigo": "RM4", "nome": "RM4 — falha por descarga próxima", "valor": _sum_zonas("RM4", "RM4")},
        {"codigo": "RU4", "nome": "RU4 — choque por linha externa", "valor": _sum_zonas("RU4", "RU4")},
        {"codigo": "RV4", "nome": "RV4 — dano físico por linha externa", "valor": _sum_zonas("RV4", "RV4")},
        {"codigo": "RW4", "nome": "RW4 — falha por surto conduzido", "valor": _sum_zonas("RW4", "RW4")},
        {"codigo": "RZ4", "nome": "RZ4 — falha por indução em linha", "valor": _sum_zonas("RZ4", "RZ4")},
    ]

    max_componentes_f = max([c["valor"] for c in componentes_f] + [0.0])
    max_componentes_r3 = max([c["valor"] for c in componentes_r3] + [0.0])
    max_componentes_r4 = max([c["valor"] for c in componentes_r4] + [0.0])

    plano_aprovacao = _gerar_plano_aprovacao(
        entrada=entrada,
        componentes=componentes,
        riscos=riscos,
        medidas=medidas or {},
        painel_resultados=painel_resultados,
        geral_aprovado=geral_aprovado,
        componentes_f=componentes_f,
        tem_r3=tem_r3,
    )

    gauge_r1 = _gauge_data(r1_valor, limites_normativos["R1"])
    gauge_f  = _gauge_data(f_valor, limites_normativos["F"])
    gauge_r3 = _gauge_data(r3_valor, limites_normativos["R3"])
    gauge_r4 = _gauge_data(r4_valor, limites_normativos["R4"])

    contexto: dict[str, Any] = {
        "projeto": projeto,
        "entrada": entrada,
        "areas": areas,
        "eventos": eventos,
        "componentes": componentes,
        "riscos": riscos,
        "avaliacao": avaliacao_render,
        "exige_protecao": exige_protecao,
        "recomendacoes": recomendacoes,
        "plano_aprovacao": plano_aprovacao,
        "responsavel": responsavel,
        "data_emissao": datetime.now().strftime("%d/%m/%Y"),
        "numero_documento": f"PDA-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "logo_data_uri": logo_data_uri,
        "fotos": fotos or [],
        "medidas": medidas or {},
        "dimensionamento": dimensionamento or {},
        "dist_r1": dist_r1,
        "dist_r3": dist_r3,
        "total_r1": total_r1,
        "total_r3": total_r3,
        # New for 17-section template
        "frequencia_danos_total": f_valor,
        "r1_valor": r1_valor,
        "f_valor": f_valor,
        "r3_valor": r3_valor,
        "r4_valor": r4_valor,
        "limites_normativos": limites_normativos,
        "painel_resultados": painel_resultados,
        "geral_aprovado": geral_aprovado,
        "falhas_conformidade": falhas_conformidade,
        "gauge_r1": gauge_r1,
        "gauge_f": gauge_f,
        "gauge_r3": gauge_r3,
        "gauge_r4": gauge_r4,
        "componentes_f": componentes_f,
        "componentes_r3": componentes_r3,
        "componentes_r4": componentes_r4,
        "max_componentes_f": max_componentes_f,
        "max_componentes_r3": max_componentes_r3,
        "max_componentes_r4": max_componentes_r4,
        "zonas_calc": zonas_calc,
        "linhas_calc": linhas_calc,
        "componentes_globais": componentes_globais,
        "tem_r3": tem_r3,
        "tem_r4": tem_r4,
        "areas_ns": _to_ns(areas),
        "eventos_ns": _to_ns(eventos),
        "ng_manual": bool(detalhes.get("ng_manual", False)),
        "ng_origem": detalhes.get("ng_origem", "ANEXO_F"),
        "rs_valor": float(getattr(entrada, "rS", 1.0) or 1.0),
        "rs_label": getattr(entrada, "tipo_construcao_label", "Robusta / alvenaria-concreto") or "Robusta / alvenaria-concreto",
    }

    template = _jinja_env.get_template("laudo_analise_risco.html")
    html = template.render(**contexto)
    return _normalizar_formulas_visuais(html)


def gerar_pdf_laudo(
    projeto: ProjetoInfo,
    entrada: EntradaLaudo,
    areas: dict[str, float],
    eventos: dict[str, float],
    componentes: ComponentesRisco,
    riscos: RiscosConsolidados,
    avaliacao: list[ResultadoAvaliacao],
    exige_protecao: bool,
    responsavel: ResponsavelTecnico | None = None,
    tem_spda: bool = False,
    tem_dps: bool = False,
    logo_data_uri: str | None = None,
    fotos: list[dict] | None = None,
    medidas: dict | None = None,
    dimensionamento: dict | None = None,
) -> bytes:
    """
    Renderiza o HTML e converte para PDF usando WeasyPrint.

    Retorna os bytes do PDF prontos para retornar via FastAPI StreamingResponse.
    """
    # Use logo_base64 from responsavel if logo_data_uri not provided separately
    _logo = logo_data_uri or (responsavel.logo_base64 if responsavel and hasattr(responsavel, "logo_base64") else None)
    html_content = gerar_html_laudo(
        projeto=projeto,
        entrada=entrada,
        areas=areas,
        eventos=eventos,
        componentes=componentes,
        riscos=riscos,
        avaliacao=avaliacao,
        exige_protecao=exige_protecao,
        responsavel=responsavel,
        tem_spda=tem_spda,
        tem_dps=tem_dps,
        logo_data_uri=_logo,
        fotos=fotos,
        medidas=medidas,
        dimensionamento=dimensionamento,
    )

    # Import lazy — WeasyPrint tem dependências de sistema (libpango, libcairo)
    try:
        from weasyprint import HTML  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "WeasyPrint não instalado ou dependências de sistema ausentes "
            "(libpango, libcairo). Instale via `pip install weasyprint` e "
            "verifique o Dockerfile do backend."
        ) from exc

    return HTML(string=html_content).write_pdf()
