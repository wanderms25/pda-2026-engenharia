"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/components/ui";
import { Sliders, AlertCircle, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/api";
import { getFeatureFlags, setFeatureFlags, type FeatureFlag } from "@/lib/feature-flags";

export default function FuncionalidadesPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [saved, setSaved] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    setAuthed(u?.role === "ADMIN");
    setFlags(getFeatureFlags());
  }, []);

  function toggle(id: string) {
    const updated = flags.map(f => f.id === id ? { ...f, habilitado: !f.habilitado } : f);
    setFlags(updated);
    setFeatureFlags(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!authed) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Funcionalidades</h1>
      <Card><CardContent className="p-8 text-center text-foreground-muted">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" /> Acesso restrito a administradores.
      </CardContent></Card>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Badge variant={"outline" as any} className="mb-2 gap-1"><Sliders className="w-3 h-3" /> Admin</Badge>
        <h1 className="text-2xl font-bold">Controle de Funcionalidades</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Funcionalidades desabilitadas ficam ocultas para usuários comuns. Administradores veem tudo.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          <CheckCircle2 className="w-4 h-4" /> Configuração salva automaticamente.
        </div>
      )}

      <div className="space-y-2">
        {flags.map(flag => (
          <Card key={flag.id} className={`transition-opacity ${flag.habilitado ? "" : "opacity-60"}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {flag.label}
                    <Badge variant={"outline" as any} className="text-[10px] font-mono">{flag.href}</Badge>
                  </div>
                  <div className="text-xs text-foreground-muted mt-0.5">{flag.descricao}</div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <span className="text-xs text-foreground-muted">{flag.habilitado ? "Ativo" : "Desativado"}</span>
                  <div
                    onClick={() => toggle(flag.id)}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${flag.habilitado ? "bg-primary" : "bg-border"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${flag.habilitado ? "translate-x-5" : "translate-x-0.5"}`}/>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-foreground-muted">
        As configurações são salvas localmente no navegador do administrador e aplicadas para todos os usuários que acessarem o sistema neste dispositivo/servidor.
      </p>
    </div>
  );
}
