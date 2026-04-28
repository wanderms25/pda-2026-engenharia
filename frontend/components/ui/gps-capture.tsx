"use client";
import { useState, useRef } from "react";
import { Button, Input, Label } from "@/components/ui";
import { MapPin, Navigation, Camera, Loader2, Upload } from "lucide-react";
import { buscarGPSPorEndereco } from "@/lib/validacoes";

interface GPSCaptureProps {
  lat?: number; lng?: number;
  onCapture: (lat: number, lng: number, display?: string) => void;
  onFoto?: (base64: string, nome: string) => void;
  endereco?: string;
  showCamera?: boolean;
}

export default function GPSCapture({ lat, lng, onCapture, onFoto, endereco, showCamera = true }: GPSCaptureProps) {
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function capturarGPSAtual() {
    if (!navigator.geolocation) { setMsg("GPS não disponível neste dispositivo."); return; }
    setBuscando(true); setMsg("Obtendo localização...");
    navigator.geolocation.getCurrentPosition(
      pos => {
        onCapture(pos.coords.latitude, pos.coords.longitude);
        setMsg(`GPS: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setBuscando(false);
      },
      err => { setMsg("Erro ao obter GPS: " + err.message); setBuscando(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function buscarPorEndereco() {
    if (!endereco || endereco.length < 5) { setMsg("Digite um endereço primeiro."); return; }
    setBuscando(true); setMsg("Buscando coordenadas...");
    const coords = await buscarGPSPorEndereco(endereco);
    setBuscando(false);
    if (coords) {
      onCapture(coords.lat, coords.lng, coords.display);
      setMsg(`Encontrado: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    } else {
      setMsg("Endereço não encontrado. Tente ser mais específico.");
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length || !onFoto) return;
    // Process each file
    files.forEach(file => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = `foto_obra_${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) onFoto(result, safeName);
      };
      reader.onerror = () => console.error("Erro ao ler foto:", file.name);
      reader.readAsDataURL(file);
    });
    // Reset input to allow selecting same file again
    e.target.value = "";
  }

  return (
    <div className="space-y-3 p-3 rounded-lg border border-border bg-background-secondary">
      <div className="text-xs font-medium text-foreground-muted flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-primary" /> Coordenadas GPS
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Latitude</Label>
          <Input value={lat?.toFixed(6) || ""} readOnly placeholder="—" className="h-8 text-xs font-mono" />
        </div>
        <div>
          <Label className="text-xs">Longitude</Label>
          <Input value={lng?.toFixed(6) || ""} readOnly placeholder="—" className="h-8 text-xs font-mono" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={capturarGPSAtual} disabled={buscando}>
          {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
          Usar GPS atual
        </Button>
        {endereco && (
          <Button type="button" variant="outline" size="sm" onClick={buscarPorEndereco} disabled={buscando}>
            <MapPin className="w-3.5 h-3.5" /> Pelo endereço
          </Button>
        )}
        {showCamera && onFoto && (
          <>
            {/* capture="environment" = câmera traseira em mobile */}
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera className="w-3.5 h-3.5" /> Foto / Câmera
            </Button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple
              className="hidden" onChange={handleFile} />
          </>
        )}
      </div>

      {msg && <p className="text-[10px] text-foreground-muted">{msg}</p>}
      {lat && lng && (
        <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-primary hover:underline flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Ver no Google Maps
        </a>
      )}
    </div>
  );
}