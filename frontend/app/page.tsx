"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Zap,
  ShieldCheck,
  ClipboardList,
  Layers,
  MapPin,
  Sparkles,
  FileText,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Github,
  Code,
  Database,
  Lock,
  TrendingDown,
  Users,
  Menu,
  X,
} from "lucide-react";
import { Button, Badge, Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/api";

// =============================================================================
// TOPBAR fixa com login no canto superior direito
// =============================================================================
function Topbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsLogged(!!getCurrentUser());
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border-subtle"
          : "bg-transparent",
      )}
    >
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/apresentacao" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Zap
              className="w-5 h-5 text-primary-foreground"
              strokeWidth={2.5}
            />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight tracking-tight">
              PDA NBR 5419
            </div>
            <div className="text-[9px] text-foreground-muted uppercase tracking-wider">
              Edição 2026
            </div>
          </div>
        </Link>

        {/* Nav links desktop */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-foreground-muted">
          <a href="#features" className="hover:text-foreground transition-colors">
            Recursos
          </a>
          <a href="#exemplos" className="hover:text-foreground transition-colors">
            Exemplos
          </a>
          <a href="#normas" className="hover:text-foreground transition-colors">
            Normas
          </a>
          <a href="#docs" className="hover:text-foreground transition-colors">
            Documentação
          </a>
        </nav>

        {/* CTA login no canto direito */}
        <div className="flex items-center gap-2">
          {mounted && isLogged ? (
            <Button asChild>
              <Link href="/login">
                Abrir sistema <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/login">
                Entrar <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-card"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border-subtle bg-background/95 backdrop-blur-xl">
          <nav className="container py-4 flex flex-col gap-3 text-sm">
            <a href="#features" onClick={() => setMobileOpen(false)}>
              Recursos
            </a>
            <a href="#exemplos" onClick={() => setMobileOpen(false)}>
              Exemplos
            </a>
            <a href="#normas" onClick={() => setMobileOpen(false)}>
              Normas
            </a>
            <a href="#docs" onClick={() => setMobileOpen(false)}>
              Documentação
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

// =============================================================================
// HERO
// =============================================================================
function Hero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="container relative">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="primary" className="mb-2">
            <Sparkles className="w-3 h-3" />
            ABNT NBR 5419:2026 — Partes 1, 2, 3 e 4
          </Badge>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
            Análise de risco contra
            <br />
            <span className="bg-gradient-to-br from-primary via-primary to-primary/50 bg-clip-text text-transparent">
              descargas atmosféricas
            </span>
            <br />
            <span className="text-foreground-muted text-2xl sm:text-3xl lg:text-4xl font-medium">
              automatizada, auditável e conforme a norma
            </span>
          </h1>

          <p className="text-base sm:text-lg text-foreground-muted max-w-2xl mx-auto leading-relaxed">
            Sistema completo de análise de risco, dimensionamento de SPDA/MPS e
            laudo técnico conforme ABNT NBR 5419:2026. Recomendação automática
            de proteção, remediação inteligente e base oficial de 5.524
            municípios do Anexo F.
          </p>

          <div className="flex flex-wrap gap-3 justify-center pt-4">
            <Button asChild size="lg">
              <Link href="/login">
                Acessar o sistema <ArrowRight className="w-5 h-5 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#features"> <BookOpen className="w-5 h-5" />
                Ver recursos
              </a>
            </Button>
          </div>

          {/* Stats inline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-12 max-w-3xl mx-auto">
            <Stat numero="5.524" label="Municípios (Anexo F)" />
            <Stat numero="30" label="Itens de checklist" />
            <Stat numero="100%" label="Cobertura normativa" />
            <Stat numero="4" label="Partes da NBR" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ numero, label }: { numero: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
        {numero}
      </div>
      <div className="text-xs text-foreground-muted mt-1 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}

// =============================================================================
// FEATURES
// =============================================================================
const features = [
  {
    icon: ShieldCheck,
    title: "Análise de risco R1/R3",
    description:
      "Cálculo completo dos componentes RA a RZ seguindo os Anexos A, B e C. Avaliação automática contra os valores toleráveis RT da Tabela 4.",
    badge: "NBR 5419-2 §6",
  },
  {
    icon: Sparkles,
    title: "Recomendação automática",
    description:
      "Dado R > RT, o motor testa 12 configurações possíveis e retorna a mínima que atinge 100% de conformidade, com passo-a-passo e citação normativa.",
    badge: "Engine próprio",
  },
  {
    icon: MapPin,
    title: "Anexo F oficial — 5.524 municípios",
    description:
      "Valores de NG (raios/km²/ano) extraídos diretamente da Tabela F.1 da norma. Autocomplete com busca por nome e UF.",
    badge: "Tabela F.1",
  },
  {
    icon: Layers,
    title: "Análise multi-zona",
    description:
      "Divida a estrutura em zonas homogêneas (ZS) conforme Seção 6.7. Componentes somados automaticamente conforme §6.9.3.",
    badge: "NBR 5419-2 §6.7",
  },
  {
    icon: ClipboardList,
    title: "Laudo de inspeção guiado",
    description:
      "Checklist normativo de 30 itens com upload de fotos georreferenciadas e geração automática do plano de remediação por prioridade.",
    badge: "NBR 5419-3 §7",
  },
  {
    icon: TrendingDown,
    title: "Remediação inteligente",
    description:
      "Para cada item não-conforme, o sistema gera automaticamente ações corretivas com prazo (imediato/curto/preventivo), custo relativo e citação da norma.",
    badge: "Playbook 30 ações",
  },
  {
    icon: FileText,
    title: "PDF profissional",
    description:
      "Geração de laudo técnico A4 com capa neutra, memória de cálculo, anexo fotográfico e bloco de assinatura para o responsável técnico.",
    badge: "WeasyPrint",
  },
  {
    icon: Lock,
    title: "Auditoria e persistência",
    description:
      "Cada análise é imutável — apenas versionada. CRUD protegido por JWT, gerenciamento de usuários pelo admin com senha aleatória e validade.",
    badge: "PostgreSQL",
  },
  {
    icon: Code,
    title: "100% conforme norma",
    description:
      "R2 substituído por frequência de danos F (§7). NG exclusivamente do Anexo F. Terminologia NP I-IV (não mais 'Classe').",
    badge: "Edição 2026",
  },
];

function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <Badge variant="primary" className="mb-3">
            <Sparkles className="w-3 h-3" />
            Recursos
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Tudo que você precisa para um
            <br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              laudo técnico impecável
            </span>
          </h2>
          <p className="text-foreground-muted">
            Os cálculos mais complexos da norma automatizados, com a memória de
            cálculo sempre auditável e a citação normativa em cada passo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Card
                key={i}
                className="hover:bg-card-hover hover:border-primary/40 transition-all duration-200"
              >
                <CardContent className="p-6">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-xs text-foreground-muted leading-relaxed mb-3">
                    {f.description}
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {f.badge}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// EXEMPLOS — cards ilustrativos dos fluxos principais
// =============================================================================
function Exemplos() {
  return (
    <section id="exemplos" className="py-20 sm:py-28 bg-background-alt/30">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <Badge variant="primary" className="mb-3">
            <Database className="w-3 h-3" />
            Exemplos
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Fluxos principais em ação
          </h2>
          <p className="text-foreground-muted">
            Três casos de uso reais que cobrem o dia-a-dia de um engenheiro
            responsável técnico.
          </p>
        </div>

        <div className="space-y-8">
          {/* Exemplo 1: hospital em SP */}
          <ExemploCard
            numero="01"
            titulo="Hospital 40x25x15 m em São Paulo"
            descricao="Estrutura hospitalar típica isolada, NG = 18 (valor oficial do Anexo F para SP-SP), 500 pessoas, atendimento crítico."
            passos={[
              {
                label: "Sem proteção",
                valor: "R1 = 3,13×10⁻⁴",
                status: "danger",
                nota: "31× acima do RT (10⁻⁵)",
              },
              {
                label: "Recomendação automática",
                valor: "SPDA NP I + DPS NP I",
                status: "info",
                nota: "12 configurações testadas pelo motor",
              },
              {
                label: "Com proteção",
                valor: "R1 = 5,53×10⁻⁶",
                status: "success",
                nota: "Conforme — redução de ~56×",
              },
            ]}
          />

          {/* Exemplo 2: laudo de inspeção */}
          <ExemploCard
            numero="02"
            titulo="Laudo de inspeção com remediação automática"
            descricao="Checklist normativo de 30 itens cobrindo captação, descidas, aterramento, equipotencialização, distâncias de segurança e MPS/DPS."
            passos={[
              {
                label: "Avaliação",
                valor: "30 itens verificados",
                status: "info",
                nota: "Cada item com foto e GPS",
              },
              {
                label: "Não-conformidades",
                valor: "Plano de ação gerado",
                status: "danger",
                nota: "Imediato / curto prazo / preventivo",
              },
              {
                label: "Resultado",
                valor: "PDF com 4 seções",
                status: "success",
                nota: "Capa + checklist + remediação + fotos",
              },
            ]}
          />

          {/* Exemplo 3: multi-zona */}
          <ExemploCard
            numero="03"
            titulo="Análise multi-zona de edifício misto"
            descricao="Estrutura comercial com três zonas homogêneas: área administrativa, data center e depósito — cada uma com características distintas."
            passos={[
              {
                label: "Divisão",
                valor: "3 zonas de estudo (ZS)",
                status: "info",
                nota: "Seção 6.7 da NBR 5419-2",
              },
              {
                label: "Cálculo",
                valor: "Componentes por zona",
                status: "info",
                nota: "Piso, pessoas e MPS distintos",
              },
              {
                label: "Consolidação",
                valor: "R1 total = ∑ R1(ZS)",
                status: "success",
                nota: "Conforme §6.9.3 da norma",
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function ExemploCard({
  numero,
  titulo,
  descricao,
  passos,
}: {
  numero: string;
  titulo: string;
  descricao: string;
  passos: {
    label: string;
    valor: string;
    status: "success" | "danger" | "info";
    nota: string;
  }[];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-0">
        {/* Número grande lateral */}
        <div className="bg-gradient-primary p-8 lg:p-10 flex items-center justify-center">
          <div className="text-6xl sm:text-7xl font-bold text-primary-foreground/90 tracking-tight">
            {numero}
          </div>
        </div>

        {/* Conteúdo */}
        <CardContent className="p-6 sm:p-8">
          <h3 className="text-xl font-bold tracking-tight mb-2">{titulo}</h3>
          <p className="text-sm text-foreground-muted mb-6">{descricao}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {passos.map((p, i) => {
              const colorClass = {
                success: "border-success/40 bg-success/5",
                danger: "border-danger/40 bg-danger/5",
                info: "border-primary/40 bg-primary/5",
              }[p.status];
              const textColor = {
                success: "text-success",
                danger: "text-danger",
                info: "text-primary",
              }[p.status];
              return (
                <div
                  key={i}
                  className={cn("rounded-lg border p-3", colorClass)}
                >
                  <div className="text-[10px] uppercase tracking-wide text-foreground-muted">
                    {p.label}
                  </div>
                  <div className={cn("font-bold text-sm mt-1", textColor)}>
                    {p.valor}
                  </div>
                  <div className="text-[10px] text-foreground-muted mt-1">
                    {p.nota}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// =============================================================================
// NORMAS / cobertura normativa
// =============================================================================
const partes = [
  {
    numero: "Parte 1",
    titulo: "Princípios gerais",
    items: [
      "Níveis de proteção NP I-IV (Tabela 1)",
      "Parâmetros máximos e mínimos da corrente (Tabelas 3-5)",
      "Terminologia e definições",
    ],
  },
  {
    numero: "Parte 2",
    titulo: "Análise de risco",
    items: [
      "Áreas de exposição AD, ADJ, AM, AL, AI (Anexo A)",
      "Probabilidades PA..PZ (Anexo B completo)",
      "Perdas LA..LZ para L1, L3 e L4 (Anexos C e D)",
      "5.524 municípios do Anexo F / Tabela F.1 oficial",
    ],
  },
  {
    numero: "Parte 3",
    titulo: "Danos físicos",
    items: [
      "Esfera rolante, malha e ângulo (Tabela 2)",
      "Dimensionamento automático de descidas (Tabela 5)",
      "Distância de segurança s (Equação 5)",
      "Checklist normativo de inspeção (Seção 7)",
    ],
  },
  {
    numero: "Parte 4",
    titulo: "Sistemas internos",
    items: [
      "Zonas de proteção ZPR 0A/0B/1/2/3",
      "Classes de DPS I, II, III",
      "Sistema coordenado de DPS (Anexo C)",
      "Checklist de inspeção das MPS (§9.2)",
    ],
  },
];

function Normas() {
  return (
    <section id="normas" className="py-20 sm:py-28">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <Badge variant="primary" className="mb-3">
            <BookOpen className="w-3 h-3" />
            Cobertura normativa
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Conforme em cada passo
          </h2>
          <p className="text-foreground-muted">
            Todas as tabelas, equações e procedimentos das 4 Partes da
            ABNT NBR 5419:2026 estão implementados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {partes.map((p) => (
            <Card key={p.numero}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="primary">{p.numero}</Badge>
                  <h3 className="font-semibold text-base">{p.titulo ?? ""}</h3>
                </div>
                <ul className="space-y-2">
                  {p.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 items-start text-sm text-foreground-muted"
                    >
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-success" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// DOCS — mini-guia de uso
// =============================================================================
const docs = [
  {
    passo: "1",
    titulo: "Login",
    texto:
      "Administrador recebe credenciais geradas no startup. Usuários comuns são criados pelo admin com senha aleatória e validade definida.",
  },
  {
    passo: "2",
    titulo: "Cadastro do cliente",
    texto:
      "Digite o CNPJ e clique em Buscar — a BrasilAPI preenche automaticamente razão social, endereço, e-mail e telefone.",
  },
  {
    passo: "3",
    titulo: "Análise de risco",
    texto:
      "Autocomplete de município do Anexo F, simulador de proteção SPDA/DPS e recomendação automática para atingir 100% de conformidade.",
  },
  {
    passo: "4",
    titulo: "Laudo de inspeção",
    texto:
      "Checklist de 30 itens com upload de fotos georreferenciadas. O plano de remediação é gerado automaticamente.",
  },
  {
    passo: "5",
    titulo: "PDF profissional",
    texto:
      "Gere o PDF A4 com capa neutra, memória de cálculo completa, anexo fotográfico e bloco de assinatura para o responsável técnico.",
  },
  {
    passo: "6",
    titulo: "Auditoria",
    texto:
      "Cada análise é imutável e versionada. O histórico fica disponível para fiscalização e atualização posterior.",
  },
];

function Docs() {
  return (
    <section id="docs" className="py-20 sm:py-28 bg-background-alt/30">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <Badge variant="primary" className="mb-3">
            <BookOpen className="w-3 h-3" />
            Documentação
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Começe em 6 passos
          </h2>
          <p className="text-foreground-muted">
            Do cadastro inicial ao PDF do laudo, o fluxo é direto e guiado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {docs.map((d) => (
            <div
              key={d.passo}
              className="relative rounded-xl border border-border-subtle bg-card p-6 hover:border-primary/40 transition-colors"
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-glow">
                {d.passo}
              </div>
              <h3 className="font-semibold text-base mt-2 mb-2">{d.titulo ?? ""}</h3>
              <p className="text-xs text-foreground-muted leading-relaxed">
                {d.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// CTA FINAL
// =============================================================================
function CTAFinal() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container">
        <Card className="relative overflow-hidden border-primary/30">
          <div className="absolute inset-0 hero-gradient" />
          <CardContent className="relative p-10 sm:p-16 text-center">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Zap
                  className="w-7 h-7 text-primary-foreground"
                  strokeWidth={2.5}
                />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Pronto para começar?
              </h2>
              <p className="text-foreground-muted">
                Acesse o sistema com suas credenciais de administrador ou
                solicite um acesso técnico.
              </p>
              <div className="flex flex-wrap gap-3 justify-center pt-2">
                <Button asChild size="lg">
                  <Link href="/login">
                    Entrar no sistema <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// =============================================================================
// FOOTER
// =============================================================================
function Footer() {
  return (
    <footer className="border-t border-border-subtle py-10">
      <div className="container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-foreground-muted">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap
                className="w-4 h-4 text-primary-foreground"
                strokeWidth={2.5}
              />
            </div>
            <div>
              <div className="font-semibold text-foreground">PDA NBR 5419 v0.7.8</div>
              <div>ABNT NBR 5419:2026 — Partes 1, 2, 3 e 4</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span>FastAPI + Next.js 14</span>
            <span>·</span>
            <span>PostgreSQL</span>
            <span>·</span>
            <span>WeasyPrint</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// =============================================================================
// PÁGINA PRINCIPAL
// =============================================================================
export default function ApresentacaoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Topbar />
      <Hero />
      <Features />
      <Exemplos />
      <Normas />
      <Docs />
      <CTAFinal />
      <Footer />
    </div>
  );
}
