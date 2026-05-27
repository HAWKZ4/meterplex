# CI/CD & Automated Maintenance

Meterplex uses a state-of-the-art CI/CD infrastructure designed for **Zero-Trust security** and **automated supply chain health**. This document explains our security layers and automated workflows.

## 🛡️ Security Layers

### 1. Egress Control (Harden Runner)

Every workflow job starts with **Step Security's Harden Runner**. This provides runtime security for the GitHub Actions runner.

- **What it does**: It monitors all outbound network traffic during the build process.
- **Why it's there**: To prevent "phoning home" attacks where a compromised dependency attempts to steal `GITHUB_TOKEN` or other secrets and send them to an external server.
- **Status**: Currently in `audit` mode. Once the list of required endpoints is finalized, it will be switched to `block` mode for maximum security.

### 2. OpenSSF Scorecard

We use the **OpenSSF Scorecard** to track the overall security health of the repository.

- **What it does**: It scans the repo for 19+ security best practices, including branch protection, use of dangerous workflows, and dependency pinning.
- **How to view**: Check the "Security" tab in GitHub or click the Scorecard badge in the [README](../../README.md).
- **Automation**: Runs automatically on every push to `main` and on a weekly schedule.

### 3. Build Provenance & Attestations

We use **GitHub Actions Build Provenance** (`actions/attest-build-provenance`) to cryptographically sign our releases.

- **What it does**: It generates a non-forgeable attestation that links the published release directly to the specific GitHub Actions run and commit that produced it.
- **Why it's there**: It provides downstream users with high-assurance verification that the release artifact was not tampered with and actually originated from this repository.

### 4. Access Control (Environments)

We use the **`production`** GitHub Environment to isolate release-specific permissions and provide deployment tracking.

- **What it does**: It creates a dedicated logical space for the release workflow.
- **Approval Gate**: This environment is configured to require **manual approval** before a release can be published, providing a human-in-the-loop safety check for production changes.
- **Deployment URL**: Each release automatically links back to the published tag on GitHub for easy traceability.

### 5. Secret Scanning (Gitleaks)

- **Local**: Integrated into `lefthook` to prevent secrets from ever being committed.
- **CI**: A dedicated job in `ci.yml` perform **incremental scans** of only the new commits in a PR, ensuring near-instant feedback as the repository grows.

### 6. Dependency Auditing (OSV-Scanner)

- Scans our `pnpm-lock.yaml` against Google's Open Source Vulnerabilities (OSV) database.
- Blocks the PR if a known vulnerability is found in our dependencies.

### 7. Zombie Code Detection (Knip)

- **What it does**: Scans the entire project for unused files, exports, and dependencies.
- **Why it's there**: To keep the codebase lean and prevent "code rot." It ensures that every line of code in the repo actually serves a purpose.
- **CI**: Integrated into the main hygiene job. If a PR introduces unused code, the build fails.

---

## 🏎️ Extreme Performance Architecture

Our CI pipeline is optimized for speed and cost-efficiency (Free-tier friendly):

1. **Parallel Hygiene**: Code linting, formatting checks, and markdown audits run in parallel jobs. This provides developer feedback 3x faster than sequential runs.
2. **Smart Caching**:
   - **pnpm Store**: Global cache for dependency resolution.
   - **Prisma Client**: The generated Prisma client is cached and only rebuilt when `schema.prisma` changes, saving ~20s per build.
   - **Pip**: Python dependencies for documentation are cached.
3. **Trigger Lockdown**: To save Actions minutes, workflows **only** run on the `main` branch or within a Pull Request targeting `main`. Intermediate pushes to feature branches do not trigger CI, encouraging local testing via `lefthook`.

---

## 🤖 Automated Maintenance & Governance

To keep the codebase healthy without manual toil, we have several automated maintenance cycles:

### Two-Step Automated Releases 🚀

We use a high-control, two-workflow release system:

1. **Step 1: Preparation (Manual)**: The owner triggers `Release 1 - Prepare PR`. This bumps the `package.json` version, updates the `CHANGELOG.md`, and opens a dedicated **Release PR**.
2. **Step 2: Review (Human)**: The owner reviews the PR. This is the "Control Point" where final edits can be made to the changelog before tagging.
3. **Step 3: Finalization (Auto)**: Once the owner **merges** the PR, the `Release 2 - Finalize Tag` workflow wakes up. It pushes a **Verified Tag**, creates the **GitHub Release**, and generates the **SLSA Attestation** in a single sequence.

### Dependency Management (Renovate)

We use **Renovate** to keep our dependencies up to date. Unlike standard tools, Renovate is configured to group updates and provide clear release notes.

### Smart Auto-Approval

To maintain velocity while following strict branch protection rules:

- **Patch/Minor**: Automated PRs for minor/patch updates are automatically approved by a dedicated workflow (`auto-approve.yml`) once CI passes.
- **Unblocking**: If a review was explicitly requested from the owner, the bot automatically **removes the reviewer request** before approving, ensuring the PR isn't stuck behind a manual "Review Required" lock.

---

## 📋 Workflow Catalog

| Workflow                | File                   | Purpose                                                  | Trigger                   |
| :---------------------- | :--------------------- | :------------------------------------------------------- | :------------------------ |
| **CI & Security**       | `ci.yml`               | Validates code quality, runs tests, and audits security. | PR / Push to main         |
| **Action Linting**      | `workflow-lint.yml`    | Audits GitHub Actions for security flaws using `zizmor`. | Changes to workflows      |
| **Release PR Autofill** | `pr-autofill.yml`      | Updates release PR descriptions based on commit history. | Release PR to main        |
| **Auto-Approve**        | `auto-approve.yml`     | Approves safe automated updates & unblocks reviews.      | CI finish on bot branches |
| **Release 1**           | `release-prepare.yml`  | Bumps version and opens a Release PR.                    | Manual (Owner Only)       |
| **Release 2**           | `release-finalize.yml` | Pushes tag and creates GitHub Release on PR merge.       | PR Merge (Owner Only)     |
| **Scorecard**           | `scorecard.yml`        | Tracks repo-level security health (OpenSSF).             | Weekly / Push to main     |
| **Docs Deploy**         | `docs.yml`             | Builds and publishes documentation.                      | Push to main / Manual     |
| **Maintenance**         | `maintenance.yml`      | Weekly automated cleanup of dependency overrides.        | Weekly / Manual           |

---

## 🏗️ 2027 Automation Standards

All workflows in this repository follow our "2027-standard" for security and performance:

- **Node 24 LTS**: The active runtime for all runners and local development.
- **True Zero-Noise PRs**: Pull Requests contain zero manual boilerplate. Descriptions are automatically generated and categorized using `git-cliff`.
- **Harden Runner**: Every workflow is isolated using `step-security/harden-runner`.
- **Prisma Client Caching**: Optimized cross-job caching for database types.
- **Hands-Free Releases**: Automated changelog generation, PR creation, and auto-merging.

1. **Centralized Identity**: All automated actions (approvals, labels, releases) use a custom **GitHub App** (`chitrank-action`) via a centralized setup action. This ensures consistent audit logs and triggers downstream workflows.
2. **Zero-Trust Egress**: Every job includes `harden-runner` to monitor and restrict network traffic, preventing token exfiltration.
3. **Immutability (SHA Pinning)**: All third-party actions are pinned to a 40-character commit SHA to prevent "tag moving" supply-chain attacks.
4. **Credential Security**: `persist-credentials: false` is used on every checkout to prevent tokens from being stored in the runner's `.git` directory.
5. **No Template Injection**: `${{ ... }}` expansion is NEVER used inside `run:` scripts. Dynamic data is always passed via environment variables (`env`).
6. **Single Checkout Strategy**: Jobs are optimized to perform exactly one repository checkout, saving runner time and bandwidth.
7. **Unblocked Pipelines**: Required status checks (CI, Linting) run on all PRs to ensure they never block automated merges from Renovate or Release bots.
