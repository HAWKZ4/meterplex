# Meterplex Documentation

> Welcome to the Meterplex documentation - a B2B usage metering, entitlements, and billing platform.

---

## Quick Links

| Section                                  | What you'll find                                                                   |
| :--------------------------------------- | :--------------------------------------------------------------------------------- |
| [Architecture](architecture/overview.md) | System design, module boundaries, data flow, infrastructure decisions.             |
| [Development](development/setup.md)      | Setup guide, daily workflow, conventions, troubleshooting.                         |
| [API](api/overview.md)                   | API design decisions, versioning, error format, authentication.                    |
| [Maintenance](maintenance/ci-cd.md)      | CI/CD security, automated releases, and maintenance cycles.                        |
| [Build Phases](phases/phase-0.md)        | Detailed log of each development phase - what was built, why, and lessons learned. |

---

## Getting Started

Meterplex is built for speed and developer happiness. You can get a full production-grade development environment running in seconds using our **Interactive Setup Wizard**.

```bash
git clone https://github.com/chitrank2050/meterplex.git
cd meterplex

# One command to rule them all:
pnpm dev:init
```

App runs at `http://localhost:3000`. API docs at `http://localhost:3000/api/docs`.

---

## Current Status

| Phase | Focus                                                             | Status      |
| :---- | :---------------------------------------------------------------- | :---------- |
| 0     | Project setup, infrastructure, foundations                        | ✅ Complete |
| 1     | Multi-tenant identity and access (auth, tenants, users, API keys) | ✅ Complete |
| 2     | Plans, entitlements, and quotas                                   | ✅ Complete |
| 3     | Usage ingestion, outbox pattern, Kafka pipeline                   | ✅ Complete |
| 4     | Billing ledger and invoices                                       | ✅ Complete |
| 5     | Payments and webhooks                                             | 🔜 Next     |
| 6     | Admin, audit log, reconciliation                                  |             |
| 7     | Observability (Grafana, Loki, OpenTelemetry)                      |             |
| 8     | Scale, hardening, load testing                                    |             |

---

## API Endpoints (Phase 1)

### Auth

| Method | Path                           | Description                            |
| :----- | :----------------------------- | :------------------------------------- |
| POST   | `/api/v1/auth/register`        | Register user + create tenant          |
| POST   | `/api/v1/auth/login`           | Login, get JWT + refresh token         |
| POST   | `/api/v1/auth/refresh`         | Refresh access token                   |
| GET    | `/api/v1/auth/me`              | Get current user profile               |
| POST   | `/api/v1/auth/change-password` | Change password, revoke other sessions |
| POST   | `/api/v1/auth/forgot-password` | Request password reset token           |
| POST   | `/api/v1/auth/reset-password`  | Reset password with token              |
| POST   | `/api/v1/auth/logout`          | Revoke a refresh token                 |
| POST   | `/api/v1/auth/revoke-all`      | Revoke all sessions                    |

### Tenants

| Method | Path                         | Description                   |
| :----- | :--------------------------- | :---------------------------- |
| POST   | `/api/v1/tenants`            | Create a tenant               |
| GET    | `/api/v1/tenants`            | List tenants for current user |
| GET    | `/api/v1/tenants/:id`        | Get tenant by ID              |
| GET    | `/api/v1/tenants/slug/:slug` | Get tenant by slug            |
| PATCH  | `/api/v1/tenants/:id`        | Update tenant                 |
| GET    | `/api/v1/tenants/me/context` | Get current tenant context    |

### Users

| Method | Path                | Description           |
| :----- | :------------------ | :-------------------- |
| POST   | `/api/v1/users`     | Create user in tenant |
| GET    | `/api/v1/users/:id` | Get user by ID        |
| PATCH  | `/api/v1/users/:id` | Update user profile   |

### API Keys

| Method | Path                   | Description                 |
| :----- | :--------------------- | :-------------------------- |
| POST   | `/api/v1/api-keys`     | Create API key (shown once) |
| GET    | `/api/v1/api-keys`     | List keys for tenant        |
| DELETE | `/api/v1/api-keys/:id` | Revoke API key              |

---

### Phase 2 - Plans and Entitlements

#### Plans

| Method | Path                       | Description      |
| :----- | :------------------------- | :--------------- |
| POST   | `/api/v1/plans`            | Create a plan    |
| GET    | `/api/v1/plans`            | List plans       |
| GET    | `/api/v1/plans/:id`        | Get plan by ID   |
| GET    | `/api/v1/plans/slug/:slug` | Get plan by slug |
| PATCH  | `/api/v1/plans/:id`        | Update plan      |

#### Plan Prices

| Method | Path                               | Description       |
| :----- | :--------------------------------- | :---------------- |
| POST   | `/api/v1/plans/:planId/prices`     | Add price to plan |
| GET    | `/api/v1/plans/:planId/prices`     | List prices       |
| PATCH  | `/api/v1/plans/:planId/prices/:id` | Deactivate price  |

#### Features

| Method | Path                              | Description               |
| :----- | :-------------------------------- | :------------------------ |
| POST   | `/api/v1/features`                | Create feature            |
| GET    | `/api/v1/features`                | List features             |
| GET    | `/api/v1/features/:id`            | Get feature by ID         |
| GET    | `/api/v1/features/key/:lookupKey` | Get feature by lookup key |
| PATCH  | `/api/v1/features/:id`            | Update feature            |

#### Entitlements

| Method | Path                                     | Description            |
| :----- | :--------------------------------------- | :--------------------- |
| POST   | `/api/v1/plans/:planId/entitlements`     | Map feature to plan    |
| GET    | `/api/v1/plans/:planId/entitlements`     | List plan entitlements |
| GET    | `/api/v1/plans/:planId/entitlements/:id` | Get entitlement        |
| PATCH  | `/api/v1/plans/:planId/entitlements/:id` | Update entitlement     |
| DELETE | `/api/v1/plans/:planId/entitlements/:id` | Remove entitlement     |

#### Subscriptions

| Method | Path                               | Description               |
| :----- | :--------------------------------- | :------------------------ |
| POST   | `/api/v1/subscriptions`            | Subscribe tenant to plan  |
| GET    | `/api/v1/subscriptions/active`     | Get active subscription   |
| GET    | `/api/v1/subscriptions`            | List subscription history |
| POST   | `/api/v1/subscriptions/:id/cancel` | Cancel subscription       |

#### Entitlement Checks (the hot path)

| Method | Path                                       | Description                     |
| :----- | :----------------------------------------- | :------------------------------ |
| GET    | `/api/v1/entitlements/:featureKey/check`   | Check if tenant can use feature |
| POST   | `/api/v1/entitlements/:featureKey/consume` | Consume units of feature        |

---

### Phase 3 - Usage Pipeline

#### Usage Events

| Method | Path                   | Description                                 |
| :----- | :--------------------- | :------------------------------------------ |
| POST   | `/api/v1/usage/events` | Submit batch of usage events (API key auth) |

---

### Phase 4 - Billing & Invoices

#### Invoices

| Method | Path                              | Description                                   |
| ------ | --------------------------------- | --------------------------------------------- |
| GET    | `/api/v1/invoices`                | List invoices (paginated)                     |
| GET    | `/api/v1/invoices/:id`            | Get invoice with line items                   |
| GET    | `/api/v1/invoices/:id/line-items` | Get line items only                           |
| POST   | `/api/v1/invoices/generate`       | Generate invoice (auto-detects full/prorated) |
| POST   | `/api/v1/invoices/:id/finalize`   | DRAFT → FINALIZED                             |
| POST   | `/api/v1/invoices/:id/mark-paid`  | FINALIZED → PAID                              |
| POST   | `/api/v1/invoices/:id/void`       | DRAFT/FINALIZED → VOID                        |

#### Billing

| Method | Path                      | Description                     |
| ------ | ------------------------- | ------------------------------- |
| GET    | `/api/v1/billing/ledger`  | List ledger entries (paginated) |
| GET    | `/api/v1/billing/balance` | Get tenant balance              |

---

## Developer Workflow

Meterplex uses a modern, high-performance developer workflow to ensure code quality and automated releases.

### Git Hooks (Lefthook)

We use [Lefthook](https://github.com/evilmartians/lefthook) for lightning-fast pre-commit checks. It automatically runs:

- **Linting**: ESLint and Prettier.
- **Security**: Gitleaks for secrets and Zizmor for GitHub Actions.
- **Testing**: Vitest for relevant unit tests.

### Commit & Branch Standards

We enforce [Conventional Commits](https://www.conventionalcommits.org/) and strict branch naming conventions using our custom package **[@chitrank2050/git-hygiene](https://github.com/chitranklabs/git-hygiene)**.

- **Commit Format Validation**: Enforced via a `commit-msg` git hook running `npx git-hygiene commit` to check format compliance.
- **Branch Verification**: Enforced via a `pre-push` git hook running `npx git-hygiene branch` to check branch naming rules before pushing to remote.

#### Allowed Types

Allowed type prefixes (defined in `package.json`) include:

- `feat` - New features.
- `fix` - Bug fixes.
- `chore` - Routine chore/configuration updates.
- `docs` - Documentation additions/updates.
- `refactor` - Code refactoring without functionality changes.
- `perf` - Performance enhancements.
- `test` - Testing setups or changes.
- `maintenance` - Code hygiene, cleanup, and security tasks.
- `renovate` - Automated dependency upgrades.
- `style`, `build`, `ci`, `revert`

### Automated Releases

Pushing a tag (e.g., `git tag v0.5.3 && git push --tags`) triggers the **Release Workflow**, which:

1. Generates release notes using `git-cliff`.
2. Updates `CHANGELOG.md` in the repository.
3. Deploys updated documentation to GitHub Pages.
4. Creates a GitHub Release.

---

## Automated Maintenance

To save developer time, the project includes several automated maintenance tasks:

| Feature              | Description                                                                            | Frequency     |
| :------------------- | :------------------------------------------------------------------------------------- | :------------ |
| **OSV Audit**        | Scans lockfiles for known vulnerabilities using Google's OSV database.                 | Every PR/Push |
| **Secret Scan**      | Scans entire git history for leaked credentials using Gitleaks.                        | Every PR/Push |
| **Override Pruning** | Proactively checks if `pnpm.overrides` are still needed and opens a PR to remove them. | Weekly        |
| **Actions Audit**    | Scans GitHub Actions for security flaws and unpinned versions using `zizmor`.          | Every PR/Push |
| **Renovate**         | Automated dependency updates and security patches.                                     | Continuous    |
