"use client";

import { useState, useRef } from "react";
import { Button, Badge } from "@/components/ui";
import { Camera, X, Image as ImageIcon, MapPin } from "lucide-react";
import type { FotoLaudoInput } from "@/lib/api";

interface Props {
  codigoItem: string;
  fotos: FotoLaudoInput[];
  onChange: (fotos: FotoLaudoInput[]) => void;
}

/**
 * Converte File para data URI base64.
 */
function fileParaDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Captura geolocalização do dispositivo (sem bloquear se falhar).
 */
function capturarLocalizacao(): Promise<
  { latitude: number; longitude: number } | null
> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 4000 },
    );
  });
}

export function FotoUpload({ codigoItem, fotos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Fotos deste item específico
  const fotosDoItem = fotos.filter((f) => f.codigo_item === codigoItem);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const geo = await capturarLocalizacao();

      const novasFotos: FotoLaudoInput[] = [];
      for (const file of Array.from(files) as File[]) {
        // Limite 5 MB por arquivo
        if (file.size > 5 * 1024 * 1024) {
          alert(`Arquivo ${file.name} excede 5 MB e foi ignorado.`);
          continue;
        }
        const data_uri = await fileParaDataURI(file);
        novasFotos.push({
          codigo_item: codigoItem,
          legenda: file.name,
          data_uri,
          latitude: geo?.latitude,
          longitude: geo?.longitude,
        });
      }
      onChange([...fotos, ...novasFotos]);
    } catch (err) {
      alert(
        `Erro ao processar imagem: ${err instanceof Error ? err.message : "desconhecido"}`,
      );
    } finally {
      setUploading(false);
      // Limpa o input para permitir re-upload do mesmo arquivo
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removerFoto(index: number) {
    // Pega o index GLOBAL (na lista completa de fotos) a partir do index LOCAL
    const foto = fotosDoItem[index];
    const globalIndex = fotos.findIndex((f) => f === foto);
    if (globalIndex === -1) return;
    const novasFotos = [...fotos];
    novasFotos.splice(globalIndex, 1);
    onChange(novasFotos);
  }

  return (
    <div className="mt-3 space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="w-4 h-4" />
          {uploading ? "Processando..." : "Adicionar foto"}
        </Button>
        {fotosDoItem.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            <ImageIcon className="w-3 h-3" />
            {fotosDoItem.length} foto{fotosDoItem.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Preview das fotos */}
      {fotosDoItem.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {fotosDoItem.map((foto, i) => (
            <div
              key={i}
              className="relative group rounded-lg overflow-hidden border border-border-subtle bg-background-alt aspect-square"
            >
              <img
                src={foto.data_uri}
                alt={foto.legenda}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removerFoto(i)}
                className="absolute top-1 right-1 p-1 rounded-full bg-background/80 backdrop-blur hover:bg-danger hover:text-danger-foreground transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Remover foto"
              >
                <X className="w-3 h-3" />
              </button>
              {foto.latitude && foto.longitude && (
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur text-[9px] flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" />
                  GPS
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FotoUpload;