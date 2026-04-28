"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Select,
  Badge,
} from "@/components/ui";
import {
  Layers,
  Plus,
  Trash2,
  Info,
  BookOpen,
  Calculator,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatRisco } from "@/lib/utils";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface Zona {
  id: string;
  nome: string;
  tipo_piso: string;
  risco_incendio: string;
  providencias_incendio: string;
  perigo_especial: string;
  tipo_construcao: string;
  numero_pessoas_zona: number;
  numero_pessoas_total: number;
  horas_ano_presenca: number;
  spda_nivel: string;
  dps_coordenados_nivel: string;
}

interface ZonaResultado {
  id: string;
  nome: string;
  componentes: Record<string, number>;
  R1_parcial: number;
}

interface ResultadoMulti {
  componentes_totais: Record<string, number>;
  R1_total: number;
  R3_total: number;
  zonas: ZonaResultado[];
  avaliacao: Array<{
    tipo_risco: string;
    valor_calculado: number;
    valor_tolerado: number;
    status: string;
  }>;
  exige_protecao: boolean;
}

function criarZona(index: number): Zona {
  return {
    id: crypto.randomUUID(),
    nome: `Zona ${index}`,
    tipo_piso: "MARMORE_CERAMICA",
    risco_incendio: "NORMAL",
    providencias_incendio: "AUTOMATICA",
    perigo_especial: "NENHUM",
    tipo_construcao: "ALV_CONCRETO",
    numero_pessoas_zona: 100,
    numero_pessoas_total: 100,
    horas_ano_presenca: 8760,
    spda_nivel: "NENHUM",
    dps_coordenados_nivel: "NENHUM",
  };
}

export default function ZonasPage() {
  const [nomeProjeto, setNomeProjeto] = useState("Projeto Multi-Zona");
  const [NG, setNG] = useState(18);
  const [L, setL] = useState(60);
  const [W, setW] = useState(40);
  const [H, setH] = useState(20);
  const [tipoEstrutura, setTipoEstrutura] = useState("HOSPITAL");
  const [localizacao, setLocalizacao] = useState("ISOLADA");

  const [zonas, setZonas] = useState<Zona[]>([criarZona(1)]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoMulti | null>(null);
  const [error, setError] = useState<string | null>(null);

  function adicionarZona() {
    setZonas([...zonas, criarZona(zonas.length + 1)]);
  }

  function removerZona(id: string) {
    if (zonas.length > 1) {
      setZonas(zonas.filter((z) => z.id !== id));
    }
  }

  function atualizarZona(id: string, patch: Partial<Zona>) {
    setZonas(zonas.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  async function calcular() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        nome_projeto: nomeProjeto,
        NG,
        dimensoes: { L, W, H },
        localizacao,
        tipo_estrutura: tipoEstrutura,
        comprimento_linha_m: 1000,
        instalacao_linha: "AEREO",
        tipo_linha: "BT_SINAL",
        ambiente_linha: "URBANO",
        tensao_UW_kV: 2.5,
        zonas: zonas.map((z) => ({
          ...z,
          numero_pessoas_total: Math.max(z.numero_pessoas_total, 1),
        })),
      };
      const response = await fetch(
        `${API_BASE_URL}/analise-risco/calcular-multi-zona`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail?.[0]?.msg ?? body?.detail ?? `Erro ${response.status}`,
        );
      }
      setResultado(await response.json());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erro ao calcular. Verifique se o backend está rodando.",
      );
    } finally {
      setLoading(false);
    }
  }

  const totalPessoas = zonas.reduce((acc, z) => acc + z.numero_pessoas_zona, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Badge variant="primary" className="mb-2">
          <Layers className="w-3 h-3" />
          NBR 5419-2:2026 §6.7
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Zonas de Estudo (ZS)
        </h1>
        <p className="text-sm text-foreground-muted mt-1 max-w-2xl">
          Divida a estrutura em zonas com características homogêneas. O risco
          total é a soma dos componentes de cada zona (Seção 6.9.3).
        </p>
      </div>

      {/* Explicação normativa */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                Quando dividir a estrutura em zonas?
              </CardTitle>
              <CardDescription className="mt-2">
                Divida quando houver diferença significativa em: tipo de piso (afeta RA, RU);
                compartimentos à prova de fogo (RB, RV); blindagem espacial (RC, RM);
                layout dos sistemas internos; medidas de proteção distintas.
              </CardDescription>
              <div className="flex items-center gap-1 text-[10px] text-primary mt-2">
                <BookOpen className="w-3 h-3" />
                NBR 5419-2:2026, 6.7.1, 6.7.2 e 6.9
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Dados gerais da estrutura */}
      <Card>
        <CardHeader>
          <CardTitle>Estrutura</CardTitle>
          <CardDescription>Parâmetros globais da estrutura</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Label>Nome do projeto</Label>
            <Input
              value={nomeProjeto}
              onChange={(e) => setNomeProjeto(e.target.value)}
            />
          </div>
          <div>
            <Label>NG (Anexo F)</Label>
            <Input
              type="number"
              step="0.5"
              value={NG}
              onChange={(e) => setNG(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>Tipo de estrutura</Label>
            <Select
              value={tipoEstrutura}
              onChange={(e) => setTipoEstrutura(e.target.value)}
            >
              <option value="HOSPITAL">Hospital</option>
              <option value="HOTEL">Hotel</option>
              <option value="ESCOLA">Escola</option>
              <option value="INDUSTRIAL">Industrial</option>
              <option value="COMERCIAL">Comercial</option>
              <option value="RESIDENCIAL">Residencial</option>
            </Select>
          </div>
          <div>
            <Label>Localização (CD)</Label>
            <Select
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
            >
              <option value="CERCADA_OBJETOS_MAIS_ALTOS">Cercada (0,25)</option>
              <option value="CERCADA_MESMA_ALTURA">Mesma altura (0,50)</option>
              <option value="ISOLADA">Isolada (1,00)</option>
              <option value="ISOLADA_TOPO_COLINA">Topo colina (2,00)</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2 lg:col-span-2">
            <div>
              <Label>L (m)</Label>
              <Input
                type="number"
                value={L}
                onChange={(e) => setL(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>W (m)</Label>
              <Input
                type="number"
                value={W}
                onChange={(e) => setW(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>H (m)</Label>
              <Input
                type="number"
                value={H}
                onChange={(e) => setH(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{zonas.length}</div>
            <p className="text-xs text-foreground-muted">Zonas definidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalPessoas}</div>
            <p className="text-xs text-foreground-muted">Total de pessoas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {zonas.length === 1 ? "Simples" : "Multi"}
            </div>
            <p className="text-xs text-foreground-muted">Modo análise</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de zonas */}
      <div className="space-y-4">
        {zonas.map((zona, index) => (
          <Card key={zona.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-base truncate">
                    Zona {index + 1}: {zona.nome}
                  </CardTitle>
                  <Badge variant="outline">ZS_{index + 1}</Badge>
                </div>
                {zonas.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removerZona(zona.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={zona.nome}
                  onChange={(e) =>
                    atualizarZona(zona.id, { nome: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Piso (rt)</Label>
                <Select
                  value={zona.tipo_piso}
                  onChange={(e) =>
                    atualizarZona(zona.id, { tipo_piso: e.target.value })
                  }
                >
                  <option value="TERRA_CONCRETO">Terra/concreto (10⁻²)</option>
                  <option value="MARMORE_CERAMICA">Mármore (10⁻³)</option>
                  <option value="BRITA_CARPETE">Brita/carpete (10⁻⁴)</option>
                  <option value="ASFALTO">Asfalto (10⁻⁵)</option>
                </Select>
              </div>
              <div>
                <Label>Risco incêndio</Label>
                <Select
                  value={zona.risco_incendio}
                  onChange={(e) =>
                    atualizarZona(zona.id, { risco_incendio: e.target.value })
                  }
                >
                  <option value="EXPLOSAO">Explosão</option>
                  <option value="ALTO">Alto</option>
                  <option value="NORMAL">Normal</option>
                  <option value="BAIXO">Baixo</option>
                </Select>
              </div>
              <div>
                <Label>Providências</Label>
                <Select
                  value={zona.providencias_incendio}
                  onChange={(e) =>
                    atualizarZona(zona.id, {
                      providencias_incendio: e.target.value,
                    })
                  }
                >
                  <option value="NENHUMA">Nenhuma</option>
                  <option value="EXTINTORES">Extintores</option>
                  <option value="HIDRANTES">Hidrantes</option>
                  <option value="AUTOMATICA">Automática</option>
                </Select>
              </div>
              <div>
                <Label>Pessoas na zona</Label>
                <Input
                  type="number"
                  value={zona.numero_pessoas_zona}
                  onChange={(e) =>
                    atualizarZona(zona.id, {
                      numero_pessoas_zona: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>Total da estrutura</Label>
                <Input
                  type="number"
                  value={zona.numero_pessoas_total}
                  onChange={(e) =>
                    atualizarZona(zona.id, {
                      numero_pessoas_total: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Label>SPDA da zona</Label>
                <Select
                  value={zona.spda_nivel}
                  onChange={(e) =>
                    atualizarZona(zona.id, { spda_nivel: e.target.value })
                  }
                >
                  <option value="NENHUM">Sem SPDA</option>
                  <option value="IV">NP IV</option>
                  <option value="III">NP III</option>
                  <option value="II">NP II</option>
                  <option value="I">NP I</option>
                </Select>
              </div>
              <div>
                <Label>DPS da zona</Label>
                <Select
                  value={zona.dps_coordenados_nivel}
                  onChange={(e) =>
                    atualizarZona(zona.id, {
                      dps_coordenados_nivel: e.target.value,
                    })
                  }
                >
                  <option value="NENHUM">Sem DPS</option>
                  <option value="IV">NP IV</option>
                  <option value="II">NP II</option>
                  <option value="I">NP I</option>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <Button variant="outline" onClick={adicionarZona}>
          <Plus className="w-4 h-4" /> Adicionar zona
        </Button>
        <Button size="lg" onClick={calcular} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Calculando...
            </>
          ) : (
            <>
              <Calculator className="w-4 h-4" /> Calcular risco por zona
            </>
          )}
        </Button>
      </div>

      {/* Erro */}
      {error && (
        <Card className="border-danger/50 bg-danger-muted">
          <CardContent className="pt-6">
            <p className="text-sm text-danger">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {resultado && (
        <Card
          className={
            resultado.exige_protecao
              ? "border-danger/50 bg-danger-muted/30"
              : "border-success/50 bg-success-muted/30"
          }
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              {resultado.exige_protecao ? (
                <XCircle className="w-8 h-8 text-danger" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-success" />
              )}
              <div>
                <CardTitle>
                  R1 total = {formatRisco(resultado.R1_total)}
                </CardTitle>
                <CardDescription>
                  Soma dos componentes de {resultado.zonas.length} zona(s)
                  conforme NBR 5419-2:2026, 6.9.3
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(resultado.componentes_totais).map(([k, v]: [string, number]) => (
                <div
                  key={k}
                  className="p-2 rounded-lg border border-border-subtle bg-background-alt text-center"
                >
                  <div className="text-[10px] text-foreground-muted uppercase">
                    {k}
                  </div>
                  <div className="font-mono text-[10px]">{formatRisco(v)}</div>
                </div>
              ))}
            </div>

            {/* Detalhamento por zona */}
            <div className="space-y-2 mt-4 pt-4 border-t border-border-subtle">
              <div className="text-xs font-semibold text-foreground-muted uppercase">
                Contribuição por zona
              </div>
              {resultado.zonas.map((z) => (
                <div
                  key={z.id}
                  className="flex items-center justify-between p-2 rounded border border-border-subtle"
                >
                  <div className="text-xs font-medium">{z.nome}</div>
                  <div className="font-mono text-xs">
                    {formatRisco(z.R1_parcial)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}