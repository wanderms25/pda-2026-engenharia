// lib/validacoes.ts – CPF, CNPJ, telefone, email, CEP, campos numéricos
import { API_BASE_URL } from "@/lib/config";
const soDigitos = (v: string) => v.replace(/\D/g, "");

// ── CPF ──────────────────────────────────────────────────────────────
export function validarCPF(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || new Set(d).size === 1) return false;
  for (let i = 0; i < 2; i++) {
    let s = 0;
    for (let j = 0; j < 9 + i; j++) s += Number(d[j]) * (10 + i - j);
    let r = (s * 10) % 11; if (r === 10) r = 0;
    if (r !== Number(d[9 + i])) return false;
  }
  return true;
}
export function formatarCPF(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
}

// ── CNPJ ─────────────────────────────────────────────────────────────
export function validarCNPJ(cnpj: string): boolean {
  const d = soDigitos(cnpj);
  if (d.length !== 14 || new Set(d).size === 1) return false;
  const p1 = [5,4,3,2,9,8,7,6,5,4,3,2], p2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const dig = (nums: string, pw: number[]) => {
    const s = nums.split("").reduce((a,n,i) => a + Number(n)*pw[i], 0);
    const r = s % 11; return r < 2 ? 0 : 11 - r;
  };
  return dig(d.slice(0,12), p1) === Number(d[12]) && dig(d.slice(0,13), p2) === Number(d[13]);
}
export function formatarCNPJ(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}

// ── Telefone ──────────────────────────────────────────────────────────
export function formatarTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
}
export function validarTelefone(v: string): boolean {
  return [10,11].includes(soDigitos(v).length);
}

// ── Email ─────────────────────────────────────────────────────────────
export function validarEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// ── CEP ───────────────────────────────────────────────────────────────
export function formatarCEP(v: string): string {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d;
}
export function validarCEP(v: string): boolean { return soDigitos(v).length === 8; }

// ── Numérico ──────────────────────────────────────────────────────────
export function somenteNumerico(v: string): string {
  return v.replace(/[^0-9.,]/g, "").replace(",", ".");
}
export function parseFlutuante(v: string): number | null {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

// ── BrasilAPI CNPJ ────────────────────────────────────────────────────
export interface DadosCNPJ {
  razao_social: string; nome_fantasia?: string; email?: string;
  telefone?: string; logradouro?: string; numero?: string;
  complemento?: string; bairro?: string; municipio?: string;
  uf?: string; cep?: string; situacao_cadastral?: string;
}
export async function buscarCNPJBrasilAPI(cnpj: string): Promise<DadosCNPJ | null> {
  const d = soDigitos(cnpj);
  if (d.length !== 14) return null;
  try {
    // Proxy backend seguro — sem CORS, com timeout, rate limiting server-side
    const res = await fetch(`${API_BASE_URL}/util/cnpj/${d}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return await res.json() as DadosCNPJ;
  } catch { return null; }
}

// ── BrasilAPI CEP ─────────────────────────────────────────────────────────
export interface DadosCEP {
  cep: string; logradouro: string; complemento?: string;
  bairro: string; localidade: string; uf: string; ibge?: string;
}

export async function buscarCEP(cep: string): Promise<DadosCEP | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    // Proxy backend seguro — sem CORS, com timeout, rate limiting server-side
    const res = await fetch(`${API_BASE_URL}/util/cep/${d}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json() as DadosCEP;
  } catch { return null; }
}

// GPS por endereço (Nominatim OpenStreetMap — gratuito, sem API key)
export interface CoordsGPS { lat: number; lng: number; display: string; }

export async function buscarGPSPorEndereco(endereco: string): Promise<CoordsGPS | null> {
  if (!endereco || endereco.length < 5) return null;
  try {
    const q = encodeURIComponent(endereco + ", Brasil");
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`,
      { headers: { "Accept-Language": "pt-BR", "User-Agent": "pda-nbr5419/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
  } catch { return null; }
}
