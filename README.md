# PDA-NBR5419 v0.5.0

Sistema completo de análise de risco, projeto de SPDA/MPS e laudo técnico conforme **ABNT NBR 5419:2026 (Partes 1 a 4)**.

## Destaques desta versão

- **503 municípios** com valores oficiais de NG extraídos do **Anexo F / Tabela F.1** da NBR 5419-2:2026
- **Motor de recomendação automática** — dado um R > RT, o sistema encontra a configuração mínima (SPDA + DPS) que atinge 100% de conformidade, com passo-a-passo e citação normativa
- **Motor de remediação do laudo** — para cada item não-conforme do checklist, gera ações corretivas com prioridade (imediato/curto prazo/preventivo), prazo e custo relativo
- **Análise multi-zona** conforme Seção 6.9.3 — divida a estrutura em ZS homogêneas
- **Frontend moderno dark-first** — tema escuro como padrão, responsivo, com glassmorphism e gradientes
- **Autocomplete de municípios** ligado ao Anexo F oficial
- **PDF profissional** do laudo de inspeção com plano de remediação e anexo fotográfico
- **Modo offline** com Dexie/IndexedDB para inspeções em campo
- **Auth JWT** + CRUD protegido de clientes e projetos
- **Migrações Alembic** e deploy completo via Docker Compose

## Stack

- **Backend**: Python 3.11 + FastAPI + SQLAlchemy 2 + Pydantic v2 + PostgreSQL + Alembic
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind + React + Dexie
- **PDF**: Jinja2 + WeasyPrint
- **Auth**: JWT (jose) + bcrypt (passlib)
- **Deploy**: Docker Compose (db + backend + frontend)

## Como rodar

```bash
cd pda-nbr5419
docker compose up -d
```

URLs:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs
- Postgres: localhost:5432

## Cobertura normativa

| Parte | Conteúdo |
|---|---|
| **Parte 1** — Princípios gerais | Tabelas 1, 3, 4, 5 (NP, parâmetros da corrente) |
| **Parte 2** — Análise de risco | Áreas A.1-A.5, Probabilidades B.1-B.8, Perdas C.1-C.9, Componentes 6.x, Frequência F (§7), Anexo F Tabela F.1 |
| **Parte 3** — Danos físicos | Tabelas 2, 5, 6, 7, 11-13; dimensionamento automático; checklist §7 |
| **Parte 4** — Sistemas internos | ZPR 0A/0B/1/2/3; DPS I/II/III; projeto MPS B.3; checklist §9.2 |

## Principais endpoints da API

### Público
- `POST /api/v1/analise-risco/calcular` — Análise completa com recomendação automática
- `POST /api/v1/analise-risco/calcular-multi-zona` — Análise multi-zona (§6.9.3)
- `POST /api/v1/laudo/analisar` — Plano de remediação do laudo
- `POST /api/v1/laudo/pdf` — PDF do laudo de análise de risco
- `POST /api/v1/laudo/inspecao/pdf` — PDF do laudo de inspeção com fotos
- `GET  /api/v1/ng/por-municipio/{nome-uf}` — NG oficial do Anexo F
- `GET  /api/v1/ng/buscar?q=...` — Autocomplete de municípios
- `GET  /api/v1/spda/checklist` — 30 itens do checklist normativo
- `POST /api/v1/spda/dimensionar` — Dimensionamento do SPDA

### Autenticação
- `POST /api/v1/auth/registro` — Registrar novo usuário
- `POST /api/v1/auth/login` — Login OAuth2
- `GET  /api/v1/auth/me` — Dados do usuário autenticado

### Protegido (JWT)
- `GET/POST /api/v1/clientes` — CRUD de clientes
- `GET/POST /api/v1/projetos` — CRUD de projetos
- `POST /api/v1/laudos/{id}/fotos` — Upload de fotos do laudo
- `GET /api/v1/dashboard/metricas` — Métricas agregadas reais

## Estrutura

```
pda-nbr5419/
├── backend/
│   ├── app/
│   │   ├── nbr5419/          # Tabelas normativas (4 partes + NG Anexo F)
│   │   ├── engine/           # Cálculo + recomendador automático
│   │   ├── services/         # Checklist, remediador, geradores de PDF
│   │   ├── api/v1/           # 9 routers FastAPI
│   │   ├── models/           # SQLAlchemy 2 ORM (8 tabelas)
│   │   ├── schemas/          # Pydantic v2
│   │   └── tests/            # pytest (engine + recomendador + remediador)
│   ├── alembic/              # Migrações
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── app/                  # App Router (8 páginas)
│   │   ├── page.tsx          # Dashboard com hero + métricas
│   │   ├── analise-risco/    # Wizard com simulador
│   │   ├── zonas/            # Multi-zona
│   │   ├── laudo/            # Checklist + remediação
│   │   ├── login/            # Auth
│   │   ├── projetos/         # CRUD protegido
│   │   └── relatorios/       # PDFs
│   ├── components/
│   │   ├── ui/               # Design system (Card, Button, Input, StatCard, etc)
│   │   ├── layout/           # Sidebar + MobileNav
│   │   ├── analise/          # CaminhoParaConformidade, MunicipioAutocomplete
│   │   ├── laudo/            # PlanoRemediacao
│   │   └── dashboard/        # IndicadorOffline
│   ├── lib/
│   │   ├── api.ts            # Cliente HTTP tipado
│   │   ├── db-local.ts       # Dexie para modo offline
│   │   └── utils.ts
│   └── Dockerfile
└── docker-compose.yml
```

## Observações normativas críticas

1. **Não use NG de outras fontes.** A NBR 5419-2:2026 §F.1.1 é explícita: *"os valores de NG devem ser iguais àqueles encontrados EXCLUSIVAMENTE neste Anexo"*.
2. **R2 foi substituído por F** (frequência de danos) — o sistema calcula ambos mas apenas R1 e R3 são obrigatórios.
3. **Medição de aterramento não é requisito** para eficácia do SPDA (§7.1.4 da Parte 3).
4. **Terminologia**: use "Nível de Proteção (NP) I-IV", não "Classe I-IV" (legado da 2015).
