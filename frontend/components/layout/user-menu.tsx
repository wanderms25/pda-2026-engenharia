"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  User,
  LogOut,
  ChevronDown,
  Shield,
  KeyRound,
  FolderKanban,
} from "lucide-react";
import { getCurrentUser, logout, type UsuarioInfo } from "@/lib/api";

export function UserMenu() {
  const [user, setUser] = useState<UsuarioInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setUser(getCurrentUser());
    const onStorage = () => setUser(getCurrentUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function handleLogout() {
    logout();
    // Reload força o AuthGuard a re-detectar o estado unauth
    window.location.reload();
  }

  // Durante SSR / hidratação, mostra placeholder neutro
  if (!mounted || !user) {
    return <div className="w-20 h-9" />;
  }

  const inicial = user.nome?.[0]?.toUpperCase() ?? "U";
  const primeiroNome = user.nome?.split(" ")[0] ?? user.email;
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-card transition-colors"
      >
        <div className="relative">
          <div className="w-7 h-7 rounded-full bg-gradient-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground shadow-glow">
            {inicial}
          </div>
          {isAdmin && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-warning border border-background flex items-center justify-center">
              <Shield className="w-2 h-2 text-warning-foreground" />
            </div>
          )}
        </div>
        <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
          {primeiroNome}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-foreground-muted hidden sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-background-alt/95 backdrop-blur-xl shadow-card-elevated z-40 animate-in overflow-hidden">
          <div className="p-3 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                {inicial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate flex items-center gap-1">
                  {user.nome}
                  {isAdmin && (
                    <Shield className="w-3 h-3 text-warning shrink-0" />
                  )}
                </div>
                <div className="text-[11px] text-foreground-muted truncate">
                  {user.email}
                </div>
                {user.registro_profissional && (
                  <div className="text-[10px] text-foreground-muted truncate mt-0.5">
                    {user.registro_profissional}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-1">
            <Link
              href="/perfil"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-card transition-colors"
              onClick={() => setOpen(false)}
            >
              <User className="w-4 h-4 text-foreground-muted" />
              Meu perfil
            </Link>
            <Link
              href="/projetos"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-card transition-colors"
              onClick={() => setOpen(false)}
            >
              <FolderKanban className="w-4 h-4 text-foreground-muted" />
              Meus projetos
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-card transition-colors"
                onClick={() => setOpen(false)}
              >
                <Shield className="w-4 h-4 text-warning" />
                Gerenciar usuários
              </Link>
            )}

            <div className="my-1 border-t border-border-subtle" />

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-danger-muted hover:text-danger transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
