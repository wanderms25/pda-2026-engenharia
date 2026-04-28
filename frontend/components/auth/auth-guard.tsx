"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getCurrentUser, isAuthenticated } from "@/lib/api";
import { TrocarSenhaScreen } from "@/components/auth/trocar-senha-screen";
import { Loader2 } from "lucide-react";

const PUBLICAS = ["/", "/login", "/apresentacao", "/cadastro", "/termos", "/privacidade"];

function isPublica(p: string) {
  return PUBLICAS.some(r => p === r || p.startsWith(`${r}/`));
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
    } else {
      setState("ok");
    }
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

  return <>{children}</>;
}
