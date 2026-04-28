"use client";
import { useEffect, useState } from "react";
import { getCurrentUser, type UsuarioInfo } from "@/lib/api";
import { ShieldCheck, Building2, Phone, Mail } from "lucide-react";

/**
 * Exibe os dados do profissional logado (nome, empresa, conselho, ART).
 * Aparece no topo dos formulários de laudo e análise de risco.
 */
export default function InfoProfissional({ art }: { art?: string }) {
  const [user, setUser] = useState<UsuarioInfo | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  if (!user) return null;

  const reg = (() => {
    const tipo = (user as any).tipo_registro;
    const num  = (user as any).numero_registro;
    const uf   = (user as any).uf_profissional;
    // Only show CREA/CFT/CRT — CAU is architecture, not relevant for SPDA
    const tipoLabel = tipo === "CAU" ? "CREA" : tipo;  // fallback for old data
    if (tipoLabel && num && uf) return `${tipoLabel}-${uf} Nº ${num}`;
    const tl = tipo === "CAU" ? "CREA" : tipo;
    if (tl && num)       return `${tl} Nº ${num}`;
    return user.registro_profissional || null;
  })();

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-background-secondary border border-border-subtle text-sm">
      {(user as any).logo_base64 && (
        <img
          src={(user as any).logo_base64}
          alt="Logo"
          className="w-12 h-10 object-contain rounded border border-border bg-white shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="font-medium truncate">{user.nome}</div>
        {(user as any).empresa && (
          <div className="text-foreground-muted text-xs flex items-center gap-1 truncate">
            <Building2 className="w-3 h-3 shrink-0" />
            {(user as any).empresa}
          </div>
        )}
        {reg && (
          <div className="text-foreground-muted text-xs flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            {reg}
            {art && <span className="ml-2">· ART nº {art}</span>}
          </div>
        )}
        {((user as any).telefone || user.email) && (
          <div className="text-foreground-muted text-xs flex items-center gap-3">
            {(user as any).telefone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {(user as any).telefone}
              </span>
            )}
            {user.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" /> {user.email}
              </span>
            )}
          </div>
        )}
      </div>
      {!(user as any).numero_registro && (
        <a href="/perfil" className="text-[10px] text-primary hover:underline shrink-0">
          Completar perfil →
        </a>
      )}
    </div>
  );
}
