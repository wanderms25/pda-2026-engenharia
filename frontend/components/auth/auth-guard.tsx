"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { getFeatureFlagForPath, getFeatureFlags } from "@/lib/feature-flags";
import { TrocarSenhaScreen } from "@/components/auth/trocar-senha-screen";
import { AlertTriangle, Home, Loader2, LockKeyhole, Settings } from "lucide-react";

const PUBLICAS = ["/", "/login", "/apresentacao", "/cadastro", "/termos", "/privacidade"];
const ROTAS_ADMIN = ["/admin"];

function isPublica(p: string) {
  return PUBLICAS.some(r => p === r || p.startsWith(`${r}/`));
}

function isAdminRoute(p: string) {
  return ROTAS_ADMIN.some(r => p === r || p.startsWith(`${r}/`));
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Se é rota pública, renderiza imediatamente sem loading
  if (isPublica(pathname)) {
    return <>{children}</>;
  }

  return <AuthGuardProtected>{children}</AuthGuardProtected>;
}

function AuthGuardProtected({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "temp-password">(() => {
    // Inicializa sem loading se já temos dados de auth em memória
    if (typeof window === "undefined") return "loading";
    const u = getCurrentUser();
    if (!u) return "loading"; // vai redirecionar
    if (u.senha_temporaria) return "temp-password";
    return "ok";
  });
  const [blockedFeature, setBlockedFeature] = useState<{ label: string; href: string } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      // Usa hard navigation para garantir re-render completo
      window.location.href = "/login";
      return;
    }
    if (u.senha_temporaria) {
      setState("temp-password");
      setBlockedFeature(null);
      return;
    }

    const flags = getFeatureFlags();
    const flag = getFeatureFlagForPath(pathname, flags);
    const rotaBloqueada = flag && !flag.habilitado && !isAdminRoute(pathname);

    setBlockedFeature(rotaBloqueada ? { label: flag.label, href: flag.href } : null);
    setState("ok");
  }, [pathname]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (state === "temp-password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <TrocarSenhaScreen />
      </div>
    );
  }

  if (blockedFeature) {
    const user = typeof window !== "undefined" ? getCurrentUser() : null;
    const isAdmin = user?.role === "ADMIN";

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-xl card-glass border border-border-subtle rounded-2xl p-8 text-center shadow-soft">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning mb-4">
            <AlertTriangle className="h-3.5 w-3.5" />
            Funcionalidade desabilitada
          </div>
          <h1 className="text-2xl font-bold text-foreground">Acesso bloqueado</h1>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">
            A aba <strong className="text-foreground">{blockedFeature.label}</strong> foi desabilitada pelo administrador.
            Enquanto estiver desabilitada, a rota fica travada mesmo quando acessada diretamente pela URL.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Home className="h-4 w-4" />
              Ir para o dashboard
            </Link>
            {isAdmin && (
              <Link
                href="/admin/funcionalidades"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-card/80 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Reativar funcionalidade
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
