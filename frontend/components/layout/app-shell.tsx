"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { IndicadorOffline } from "@/components/dashboard/indicador-offline";

// Rotas sem shell (sem sidebar/topbar) — layout próprio
const ROTAS_SEM_SHELL = ["/", "/login", "/apresentacao", "/cadastro", "/termos", "/privacidade"];

function isSemShell(pathname: string): boolean {
  return ROTAS_SEM_SHELL.some(r => pathname === r || pathname.startsWith(`${r}/`));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isSemShell(pathname)) {
    return <div className="h-full overflow-y-auto">{children}</div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 card-glass border-b border-border-subtle">
          <div className="container flex items-center justify-between h-14 gap-4">
            <MobileNav />
            <div className="flex-1 lg:hidden">
              <div className="font-semibold text-sm">PDA NBR 5419</div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <IndicadorOffline />
              <UserMenu />
            </div>
          </div>
        </header>
        {/* Rotas com layout próprio (sem container/padding) */}
        {pathname.startsWith("/analise-risco") ? (
          <div className="animate-in">{children}</div>
        ) : (
          <div className="container py-6 lg:py-8 pb-20 lg:pb-8 animate-in">
            {children}
          </div>
        )}
      </main>
    </div>
  );
}