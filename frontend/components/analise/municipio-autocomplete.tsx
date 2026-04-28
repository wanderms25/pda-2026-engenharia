"use client";

import { useState, useEffect, useRef } from "react";
import { Input, Badge } from "@/components/ui";
import { MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface MunicipioResult {
  municipio_uf: string;
  NG: number;
  nome: string;
  uf: string;
}

interface Props {
  uf: string;
  value?: string;
  onChange: (municipio: string, ngVal: number) => void;
}

export function MunicipioAutocomplete({ uf, value, onChange }: Props) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<MunicipioResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value ?? ""); }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2 || !open) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `${API_BASE_URL}/ng/buscar?q=${encodeURIComponent(query)}&uf=${uf}&limit=10`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setResults(data.resultados ?? []);
        }
      } catch (error) {
        console.error("Erro ao buscar municípios:", error);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, uf, open]);

  const handleSelect = (m: MunicipioResult) => {
    setQuery(m.municipio_uf);
    onChange(m.municipio_uf, m.NG);
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Input
          placeholder="Buscar município..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="pl-9"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
      </div>
      {open && (query.length >= 2 || loading) && (
        <div className="absolute z-50 w-full mt-2 rounded-xl border border-border bg-background/95 backdrop-blur-xl shadow-lg max-h-60 overflow-auto">
          {loading && <div className="p-3 text-xs text-foreground-muted text-center">Buscando...</div>}
          {!loading && results.length === 0 && (
            <div className="p-3 text-xs text-foreground-muted text-center">Nenhum município encontrado em {uf}</div>
          )}
          {results.map((m) => (
            <button key={m.municipio_uf} type="button" onClick={() => handleSelect(m)}
              className={cn("w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left",
                "hover:bg-primary/10 transition-colors text-sm",
                "border-b border-border-subtle last:border-0")}>
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
                <span className="truncate">{m.municipio_uf}</span>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">NG {m.NG}</Badge>
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-foreground-muted mt-1">Valores conforme NBR 5419-2:2026</p>
    </div>
  );
}
