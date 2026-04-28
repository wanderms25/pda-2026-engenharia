// lib/feature-flags.ts — Controle de funcionalidades pelo admin
// Flags salvas no localStorage e lidas pelo sidebar/auth-guard

export interface FeatureFlag {
  id: string;
  label: string;
  descricao: string;
  href: string;
  habilitado: boolean;
  apenasAdmin?: boolean;
}

export const FLAGS_DEFAULT: FeatureFlag[] = [
  { id:"analise_risco",   label:"Análise de Risco",      descricao:"Análise R1/R3 conforme NBR 5419-2",     href:"/analise-risco",    habilitado:true },
  { id:"dimensionamento", label:"Dimensionamento",        descricao:"CAD SPDA e dimensionamento normativo",  href:"/dimensionamento",  habilitado:true },
  { id:"laudo",           label:"Laudo de Inspeção",      descricao:"Checklist e laudo de SPDA",             href:"/laudo",            habilitado:true },
  { id:"clientes",        label:"Clientes",               descricao:"Cadastro de clientes PF/PJ",            href:"/clientes",         habilitado:true },
  { id:"projetos",        label:"Projetos",               descricao:"Gestão de projetos",                    href:"/projetos",         habilitado:true },
  { id:"zonas",           label:"Zonas de Estudo",        descricao:"Definição de zonas protegidas",         href:"/zonas",            habilitado:true },
  { id:"historico",       label:"Histórico",              descricao:"Análises e laudos salvos",              href:"/historico",        habilitado:true },
  { id:"relatorios",      label:"Relatórios",             descricao:"Geração de PDFs",                       href:"/relatorios",       habilitado:true },
];

const STORAGE_KEY = "pda_feature_flags";

export function getFeatureFlags(): FeatureFlag[] {
  if (typeof window === "undefined") return FLAGS_DEFAULT;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return FLAGS_DEFAULT;
    const parsed = JSON.parse(stored) as FeatureFlag[];
    // Merge with defaults to handle new flags added later
    return FLAGS_DEFAULT.map(def => {
      const stored = parsed.find(f => f.id === def.id);
      return stored ? { ...def, habilitado: stored.habilitado } : def;
    });
  } catch {
    return FLAGS_DEFAULT;
  }
}

export function setFeatureFlags(flags: FeatureFlag[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {}
}

export function isFlagEnabled(id: string): boolean {
  return getFeatureFlags().find(f => f.id === id)?.habilitado ?? true;
}
