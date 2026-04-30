"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFeatureFlags } from "@/lib/feature-flags";
import { navigation } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [flags, setFlags] = useState(() =>
    typeof window !== "undefined" ? getFeatureFlags() : [],
  );
  const items = navigation.filter((item) => {
    const flag = flags.find((f) => f.href === item.href);
    return !flag || flag.habilitado;
  });

  // Fecha o drawer quando navegar
  useEffect(() => {
    setOpen(false);
    setFlags(getFeatureFlags());
  }, [pathname]);

  useEffect(() => {
    const onFlagsUpdated = () => setFlags(getFeatureFlags());
    window.addEventListener("storage", onFlagsUpdated);
    window.addEventListener("pda-feature-flags-updated", onFlagsUpdated);
    return () => {
      window.removeEventListener("storage", onFlagsUpdated);
      window.removeEventListener("pda-feature-flags-updated", onFlagsUpdated);
    };
  }, []);

  // Bloqueia scroll do body quando drawer aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Botão hamburger — apenas mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-card transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in"
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 h-full w-72 bg-background-alt border-r border-border-subtle flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do drawer */}
            <div className="flex items-center justify-between p-5 border-b border-border-subtle">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                  <Zap
                    className="w-5 h-5 text-primary-foreground"
                    strokeWidth={2.5}
                  />
                </div>
                <div>
                  <div className="font-bold text-sm leading-tight">
                    PDA NBR 5419
                  </div>
                  <div className="text-[10px] text-foreground-muted uppercase tracking-wider">
                    Edição 2026
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-card transition-colors"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium",
                      "transition-all",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground-muted hover:bg-card hover:text-foreground",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-border-subtle text-[10px] text-foreground-muted">
              <div className="font-medium text-foreground/70">
                PDA NBR 5419 v0.5.0
              </div>
              <div>ABNT NBR 5419:2026</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
