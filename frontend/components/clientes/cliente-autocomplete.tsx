"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, Loader2, Search, UserRound, X } from "lucide-react";
import { listarClientes, type Cliente } from "@/lib/api";
import { Input } from "@/components/ui";

export function nomeCliente(cliente: Cliente): string {
  return cliente.nome_fantasia?.trim() || cliente.razao_social?.trim() || "Cliente sem nome";
}

export function documentoCliente(cliente: Cliente): string {
  return cliente.cpf_cnpj?.trim() || cliente.cnpj?.trim() || "";
}

export function emailCliente(cliente: Cliente): string {
  return cliente.email?.trim() || cliente.contato_email?.trim() || "";
}

export function telefoneCliente(cliente: Cliente): string {
  return cliente.telefone?.trim() || cliente.contato_telefone?.trim() || "";
}

export function responsavelCliente(cliente: Cliente): string {
  return cliente.responsavel?.trim() || cliente.contato_nome?.trim() || "";
}

export function enderecoCliente(cliente: Cliente): string {
  return [cliente.endereco, cliente.cidade, cliente.uf_cliente, cliente.cep].filter(Boolean).join(", ");
}

interface ClienteAutocompleteProps {
  label?: string;
  placeholder?: string;
  value?: string;
  className?: string;
  disabled?: boolean;
  onSelect: (cliente: Cliente) => void;
  onValueChange?: (value: string) => void;
}

export function ClienteAutocomplete({
  label = "Buscar cliente cadastrado",
  placeholder = "Digite nome, CPF/CNPJ, cidade ou e-mail...",
  value,
  className = "",
  disabled = false,
  onSelect,
  onValueChange,
}: ClienteAutocompleteProps) {
  const [query, setQuery] = useState(value ?? "");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    listarClientes()
      .then((lista) => {
        if (!ativo) return;
        setClientes(lista);
        setErro(null);
      })
      .catch(() => {
        if (!ativo) return;
        setErro("Não foi possível carregar os clientes cadastrados.");
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = clientes.slice().sort((a, b) => nomeCliente(a).localeCompare(nomeCliente(b)));
    if (!q) return base.slice(0, 8);
    return base
      .filter((cliente) => {
        const alvo = [
          cliente.razao_social,
          cliente.nome_fantasia,
          cliente.cpf_cnpj,
          cliente.cnpj,
          cliente.contato_email,
          cliente.email,
          cliente.contato_telefone,
          cliente.telefone,
          cliente.cidade,
          cliente.uf_cliente,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return alvo.includes(q);
      })
      .slice(0, 10);
  }, [clientes, query]);

  function selecionar(cliente: Cliente) {
    setQuery(nomeCliente(cliente));
    setOpen(false);
    onSelect(cliente);
  }

  function limpar() {
    setQuery("");
    onValueChange?.("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && <div className="text-[10px] font-bold text-foreground-muted uppercase tracking-wide mb-1">{label}</div>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
        <Input
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            onValueChange?.(next);
          }}
          placeholder={placeholder}
          className="pl-9 pr-10"
        />
        {query && (
          <button
            type="button"
            onClick={limpar}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
            aria-label="Limpar busca de cliente"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-background shadow-xl">
          <div className="max-h-80 overflow-y-auto p-1">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-foreground-muted">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando clientes...
              </div>
            )}

            {!loading && erro && <div className="px-3 py-3 text-xs text-danger">{erro}</div>}

            {!loading && !erro && filtrados.length === 0 && (
              <div className="px-3 py-3 text-xs text-foreground-muted">
                Nenhum cliente encontrado. Cadastre em Clientes e volte a buscar aqui.
              </div>
            )}

            {!loading &&
              !erro &&
              filtrados.map((cliente) => {
                const doc = documentoCliente(cliente);
                const endereco = enderecoCliente(cliente);
                const isPJ = (cliente.tipo_pessoa || "").toUpperCase() !== "PF";
                return (
                  <button
                    type="button"
                    key={cliente.id}
                    onClick={() => selecionar(cliente)}
                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {isPJ ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold text-foreground">{nomeCliente(cliente)}</div>
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary opacity-60" />
                        </div>
                        <div className="mt-0.5 truncate text-xs text-foreground-muted">
                          {[cliente.razao_social !== nomeCliente(cliente) ? cliente.razao_social : "", doc].filter(Boolean).join(" · ")}
                        </div>
                        {endereco && <div className="mt-0.5 truncate text-[11px] text-foreground-muted">{endereco}</div>}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
