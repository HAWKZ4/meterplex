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

## What is Meterplex?

> Meterplex is a high-performance, developer-first billing engine that manages plans, tracks usage events, enforces quotas in real time, and maintains auditability. Designed as a modular monolith, it allows you to easily scale from a simple SaaS application to an event-driven microservices architecture.

---

## Key Features

- 👤 **Multi-Tenant Identity & Access** - Secure JWT authentication, tenant isolation, and Stripe-like API keys (using hashed storage and constant-time comparison).
- 🏷️ **Plans & Entitlements** - Programmable features (boolean flags, reset quotas, metered features) with snapshotted entitlements to protect existing contracts.
- ⚡ **Usage Ingestion Pipeline** - Guaranteed, idempotent event delivery using the **Transactional Outbox Pattern** and **Kafka** event streams with concurrency safety (`SKIP LOCKED`).
- 🔢 **Atomic Aggregations** - Concurrent real-time usage tracking using Postgres raw SQL upserts and atomic **Redis** caching with auto-expiring TTLs.
- 📋 **Audit-Ready Ledgers** - Append-only transactional database logs and built-in dead-letter auditing to triage and reprocess failed billing events.

---

## Quick Start

### Prerequisites

Make sure you have **Node.js >= 24**, **pnpm >= 9**, and **Docker** installed.

### 1. Clone & Initialize

Run the Interactive Setup Wizard to automatically install dependencies, start containers, and seed the database in a single step:

```bash
git clone https://github.com/chitrank2050/meterplex.git
cd meterplex
pnpm dev:init
```

### 2. Verify Installation

```bash
# Health check (should return status: ok)
curl http://localhost:3000/health

# Open API Swagger / Scalar Documentation
# http://localhost:3000/api/docs
```

_For custom configs, manual setups, or daily commands, refer to the [Development Setup Guide](docs/development/setup.md)._

---

## Architecture

Meterplex is structured as a **modular monolith** to combine the operational simplicity of a single deployable unit with strict domain boundary isolation.

```text
┌────────────────────────────────────────────────────┐
│                    NestJS App                      │
│                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Tenants │ │  Usage   │ │ Billing  │  ...more   │
│  │  Module  │ │  Module  │ │  Module  │  modules   │
│  └────┬─────┘ └─────┬────┘ └─────┬────┘            │
│       │             │            │                 │
│  ┌────▼─────────────▼────────────▼─────┐           │
│  │          Prisma (PostgreSQL)        │           │
│  └─────────────────────────────────────┘           │
│       │             │           │                  │
│  ┌────▼──┐    ┌─────▼───┐  ┌────▼──┐               │
│  │ Redis │    │  Kafka  │  │ Cron  │               │
│  └───────┘    └─────────┘  └───────┘               │
└────────────────────────────────────────────────────┘
```

| Domain        | Technology                                                                        | Purpose                                 |
| :------------ | :-------------------------------------------------------------------------------- | :-------------------------------------- |
| **Backend**   | [NestJS 11](https://nestjs.com/)                                                  | Modular application framework           |
| **Language**  | [TypeScript 6.0](https://www.typescriptlang.org/)                                 | Type-safe business logic                |
| **Database**  | [PostgreSQL 18](https://www.postgresql.org/) + [Prisma 7](https://www.prisma.io/) | Data persistence & transactional outbox |
| **Messaging** | [Apache Kafka 4.2](https://kafka.apache.org/)                                     | Async event-driven processing           |
| **Caching**   | [Redis 8](https://redis.io/)                                                      | Distributed caching & real-time quotas  |

_Learn more about our design decisions in the [Architecture Overview](docs/architecture/overview.md)._

---

## Documentation

🚀 **Live Docs:** [chitrank2050.github.io/meterplex](https://chitrank2050.github.io/meterplex/)

Deep-dive technical documentation is organized across:

- 📖 **[Architecture Guides](docs/architecture/overview.md)** - Core design principles, ER diagrams, and data flow.
- 🛠️ **[Development Guide](docs/development/setup.md)** - Custom configuration, local troubleshooting, and code conventions.
- 📡 **[API Reference](docs/index.md#api-endpoints-phase-1)** - Request/Response structures and routing details.
- 🔄 **[Release & Changelog](docs/index.md#developer-workflow)** - Git hygiene, conventional commits, and automated release pipelines.

---

## License

Meterplex is licensed under the [MIT License](LICENSE).

⭐ _If you use **Meterplex** in your project, a star or credit is appreciated._

---

❤️ Developed by [Chitrank Agnihotri](https://www.chitrankagnihotri.com)
