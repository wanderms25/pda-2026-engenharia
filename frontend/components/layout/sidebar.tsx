"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Ruler,
  History,
  Pencil,
  Settings,
  ShieldCheck,
  ClipboardList,
  FileText,
  FileCheck2,
  Zap,
  Layers,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/api";
import { getFeatureFlags } from "@/lib/feature-flags";

/**
 * Entradas base do menu (visíveis a todos os usuários autenticados).
 * A entrada "Admin" é adicionada dinamicamente só para role=ADMIN.
 */
export const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Histórico", href: "/historico", icon: History },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Projetos", href: "/projetos", icon: FolderKanban },
  { name: "Análise de Risco", href: "/analise-risco", icon: ShieldCheck },
  { name: "Zonas de Estudo", href: "/zonas", icon: Layers },
  { name: "Dimensionamento", href: "/dimensionamento", icon: Ruler },
  { name: "Laudo de Inspeção", href: "/laudo", icon: ClipboardList },
  { name: "PIE - Instalações Elétricas", href: "/prontuario-instalacoes-eletricas", icon: FileCheck2 },
  { name: "Relatórios", href: "/relatorios", icon: FileText },
];

const adminNavItems = [
  { name: "Admin", href: "/admin", icon: Shield },
  { name: "Editor da Página", href: "/admin/editor", icon: Pencil },
  { name: "Funcionalidades", href: "/admin/funcionalidades", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setIsAdmin(user?.role === "ADMIN");
  }, [pathname]);

  // Filter nav items based on feature flags (admin sees all)
  const flags = typeof window !== "undefined" ? getFeatureFlags() : [];
  const items = isAdmin
    ? [...navigation, ...adminNavItems]
    : navigation.filter(item => {
        const flag = flags.find(f => f.href === item.href);
        return !flag || flag.habilitado;
      });

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col bg-background-alt/40 backdrop-blur-xl border-r border-border-subtle">
      {/* Logo */}
      <div className="p-6 border-b border-border-subtle">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Zap className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-bold text-base leading-tight tracking-tight">
              PDA NBR 5419
            </div>
            <div className="text-[10px] text-foreground-muted uppercase tracking-wider">
              Edição 2026
            </div>
          </div>
        </Link>
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const isAdminLink = item.href === "/admin";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium",
                "transition-all duration-150 group relative",
                isActive
                  ? isAdminLink
                    ? "bg-warning/10 text-warning shadow-[inset_3px_0_0_0_hsl(var(--warning))]"
                    : "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                  : "text-foreground-muted hover:bg-card hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 transition-transform",
                  isActive ? "scale-110" : "group-hover:scale-110",
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div className="p-4 border-t border-border-subtle text-[10px] text-foreground-muted">
        <div className="font-medium text-foreground/70">PDA NBR 5419 v0.6.0</div>
        <div>ABNT NBR 5419:2026</div>
        <div>Partes 1, 2, 3 e 4</div>
      </div>
    </aside>
  );
}
