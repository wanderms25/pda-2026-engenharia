"use client";
import InfoProfissional from "@/components/analise/info-profissional";
import { buscarCEP, buscarCNPJBrasilAPI, formatarCEP } from "@/lib/validacoes";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
} from "@/components/ui";
import {
  obterChecklist,
  analisarLaudo,
  gerarPDFLaudoInspecao,
  type ChecklistItemOut,
  type ResultadoRemediacao,
  type FotoLaudoInput,
  type LaudoInspecaoPDFRequest,
} from "@/lib/api";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  BookOpen,
  Sparkles,
  ClipboardList,
  Download,
  AlertTriangle,
} from "lucide-react";
import { PlanoRemediacao } from "@/components/laudo/plano-remediacao";
import { FotoUpload } from "@/components/laudo/foto-upload";
import dynamic from "next/dynamic";
const GraficosProtecao = dynamic(() => import("@/components/laudo/graficos-protecao"), { ssr: false });




const CATEGORIAS_LABEL: Record<string, string> = {
  DOCUMENTACAO: "📋 Documentação",
  CAPTACAO: "⚡ Subsistema de Captação",
  DESCIDA: "↓ Subsistema de Descida",
  ATERRAMENTO: "⏚ Subsistema de Aterramento",
  EQUIPOTENCIALIZACAO: "⇌ Equipotencialização",
  DISTANCIAS_SEGURANCA: "📏 Distâncias de Segurança",
  MPS_DPS: "🛡 MPS e DPS",
  ENSAIOS: "🔬 Ensaios",
};

export default function LaudoPage() {
  const [checklist, setChecklist] = useState<
    Record<string, ChecklistItemOut[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Respostas do checklist
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  // Fotos (em base64) associadas a itens do checklist
  const [fotos, setFotos] = useState<FotoLaudoInput[]>([]);

  // Dados gerais do laudo
  const [dadosGerais, setDadosGerais] = useState({
    nome_projeto: "Projeto de Exemplo",
    cliente: "",
    cnpj_cliente: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    endereco: "",
    inspetor_nome: "",
    inspetor_registro: "",
    tipo_registro: "CREA",
    uf_registro: "",
    art: "",
    data: new Date().toISOString().split("T")[0],
    area_classificada: false,
    atmosfera_agressiva: false,
    servico_essencial: false,
    // Dados físicos do SPDA
    tipo_spda: "nao_isolado" as "isolado" | "nao_isolado",
    possui_spda: true,
    spda_obrigatorio: true,
    ocupacao: "",
    idade_edificio: "",
    acesso_topo_seguro: true,
    topo_acessado: true,
    avaliacao_visual: "bom" as "bom" | "regular" | "ruim",
    elementos_fora_zona: false,
    quais_elementos_fora: "",
    elementos_mais_altos: false,
    possui_antena: false,
    luz_piloto: false,
    obs_luz_piloto: "",
    // Captores
    tipo_captor: "franklin" as "franklin" | "anel" | "faraday" | "misto",
    radioativo: false,
    altura_mastro: "",
    qtde_mastros: "",
    secao_mastro: "35mm²",
    condicao_mastro: "bom" as "bom" | "oxidado" | "quebrado" | "enferrujado" | "mal_fixado",
    anel_perimetral: false,
    secao_anel_perimetral: "35mm²",
    condicao_anel_perimetral: "bom",
    anel_atico: false,
    secao_anel_atico: "35mm²",
    condicao_anel_atico: "bom",
    // Descidas
    isoladores_disponiveis: false,
    condicao_isoladores: "bom",
    emendas_disponiveis: false,
    condicao_emendas: "bom",
    qtde_descidas: "",
    secao_descidas: "35mm²",
    espacamento_ok: true,
    distancia_gas_ok: true,
    // DPS/MPS
    classe_dps: "I_II" as "I" | "II" | "I_II" | "nao_informado" | "nao_existe",
    corrente_nominal_dps: "",
    spda_interligado_bep: true,
  });

  const [showGraficos, setShowGraficos] = useState(false);
  const [npGrafico, setNpGrafico] = useState("III");
  const [alturaCaptor, setAlturaCaptor] = useState(6);
  const [alturaEstrutura, setAlturaEstrutura] = useState(0);
  const [comprimentoEstr, setComprimentoEstr] = useState(0);
  const [larguraEstr, setLarguraEstr] = useState(0);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRemediacao | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    obterChecklist()
      .then(setChecklist)
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Erro ao carregar checklist. Verifique se o backend está rodando.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  function setResposta(codigo: string, status: string) {
    setRespostas((prev) => ({ ...prev, [codigo]: status }));
  }

  async function handleBuscarCEP(cep: string) {
    const d = cep.replace(/\D/g,"");
    if (d.length !== 8) return;
    setBuscandoCEP(true);
    const dados = await buscarCEP(cep);
    setBuscandoCEP(false);
    if (dados) {
      setDadosGerais(prev => ({
        ...prev,
        logradouro: dados.logradouro || prev.logradouro,
        bairro: dados.bairro || prev.bairro,
        cidade: dados.localidade || prev.cidade,
        uf: dados.uf || prev.uf,
        endereco: [dados.logradouro, prev.numero, dados.bairro, dados.localidade, dados.uf].filter(Boolean).join(", "),
      }));
    }
  }

  async function handleBuscarCNPJ() {
    setBuscandoCNPJ(true);
    const dados = await buscarCNPJBrasilAPI(dadosGerais.cnpj_cliente);
    setBuscandoCNPJ(false);
    if (dados) {
      setDadosGerais(prev => ({
        ...prev,
        cliente: dados.razao_social || prev.cliente,
        logradouro: dados.logradouro || prev.logradouro,
        bairro: dados.bairro || prev.bairro,
        cidade: dados.municipio || prev.cidade,
        uf: dados.uf || prev.uf,
        cep: dados.cep ? formatarCEP(dados.cep) : prev.cep,
        endereco: [dados.logradouro, dados.numero, dados.bairro, dados.municipio, dados.uf].filter(Boolean).join(", "),
      }));
    }
  }

  async function handleAnalisar() {
    setAnalisando(true);
    setError(null);
    try {
      const res = await analisarLaudo(respostas);
      setResultado(res);
      setTimeout(() => {
        document
          .getElementById("plano-remediacao")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao analisar");
    } finally {
      setAnalisando(false);
    }
  }

  async function handleGerarPdf() {
    setGerandoPdf(true);
    setError(null);
    try {
      const request: LaudoInspecaoPDFRequest = {
        projeto: {
          nome: dadosGerais.nome_projeto,
          cliente: dadosGerais.cliente || undefined,
          endereco: dadosGerais.endereco || undefined,
        },
        responsavel: {
          nome: dadosGerais.inspetor_nome || "Engenheiro(a) Responsável",
          registro: dadosGerais.inspetor_registro || "CREA/CAU/CFT nº ________",
          art: dadosGerais.art || "________",
        },
        respostas,
        fotos,
        area_classificada: dadosGerais.area_classificada,
        atmosfera_agressiva: dadosGerais.atmosfera_agressiva,
        servico_essencial: dadosGerais.servico_essencial,
      };

      const blob = await gerarPDFLaudoInspecao(request);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laudo_inspecao_${dadosGerais.nome_projeto}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Erro ao gerar PDF: ${e.message}`
          : "Erro ao gerar PDF",
      );
    } finally {
      setGerandoPdf(false);
    }
  }

  const total = Object.values(checklist).flat().length;
  const respondidos = Object.values(respostas).filter((r) => r).length;
  const conformes = Object.values(respostas).filter(
    (r) => r === "CONFORME",
  ).length;
  const naoConformes = Object.values(respostas).filter(
    (r) => r === "NAO_CONFORME",
  ).length;
  const percentual = respondidos > 0 ? (conformes / respondidos) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (error && Object.keys(checklist).length === 0) {
    return (
      <Card className="border-danger/50 bg-danger-muted">
        <CardContent className="pt-6">
          <p className="text-sm text-danger">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Badge variant="primary" className="mb-2">
            <ClipboardList className="w-3 h-3" />
            NBR 5419-3 §7 e NBR 5419-4 §9
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Laudo de Inspeção
          </h1>
          <InfoProfissional />
          <p className="text-sm text-foreground-muted mt-1 max-w-2xl">
            Checklist normativo de 30 itens com upload de fotos e plano
            automático de remediação. Gere PDF profissional ao final.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleGerarPdf}
          disabled={gerandoPdf || respondidos === 0}
          className="shrink-0"
        >
          {gerandoPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Gerar PDF do laudo
        </Button>
      </div>

      {/* Erro global */}
      {error && Object.keys(checklist).length > 0 && (
        <Card className="border-danger/50 bg-danger-muted">
          <CardContent className="pt-5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo de progresso */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {respondidos}/{total}
            </div>
            <p className="text-xs text-foreground-muted">Itens avaliados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-success">{conformes}</div>
            <p className="text-xs text-foreground-muted">Conformes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-danger">{naoConformes}</div>
            <p className="text-xs text-foreground-muted">Não conformes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{percentual.toFixed(0)}%</div>
            <p className="text-xs text-foreground-muted">Conformidade</p>
          </CardContent>
        </Card>
      </div>

      {/* Dados gerais */}
      <Card>
        <CardHeader>
          <CardTitle>Dados da inspeção</CardTitle>
          <CardDescription>
            Esses dados vão para a capa e seção 2 do PDF
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Nome do projeto *</Label>
            <Input
              value={dadosGerais.nome_projeto}
              onChange={(e) =>
                setDadosGerais({ ...dadosGerais, nome_projeto: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Cliente</Label>
            <Input
              value={dadosGerais.cliente}
              onChange={(e) =>
                setDadosGerais({ ...dadosGerais, cliente: e.target.value })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço</Label>
            <Input
              value={dadosGerais.endereco}
              onChange={(e) =>
                setDadosGerais({ ...dadosGerais, endereco: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Inspetor responsável</Label>
            <Input
              value={dadosGerais.inspetor_nome}
              onChange={(e) =>
                setDadosGerais({
                  ...dadosGerais,
                  inspetor_nome: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label>Registro (CREA/CFT)</Label>
            <Input
              value={dadosGerais.inspetor_registro}
              onChange={(e) =>
                setDadosGerais({
                  ...dadosGerais,
                  inspetor_registro: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label>ART nº</Label>
            <Input
              value={dadosGerais.art}
              onChange={(e) =>
                setDadosGerais({ ...dadosGerais, art: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Data da inspeção</Label>
            <Input
              type="date"
              value={dadosGerais.data}
              onChange={(e) =>
                setDadosGerais({ ...dadosGerais, data: e.target.value })
              }
            />
          </div>

          {/* Flags para cálculo da periodicidade da próxima inspeção */}
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border-subtle">
            <div className="text-[10px] text-foreground-muted uppercase col-span-full">
              Periodicidade (NBR 5419-3 §7.3.2.f)
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={dadosGerais.area_classificada}
                onChange={(e) =>
                  setDadosGerais({
                    ...dadosGerais,
                    area_classificada: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-primary"
              />
              Área classificada
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={dadosGerais.atmosfera_agressiva}
                onChange={(e) =>
                  setDadosGerais({
                    ...dadosGerais,
                    atmosfera_agressiva: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-primary"
              />
              Atmosfera agressiva
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={dadosGerais.servico_essencial}
                onChange={(e) =>
                  setDadosGerais({
                    ...dadosGerais,
                    servico_essencial: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-primary"
              />
              Serviço essencial
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Checklist por categoria */}
      {Object.entries(checklist).map(([categoria, itens]: [string, any[]]) => (
        <Card key={categoria}>
          <CardHeader>
            <CardTitle className="text-base">
              {CATEGORIAS_LABEL[categoria] ?? categoria}
            </CardTitle>
            <CardDescription>{itens.length} itens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {itens.map((item) => {
              const status = respostas[item.codigo];
              return (
                <div
                  key={item.codigo}
                  className="p-4 rounded-lg border border-border-subtle"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono">
                          {item.codigo}
                        </Badge>
                        {!item.obrigatorio && (
                          <Badge variant="outline" className="text-[10px]">
                            Opcional
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm mt-2">
                        {item.descricao}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-foreground-muted mt-1">
                        <BookOpen className="w-3 h-3" />
                        <span>
                          {item.norma} — {item.referencia_normativa}
                        </span>
                      </div>
                      {item.observacoes && (
                        <p className="text-[10px] text-foreground-muted mt-1 italic">
                          {item.observacoes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={status === "CONFORME" ? "success" : "outline"}
                      onClick={() => setResposta(item.codigo, "CONFORME")}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Conforme
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        status === "NAO_CONFORME" ? "destructive" : "outline"
                      }
                      onClick={() => setResposta(item.codigo, "NAO_CONFORME")}
                    >
                      <XCircle className="w-4 h-4" /> Não conforme
                    </Button>
                    <Button
                      size="sm"
                      variant={status === "NA" ? "secondary" : "outline"}
                      onClick={() => setResposta(item.codigo, "NA")}
                    >
                      <MinusCircle className="w-4 h-4" /> N/A
                    </Button>
                  </div>

                  {/* Upload de fotos deste item */}
                  <FotoUpload
                    codigoItem={item.codigo}
                    fotos={fotos}
                    onChange={setFotos}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}



      {/* Gráficos de proteção — cálculo normativo completo (NBR 5419-3 Tabela A.1) */}
      <div className="mt-6 space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">📊 Ângulo de proteção — Cálculo normativo</p>
          <button type="button" onClick={() => setShowGraficos(s => !s)}
            className="text-xs text-primary hover:underline">
            {showGraficos ? "Ocultar gráficos" : "Mostrar gráficos"}
          </button>
        </div>

        {/* Dimensões da edificação para cálculo do perímetro e ângulo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-foreground-muted font-medium">Nível de Proteção (NP)</label>
            <select value={npGrafico} onChange={e => setNpGrafico(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-1">
              {(["I","II","III","IV"] as ("I"|"II"|"III"|"IV")[]).map(n => <option key={n} value={n}>NP {n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-foreground-muted font-medium">h₁ — Altura do captor/mastro (m)</label>
            <input type="number" min={1} max={60} value={alturaCaptor}
              onChange={e => setAlturaCaptor(Number(e.target.value))}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-1"/>
          </div>
          <div>
            <label className="text-foreground-muted font-medium">H — Altura da estrutura (m)</label>
            <input type="number" min={0} max={500} value={alturaEstrutura}
              onChange={e => setAlturaEstrutura(Number(e.target.value))}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-1"/>
          </div>
          <div>
            <label className="text-foreground-muted font-medium">L — Comprimento da planta (m)</label>
            <input type="number" min={0} max={1000} value={comprimentoEstr}
              onChange={e => setComprimentoEstr(Number(e.target.value))}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-1"/>
          </div>
          <div>
            <label className="text-foreground-muted font-medium">W — Largura da planta (m)</label>
            <input type="number" min={0} max={1000} value={larguraEstr}
              onChange={e => setLarguraEstr(Number(e.target.value))}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-1"/>
          </div>
          {/* Perímetro calculado */}
          {comprimentoEstr > 0 && larguraEstr > 0 && (
            <div className="flex flex-col justify-end pb-1">
              <span className="text-foreground-muted font-medium">Perímetro calculado</span>
              <span className="font-mono font-bold text-primary text-sm mt-1">
                {(2*(comprimentoEstr+larguraEstr)).toFixed(1)} m
              </span>
              <span className="text-foreground-muted text-[10px]">
                Semidiag.: {Math.sqrt((comprimentoEstr/2)**2+(larguraEstr/2)**2).toFixed(2)} m
              </span>
            </div>
          )}
        </div>

        {/* Gráficos */}
        {showGraficos && (
          <GraficosProtecao
            np={npGrafico}
            alturaCaptor={alturaCaptor}
            alturaEstrutura={alturaEstrutura}
            comprimento={comprimentoEstr}
            largura={larguraEstr}
          />
        )}
      </div>

      {/* Barra de ação sticky */}
      <div className="sticky bottom-4 flex flex-col sm:flex-row justify-end gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={handleGerarPdf}
          disabled={gerandoPdf || respondidos === 0}
        >
          {gerandoPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Gerar PDF ({fotos.length} foto{fotos.length !== 1 ? "s" : ""})
        </Button>
        <Button
          size="lg"
          onClick={handleAnalisar}
          disabled={analisando || respondidos === 0}
        >
          {analisando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Analisando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Gerar plano de 100%
            </>
          )}
        </Button>
      </div>

      {/* Plano de remediação */}
      {resultado && (
        <div id="plano-remediacao" className="pt-8 border-t border-border-subtle">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-bold">
              Caminho para 100% de conformidade
            </h2>
          </div>
          <PlanoRemediacao resultado={resultado} />
        </div>
      )}
    </div>
  );
}