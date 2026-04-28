import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor de risco em notação científica legível.
 * Exemplo: 1.234e-5 -> "1,23 × 10⁻⁵"
 */
export function formatRisco(valor: number): string {
  if (valor === 0) return "0";
  const expoente = Math.floor(Math.log10(Math.abs(valor)));
  const mantissa = valor / Math.pow(10, expoente);
  const sobrescritos: Record<string, string> = {
    "-": "⁻",
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  };
  const expStr = expoente
    .toString()
    .split("")
    .map((c) => sobrescritos[c] ?? c)
    .join("");
  return `${mantissa.toFixed(2).replace(".", ",")} × 10${expStr}`;
}
