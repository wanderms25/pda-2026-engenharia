"use client";
import { useState, useEffect } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label,
} from "@/components/ui";
import { Lock, Loader2, ShieldCheck, LogOut } from "lucide-react";
import { trocarSenha, logout, getCurrentUser, type UsuarioInfo } from "@/lib/api";

interface Props {
  user?: UsuarioInfo;
  primeiroAcesso?: boolean;
  onSuccess?: (user: UsuarioInfo) => void;
}

export function TrocarSenhaScreen({
  user: userProp,
  primeiroAcesso = true,
  onSuccess,
}: Props) {
  const [user, setUser] = useState<UsuarioInfo | null>(userProp ?? null);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirma, setSenhaConfirma] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!user) setUser(getCurrentUser());
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (senhaNova !== senhaConfirma) {
      setError("A confirmação da senha não confere.");
      return;
    }
    if (senhaNova.length < 8) {
      setError("A senha nova deve ter ao menos 8 caracteres.");
      return;
    }
    if (senhaNova === senhaAtual) {
      setError("A senha nova deve ser diferente da atual.");
      return;
    }
    setLoading(true);
    try {
      const result = await trocarSenha(senhaAtual, senhaNova);
      setSucesso(true);
      if (onSuccess) {
        onSuccess(result);
      } else {
        // Default: reload to trigger auth re-check
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao trocar senha");
    } finally {
      setLoading(false);
    }
  }

  function handleCancelar() {
    logout();
    window.location.href = "/";
  }

  if (sucesso) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-green-500 mx-auto" />
          <p className="font-medium">Senha alterada com sucesso!</p>
          <p className="text-xs text-foreground-muted">Redirecionando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          {primeiroAcesso ? "Defina sua senha" : "Trocar senha"}
        </CardTitle>
        <CardDescription>
          {primeiroAcesso
            ? "Crie uma senha forte para proteger sua conta."
            : "Digite sua senha atual e escolha uma nova."}
          {user?.nome && (
            <span className="block mt-1 font-medium text-foreground">{user.nome}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!primeiroAcesso && (
            <div>
              <Label>Senha atual</Label>
              <Input
                type="password"
                value={senhaAtual}
                onChange={e => setSenhaAtual(e.target.value)}
                required
                disabled={loading}
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={senhaNova}
              onChange={e => setSenhaNova(e.target.value)}
              minLength={8}
              required
              disabled={loading}
              className="mt-1"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <Label>Confirme a nova senha</Label>
            <Input
              type="password"
              value={senhaConfirma}
              onChange={e => setSenhaConfirma(e.target.value)}
              minLength={8}
              required
              disabled={loading}
              className="mt-1"
            />
          </div>
          {error && (
            <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleCancelar}
              disabled={loading}
            >
              <LogOut className="w-4 h-4 mr-1" /> Sair
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : "Salvar senha"
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
