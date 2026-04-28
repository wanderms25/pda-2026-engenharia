"use client";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui";
import { Ruler } from "lucide-react";

const SpdaDimensionamento = dynamic(
  () => import("@/components/laudo/spda-dimensionamento"),
  { ssr: false }
);
const CadSPDA = dynamic(
  () => import("@/components/laudo/cad-spda"),
  { ssr: false }
);

export default function DimensionamentoPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="primary" className="mb-2">
          <Ruler className="w-3 h-3" />
          NBR 5419-3:2026
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Dimensionamento SPDA
        </h1>
        <p className="text-sm text-foreground-muted mt-1">
          Cálculo de perímetro, descidas, ângulo de proteção e planta interativa.
        </p>
      </div>
      <SpdaDimensionamento npRecomendado="II" />
      <CadSPDA />
    </div>
  );
}
