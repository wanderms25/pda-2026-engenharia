"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label } from "@/components/ui";
import { Loader2, Zap, AlertCircle, UserPlus, LogIn } from "lucide-react";
import { login } from "@/lib/api";

export function LoginScreen() {
  const [tab, setTab] = useState<"login" | "info">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, senha);
      // Hard navigation garante re-render completo do layout e auth-guard
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenciais inválidas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">PDA NBR 5419</div>
            <div className="text-xs text-foreground-muted">Edição 2026</div>
          </div>
        </div>

        <div className="flex rounded-lg border border-border p-1 gap-1">
          {(["login","info"] as ("login"|"info")[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground"
              }`}>
              {t === "login" ? <><LogIn className="w-3.5 h-3.5" /> Entrar</> : <><UserPlus className="w-3.5 h-3.5" /> Cadastro</>}
            </button>
          ))}
        </div>

        {tab === "login" ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Acesso ao sistema</CardTitle>
              <CardDescription className="text-xs">Digite suas credenciais para continuar.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com" required autoComplete="email" disabled={loading} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Senha</Label>
                  <Input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                    required autoComplete="current-password" disabled={loading} className="mt-1" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</> : "Entrar no sistema"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" /> Novo cadastro
              </CardTitle>
              <CardDescription className="text-xs">
                O cadastro é realizado pelo administrador do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-2">
                <p className="font-medium">Como obter acesso:</p>
                <ol className="list-decimal list-inside space-y-1 text-foreground-muted">
                  <li>Contate o administrador do sistema</li>
                  <li>Forneça nome, e-mail e nº do CREA/CAU</li>
                  <li>Receba a senha temporária por e-mail</li>
                  <li>No primeiro acesso, crie sua senha definitiva</li>
                </ol>
              </div>
              <Button variant="outline" className="w-full" asChild><Link href="/cadastro">Solicitar cadastro</Link></Button>
              <Button variant="ghost" className="w-full text-xs" onClick={() => setTab("login")}>
                Voltar ao login
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-[10px] text-foreground-muted">
          PDA NBR 5419 v0.7.8 · ABNT NBR 5419:2026
        </p>
      </div>
    </div>
  );
}
