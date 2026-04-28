"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardContent, Button, Input, Badge } from "@/components/ui";
import { FileText, Search, Edit, Trash2, Clock, Shield, Loader2 } from "lucide-react";
import { isAuthenticated } from "@/lib/api";
import { listarAnaliseHistorico, removerAnaliseHistorico, type AnaliseHistorico } from "@/lib/historico";

function fmtRisco(v: number) {
  if (!v || isNaN(v)) return "—";
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const coef = (v / Math.pow(10, exp)).toFixed(2);
  return `${coef}×10^${exp}`;
}

export default function HistoricoPage() {
  const router = useRouter();
  const [analises, setAnalises] = useState<AnaliseHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
    setAnalises(listarAnaliseHistorico());
    setLoading(false);
  }, []);

  function handleDeletar(id: string) {
    removerAnaliseHistorico(id);
    setAnalises(prev => prev.filter(a => a.id !== id));
  }

  const filtradas = analises.filter(a =>
    a.nome_projeto.toLowerCase().includes(busca.toLowerCase())
  );

  if (!authed && !loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Histórico</h1>
        <Card>
          <CardContent className="p-8 text-center text-foreground-muted">
            Faça login para ver o histórico.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Badge variant={"outline" as any} className="mb-2 gap-1">
          <Clock className="w-3 h-3" /> Histórico
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Análises e Laudos</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Histórico salvo automaticamente ao calcular. Clique em editar para reabrir.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        <Input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por projeto..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      ) : filtradas.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-foreground-muted">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>
              {analises.length === 0
                ? "Nenhuma análise salva. Realize uma análise de risco para começar."
                : "Nenhum resultado para esta busca."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtradas.map(a => (
            <Card key={a.id} className="card-glass">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      a.conforme ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.nome_projeto}</div>
                      <div className="text-xs text-foreground-muted mt-0.5">
                        {new Date(a.criado_em).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                        {" · "}
                        <span>{a.tipo === "laudo" ? "Laudo" : "Análise de risco"}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs mt-1.5">
                        <span className="text-foreground-muted">
                          R1: <strong className={a.conforme ? "text-green-600" : "text-red-600"}>
                            {fmtRisco(a.R1)}
                          </strong>
                        </span>
                        <span className="text-foreground-muted">
                          R3: <strong>{fmtRisco(a.R3)}</strong>
                        </span>
                        <Badge
                          variant={"outline" as any}
                          className={`text-[10px] ${
                            a.conforme
                              ? "border-green-500 text-green-700"
                              : "border-red-400 text-red-600"
                          }`}
                        >
                          {a.conforme ? "✓ Conforme" : "✗ Não conforme"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { router.push(`/analise-risco?id=${a.id}`); router.refresh(); }}
                      title="Editar / reabrir"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletar(a.id)}
                      title="Remover do histórico"
                      className="hover:border-red-300 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {analises.length > 0 && (
        <p className="text-xs text-foreground-muted text-center">
          {analises.length} registro{analises.length !== 1 ? "s" : ""} salvos localmente.
        </p>
      )}
    </div>
  );
}
