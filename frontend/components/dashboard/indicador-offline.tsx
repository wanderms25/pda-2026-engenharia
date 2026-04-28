"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { Wifi, WifiOff, CloudUpload, CheckCircle2 } from "lucide-react";
import { contarPendentes } from "@/lib/db-local";

export function IndicadorOffline() {
  const [online, setOnline] = useState(true);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    // Detecta status de conexão
    const atualizar = () => setOnline(navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);

    // Conta pendentes periodicamente
    const contar = async () => {
      try {
        setPendentes(await contarPendentes());
      } catch {
        // IndexedDB ainda não inicializado
      }
    };
    contar();
    const interval = setInterval(contar, 5000);

    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
      clearInterval(interval);
    };
  }, []);

  if (!online) {
    return (
      <Badge variant="warning" className="gap-1">
        <WifiOff className="w-3 h-3" />
        Modo offline {pendentes > 0 && `— ${pendentes} rascunhos`}
      </Badge>
    );
  }

  if (pendentes > 0) {
    return (
      <Badge variant="default" className="gap-1">
        <CloudUpload className="w-3 h-3" />
        {pendentes} rascunho(s) para sincronizar
      </Badge>
    );
  }

  return (
    <Badge variant="success" className="gap-1">
      <CheckCircle2 className="w-3 h-3" />
      Online e sincronizado
    </Badge>
  );
}
