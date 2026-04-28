// lib/historico.ts — Histórico de análises em localStorage

export interface AnaliseHistorico {
  id: string;
  nome_projeto: string;
  criado_em: string;
  R1: number;
  R3: number;
  conforme: boolean;
  tipo: "analise" | "laudo";
}

const STORAGE_KEY = "pda_historico_analises";

export function salvarAnaliseNoHistorico(
  analise: Omit<AnaliseHistorico, "id" | "criado_em">
): void {
  if (typeof window === "undefined") return;
  try {
    const existing: AnaliseHistorico[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    const nova: AnaliseHistorico = {
      ...analise,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      criado_em: new Date().toISOString(),
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([nova, ...existing].slice(0, 50))
    );
  } catch {
    // localStorage may be blocked in private mode
  }
}

export function listarAnaliseHistorico(): AnaliseHistorico[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function removerAnaliseHistorico(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = listarAnaliseHistorico();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(existing.filter(a => a.id !== id))
    );
  } catch {}
}
