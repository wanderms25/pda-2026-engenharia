import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  StatCard,
} from "@/components/ui";
import {
  ShieldCheck,
  ClipboardList,
  FileText,
  Zap,
  AlertTriangle,
  ArrowRight,
  Layers,
  MapPin,
  CheckCircle2,
  Database,
  BookOpen,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* ==================================================================
          HERO
          ================================================================== */}
      <section className="relative overflow-hidden rounded-2xl hero-gradient border border-border-subtle p-8 sm:p-12">
        <div className="relative max-w-3xl space-y-4">
          <Badge variant="primary" className="mb-2">
            <Sparkles className="w-3 h-3" />
            Edição 2026 — Tabela F.1 completa
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            Análise de risco automatizada
            <br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              100% conforme NBR 5419
            </span>
          </h1>
          <p className="text-base sm:text-lg text-foreground-muted max-w-2xl">
            Sistema completo de análise de risco, dimensionamento de SPDA e
            laudo técnico. Recomendação automática de proteção, remediação
            inteligente do laudo e base de 5.524+ municípios do Anexo F oficial.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/analise-risco">
                <ShieldCheck className="w-5 h-5" />
                Nova análise
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/laudo">
                <ClipboardList className="w-5 h-5" />
                Novo laudo
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ==================================================================
          MÉTRICAS
          ================================================================== */}
      <section className="metrics-grid">
        <StatCard
          label="Municípios cadastrados"
          value="5.524"
          icon={<MapPin className="w-5 h-5" />}
          trend="Anexo F oficial"
          accent="primary"
        />
        <StatCard
          label="Itens de checklist"
          value="30"
          icon={<ClipboardList className="w-5 h-5" />}
          trend="100% cobertos"
          accent="success"
        />
        <StatCard
          label="Ações corretivas"
          value="30"
          icon={<Sparkles className="w-5 h-5" />}
          trend="Playbook completo"
          accent="warning"
        />
        <StatCard
          label="Partes cobertas"
          value="1-4"
          icon={<BookOpen className="w-5 h-5" />}
          trend="NBR 5419:2026"
          accent="primary"
        />
      </section>

      {/* ==================================================================
          AVISO NORMATIVO
          ================================================================== */}
      <Card className="border-warning/30 bg-warning-muted/20">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">
                Edição 2026 — principais mudanças em relação à 2015
              </CardTitle>
              <CardDescription className="mt-2 space-y-1">
                <p>
                  • <strong className="text-foreground">R2</strong> foi
                  substituído pela{" "}
                  <strong className="text-foreground">frequência de danos F</strong>
                </p>
                <p>
                  • Apenas <strong className="text-foreground">R1 e R3</strong>{" "}
                  são obrigatórios; R4 é informativo
                </p>
                <p>
                  • NG vem <strong className="text-foreground">exclusivamente</strong>{" "}
                  do Anexo F (Tabela F.1)
                </p>
                <p>
                  •{" "}
                  <strong className="text-foreground">
                    Medição de resistência de aterramento
                  </strong>{" "}
                  não é mais requisito para eficácia do SPDA (7.1.4)
                </p>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ==================================================================
          AÇÕES RÁPIDAS
          ================================================================== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Ações rápidas
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionCard
            href="/analise-risco"
            icon={<ShieldCheck className="w-5 h-5" />}
            title="Análise de Risco"
            description="Calcule R1, R3 e F com recomendação automática da configuração mínima para 100% de conformidade."
            norma="NBR 5419-2:2026"
          />
          <ActionCard
            href="/zonas"
            icon={<Layers className="w-5 h-5" />}
            title="Zonas de Estudo"
            description="Divida a estrutura em zonas homogêneas (ZS) conforme Seção 6.7 para análise multi-zona."
            norma="NBR 5419-2 §6.7"
          />
          <ActionCard
            href="/laudo"
            icon={<ClipboardList className="w-5 h-5" />}
            title="Laudo de Inspeção"
            description="Checklist normativo com 30 itens e plano de remediação automática com citação normativa."
            norma="NBR 5419-3 §7 / -4 §9"
          />
          <ActionCard
            href="/projetos"
            icon={<Database className="w-5 h-5" />}
            title="Projetos e Clientes"
            description="CRUD de clientes, estruturas e histórico versionado de análises (auditoria)."
            norma="Persistência PostgreSQL"
          />
          <ActionCard
            href="/relatorios"
            icon={<FileText className="w-5 h-5" />}
            title="Relatórios PDF"
            description="Geração automática de PDF A4 profissional com capa, memória de cálculo e anexo fotográfico."
            norma="WeasyPrint + Jinja2"
          />
          <ActionCard
            href="/login"
            icon={<Zap className="w-5 h-5" />}
            title="Acesso ao sistema"
            description="Autenticação JWT, CRUD protegido e rotas de auditoria para uso profissional."
            norma="Auth + ART"
          />
        </div>
      </section>

      {/* ==================================================================
          COBERTURA NORMATIVA
          ================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Cobertura normativa implementada
          </CardTitle>
          <CardDescription>
            Todas as tabelas e equações principais das 4 Partes da NBR 5419:2026
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CoverageItem
            parte="Parte 1"
            titulo="Princípios gerais"
            items={[
              "Níveis de proteção NP I-IV (Tabela 1)",
              "Parâmetros máximos e mínimos da corrente (Tabelas 3, 4, 5)",
              "Terminologia e definições",
            ]}
          />
          <CoverageItem
            parte="Parte 2"
            titulo="Análise de risco"
            items={[
              "Áreas de exposição AD, ADJ, AM, AL, AI (Anexo A)",
              "Probabilidades PA..PZ (Anexo B completo)",
              "Perdas LA..LZ para L1, L3 e L4 (Anexos C e D)",
              "Componentes RA..RZ e riscos R1, R3, R4 (Seção 6)",
              "Frequência de danos F — substitui R2 (Seção 7)",
              "5.524 municípios do Anexo F / Tabela F.1",
            ]}
          />
          <CoverageItem
            parte="Parte 3"
            titulo="Danos físicos a estruturas"
            items={[
              "Raio da esfera rolante, malha e ângulo (Tabela 2)",
              "Dimensionamento automático de descidas (Tabela 5)",
              "Distância de segurança s (Equação 5)",
              "Materiais e seções mínimas (Tabela 7)",
              "Checklist normativo de inspeção (Seção 7)",
              "Periodicidade de inspeção (7.3.2.f)",
            ]}
          />
          <CoverageItem
            parte="Parte 4"
            titulo="Sistemas elétricos e eletrônicos internos"
            items={[
              "Zonas de proteção ZPR 0A/0B/1/2/3",
              "Classes de DPS I, II, III",
              "Sistema coordenado de DPS (Anexo C)",
              "Etapas do projeto de MPS (Anexo B.3)",
              "Checklist de inspeção das MPS (Seção 9.2)",
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
  norma,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  norma: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full hover:bg-card-hover hover:border-primary/40 transition-all duration-200">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              {icon}
            </div>
            <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-semibold text-base tracking-tight">{title}</h3>
            <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
              {description}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {norma}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

function CoverageItem({
  parte,
  titulo,
  items,
}: {
  parte: string;
  titulo: string;
  items: string[];
}) {
  return (
    <div className="flex gap-4 pb-4 border-b border-border-subtle last:border-0 last:pb-0">
      <div className="shrink-0">
        <Badge variant="primary">{parte}</Badge>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm">{titulo}</h4>
        <ul className="mt-1.5 space-y-1 text-xs text-foreground-muted">
          {items.map((item) => (
            <li key={item} className="flex gap-2 items-start">
              <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-success" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
