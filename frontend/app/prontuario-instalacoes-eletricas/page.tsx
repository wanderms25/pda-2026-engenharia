"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  ListChecks,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Zap,
} from "lucide-react";
import { gerarPDFPIE, type Cliente } from "@/lib/api";
import { ClienteAutocomplete, documentoCliente, enderecoCliente, nomeCliente } from "@/components/clientes/cliente-autocomplete";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";

const STORAGE_KEY = "pda_pie_prontuario_v1";

type SimNao = "" | "sim" | "nao" | "na";
type Adequacao = "" | "adequado" | "nao_adequado" | "na";
type Risco = "" | "baixo" | "medio" | "alto";
type Conclusao = "" | "conforme" | "parcial" | "nao_conforme";
type ConfirmacaoSistema = {
  titulo: string;
  mensagem: string;
  textoConfirmar: string;
  acao: () => void;
  variante?: "destructive" | "success";
};

interface Identificacao {
  condominio: string;
  cnpj: string;
  endereco: string;
  responsavelTecnico: string;
  crea: string;
  data: string;
}

interface ChecklistSNItem {
  id: string;
  label: string;
  status: SimNao;
}

interface ProcedimentoItem {
  id: string;
  label: string;
  existe: boolean;
  aplicado: boolean;
}

interface EpiItem {
  id: string;
  label: string;
  existe: boolean;
  uso: boolean;
  validade: boolean;
}

interface QuadroEletrico {
  id: string;
  nome: string;
  localizacao: string;
  tensao: string;
  identificacaoCircuitos: SimNao;
  fechamentoAdequado: SimNao;
  partesVivasExpostas: SimNao;
  sinalizacao: SimNao;
  disjuntores: SimNao;
  dr: SimNao;
  dps: SimNao;
  umidade: SimNao;
  areaMolhada: SimNao;
  acessoRestrito: SimNao;
  aterramento: "" | "TT" | "TN-S" | "TN-C" | "TN-C-S" | "IT";
  estudoArco: SimNao;
  etiquetagemArco: SimNao;
  grauRisco: Risco;
  observacoes: string;
}

interface AdequacaoItem {
  id: string;
  label: string;
  status: Adequacao;
}

interface SecaoAdequacao {
  id: string;
  titulo: string;
  itens: AdequacaoItem[];
}

interface PlanoAcaoItem {
  id: string;
  mes: string;
  acao: string;
  responsavel: string;
  status: "" | "pendente" | "andamento" | "concluido";
}

interface FotoRegistro {
  id: string;
  titulo: string;
  descricao: string;
  local: string;
  data: string;
  imagem?: string;
  nomeArquivo?: string;
}

interface PieForm {
  identificacao: Identificacao;
  documentacao: ChecklistSNItem[];
  conformidade: ChecklistSNItem[];
  spdaAterramento: ChecklistSNItem[];
  quadros: QuadroEletrico[];
  procedimentos: ProcedimentoItem[];
  epis: EpiItem[];
  trabalhadores: {
    quantidade: string;
    nr10Basico: SimNao;
    nr10Sep: SimNao;
    asoValido: SimNao;
  };
  ensaios: ChecklistSNItem[];
  areasClassificadas: {
    aplicavel: boolean;
    detalhe: string;
  };
  relatorioTecnico: SecaoAdequacao[];
  analiseTecnica: {
    irregularidades: string;
    classificacaoRisco: Risco;
  };
  recomendacoes: ChecklistSNItem[];
  planoAcao: PlanoAcaoItem[];
  conclusao: Conclusao;
  fotos: FotoRegistro[];
  responsavel: {
    nome: string;
    crea: string;
    art: string;
    empresa: string;
    telefone: string;
    email: string;
    data: string;
  };
}

const hoje = new Date().toISOString().slice(0, 10);

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function itemSN(id: string, label: string): ChecklistSNItem {
  return { id, label, status: "" };
}

function itemAdequacao(id: string, label: string): AdequacaoItem {
  return { id, label, status: "" };
}

const ITENS_PADRAO_AREA_COMUM = [
  "Tomadas no padrão 3P+T (com aterramento)",
  "Fixação das tomadas",
  "Equipamentos de proteção coletiva",
  "Ausência de partes energizadas expostas",
  "Estado geral de conservação",
];

function novoQuadro(nome: string): QuadroEletrico {
  return {
    id: uid("quadro"),
    nome,
    localizacao: "",
    tensao: "",
    identificacaoCircuitos: "",
    fechamentoAdequado: "",
    partesVivasExpostas: "",
    sinalizacao: "",
    disjuntores: "",
    dr: "",
    dps: "",
    umidade: "",
    areaMolhada: "",
    acessoRestrito: "",
    aterramento: "",
    estudoArco: "",
    etiquetagemArco: "",
    grauRisco: "",
    observacoes: "",
  };
}

function criarSecaoAdequacao(id: string, titulo: string, itens: string[]): SecaoAdequacao {
  return { id, titulo, itens: itens.map((label, index) => itemAdequacao(`${id}_${index}`, label)) };
}

function novoLocalAreaComum(indice: number): SecaoAdequacao {
  const id = uid("local");
  return criarSecaoAdequacao(id, `Novo local ${String(indice).padStart(2, "0")}`, ITENS_PADRAO_AREA_COMUM);
}

function novaFotoRegistro(indice: number): FotoRegistro {
  return {
    id: uid("foto"),
    titulo: `Imagem ${String(indice).padStart(2, "0")}`,
    descricao: "",
    local: "",
    data: "",
    imagem: "",
    nomeArquivo: "",
  };
}

function criarFormularioPadrao(): PieForm {
  return {
    identificacao: {
      condominio: "",
      cnpj: "",
      endereco: "",
      responsavelTecnico: "",
      crea: "",
      data: hoje,
    },
    documentacao: [
      itemSN("diagramas_unifilares", "Diagramas unifilares"),
      itemSN("diagramas_instalacoes", "Diagramas das instalações"),
      itemSN("laudos_eletricos", "Laudos elétricos"),
      itemSN("spda", "SPDA"),
      itemSN("sistema_aterramento", "Sistema de aterramento"),
    ],
    conformidade: [
      itemSN("diagramas_atualizados", "Diagramas atualizados"),
      itemSN("procedimentos_seguranca", "Procedimentos de segurança"),
      itemSN("inspecoes_periodicas", "Inspeções periódicas"),
      itemSN("epis_epcs", "EPIs e EPCs adequados"),
      itemSN("treinamento", "Treinamento dos trabalhadores"),
      itemSN("relatorios_atualizados", "Relatórios técnicos atualizados"),
    ],
    spdaAterramento: [
      itemSN("laudo_spda", "Laudo de SPDA atualizado"),
      itemSN("medicao_aterramento", "Medição de aterramento"),
      itemSN("continuidade_eletrica", "Continuidade elétrica"),
      itemSN("inspecao_visual", "Inspeção visual geral"),
    ],
    quadros: [
      novoQuadro("QGBT - Quadro Geral de Baixa Tensão"),
      novoQuadro("Quadro 02"),
      novoQuadro("Quadro 03"),
      novoQuadro("Quadro 04"),
      novoQuadro("Quadro 05"),
    ],
    procedimentos: [
      { id: "desenergizacao", label: "Desenergização", existe: false, aplicado: false },
      { id: "apr", label: "APR (Análise Preliminar de Risco)", existe: false, aplicado: false },
      { id: "permissao_trabalho", label: "Permissão de Trabalho", existe: false, aplicado: false },
      { id: "manutencao_eletrica", label: "Manutenção elétrica", existe: false, aplicado: false },
      { id: "terceiros", label: "Serviços com terceiros", existe: false, aplicado: false },
    ],
    epis: [
      { id: "luvas", label: "Luvas isolantes", existe: false, uso: false, validade: false },
      { id: "vestimenta", label: "Vestimenta anti-arco", existe: false, uso: false, validade: false },
      { id: "ferramentas", label: "Ferramentas isoladas", existe: false, uso: false, validade: false },
    ],
    trabalhadores: {
      quantidade: "",
      nr10Basico: "",
      nr10Sep: "",
      asoValido: "",
    },
    ensaios: [
      itemSN("teste_luvas", "Teste em luvas isolantes"),
      itemSN("ferramentas_isoladas", "Ferramentas isoladas"),
      itemSN("epc", "Equipamentos de proteção coletiva"),
    ],
    areasClassificadas: {
      aplicavel: false,
      detalhe: "",
    },
    relatorioTecnico: [
      criarSecaoAdequacao("tomadas_corredores", "Tomadas elétricas - áreas/corredores", ITENS_PADRAO_AREA_COMUM),
      criarSecaoAdequacao("tomadas_salao", "Tomadas elétricas - salão de festas", ITENS_PADRAO_AREA_COMUM),
      criarSecaoAdequacao("tomadas_maquinas", "Tomadas elétricas - casa de máquinas", ITENS_PADRAO_AREA_COMUM),
      criarSecaoAdequacao("tomadas_x", "Tomadas elétricas - ambiente X", ITENS_PADRAO_AREA_COMUM),
      criarSecaoAdequacao("tomadas_y", "Tomadas elétricas - ambiente Y", ITENS_PADRAO_AREA_COMUM),
      criarSecaoAdequacao("iluminacao", "Sistema de iluminação", [
        "Nível de iluminação",
        "Iluminação de emergência instalada",
        "Funcionamento da iluminação de emergência",
        "Condição das luminárias",
        "Estado geral de conservação",
      ]),
      criarSecaoAdequacao("gerador", "Sistema de emergência / gerador", [
        "Existência de gerador (quando aplicável)",
        "Condições operacionais do gerador",
        "Realização de testes periódicos",
        "Quadro de transferência (QTA)",
        "Estado geral de conservação",
      ]),
      criarSecaoAdequacao("infraestrutura", "Infraestrutura elétrica", [
        "Integridade dos eletrodutos",
        "Fechamento das caixas de passagem",
        "Proteção da fiação",
        "Organização dos cabos",
        "Estado geral de conservação",
      ]),
      criarSecaoAdequacao("aterramento", "Sistema de aterramento", [
        "Existência de sistema de aterramento",
        "Continuidade elétrica do aterramento",
        "Identificação do barramento de terra",
        "Equipotencialização",
        "Estado geral de conservação",
      ]),
      criarSecaoAdequacao("seguranca", "Segurança das instalações", [
        "Ausência de partes vivas expostas",
        "Sinalização de risco elétrico",
        "Restrição de acesso aos quadros elétricos",
        "Proteção contra choques elétricos",
        "Estado geral de conservação",
      ]),
    ],
    analiseTecnica: {
      irregularidades: "",
      classificacaoRisco: "",
    },
    recomendacoes: [
      itemSN("adequacao_aterramento", "Adequação dos sistemas de aterramento"),
      itemSN("diagramas", "Regularização de diagramas elétricos"),
      itemSN("sinalizacao", "Implementação de sinalização de segurança"),
      itemSN("treinamentos", "Atualização de treinamentos NR-10"),
      itemSN("quadros", "Correção de falhas em quadros elétricos"),
    ],
    planoAcao: ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"].map((mes, index) => ({
      id: `plano_${mes}`,
      mes,
      acao: index === 1 ? "Identificação dos circuitos do QGBT" : "",
      responsavel: index === 1 ? "Empresa terceira" : "",
      status: index === 1 ? "andamento" : "",
    })),
    conclusao: "",
    fotos: Array.from({ length: 6 }, (_, index) => novaFotoRegistro(index + 1)),
    responsavel: {
      nome: "",
      crea: "",
      art: "",
      empresa: "",
      telefone: "",
      email: "",
      data: hoje,
    },
  };
}


function aplicarStatusSN(itens: ChecklistSNItem[], valores: Record<string, SimNao>): ChecklistSNItem[] {
  return itens.map((item) => ({ ...item, status: valores[item.id] ?? item.status }));
}

function aplicarStatusAdequacao(secao: SecaoAdequacao, status: Adequacao[]): SecaoAdequacao {
  return {
    ...secao,
    itens: secao.itens.map((item, index) => ({ ...item, status: status[index] ?? item.status })),
  };
}

function criarCenarioTesteLaudoPIE(): PieForm {
  const base = criarFormularioPadrao();

  return {
    ...base,
    identificacao: {
      condominio: "Condomínio Residencial Jardim das Torres",
      cnpj: "12.345.678/0001-90",
      endereco: "Rua das Instalações, 100 - Centro - São Paulo/SP",
      responsavelTecnico: "Eng. Eletricista Wanderson Silva",
      crea: "CREA-SP 0000000000",
      data: hoje,
    },
    documentacao: aplicarStatusSN(base.documentacao, {
      diagramas_unifilares: "sim",
      diagramas_instalacoes: "nao",
      laudos_eletricos: "sim",
      spda: "sim",
      sistema_aterramento: "sim",
    }),
    conformidade: aplicarStatusSN(base.conformidade, {
      diagramas_atualizados: "nao",
      procedimentos_seguranca: "sim",
      inspecoes_periodicas: "sim",
      epis_epcs: "nao",
      treinamento: "sim",
      relatorios_atualizados: "sim",
    }),
    spdaAterramento: aplicarStatusSN(base.spdaAterramento, {
      laudo_spda: "sim",
      medicao_aterramento: "sim",
      continuidade_eletrica: "sim",
      inspecao_visual: "sim",
    }),
    quadros: [
      {
        ...novoQuadro("QGBT - Quadro Geral de Baixa Tensão"),
        id: "teste_qgbt",
        localizacao: "Subsolo técnico - sala elétrica principal",
        tensao: "380/220 V",
        identificacaoCircuitos: "nao",
        fechamentoAdequado: "sim",
        partesVivasExpostas: "nao",
        sinalizacao: "nao",
        disjuntores: "sim",
        dr: "nao",
        dps: "sim",
        umidade: "nao",
        areaMolhada: "nao",
        acessoRestrito: "sim",
        aterramento: "TN-S",
        estudoArco: "nao",
        etiquetagemArco: "nao",
        grauRisco: "medio",
        observacoes: "Necessária atualização das etiquetas dos circuitos e implantação de identificação de risco elétrico/arc flash.",
      },
      {
        ...novoQuadro("Quadro de Bombas - Recalque"),
        id: "teste_bombas",
        localizacao: "Casa de bombas",
        tensao: "220 V",
        identificacaoCircuitos: "sim",
        fechamentoAdequado: "sim",
        partesVivasExpostas: "nao",
        sinalizacao: "sim",
        disjuntores: "sim",
        dr: "sim",
        dps: "nao",
        umidade: "sim",
        areaMolhada: "sim",
        acessoRestrito: "sim",
        aterramento: "TN-S",
        estudoArco: "nao",
        etiquetagemArco: "nao",
        grauRisco: "alto",
        observacoes: "Ambiente sujeito à umidade. Recomendado tratamento de vedação, revisão de grau de proteção e instalação de DPS adequado.",
      },
      {
        ...novoQuadro("Quadro de Iluminação - Áreas Comuns"),
        id: "teste_iluminacao",
        localizacao: "Térreo - hall de serviço",
        tensao: "127/220 V",
        identificacaoCircuitos: "sim",
        fechamentoAdequado: "sim",
        partesVivasExpostas: "nao",
        sinalizacao: "sim",
        disjuntores: "sim",
        dr: "sim",
        dps: "sim",
        umidade: "nao",
        areaMolhada: "nao",
        acessoRestrito: "sim",
        aterramento: "TN-S",
        estudoArco: "na",
        etiquetagemArco: "na",
        grauRisco: "baixo",
        observacoes: "Quadro em condição geral satisfatória. Manter inspeções periódicas e registro das manutenções.",
      },
    ],
    procedimentos: base.procedimentos.map((item) => ({
      ...item,
      existe: ["desenergizacao", "apr", "permissao_trabalho", "manutencao_eletrica"].includes(item.id),
      aplicado: ["desenergizacao", "apr", "manutencao_eletrica"].includes(item.id),
    })),
    epis: base.epis.map((item) => ({
      ...item,
      existe: true,
      uso: item.id !== "vestimenta",
      validade: item.id !== "luvas" ? true : false,
    })),
    trabalhadores: {
      quantidade: "3",
      nr10Basico: "sim",
      nr10Sep: "nao",
      asoValido: "sim",
    },
    ensaios: aplicarStatusSN(base.ensaios, {
      teste_luvas: "nao",
      ferramentas_isoladas: "sim",
      epc: "sim",
    }),
    areasClassificadas: {
      aplicavel: false,
      detalhe: "Não foram identificadas áreas classificadas na inspeção visual do cenário de teste.",
    },
    relatorioTecnico: [
      aplicarStatusAdequacao(criarSecaoAdequacao("teste_corredores", "Tomadas elétricas - corredores e halls", ITENS_PADRAO_AREA_COMUM), ["adequado", "adequado", "adequado", "adequado", "adequado"]),
      aplicarStatusAdequacao(criarSecaoAdequacao("teste_salao", "Tomadas elétricas - salão de festas", ITENS_PADRAO_AREA_COMUM), ["adequado", "nao_adequado", "adequado", "adequado", "nao_adequado"]),
      aplicarStatusAdequacao(criarSecaoAdequacao("teste_bombas", "Casa de bombas", ITENS_PADRAO_AREA_COMUM), ["adequado", "adequado", "nao_adequado", "adequado", "nao_adequado"]),
      aplicarStatusAdequacao(criarSecaoAdequacao("teste_iluminacao", "Sistema de iluminação", [
        "Nível de iluminação",
        "Iluminação de emergência instalada",
        "Funcionamento da iluminação de emergência",
        "Condição das luminárias",
        "Estado geral de conservação",
      ]), ["adequado", "adequado", "nao_adequado", "adequado", "adequado"]),
      aplicarStatusAdequacao(criarSecaoAdequacao("teste_gerador", "Sistema de emergência / gerador", [
        "Existência de gerador (quando aplicável)",
        "Condições operacionais do gerador",
        "Realização de testes periódicos",
        "Quadro de transferência (QTA)",
        "Estado geral de conservação",
      ]), ["na", "na", "na", "na", "na"]),
      aplicarStatusAdequacao(criarSecaoAdequacao("teste_infra", "Infraestrutura elétrica", [
        "Integridade dos eletrodutos",
        "Fechamento das caixas de passagem",
        "Proteção da fiação",
        "Organização dos cabos",
        "Estado geral de conservação",
      ]), ["adequado", "nao_adequado", "adequado", "nao_adequado", "nao_adequado"]),
      aplicarStatusAdequacao(criarSecaoAdequacao("teste_aterramento", "Sistema de aterramento", [
        "Existência de sistema de aterramento",
        "Continuidade elétrica do aterramento",
        "Identificação do barramento de terra",
        "Equipotencialização",
        "Estado geral de conservação",
      ]), ["adequado", "adequado", "nao_adequado", "adequado", "adequado"]),
      aplicarStatusAdequacao(criarSecaoAdequacao("teste_seguranca", "Segurança das instalações", [
        "Ausência de partes vivas expostas",
        "Sinalização de risco elétrico",
        "Restrição de acesso aos quadros elétricos",
        "Proteção contra choques elétricos",
        "Estado geral de conservação",
      ]), ["adequado", "nao_adequado", "adequado", "adequado", "nao_adequado"]),
    ],
    analiseTecnica: {
      irregularidades: [
        "Identificação incompleta de circuitos no QGBT.",
        "Ausência de evidência de ensaio vigente das luvas isolantes.",
        "DPS ausente no quadro de bombas.",
        "Sinalização de risco elétrico insuficiente em alguns quadros.",
        "Caixas de passagem sem fechamento adequado em trecho da infraestrutura comum.",
      ].join("\n"),
      classificacaoRisco: "medio",
    },
    recomendacoes: aplicarStatusSN(base.recomendacoes, {
      adequacao_aterramento: "sim",
      diagramas: "sim",
      sinalizacao: "sim",
      treinamentos: "sim",
      quadros: "sim",
    }),
    planoAcao: base.planoAcao.map((item) => {
      const acoes: Record<string, Partial<PlanoAcaoItem>> = {
        JAN: { acao: "Revisar diagramas unifilares e documentação do PIE", responsavel: "Engenharia elétrica", status: "andamento" },
        FEV: { acao: "Identificação dos circuitos do QGBT", responsavel: "Empresa terceira", status: "andamento" },
        MAR: { acao: "Instalar DPS no quadro de bombas", responsavel: "Manutenção elétrica", status: "pendente" },
        ABR: { acao: "Regularizar sinalização de risco elétrico", responsavel: "Síndico / manutenção", status: "pendente" },
        MAI: { acao: "Atualizar treinamento NR-10 SEP quando aplicável", responsavel: "RH / Segurança do Trabalho", status: "pendente" },
      };
      return { ...item, ...(acoes[item.mes] ?? {}) };
    }),
    conclusao: "parcial",
    fotos: [
      { id: "foto_teste_1", titulo: "Imagem 01 - QGBT", descricao: "Vista frontal do QGBT com necessidade de atualização das identificações de circuitos.", local: "Subsolo técnico", data: hoje },
      { id: "foto_teste_2", titulo: "Imagem 02 - Quadro de bombas", descricao: "Quadro instalado em ambiente sujeito à umidade, com recomendação de adequação do grau de proteção.", local: "Casa de bombas", data: hoje },
      { id: "foto_teste_3", titulo: "Imagem 03 - Caixa de passagem", descricao: "Caixa de passagem sem fechamento adequado em área comum.", local: "Garagem - subsolo 1", data: hoje },
      { id: "foto_teste_4", titulo: "Imagem 04 - Iluminação de emergência", descricao: "Ponto de iluminação de emergência a ser testado e registrado em manutenção preventiva.", local: "Escadaria de emergência", data: hoje },
    ],
    responsavel: {
      nome: "Eng. Eletricista Wanderson Silva",
      crea: "CREA-SP 0000000000",
      art: "ART 2026000000000",
      empresa: "WMS Consultoria Técnica",
      telefone: "(11) 99999-0000",
      email: "responsavel.tecnico@exemplo.com.br",
      data: hoje,
    },
  };
}

function normalizarFormulario(raw: Partial<PieForm>): PieForm {
  const padrao = criarFormularioPadrao();
  const quadros = Array.isArray(raw.quadros)
    ? raw.quadros.map((quadro, index) => ({
        ...novoQuadro(quadro?.nome || `Quadro ${String(index + 1).padStart(2, "0")}`),
        ...quadro,
      }))
    : padrao.quadros;
  const relatorioTecnico = Array.isArray(raw.relatorioTecnico)
    ? raw.relatorioTecnico.map((secao, index) => {
        const secaoPadrao = padrao.relatorioTecnico[index % padrao.relatorioTecnico.length];
        const secaoId = secao?.id || secaoPadrao.id || uid("local");
        const itens = Array.isArray(secao?.itens) && secao.itens.length > 0
          ? secao.itens.map((item, itemIndex) => ({
              id: item?.id || `${secaoId}_${itemIndex}`,
              label: item?.label || ITENS_PADRAO_AREA_COMUM[itemIndex % ITENS_PADRAO_AREA_COMUM.length],
              status: (item?.status || "") as Adequacao,
            }))
          : ITENS_PADRAO_AREA_COMUM.map((label, itemIndex) => itemAdequacao(`${secaoId}_${itemIndex}`, label));
        return {
          id: secaoId,
          titulo: secao?.titulo || secaoPadrao.titulo || `Local ${String(index + 1).padStart(2, "0")}`,
          itens,
        };
      })
    : padrao.relatorioTecnico;

  const fotos = Array.isArray(raw.fotos)
    ? raw.fotos.map((foto, index) => {
        const fotoPadrao = padrao.fotos[index % padrao.fotos.length];
        return {
          id: foto?.id || fotoPadrao.id || `foto_${index + 1}`,
          titulo: foto?.titulo || fotoPadrao.titulo || `Imagem ${String(index + 1).padStart(2, "0")}`,
          descricao: foto?.descricao || fotoPadrao.descricao || "",
          local: foto?.local || fotoPadrao.local || "",
          data: foto?.data || fotoPadrao.data || "",
          imagem: foto?.imagem || fotoPadrao.imagem || "",
          nomeArquivo: foto?.nomeArquivo || fotoPadrao.nomeArquivo || "",
        };
      })
    : padrao.fotos;

  return {
    ...padrao,
    ...raw,
    identificacao: { ...padrao.identificacao, ...(raw.identificacao ?? {}) },
    documentacao: Array.isArray(raw.documentacao) ? raw.documentacao : padrao.documentacao,
    conformidade: Array.isArray(raw.conformidade) ? raw.conformidade : padrao.conformidade,
    spdaAterramento: Array.isArray(raw.spdaAterramento) ? raw.spdaAterramento : padrao.spdaAterramento,
    quadros,
    procedimentos: Array.isArray(raw.procedimentos) ? raw.procedimentos : padrao.procedimentos,
    epis: Array.isArray(raw.epis) ? raw.epis : padrao.epis,
    trabalhadores: { ...padrao.trabalhadores, ...(raw.trabalhadores ?? {}) },
    ensaios: Array.isArray(raw.ensaios) ? raw.ensaios : padrao.ensaios,
    areasClassificadas: { ...padrao.areasClassificadas, ...(raw.areasClassificadas ?? {}) },
    relatorioTecnico,
    analiseTecnica: { ...padrao.analiseTecnica, ...(raw.analiseTecnica ?? {}) },
    recomendacoes: Array.isArray(raw.recomendacoes) ? raw.recomendacoes : padrao.recomendacoes,
    planoAcao: Array.isArray(raw.planoAcao) ? raw.planoAcao : padrao.planoAcao,
    conclusao: raw.conclusao ?? padrao.conclusao,
    fotos,
    responsavel: { ...padrao.responsavel, ...(raw.responsavel ?? {}) },
  };
}

function statusLabel(status: SimNao | Adequacao | Risco | Conclusao) {
  const map: Record<string, string> = {
    sim: "Sim",
    nao: "Não",
    na: "N/A",
    adequado: "Adequado",
    nao_adequado: "Não adequado",
    baixo: "Baixo",
    medio: "Médio",
    alto: "Alto",
    conforme: "Conforme",
    parcial: "Parcialmente conforme",
    nao_conforme: "Não conforme",
  };
  return status ? map[status] : "Pendente";
}

function statusBadge(status: SimNao | Adequacao | Risco | Conclusao) {
  if (!status || status === "na") return "outline";
  if (status === "sim" || status === "adequado" || status === "baixo" || status === "conforme") return "success";
  if (status === "medio" || status === "parcial") return "warning";
  return "danger";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SelectSimNao({ value, onChange, incluirNA = false }: { value: SimNao; onChange: (v: SimNao) => void; incluirNA?: boolean }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as SimNao)} className="h-9 w-full rounded-lg border border-border bg-background-alt px-3 text-sm">
      <option value="">Selecionar...</option>
      <option value="sim">Sim</option>
      <option value="nao">Não</option>
      {incluirNA && <option value="na">N/A</option>}
    </select>
  );
}

function SelectAdequacao({ value, onChange }: { value: Adequacao; onChange: (v: Adequacao) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as Adequacao)} className="h-9 w-full rounded-lg border border-border bg-background-alt px-3 text-sm">
      <option value="">Selecionar...</option>
      <option value="adequado">Adequado</option>
      <option value="nao_adequado">Não adequado</option>
      <option value="na">N/A</option>
    </select>
  );
}

function ChecklistSimNao({ itens, onChange }: { itens: ChecklistSNItem[]; onChange: (id: string, value: SimNao) => void }) {
  return (
    <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle overflow-hidden">
      {itens.map((item) => (
        <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 p-3 items-center bg-background-alt/40">
          <div className="text-sm font-medium">{item.label}</div>
          <SelectSimNao value={item.status} onChange={(value) => onChange(item.id, value)} incluirNA />
        </div>
      ))}
    </div>
  );
}

function BooleanCell({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs transition-colors ${
        checked ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background-alt text-foreground-muted hover:text-foreground"
      }`}
    >
      <CheckCircle2 className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function ConfirmacaoSistemaModal({
  confirmacao,
  onCancelar,
  onConfirmar,
}: {
  confirmacao: ConfirmacaoSistema | null;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  if (!confirmacao) return null;

  const confirmacaoPositiva = confirmacao.variante === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 backdrop-blur-sm px-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacao-sistema-titulo"
        aria-describedby="confirmacao-sistema-mensagem"
        className="w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
      >
        <div className="p-5 sm:p-6 border-b border-border-subtle">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${confirmacaoPositiva ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
              {confirmacaoPositiva ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="confirmacao-sistema-titulo" className="text-base font-semibold tracking-tight">
                {confirmacao.titulo}
              </h2>
              <p id="confirmacao-sistema-mensagem" className="mt-1 text-sm leading-relaxed text-foreground-muted">
                {confirmacao.mensagem}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end sm:p-5">
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="button" variant={confirmacaoPositiva ? "success" : "destructive"} onClick={onConfirmar}>
            {confirmacaoPositiva ? <CheckCircle2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            {confirmacao.textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProntuarioInstalacoesEletricasPage() {
  const [form, setForm] = useState<PieForm>(() => criarFormularioPadrao());
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoSistema | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setForm(normalizarFormulario(JSON.parse(stored) as Partial<PieForm>));
    } catch {
      setForm(criarFormularioPadrao());
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      setSaved(true);
      const timer = window.setTimeout(() => setSaved(false), 1200);
      return () => window.clearTimeout(timer);
    } catch {
      return undefined;
    }
  }, [form, hydrated]);

  useEffect(() => {
    if (!confirmacao) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmacao(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmacao]);

  const resumo = useMemo(() => {
    const itensSN = [...form.documentacao, ...form.conformidade, ...form.spdaAterramento, ...form.ensaios, ...form.recomendacoes];
    const sim = itensSN.filter((item) => item.status === "sim").length;
    const nao = itensSN.filter((item) => item.status === "nao").length;
    const pendentes = itensSN.filter((item) => !item.status).length;
    const naoAdequados = form.relatorioTecnico.flatMap((secao) => secao.itens).filter((item) => item.status === "nao_adequado").length;
    const quadrosAltoRisco = form.quadros.filter((quadro) => quadro.grauRisco === "alto").length;
    return { sim, nao, pendentes, naoAdequados, quadrosAltoRisco };
  }, [form]);

  function updateIdentificacao<K extends keyof Identificacao>(key: K, value: Identificacao[K]) {
    setForm((prev) => ({ ...prev, identificacao: { ...prev.identificacao, [key]: value } }));
  }

  function aplicarClienteCadastrado(cliente: Cliente) {
    setForm((prev) => ({
      ...prev,
      identificacao: {
        ...prev.identificacao,
        condominio: nomeCliente(cliente),
        cnpj: documentoCliente(cliente) || prev.identificacao.cnpj,
        endereco: enderecoCliente(cliente) || prev.identificacao.endereco,
      },
    }));
  }

  function updateChecklist(group: "documentacao" | "conformidade" | "spdaAterramento" | "ensaios" | "recomendacoes", id: string, value: SimNao) {
    setForm((prev) => ({
      ...prev,
      [group]: prev[group].map((item) => (item.id === id ? { ...item, status: value } : item)),
    }));
  }

  function updateQuadro(id: string, patch: Partial<QuadroEletrico>) {
    setForm((prev) => ({ ...prev, quadros: prev.quadros.map((quadro) => (quadro.id === id ? { ...quadro, ...patch } : quadro)) }));
  }

  function updateAdequacao(secaoId: string, itemId: string, status: Adequacao) {
    setForm((prev) => ({
      ...prev,
      relatorioTecnico: prev.relatorioTecnico.map((secao) =>
        secao.id === secaoId
          ? { ...secao, itens: secao.itens.map((item) => (item.id === itemId ? { ...item, status } : item)) }
          : secao,
      ),
    }));
  }

  function updateTituloLocalRelatorio(secaoId: string, titulo: string) {
    setForm((prev) => ({
      ...prev,
      relatorioTecnico: prev.relatorioTecnico.map((secao) => (secao.id === secaoId ? { ...secao, titulo } : secao)),
    }));
  }

  function adicionarLocalRelatorio() {
    setForm((prev) => ({
      ...prev,
      relatorioTecnico: [...prev.relatorioTecnico, novoLocalAreaComum(prev.relatorioTecnico.length + 1)],
    }));
  }

  function removerLocalRelatorio(secaoId: string) {
    setConfirmacao({
      titulo: "Excluir local do checklist?",
      mensagem: "Este local e todos os seus itens de verificação serão removidos do Prontuário de Instalações Elétricas.",
      textoConfirmar: "Excluir local",
      acao: () => {
        setForm((prev) => ({
          ...prev,
          relatorioTecnico: prev.relatorioTecnico.filter((secao) => secao.id !== secaoId),
        }));
      },
    });
  }

  function adicionarFoto() {
    setForm((prev) => ({ ...prev, fotos: [...prev.fotos, novaFotoRegistro(prev.fotos.length + 1)] }));
  }

  function updateFoto(id: string, patch: Partial<FotoRegistro>) {
    setForm((prev) => ({ ...prev, fotos: prev.fotos.map((foto) => (foto.id === id ? { ...foto, ...patch } : foto)) }));
  }

  function anexarImagemFoto(id: string, file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPdfError("Selecione um arquivo de imagem válido para o registro fotográfico.");
      return;
    }
    const maxSizeMb = 6;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setPdfError(`A imagem deve ter no máximo ${maxSizeMb} MB para ser anexada ao PDF.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateFoto(id, { imagem: result, nomeArquivo: file.name });
      setPdfError(null);
    };
    reader.onerror = () => setPdfError("Não foi possível carregar a imagem selecionada.");
    reader.readAsDataURL(file);
  }

  function removerImagemFoto(id: string) {
    updateFoto(id, { imagem: "", nomeArquivo: "" });
  }

  function removerFoto(id: string) {
    setConfirmacao({
      titulo: "Excluir campo de imagem?",
      mensagem: "Este campo será removido do registro fotográfico e não aparecerá no PDF do prontuário.",
      textoConfirmar: "Excluir imagem",
      acao: () => {
        setForm((prev) => ({ ...prev, fotos: prev.fotos.filter((foto) => foto.id !== id) }));
      },
    });
  }

  function resetarFormulario() {
    setConfirmacao({
      titulo: "Limpar dados do prontuário?",
      mensagem: "Todos os dados preenchidos nesta aba serão apagados e o formulário voltará ao padrão inicial.",
      textoConfirmar: "Limpar dados",
      acao: () => setForm(criarFormularioPadrao()),
    });
  }

  function carregarCenarioTeste() {
    setConfirmacao({
      titulo: "Carregar cenário de teste do laudo?",
      mensagem: "O formulário será preenchido com dados fictícios completos para validar o PDF do PIE, incluindo quadros, checklist, plano de ação, registro fotográfico e responsável técnico.",
      textoConfirmar: "Carregar teste",
      variante: "success",
      acao: () => setForm(criarCenarioTesteLaudoPIE()),
    });
  }

  function executarConfirmacao() {
    const acao = confirmacao?.acao;
    setConfirmacao(null);
    acao?.();
  }

  async function gerarPdf() {
    setPdfError(null);
    setPdfLoading(true);
    try {
      const blob = await gerarPDFPIE({ dados: form as unknown as Record<string, unknown> });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pie-prontuario-${form.identificacao.condominio || "instalacao"}.pdf`.replace(/\s+/g, "-").toLowerCase();
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Erro ao gerar PDF do PIE");
    } finally {
      setPdfLoading(false);
    }
  }

  function exportarJson() {
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pie-prontuario-${form.identificacao.condominio || "instalacao"}.json`.replace(/\s+/g, "-").toLowerCase();
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <ConfirmacaoSistemaModal
        confirmacao={confirmacao}
        onCancelar={() => setConfirmacao(null)}
        onConfirmar={executarConfirmacao}
      />
      <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="primary" className="mb-2 gap-1">
            <ClipboardCheck className="w-3 h-3" /> PIE · NR-10
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Prontuário de Instalações Elétricas</h1>
          <p className="text-sm text-foreground-muted mt-1 max-w-3xl">
            Relatório técnico para organização do PIE com identificação do empreendimento, documentação técnica, inspeções, quadros elétricos,
            EPIs/EPCs, trabalhadores, plano de ação, registro fotográfico e conclusão técnica.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={gerarPdf} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {pdfLoading ? "Gerando PDF..." : "Gerar PDF"}
          </Button>
          <Button type="button" variant="success" onClick={carregarCenarioTeste}>
            <ClipboardCheck className="w-4 h-4" /> Cenário de teste
          </Button>
          <Button type="button" variant="outline" onClick={exportarJson}>
            <Download className="w-4 h-4" /> Exportar JSON
          </Button>
          <Button type="button" variant="outline" onClick={resetarFormulario}>
            <RotateCcw className="w-4 h-4" /> Limpar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="card-glass"><CardContent className="p-4"><div className="text-xs text-foreground-muted">Itens atendidos</div><div className="text-2xl font-bold text-success">{resumo.sim}</div></CardContent></Card>
        <Card className="card-glass"><CardContent className="p-4"><div className="text-xs text-foreground-muted">Não atendidos</div><div className="text-2xl font-bold text-danger">{resumo.nao}</div></CardContent></Card>
        <Card className="card-glass"><CardContent className="p-4"><div className="text-xs text-foreground-muted">Pendentes</div><div className="text-2xl font-bold text-warning">{resumo.pendentes}</div></CardContent></Card>
        <Card className="card-glass"><CardContent className="p-4"><div className="text-xs text-foreground-muted">Não adequados</div><div className="text-2xl font-bold text-danger">{resumo.naoAdequados}</div></CardContent></Card>
        <Card className="card-glass"><CardContent className="p-4"><div className="text-xs text-foreground-muted">Quadros alto risco</div><div className="text-2xl font-bold text-danger">{resumo.quadrosAltoRisco}</div></CardContent></Card>
      </div>

      {saved && <div className="text-xs text-success flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> Alterações salvas localmente.</div>}
      {pdfError && <div className="text-xs text-danger flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {pdfError}</div>}

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <CardTitle>1. Identificação do empreendimento</CardTitle>
              <CardDescription>Dados básicos do condomínio, empresa ou instalação avaliada.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2 lg:col-span-3">
            <ClienteAutocomplete
              label="Buscar cliente cadastrado"
              value={form.identificacao.condominio}
              onValueChange={(value) => updateIdentificacao("condominio", value)}
              onSelect={aplicarClienteCadastrado}
            />
          </div>
          <Field label="Condomínio / empreendimento"><Input value={form.identificacao.condominio} onChange={(event) => updateIdentificacao("condominio", event.target.value)} /></Field>
          <Field label="CNPJ"><Input value={form.identificacao.cnpj} onChange={(event) => updateIdentificacao("cnpj", event.target.value)} /></Field>
          <Field label="Data"><Input type="date" value={form.identificacao.data} onChange={(event) => updateIdentificacao("data", event.target.value)} /></Field>
          <div className="md:col-span-2"><Field label="Endereço"><Input value={form.identificacao.endereco} onChange={(event) => updateIdentificacao("endereco", event.target.value)} /></Field></div>
          <Field label="Responsável técnico"><Input value={form.identificacao.responsavelTecnico} onChange={(event) => updateIdentificacao("responsavelTecnico", event.target.value)} /></Field>
          <Field label="CREA / CFT / CRT"><Input value={form.identificacao.crea} onChange={(event) => updateIdentificacao("crea", event.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <CardTitle>2. Introdução, base legal e objetivo</CardTitle>
              <CardDescription>Texto-base do prontuário para contextualizar a inspeção e os requisitos NR-10.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground-muted leading-relaxed">
          <p>
            O presente documento constitui o Prontuário das Instalações Elétricas, com o objetivo de reunir informações técnicas,
            administrativas e de segurança relacionadas às instalações elétricas do empreendimento.
          </p>
          <p>
            O relatório contempla inspeções, análises e verificações das condições operacionais e de segurança, visando garantir a integridade
            física dos trabalhadores, usuários e do patrimônio.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              "Atender aos requisitos da NR-10, incluindo itens 10.2.3 e 10.2.4.",
              "Identificar não conformidades e propor ações corretivas/preventivas.",
              "Assegurar conformidade com normas técnicas aplicáveis e boas práticas de engenharia elétrica.",
            ].map((texto) => (
              <div key={texto} className="rounded-lg border border-border-subtle bg-background-alt/40 p-3 text-xs text-foreground">
                {texto}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>5. Documentação técnica disponível</CardTitle></CardHeader>
          <CardContent><ChecklistSimNao itens={form.documentacao} onChange={(id, value) => updateChecklist("documentacao", id, value)} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>6. Conformidade com NR-10</CardTitle></CardHeader>
          <CardContent><ChecklistSimNao itens={form.conformidade} onChange={(id, value) => updateChecklist("conformidade", id, value)} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>7. SPDA e aterramento</CardTitle></CardHeader>
          <CardContent><ChecklistSimNao itens={form.spdaAterramento} onChange={(id, value) => updateChecklist("spdaAterramento", id, value)} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
            <div>
              <CardTitle>8. Avaliação dos quadros elétricos</CardTitle>
              <CardDescription>Inclui QGBT e demais quadros com verificação técnica, proteções, ambiente, aterramento e risco de arco.</CardDescription>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setForm((prev) => ({ ...prev, quadros: [...prev.quadros, novoQuadro(`Quadro ${String(prev.quadros.length + 1).padStart(2, "0")}`)] }))}>
              <Plus className="w-4 h-4" /> Adicionar quadro
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.quadros.map((quadro, index) => (
            <Card key={quadro.id} className="border-border-subtle bg-background-alt/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap className="w-4 h-4 text-primary shrink-0" />
                    <Input value={quadro.nome} onChange={(event) => updateQuadro(quadro.id, { nome: event.target.value })} className="font-semibold" />
                  </div>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, quadros: prev.quadros.filter((item) => item.id !== quadro.id) }))} disabled={form.quadros.length <= 1} className="p-2 rounded-lg hover:bg-danger/10 text-foreground-muted hover:text-danger disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Localização"><Input value={quadro.localizacao} onChange={(event) => updateQuadro(quadro.id, { localizacao: event.target.value })} /></Field>
                  <Field label="Tensão"><Input value={quadro.tensao} onChange={(event) => updateQuadro(quadro.id, { tensao: event.target.value })} /></Field>
                  <Field label="Grau de risco">
                    <select value={quadro.grauRisco} onChange={(event) => updateQuadro(quadro.id, { grauRisco: event.target.value as Risco })} className="h-10 w-full rounded-lg border border-border bg-background-alt px-3 text-sm">
                      <option value="">Selecionar...</option><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option>
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Identificação de circuitos", "identificacaoCircuitos"],
                    ["Fechamento adequado", "fechamentoAdequado"],
                    ["Partes vivas expostas", "partesVivasExpostas"],
                    ["Sinalização", "sinalizacao"],
                    ["Disjuntores", "disjuntores"],
                    ["DR", "dr"],
                    ["DPS", "dps"],
                    ["Umidade / infiltração", "umidade"],
                    ["Área molhada", "areaMolhada"],
                    ["Acesso restrito", "acessoRestrito"],
                    ["Estudo de energia incidente", "estudoArco"],
                    ["Etiquetagem de risco", "etiquetagemArco"],
                  ].map(([label, key]) => (
                    <Field key={`${quadro.id}_${key}`} label={label}>
                      <SelectSimNao value={quadro[key as keyof QuadroEletrico] as SimNao} onChange={(value) => updateQuadro(quadro.id, { [key]: value } as Partial<QuadroEletrico>)} incluirNA />
                    </Field>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Tipo de aterramento">
                    <select value={quadro.aterramento} onChange={(event) => updateQuadro(quadro.id, { aterramento: event.target.value as QuadroEletrico["aterramento"] })} className="h-10 w-full rounded-lg border border-border bg-background-alt px-3 text-sm">
                      <option value="">Selecionar...</option>{["TT", "TN-S", "TN-C", "TN-C-S", "IT"].map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                    </select>
                  </Field>
                  <div className="md:col-span-2"><Field label="Observações"><Input value={quadro.observacoes} onChange={(event) => updateQuadro(quadro.id, { observacoes: event.target.value })} /></Field></div>
                </div>
                <div className="flex items-center gap-2 text-xs text-foreground-muted">
                  <Badge variant={statusBadge(quadro.grauRisco)}>{statusLabel(quadro.grauRisco)}</Badge>
                  <span>Quadro {index + 1} de {form.quadros.length}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>9. Procedimentos operacionais</CardTitle><CardDescription>Controle de existência e aplicação dos procedimentos NR-10.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {form.procedimentos.map((item) => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center rounded-lg border border-border-subtle bg-background-alt/40 p-3">
                <div className="text-sm font-medium">{item.label}</div>
                <BooleanCell checked={item.existe} onChange={(value) => setForm((prev) => ({ ...prev, procedimentos: prev.procedimentos.map((proc) => proc.id === item.id ? { ...proc, existe: value } : proc) }))} label="Existe" />
                <BooleanCell checked={item.aplicado} onChange={(value) => setForm((prev) => ({ ...prev, procedimentos: prev.procedimentos.map((proc) => proc.id === item.id ? { ...proc, aplicado: value } : proc) }))} label="Aplicado" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>10. EPCs e EPIs</CardTitle><CardDescription>Controle de existência, uso e validade dos equipamentos.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {form.epis.map((item) => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center rounded-lg border border-border-subtle bg-background-alt/40 p-3">
                <div className="text-sm font-medium">{item.label}</div>
                <BooleanCell checked={item.existe} onChange={(value) => setForm((prev) => ({ ...prev, epis: prev.epis.map((epi) => epi.id === item.id ? { ...epi, existe: value } : epi) }))} label="Existe" />
                <BooleanCell checked={item.uso} onChange={(value) => setForm((prev) => ({ ...prev, epis: prev.epis.map((epi) => epi.id === item.id ? { ...epi, uso: value } : epi) }))} label="Uso" />
                <BooleanCell checked={item.validade} onChange={(value) => setForm((prev) => ({ ...prev, epis: prev.epis.map((epi) => epi.id === item.id ? { ...epi, validade: value } : epi) }))} label="Validade" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>11. Qualificação dos trabalhadores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Quantidade de trabalhadores"><Input value={form.trabalhadores.quantidade} onChange={(event) => setForm((prev) => ({ ...prev, trabalhadores: { ...prev.trabalhadores, quantidade: event.target.value } }))} /></Field>
            <Field label="NR-10 Básico"><SelectSimNao value={form.trabalhadores.nr10Basico} onChange={(value) => setForm((prev) => ({ ...prev, trabalhadores: { ...prev.trabalhadores, nr10Basico: value } }))} /></Field>
            <Field label="NR-10 SEP"><SelectSimNao value={form.trabalhadores.nr10Sep} onChange={(value) => setForm((prev) => ({ ...prev, trabalhadores: { ...prev.trabalhadores, nr10Sep: value } }))} incluirNA /></Field>
            <Field label="ASO válido"><SelectSimNao value={form.trabalhadores.asoValido} onChange={(value) => setForm((prev) => ({ ...prev, trabalhadores: { ...prev.trabalhadores, asoValido: value } }))} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>12. Ensaios e testes elétricos</CardTitle></CardHeader>
          <CardContent><ChecklistSimNao itens={form.ensaios} onChange={(id, value) => updateChecklist("ensaios", id, value)} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>13. Áreas classificadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <BooleanCell checked={form.areasClassificadas.aplicavel} onChange={(value) => setForm((prev) => ({ ...prev, areasClassificadas: { ...prev.areasClassificadas, aplicavel: value } }))} label={form.areasClassificadas.aplicavel ? "Aplicável" : "Não se aplica"} />
            <Field label="Detalhamento"><Input value={form.areasClassificadas.detalhe} onChange={(event) => setForm((prev) => ({ ...prev, areasClassificadas: { ...prev.areasClassificadas, detalhe: event.target.value } }))} /></Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between w-full">
            <div className="flex items-start gap-3">
              <ListChecks className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <CardTitle>14. Relatório técnico - checklist de áreas comuns</CardTitle>
                <CardDescription>Crie, renomeie e exclua locais vistoriados nas áreas comuns.</CardDescription>
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={adicionarLocalRelatorio}>
              <Plus className="w-4 h-4" /> Adicionar local
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {form.relatorioTecnico.length === 0 && (
            <div className="xl:col-span-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-foreground-muted">
              Nenhum local cadastrado. Use o botão "Adicionar local" para iniciar o checklist.
            </div>
          )}
          {form.relatorioTecnico.map((secao) => (
            <Card key={secao.id} className="bg-background-alt/30 border-border-subtle">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 w-full">
                  <Input value={secao.titulo} onChange={(event) => updateTituloLocalRelatorio(secao.id, event.target.value)} className="font-semibold text-sm" />
                  <button type="button" onClick={() => removerLocalRelatorio(secao.id)} className="p-2 rounded-lg hover:bg-danger/10 text-foreground-muted hover:text-danger" title="Excluir local">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {secao.itens.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-2 items-center rounded-lg border border-border-subtle bg-background/60 p-2.5">
                    <span className="text-sm">{item.label}</span>
                    <SelectAdequacao value={item.status} onChange={(status) => updateAdequacao(secao.id, item.id, status)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>15. Análise técnica e não conformidades</CardTitle><CardDescription>Descrição das irregularidades identificadas e classificação de risco.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Descrição das irregularidades">
              <textarea value={form.analiseTecnica.irregularidades} onChange={(event) => setForm((prev) => ({ ...prev, analiseTecnica: { ...prev.analiseTecnica, irregularidades: event.target.value } }))} rows={7} className="w-full rounded-lg border border-border bg-background-alt px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </Field>
            <Field label="Classificação de risco">
              <select value={form.analiseTecnica.classificacaoRisco} onChange={(event) => setForm((prev) => ({ ...prev, analiseTecnica: { ...prev.analiseTecnica, classificacaoRisco: event.target.value as Risco } }))} className="h-10 w-full rounded-lg border border-border bg-background-alt px-3 text-sm">
                <option value="">Selecionar...</option><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option>
              </select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>16. Recomendações técnicas</CardTitle><CardDescription>Selecione as recomendações aplicáveis ao relatório.</CardDescription></CardHeader>
          <CardContent><ChecklistSimNao itens={form.recomendacoes} onChange={(id, value) => updateChecklist("recomendacoes", id, value)} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>17. Plano de ação anual</CardTitle><CardDescription>Controle mensal de ações, responsáveis e status.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {form.planoAcao.map((item) => (
            <div key={item.id} className="grid grid-cols-1 md:grid-cols-[80px_1fr_220px_150px] gap-2 items-center rounded-lg border border-border-subtle bg-background-alt/40 p-3">
              <div className="font-semibold text-sm">{item.mes}</div>
              <Input placeholder="Ação" value={item.acao} onChange={(event) => setForm((prev) => ({ ...prev, planoAcao: prev.planoAcao.map((acao) => acao.id === item.id ? { ...acao, acao: event.target.value } : acao) }))} />
              <Input placeholder="Responsável" value={item.responsavel} onChange={(event) => setForm((prev) => ({ ...prev, planoAcao: prev.planoAcao.map((acao) => acao.id === item.id ? { ...acao, responsavel: event.target.value } : acao) }))} />
              <select value={item.status} onChange={(event) => setForm((prev) => ({ ...prev, planoAcao: prev.planoAcao.map((acao) => acao.id === item.id ? { ...acao, status: event.target.value as PlanoAcaoItem["status"] } : acao) }))} className="h-10 w-full rounded-lg border border-border bg-background-alt px-3 text-sm">
                <option value="">Status...</option><option value="pendente">Pendente</option><option value="andamento">Andamento</option><option value="concluido">Concluído</option>
              </select>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>18. Conclusão</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground-muted">Com base nas inspeções realizadas, conclui-se que as instalações elétricas encontram-se:</p>
            <select value={form.conclusao} onChange={(event) => setForm((prev) => ({ ...prev, conclusao: event.target.value as Conclusao }))} className="h-10 w-full rounded-lg border border-border bg-background-alt px-3 text-sm">
              <option value="">Selecionar...</option><option value="conforme">Conformes com a NR-10</option><option value="parcial">Parcialmente conformes</option><option value="nao_conforme">Não conformes</option>
            </select>
            <Badge variant={statusBadge(form.conclusao)}>{statusLabel(form.conclusao)}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>20. Responsável técnico</CardTitle><CardDescription>Dados utilizados no PDF e no bloco de assinatura do PIE.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Nome"><Input value={form.responsavel.nome} onChange={(event) => setForm((prev) => ({ ...prev, responsavel: { ...prev.responsavel, nome: event.target.value } }))} /></Field>
            <Field label="CREA / CFT / CRT"><Input value={form.responsavel.crea} onChange={(event) => setForm((prev) => ({ ...prev, responsavel: { ...prev.responsavel, crea: event.target.value } }))} /></Field>
            <Field label="ART / RRT / TRT"><Input value={form.responsavel.art} onChange={(event) => setForm((prev) => ({ ...prev, responsavel: { ...prev.responsavel, art: event.target.value } }))} /></Field>
            <Field label="Empresa"><Input value={form.responsavel.empresa} onChange={(event) => setForm((prev) => ({ ...prev, responsavel: { ...prev.responsavel, empresa: event.target.value } }))} /></Field>
            <Field label="Telefone"><Input value={form.responsavel.telefone} onChange={(event) => setForm((prev) => ({ ...prev, responsavel: { ...prev.responsavel, telefone: event.target.value } }))} /></Field>
            <Field label="E-mail"><Input type="email" value={form.responsavel.email} onChange={(event) => setForm((prev) => ({ ...prev, responsavel: { ...prev.responsavel, email: event.target.value } }))} /></Field>
            <Field label="Data"><Input type="date" value={form.responsavel.data} onChange={(event) => setForm((prev) => ({ ...prev, responsavel: { ...prev.responsavel, data: event.target.value } }))} /></Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between w-full">
            <div className="flex items-start gap-3">
              <Camera className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <CardTitle>19. Registro fotográfico</CardTitle>
                <CardDescription>Crie e exclua campos de imagem para organizar as evidências fotográficas levantadas em campo.</CardDescription>
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={adicionarFoto}>
              <Plus className="w-4 h-4" /> Adicionar imagem
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {form.fotos.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-dashed border-border p-6 text-center text-sm text-foreground-muted">
              Nenhum campo de imagem cadastrado. Use o botão "Adicionar imagem" para criar um registro fotográfico.
            </div>
          )}
          {form.fotos.map((foto) => (
            <Card key={foto.id} className="bg-background-alt/30 border-border-subtle">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 w-full">
                  <Input value={foto.titulo} onChange={(event) => updateFoto(foto.id, { titulo: event.target.value })} className="font-semibold text-sm" />
                  <button type="button" onClick={() => removerFoto(foto.id)} className="p-2 rounded-lg hover:bg-danger/10 text-foreground-muted hover:text-danger" title="Excluir imagem">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-dashed border-border bg-background/60 p-3">
                  {foto.imagem ? (
                    <div className="space-y-2">
                      <img src={foto.imagem} alt={foto.titulo || "Imagem do registro fotográfico"} className="h-40 w-full rounded-md object-cover border border-border-subtle" />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="truncate text-xs text-foreground-muted">{foto.nomeArquivo || "Imagem anexada"}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => removerImagemFoto(foto.id)}>
                          <Trash2 className="w-3.5 h-3.5" /> Remover anexo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-xs text-foreground-muted">
                      <Camera className="w-6 h-6 text-primary/60" />
                      <span>Nenhuma foto anexada</span>
                    </div>
                  )}
                  <label className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background-alt px-3 py-2 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground">
                    <Camera className="w-3.5 h-3.5" />
                    {foto.imagem ? "Substituir foto" : "Anexar foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        anexarImagemFoto(foto.id, event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                <Field label="Descrição"><Input value={foto.descricao} onChange={(event) => updateFoto(foto.id, { descricao: event.target.value })} /></Field>
                <Field label="Local"><Input value={foto.local} onChange={(event) => updateFoto(foto.id, { local: event.target.value })} /></Field>
                <Field label="Data"><Input type="date" value={foto.data} onChange={(event) => updateFoto(foto.id, { data: event.target.value })} /></Field>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4 flex items-start gap-3 text-sm text-foreground-muted">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            Esta aba organiza as informações do Prontuário de Instalações Elétricas em formato de formulário. Os dados são salvos localmente no navegador.
            Para emissão oficial, revise os campos técnicos, anexe evidências e valide o relatório com o responsável técnico habilitado.
          </div>
        </CardContent>
      </Card>
      </div>
    </>
  );
}
