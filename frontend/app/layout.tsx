import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "PDA NBR 5419:2026 | Análise de Risco & Laudos",
  description:
    "Sistema completo de análise de risco, projeto de SPDA/MPS e laudo técnico conforme ABNT NBR 5419:2026.",
  viewport:
    "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark h-full">
      <body className="h-full">
        <AuthGuard>
          <AppShell>{children}</AppShell>
        </AuthGuard>
      </body>
    </html>
  );
}
