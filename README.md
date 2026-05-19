<div align="center">
  <img src="assets/logo.png" width="160" height="auto" alt="Meterplex Logo">
  <h1>Meterplex</h1>
  <p><strong>Open-source B2B usage metering, entitlements, and billing platform.</strong></p>

  <p>
    <!-- Project Health & Status -->
    <a href="https://github.com/chitrank2050/meterplex/actions/workflows/ci.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/chitrank2050/meterplex/ci.yml?style=for-the-badge" alt="CI Status">
    </a>
    <a href="https://scorecard.dev/viewer/?uri=github.com/chitrank2050/meterplex">
      <img src="https://img.shields.io/ossf-scorecard/github.com/chitrank2050/meterplex?style=for-the-badge" alt="OpenSSF Scorecard">
    </a>
    <a href="https://bestpractices.coreinfrastructure.org/projects/1">
      <img src="https://img.shields.io/cii/level/1?style=for-the-badge" alt="Best Practices">
    </a>
    <a href="https://codecov.io/gh/chitrank2050/meterplex">
      <img src="https://img.shields.io/codecov/c/github/chitrank2050/meterplex/main?style=for-the-badge" alt="Code Coverage"/>
    </a>
    <img src="https://img.shields.io/badge/Security-Gitleaks-success?style=for-the-badge" alt="Security: Gitleaks">
    <img src="https://img.shields.io/badge/Hooks-Lefthook-blueviolet?style=for-the-badge" alt="Hooks: Lefthook">
    <a href="https://chitrank2050.github.io/meterplex/">
      <img src="https://img.shields.io/badge/Docs-Live-success?logo=github&logoColor=white&style=for-the-badge" alt="Documentation">
    </a>
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="MIT License">
    <img src="https://img.shields.io/badge/Node-24-success?style=for-the-badge" alt="Node: 24">
    <br/>
    <br/>
    <a href="https://ko-fi.com/D1D71U581P" target="_blank">
      <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Buy me a coffee at ko-fi.com">
    </a>
    <br/>
    <br/>
    <a href="./CONTRIBUTING.md"><b>Contributing</b></a> •
    <a href="./SECURITY.md"><b>Security</b></a>
  </p>
</div>

---

## What is this?

> Meterplex is the backend that powers a SaaS or AI API company. It defines plans and entitlements, decides whether a tenant can use a feature, tracks usage events, enforces quotas and rate limits, calculates billable usage, handles payments and webhooks, and provides auditability with replay and reconciliation. Every mutation is recorded to an immutable audit log for compliance and forensics.

## Architecture

Modular monolith - one deployable unit with strict module boundaries. Each domain (tenants, billing, usage, payments) is a self-contained NestJS module that can be extracted into a microservice when scale demands it.

```text
┌─────────────────────────────────────────────────────┐
│                    NestJS App                       │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Tenants │ │  Usage   │ │ Billing  │  ...more   │
│  │  Module  │ │  Module  │ │  Module  │  modules   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘            │
│       │             │            │                  │
│  ┌────▼─────────────▼────────────▼─────┐            │
│  │          Prisma (PostgreSQL)        │            │
│  └─────────────────────────────────────┘            │
│       │             │            │                  │
│  ┌────▼──┐    ┌─────▼───┐  ┌────▼──┐               │
│  │ Redis │    │  Kafka  │  │ Cron  │               │
│  └───────┘    └─────────┘  └───────┘               │
└─────────────────────────────────────────────────────┘
```

### 🛠️ Tech Stack

| Domain         | Technology                                                                                      | Purpose                                     |
| :------------- | :---------------------------------------------------------------------------------------------- | :------------------------------------------ |
| **Backend**    | [NestJS 11](https://nestjs.com/)                                                                | Modular backend architecture                |
| **Language**   | [TypeScript 6.0](https://www.typescriptlang.org/)                                               | Type-safe development                       |
| **Database**   | [PostgreSQL 18](https://www.postgresql.org/) + [Prisma 7](https://www.prisma.io/)               | Persistent storage & ORM                    |
| **Messaging**  | [Apache Kafka 4.2](https://kafka.apache.org/)                                                   | Event-driven async processing               |
| **Caching**    | [Redis 8](https://redis.io/)                                                                    | Distributed caching & rate limiting         |
| **DevOps**     | [GitHub Actions](https://github.com/features/actions), [Renovate](https://docs.renovatebot.com) | 2027-standard security & automation         |
| **Automation** | [Chitrank Action](https://github.com/chitrank2050)                                              | Centralized, hardened bot-driven governance |
| **Quality**    | [Vitest](https://vitest.dev/), [Lefthook](https://github.com/evilmartians/lefthook)             | Unit testing & high-performance git hooks   |
| **Docs**       | [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)                                 | Technical documentation & changelog         |
| **API Tools**  | [Bruno](https://usebruno.com/), [Swagger](https://swagger.io/), [Scalar](https://scalar.com/)   | API testing & documentation                 |

## Quick Start

**Prerequisites**: Node.js >= 24, pnpm >= 9, Docker

### ⚡ Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/chitrank2050/meterplex.git

# 2. Enter the project
cd meterplex

# 3. One-command setup (installs deps, starts docker, seeds DB)
pnpm dev:init
```

### 🛠️ Development Scripts

| Command            | Description                                                             |
| :----------------- | :---------------------------------------------------------------------- |
| `pnpm dev:init`    | **Interactive Wizard**: Multi-select setup, maintenance, and deep clean |
| `pnpm setup:all`   | Standard setup: install deps + start infrastructure + seed DB           |
| `pnpm setup:fresh` | **Hard Reset**: Wipes all data/deps and performs a fresh setup          |
| `pnpm start:dev`   | Starts the NestJS application in watch mode                             |
| `pnpm test`        | Runs the full test suite via Vitest                                     |
| `pnpm docker:up`   | Starts Postgres, Kafka, and Redis in the background                     |
| `pnpm db:studio`   | Opens Prisma Studio to visualize your database                          |
| `pnpm lint`        | Runs TypeScript, Markdown, and GitHub Action linters                    |

The app runs at `http://localhost:3000`. API docs at `http://localhost:3000/api/docs`. Health check at `http://localhost:3000/health`.

## Project Structure

```text
meterplex/
├── .github/             # GitHub Actions workflows & templates
│   ├── workflows/       # CI/CD, Security, & Maintenance pipelines
│   └── ISSUE_TEMPLATE/  # Standardized issue templates
├── src/
│   ├── common/              # Cross-cutting concerns
│   │   ├── constants/       # Error codes, app constants
│   │   ├── decorators/      # @CurrentUser, @TenantId, @Roles
│   │   ├── dto/             # Shared DTOs (error response, pagination)
│   │   ├── filters/         # Global exception filter
│   │   ├── guards/          # TenantGuard, RolesGuard
│   │   ├── interceptors/    # (Phase 2) Audit log interceptor
│   │   ├── middleware/       # Correlation ID, request logging
│   │   ├── pipes/           # (future) Custom validation pipes
│   │   ├── interfaces/      # (future) Shared TypeScript types
│   │   └── utils/           # Prisma error helpers
│   ├── config/              # Environment validation and ConfigModule
│   ├── prisma/              # PrismaService and PrismaModule
│   ├── health/              # Health check endpoint
│   └── modules/
│       ├── tenants/         # Tenant CRUD, tenant-scoped queries
│       ├── users/           # User management, tenant membership
│       ├── auth/            # JWT, Passport, refresh tokens, password reset
│       ├── usage-events/    # Usage event ingestion API (API key auth)
│       ├── usage-pipeline/  # Kafka consumers (validation, aggregation, dead letter)
│       ├── kafka/           # Kafka producer, consumer base, topic constants
│       ├── redis/           # Redis connection and cache operations
│       ├── outbox/          # Outbox publisher worker (drains to Kafka)
│       └── api-keys/        # Server-to-server key management + auth guard
├── prisma/
│   ├── schema.prisma        # Database schema (single source of truth)
│   ├── seed.ts              # Development seed data
│   └── migrations/          # Prisma migration history
├── bruno/                   # API testing collections
├── docs/                    # MkDocs documentation source
├── assets/                  # Logos and static assets
├── lefthook.yml             # High-performance Git hooks
├── cliff.toml               # Automated changelog configuration
├── package.json             # Scripts & dependencies
├── pnpm-lock.yaml           # Deterministic lockfile
└── docker-compose.yml       # Postgres, Kafka, Redis
```

## Available Scripts

| Script                   | Description                        |
| :----------------------- | :--------------------------------- |
| `pnpm start:dev`         | Start with hot reload              |
| `pnpm start:prod`        | Start production build             |
| `pnpm build`             | Compile TypeScript                 |
| `pnpm test`              | Run unit tests                     |
| `pnpm test:e2e`          | Run end-to-end tests               |
| `pnpm lint`              | Lint and fix code                  |
| `pnpm db:generate`       | Regenerate Prisma client           |
| `pnpm db:migrate:dev`    | Create and apply migration         |
| `pnpm db:migrate:deploy` | Apply migrations (CI/prod)         |
| `pnpm db:seed`           | Seed development data              |
| `pnpm db:studio`         | Open Prisma data browser           |
| `pnpm docker:up`         | Start Docker containers            |
| `pnpm docker:down`       | Stop containers and remove volumes |
| `pnpm docker:logs`       | Tail container logs                |

## API Endpoints

| Method | Path        | Description                   |
| :----- | :---------- | :---------------------------- |
| GET    | `/health`   | Infrastructure health check   |
| -      | `/api/docs` | Swagger UI (development only) |

_More endpoints are added with each phase._

## Documentation

🚀 **Live Docs:** [chitrank2050.github.io/meterplex](https://chitrank2050.github.io/meterplex/)

Detailed documentation is available in the [`docs/`](./docs) folder and on GitHub Pages:

- **[Architecture](./docs/architecture/overview.md)** - System design, module boundaries, data flow
- **[Development](./docs/development/setup.md)** - Setup guide, conventions, workflow
- **[API](./docs/api/overview.md)** - API design decisions, versioning, error format
- **[Phases](./docs/phases/phase-0.md)** - Build log for each development phase

## Development Phases

| Phase | Focus                                      | Status      |
| :---- | :----------------------------------------- | :---------- |
| 0     | Project setup, infrastructure, foundations | ✅ Complete |
| 1     | Auth, tenants, users, plans, subscriptions | ✅ Complete |
| 2     | Entitlements and usage tracking            | 🔜 Next     |
| 3     | Billing, invoices, payments                | -           |
| 4     | Kafka event pipeline, async processing     | -           |
| 5     | Observability, rate limiting, hardening    | -           |

## License

MIT - see [LICENSE](LICENSE) for details.

If you use Meterplex in your project, a star or credit is appreciated.

---

❤️ Developed by [Chitrank Agnihotri](https://www.chitrankagnihotri.com)
