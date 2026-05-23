# Changelog

All notable changes to the Meterplex API and core platform.

## [0.8.2] - 2026-05-23

### 🐛 Bug Fixes

- **auth:** Handle purged refresh tokens with explicit null check (#193) ([94c9ced](https://github.com/chitrank2050/meterplex/commit/94c9cede2cde3af1c4cc0fce107d3ab2ad67faa9))

### 🚀 Features

- **security:** Implement Redis rate limiting with tiered limits (#192) ([2f2d224](https://github.com/chitrank2050/meterplex/commit/2f2d2248b2731b3eca0c48e01d25ef0fa9d39b25))
## [0.8.1] - 2026-05-23

### 🐛 Bug Fixes

- **security:** Reject tenant :id param vs x-tenant-id header mismatch (#188) ([8594e08](https://github.com/chitrank2050/meterplex/commit/8594e08c702bfe7ac1687f94f93d1f22f52b7660))
- **security:** Add authorization checks to user update endpoint (#189) ([9030760](https://github.com/chitrank2050/meterplex/commit/9030760176713d4082c0c61e58841c3eab6598b6))
- **security:** Add PlatformAdminGuard for catalog mutations (#190) ([22fc7de](https://github.com/chitrank2050/meterplex/commit/22fc7debd7c30827d477cecd848e60593aeaa256))
## [0.8.0] - 2026-05-23

### ⚙️ Maintenance

- Upgrade pnpm to v11 and migrate configuration to pnpm-workspace.yaml ([65d7cfa](https://github.com/chitrank2050/meterplex/commit/65d7cfae1a5c8f47b3befc11715da0c9483c8155))

### 📚 Documentation

- **phase-5:** Architecture doc, phase log, API reference, and Bruno collection (#186) ([829bab9](https://github.com/chitrank2050/meterplex/commit/829bab9d62ad89c26988e88e34b2e8cfab1940e5))

### 🚀 Features

- **payments:** Payment provider abstract base class + Stripe and Fake adapters (#181) ([4425aef](https://github.com/chitrank2050/meterplex/commit/4425aef36b78c2f96b4d719c563269ac4eb8f4dc))
- **payments:** Schema for payment attempts and webhook events ([2f58b26](https://github.com/chitrank2050/meterplex/commit/2f58b266ee2c864e390064f062139f696078c5b9))
- **payments:** Payment + webhook flow (#183) ([8481842](https://github.com/chitrank2050/meterplex/commit/8481842fe6bf8ba98281657d681e62c54c024259))
- **payments:** Tenant-scoped payment history endpoints (#184) ([6c81380](https://github.com/chitrank2050/meterplex/commit/6c813809e65946c0a2fab4e211741c7ff8e04260))
- **seed:** Add payment attempts, webhook events, and mark invoices paid (#185) ([78638a7](https://github.com/chitrank2050/meterplex/commit/78638a7b5e5ce85121d3e7035685be3ceadc0797))
## [0.7.0] - 2026-05-20

### ⚙️ Maintenance

- Remove unreleased header from changelog configuration ([3c94ebd](https://github.com/chitrank2050/meterplex/commit/3c94ebd0523a66e8027623ca6ccb1eca5fa50e76))

### 📚 Documentation

- Document project structure and available development scripts in setup guide and README ([7d8cade](https://github.com/chitrank2050/meterplex/commit/7d8cade7b43589926aa4ef257b8742015ada2790))
- Remove emojis from section headers in README and index documentation ([8072e0e](https://github.com/chitrank2050/meterplex/commit/8072e0e4edced3428ff31698c2202f48e9236374))
- Update project documentation in README.md ([03cfcf3](https://github.com/chitrank2050/meterplex/commit/03cfcf309f1f46583407b089ccf79461b587c4ef))
- Update project documentation in README.md ([9a8951f](https://github.com/chitrank2050/meterplex/commit/9a8951f7d2c3a2f58636ac658ab2ae9d0d0f3153))
- Update commit and branch standards to include git-hygiene enforcement details ([b6caddd](https://github.com/chitrank2050/meterplex/commit/b6cadddcf50734bbbc12167039daf7516b291e5f))
- Update README with project documentation and setup instructions ([f30e482](https://github.com/chitrank2050/meterplex/commit/f30e4823f87699a326a556828c91dae3995e9968))
- **phase-4:** Finalize documentation and Bruno collection (#127) ([a094589](https://github.com/chitrank2050/meterplex/commit/a094589324086e122bc8626737bfad09f71f7667))

### 🚀 Features

- **billing:** Schema for invoices, line items, and billing ledger (#123) ([2284783](https://github.com/chitrank2050/meterplex/commit/2284783cb88c372a7d132353a633b2ee28242509))
- **invoice:** Invoice module (#124) ([fa32aaa](https://github.com/chitrank2050/meterplex/commit/fa32aaa02210d32faf312fc837fb6bac3b901aca))
- **invoices:** Add DTOs for invoice and billing ledger endpoints ([e81699d](https://github.com/chitrank2050/meterplex/commit/e81699d2c251a7e7ee646dd2e498be325fe2a09e))
- **billing:** Automated billing cron job (#125) ([0655f7d](https://github.com/chitrank2050/meterplex/commit/0655f7d449e373a225d33cc3a45fea2ab2960119))
- **seed:** Add sample invoices and ledger entries for dev tenants (#126) ([be1d0f4](https://github.com/chitrank2050/meterplex/commit/be1d0f4759bbf8c453afe092ada90bc07f00a0a0))
## [0.6.0] - 2026-05-19

### ⚙️ Maintenance

- Add additional workflows to auto-approve check exclusion list ([79b0e5a](https://github.com/chitrank2050/meterplex/commit/79b0e5a0febc286654fe685b46de0408076c85ab))
- Replace em dashes with hyphens in workflow comments and log messages ([b8553e8](https://github.com/chitrank2050/meterplex/commit/b8553e8bf3d462b9abaff40a0d74dfec633f4749))
- Add newline for readability in CI workflow checkout step ([f4e626e](https://github.com/chitrank2050/meterplex/commit/f4e626edafbc9953e526ad921630fed12e505b20))
- Update PR title format in maintenance workflow to match conventional commit standards ([715905b](https://github.com/chitrank2050/meterplex/commit/715905bfbd381aade3c6526a4cff885ed437093b))
- Update project badges to use shields.io style in README ([2297aa1](https://github.com/chitrank2050/meterplex/commit/2297aa185099f978ed54693833eb5a35c91d7e1d))
- Simplify commit authorship display and add contributors section to changelog template ([18389a7](https://github.com/chitrank2050/meterplex/commit/18389a73da669e8703a86b48f55dccdf62470242))
- Update dependencies in pnpm-lock.yaml ([a02555f](https://github.com/chitrank2050/meterplex/commit/a02555f84b869219e68d2991870d6618cb5c5abc))
- Add pnpm override for fast-uri to package.json ([5419262](https://github.com/chitrank2050/meterplex/commit/541926268eb06da0bd171b31e2347b768cf25475))
- Update setup-bot action configuration and fix typo in schema comment ([b7a4b52](https://github.com/chitrank2050/meterplex/commit/b7a4b52f0c08a0cfc30ac18c98a66ba62bc3171c))
- Add write permissions for contents and pull-requests to setup-bot action ([ff4c448](https://github.com/chitrank2050/meterplex/commit/ff4c448dd393d74f64f1c595f5ed5b979c5824c3))
- Add debug profile to kafka-ui service in docker-compose ([ee2366e](https://github.com/chitrank2050/meterplex/commit/ee2366e7d643943e75d8b2178185f804ba673935))
- Replace em-dash symbols with hyphens in documentation files ([90d02be](https://github.com/chitrank2050/meterplex/commit/90d02bed64f50e5985603c1c3c70212b7b0220d5))

### 🐛 Bug Fixes

- Update BOT_USER logic to correctly resolve app slug or fallback to default bot account ([e01190a](https://github.com/chitrank2050/meterplex/commit/e01190a4b47603fdda671c60cc692e96efcf5403))
- Hardcode bot username in auto-approve workflow to prevent credential lookup failures ([a0d265f](https://github.com/chitrank2050/meterplex/commit/a0d265ff741ed7c572fd1f0c6fdfe38ae9a31265))
- Remove repository restriction from setup-bot GitHub action configuration ([79785b5](https://github.com/chitrank2050/meterplex/commit/79785b565df68389ad325495548ca32ff7e4c554))

### 📚 Documentation

- Update contributing guidelines to include additional conventional commit types ([c9230be](https://github.com/chitrank2050/meterplex/commit/c9230be09857e6c7295a753e6cb9f1dfa8b9f666))
- Add architectural documentation for the usage event pipeline ([82e48f7](https://github.com/chitrank2050/meterplex/commit/82e48f79eb689cc2b0fb4f6a77580aaab0904f7d))
- **phase-3:** Finalize documentation ([c6fb3bb](https://github.com/chitrank2050/meterplex/commit/c6fb3bbeb4b75b99fdf3c1c131ac5fe2d88f6abc))
- **phase-3:** Finalize bruno collection ([0d8f397](https://github.com/chitrank2050/meterplex/commit/0d8f39724513d0b4ed6a9c3bcdfa96c58902cc2a))
- Add architecture documentation for Phase 3 usage event pipeline ([319a74e](https://github.com/chitrank2050/meterplex/commit/319a74e2a4bf8a51895461674ceb1468eac8d3cd))

### 🚀 Features

- Add DTOs for usage event ingestion and batch processing validation ([5abfc95](https://github.com/chitrank2050/meterplex/commit/5abfc957e047c6df5b77e69b91f177fcfaf2a3c2))
- Implement usage event ingestion module with API key auth and transactional persistence ([e09e227](https://github.com/chitrank2050/meterplex/commit/e09e22712d7821ee3ceee9490a6f5a4e1dc49cfa))
- **usage:** Usage events ingestion API with transactional outbox ([d31449a](https://github.com/chitrank2050/meterplex/commit/d31449ad7782c1aa6d59f4f8b89c97dcefac1a34))
- Implement Kafka module with producer service and abstract consumer base class ([154960d](https://github.com/chitrank2050/meterplex/commit/154960ddaaf14cb436e2360d097d07d20f671b98))
- Implement outbox publisher service with Kafka integration and scheduled polling ([411240c](https://github.com/chitrank2050/meterplex/commit/411240c49781381a9380c573c508426e317a94f3))
- **kafka:** Kafka infrastructure + outbox publisher worker ([12e7439](https://github.com/chitrank2050/meterplex/commit/12e7439dff6b3e0e73e42eb74490dfdc3ddeca43))
- **usage-pipeline:** Validation + aggregation Kafka consumers ([6369ec0](https://github.com/chitrank2050/meterplex/commit/6369ec075553f8a9dae6d7671cf758b45a28a8d7))
- **usage-validation:** Complete all validation checks per issue spec ([d036ccb](https://github.com/chitrank2050/meterplex/commit/d036ccb9e7480fc862e69c17ddadfaa86ab20602))
- Add ioredis dependency to package.json and update lockfile ([efcd75c](https://github.com/chitrank2050/meterplex/commit/efcd75c7ead3c2ec6dfd6c93078f59f062a99155))
- **redis:** Add Redis module + cache writes in aggregation consumer ([bb25ce1](https://github.com/chitrank2050/meterplex/commit/bb25ce1e06b46dfa4c20db03a7df307966761093))
- **dead-letter:** Consumer that persists failed events for investigation ([0c80f6a](https://github.com/chitrank2050/meterplex/commit/0c80f6afb3ddd62c792b6bac09bfb61bd8f2fdca))
- **entitlement-check:** Replace in-memory Map with Redis + Postgres ([4890bd2](https://github.com/chitrank2050/meterplex/commit/4890bd2cd9114f1ed7673d8956c347b76426ca20))
- **idempotency:** Add Redis SETNX fast dedup at ingestion layer ([274fd65](https://github.com/chitrank2050/meterplex/commit/274fd6584b65f6682b226f12d24dc03e33d8cbf6))
- **seed:** Add realistic usage data for dev tenants ([6d292d8](https://github.com/chitrank2050/meterplex/commit/6d292d88abf8f634bbce40c71c1a9e26f62a058a))

### 🚜 Refactoring

- Migrate pnpm overrides to workspace configuration and optimize ScheduleModule init ([a292f07](https://github.com/chitrank2050/meterplex/commit/a292f073cb9d60a8275857b33353a1af32214131))
## [0.5.7] - 2026-04-28

### ⚙️ Maintenance

- Update branch name validation error message and set default npm loglevel to error ([97371bc](https://github.com/chitrank2050/meterplex/commit/97371bcb29d2ea82111e2ec817507f45ec7679ba))
- Increase stale closure threshold and add pinned and security labels to exemption lists ([5e9a166](https://github.com/chitrank2050/meterplex/commit/5e9a166340188c93d48dfff4a4e653417664fac5))
- Renovate config to include merge confidence, refine matching rules & group actions deps ([196c80c](https://github.com/chitrank2050/meterplex/commit/196c80c104fd80c16f747cbb82910cdf747c429f))
- Update contents permission to write in auto-approve workflow ([23e6e24](https://github.com/chitrank2050/meterplex/commit/23e6e247454f491bd841d6998f70311182ec67fb))
- Standardize version sync workflow and update changelog formatting and tag pattern ([79339b3](https://github.com/chitrank2050/meterplex/commit/79339b3ebbec3f8891ea92b95d9121b0aeca14bc))
- Remove commitlint configuration and dependencies ([f4a884c](https://github.com/chitrank2050/meterplex/commit/f4a884cb4341b48f68aab9a932ee70be0991d876))
- Update git-cliff configuration with backend-focused commit parsing and templating ([3c1f521](https://github.com/chitrank2050/meterplex/commit/3c1f521eee376faf9ff3cd96b3836cfe5f07ed99))
- Remove *.md from .prettierignore to enable markdown formatting ([f2562d5](https://github.com/chitrank2050/meterplex/commit/f2562d550f3c726e536ca2fb213d430025aad774))
- Update CI workflow to remove commitlint config and point to new ESLint configuration file ([502c8aa](https://github.com/chitrank2050/meterplex/commit/502c8aaa9f528cf76a8164a48abfee4feb5e1c58))
- Remove nest-cli schema reference and suppress deprecation warnings in tsconfig ([1a39bf5](https://github.com/chitrank2050/meterplex/commit/1a39bf59b3ed3c4bd1cce5e69e340ecee1e7d880))
- Remove nest-cli schema reference and suppress deprecation warnings in tsconfig ([b8d9fb0](https://github.com/chitrank2050/meterplex/commit/b8d9fb04cd5837ad30185b4804f563bfd8abf621))
- Update lefthook configuration for improved pre-commit workflow efficiency ([90ef219](https://github.com/chitrank2050/meterplex/commit/90ef219b64094f0096b258105c0e665af8a5a1cd))
- Update git-hygiene action to v0.4.12 across workflow files ([d7bb52d](https://github.com/chitrank2050/meterplex/commit/d7bb52db5ade0ec1ba8272d0ec35e87e9ac6f48e))
- Update git-cliff configuration ([7c2bc0c](https://github.com/chitrank2050/meterplex/commit/7c2bc0cb138db43ad45fe86ffea02ce92b7a306e))
- Add workflow timeouts and update pnpm install commands to ignore scripts ([2ab4967](https://github.com/chitrank2050/meterplex/commit/2ab4967685efab0cb7bc42595ac3c912ed351efb))
- Update checkout action configuration with emoji and fetch-depth in lint workflow ([a8c0ba7](https://github.com/chitrank2050/meterplex/commit/a8c0ba7d9f6f9c702bb382631e7dadf8b1910cf6))
- Update git-cliff arguments to standardize changelog generation during releases ([4e1522e](https://github.com/chitrank2050/meterplex/commit/4e1522e54971144319c35e62da2c819fd6c1036b))

### 📚 Documentation

- Add header documentation to auto-approve workflow file ([a120849](https://github.com/chitrank2050/meterplex/commit/a120849a8211d5f7dd95d69cd42b7acb9cc59d9d))
- Update project documentation in README.md ([dd0edbb](https://github.com/chitrank2050/meterplex/commit/dd0edbbbc58e133ca723e3dc2b86994b23dc1892))
- Standardize changelog format and fix duplicate headers ([7a48c4b](https://github.com/chitrank2050/meterplex/commit/7a48c4b610f0fe298f72a942a33c2b823c8a6c82))

### 🚀 Features

- Implement conditional token selection in auto-approve workflow to handle bot-created PRs ([5d8d985](https://github.com/chitrank2050/meterplex/commit/5d8d985ec8619e3382926eb52a65b4ac0d61e097))
- Implement conditional token selection in auto-approve workflow and update changelog formatting ([8445a24](https://github.com/chitrank2050/meterplex/commit/8445a240b73aa1370fc6a8ccc4be9aeb588dd07a))
- Enable automatic staleness exemptions for assigned, milestoned, and draft issues and PRs ([1c5ec27](https://github.com/chitrank2050/meterplex/commit/1c5ec27f705734e26854d27cdb357ba332e440c1))
- Implement stricter security validation for auto-approvals & optimize PR verification workflow ([d354e07](https://github.com/chitrank2050/meterplex/commit/d354e07db1a44a69d0047d660ee1cb5811361d89))
- Add automatic PR approval step to the auto-approve workflow ([0b7fbde](https://github.com/chitrank2050/meterplex/commit/0b7fbde69842e3403e2dcc45c71ee8d03a1cccd2))
- Add chore/release-* branches to auto-approve workflow triggers and release detection ([a2ae18a](https://github.com/chitrank2050/meterplex/commit/a2ae18a8539945c52bfe9a779f86e672fcf2e216))
- Implement conditional PR approval logic to switch between bot identities based on author ([926bad6](https://github.com/chitrank2050/meterplex/commit/926bad63179db4b4bafbf1e6e28f10de272e3c81))

### 🚜 Refactoring

- Consolidate CI flow to run parallel build & quality checks and update doc Python deps ([b33bec4](https://github.com/chitrank2050/meterplex/commit/b33bec46e5d457919f9a090dbb97d749c8d63621))
- Improve auto-approve security by resolving true author & adding draft/mergeability checks ([0d2b880](https://github.com/chitrank2050/meterplex/commit/0d2b880b87b301aef2af61a5fdde474f08d67da7))
- Replace auto-approve logic with direct auto-merge enablement in CI workflow ([467f009](https://github.com/chitrank2050/meterplex/commit/467f00964e913d523234c98d29cd212f2c6018bc))
- Consolidate branch and PR title validation using git-hygiene ([333bfd3](https://github.com/chitrank2050/meterplex/commit/333bfd38b2853f58724f734160876b8e909f224b))
- Automate release versioning with git-hygiene and add build step to finalization workflow ([40aa8ed](https://github.com/chitrank2050/meterplex/commit/40aa8ed832c37101facb50f98389dc3b101153e6))
- Reformat doc and issue templates to improve table alignment & stylistic consistency ([9a3aec6](https://github.com/chitrank2050/meterplex/commit/9a3aec6fe83bf0bcaac57f11c2f9070a196f7c81))
- Standardize changelog architecture ([89c2a3b](https://github.com/chitrank2050/meterplex/commit/89c2a3bb49cc2f5422d37ad9239f3092f51502b0))
- Modernize git-cliff configuration and update CI workflow automation ([74334b3](https://github.com/chitrank2050/meterplex/commit/74334b3bf7c22813546a40408500f14cf8b756cd))
## [0.5.6] - 2026-04-26

### ⚙️ Maintenance

- Remove automated README version updates from release workflows ([1b060e5](https://github.com/chitrank2050/meterplex/commit/1b060e56690416809f22d152fe144e05f86743c9))
- Update Renovate reviewer settings and improve auto-approval workflow logic ([1103e66](https://github.com/chitrank2050/meterplex/commit/1103e665a93599cf9d2d819374fdaa4ebc7dc17e))
- Clear assignees and enable grouping for non-major dependencies in renovate config ([e50c419](https://github.com/chitrank2050/meterplex/commit/e50c41935aa0f76405d5e600a1d123dffd3b63b7))
- Update auto-approve workflow to use generated GitHub token ([596908a](https://github.com/chitrank2050/meterplex/commit/596908a843d69fed3f86d9748535daae5c34fc52))
- Update lefthook configuration to optimize pre-commit hook execution ([d74aa01](https://github.com/chitrank2050/meterplex/commit/d74aa01a1b62cfa25eeb3d3c53e20654456ee5a2))
- Add release, maintenance, and automated-pr labels to semantic-pr ignore list ([c4cdbce](https://github.com/chitrank2050/meterplex/commit/c4cdbce25b6f722f3113dc3ca38a4b2f0d829fe8))

### 📚 Documentation

- Update CI/CD doc to reflect the new two-step release workflow & streamlined automation rules ([853e21c](https://github.com/chitrank2050/meterplex/commit/853e21c76caf1181bfc29a61c42358f95bae6309))

### 🚀 Features

- Enable auto-merge and squash for approved pull requests in auto-approve workflow ([8a3a3fe](https://github.com/chitrank2050/meterplex/commit/8a3a3fea083130c52e84ed28ca6eb04b0aaacbf5))
- Implement two-step release workflow & add repository owner auth checks to automated workflows ([1f0a05c](https://github.com/chitrank2050/meterplex/commit/1f0a05c64fa000f8daec1239cc6d030de9430176))
- Add owner identity verification to git-tag and git-release scripts ([4e9f5cb](https://github.com/chitrank2050/meterplex/commit/4e9f5cb9c9515de84c97d759ce059cd1ec0a985a))

### 🚜 Refactoring

- Restrict prepare & release jobs to trigger only on manual dispatch & tag pushes ([fd084aa](https://github.com/chitrank2050/meterplex/commit/fd084aadcef8c7c931e57cd7fd0aec1f02d402f0))
## [0.5.5] - 2026-04-25

### ⚙️ Maintenance

- Harden CI/CD runners with step-security audit policy across all workflows ([b539033](https://github.com/chitrank2050/meterplex/commit/b539033fb8da34a38b2f917fa1c4b2e51baa9e0b))
- Configure production environment and release URL in git-release workflow ([653bcaf](https://github.com/chitrank2050/meterplex/commit/653bcaf067f644aa9a3c3ad623a8e0ec6c0ee499))
- Pin mkdocs-material version to 9.7.6 in documentation workflow ([a4053c4](https://github.com/chitrank2050/meterplex/commit/a4053c467dd130c74bbcd9c90094429c20253a25))
- Add main, master, and gh-pages to branch name validation ignore list ([5a7480d](https://github.com/chitrank2050/meterplex/commit/5a7480d20b66570fcb59437dd807a52604bd3580))
- Allow main, master, and gh-pages branch names in validation rules ([b782811](https://github.com/chitrank2050/meterplex/commit/b782811a03df943040dab319442a7b1d3f63e6fc))
- Configure renovate bot with labels, assignees, and branch pattern support ([e2dc7ad](https://github.com/chitrank2050/meterplex/commit/e2dc7add2a449769cf77bb41531a702b0e7c3819))
- Restrict workflow triggers to main branch for branch validation and linting ([14a9905](https://github.com/chitrank2050/meterplex/commit/14a990597e0319a6d874c9d0fa03308c8e34b494))
- Restrict workflow triggers to main branch and update documentation deployment logic ([9fb265a](https://github.com/chitrank2050/meterplex/commit/9fb265aefa244a54a3f81c5fd38ca0d31e3d8a35))
- Categorize codebase ownership in CODEOWNERS file ([300d5e0](https://github.com/chitrank2050/meterplex/commit/300d5e096daf3e1037a4fc1bd73c6b734273051b))
- Update git-cliff configuration and reformat knip configuration file ([85ea535](https://github.com/chitrank2050/meterplex/commit/85ea535529ee9edff4c46793a9385493a15b3058))
- Set fetch-depth to 0 in branch-name workflow to ensure complete history access ([7fb7e15](https://github.com/chitrank2050/meterplex/commit/7fb7e15c69d62ef7500c7020a18aef828eab83b9))
- Organize package.json scripts with category labels and reorder entries ([b4dc7dd](https://github.com/chitrank2050/meterplex/commit/b4dc7dd5719098f8f64cbbeafdf6139490bbcf6d))
- Apply principle of least privilege by scoping workflow permissions to specific jobs ([7cb288b](https://github.com/chitrank2050/meterplex/commit/7cb288b62ff013252ef1e62d2b553494ef74a55c))
- Update project metadata and add relevant keywords to package.json ([33103d2](https://github.com/chitrank2050/meterplex/commit/33103d22329574933c9c4f0b09fcfcd2667be429))
- Upgrade actions/create-github-app-token to v3.1.1 ([034e3dc](https://github.com/chitrank2050/meterplex/commit/034e3dc8045be4fcb7ac6bd1b4d92e4144d89496))
- Update github app token credentials to use specific bot account secrets ([7115895](https://github.com/chitrank2050/meterplex/commit/71158951e0597c9b4b7b0f7525cde2cf2957ee84))
- Include .github/actions directory in area/ci labeler configuration ([56c78cd](https://github.com/chitrank2050/meterplex/commit/56c78cd61da7d067b5c27a7a44c77d32e2ca982e))
- Remove redundant path filter from workflow linting action ([ac4cd5f](https://github.com/chitrank2050/meterplex/commit/ac4cd5f7315433ecf59f4a5286f3a30d744bed21))
- Update node engine requirement to >=24.0.0 and sync README versions ([86bb09c](https://github.com/chitrank2050/meterplex/commit/86bb09c1f257e830d97215152a3dffb3ad7eb50f))
- Configure git-cliff to ignore merge commits and redundant changelog updates ([0c84432](https://github.com/chitrank2050/meterplex/commit/0c844323571b5ad29bd255699f7dbdee9502281f))
- Update build provenance attestation to target CHANGELOG.md instead of repository sha ([b98ba5d](https://github.com/chitrank2050/meterplex/commit/b98ba5db1ee3fef96e8b6b4c0713abe9768baab2))
- Enable GitHub authentication for git-cliff to resolve commit author usernames ([cedfc33](https://github.com/chitrank2050/meterplex/commit/cedfc33eac4d5aa7e297098ada9de40333299bfe))

### 🐛 Bug Fixes

- Broaden CI success criteria and relax Renovate actor validation in auto-approve workflow ([f4baf2f](https://github.com/chitrank2050/meterplex/commit/f4baf2f4648eadda0cfcf19ce412f5cc1d53dfb1))
- Add fallback logic to retrieve actor, branch, and PR number in auto-approve workflow ([c81c513](https://github.com/chitrank2050/meterplex/commit/c81c5134b3ba0467f49132b851a7bf36a468d860))
- Explicitly pass repository to gh cmd to ensure correct context resolution in auto-approve ([4129e3b](https://github.com/chitrank2050/meterplex/commit/4129e3b7dcc806e50170feb70beadbbc9197c293))
- Update check logic in auto-approve flow to correctly filter by completion status & conclusion ([c682ac0](https://github.com/chitrank2050/meterplex/commit/c682ac008e82b0e454907f22515f3d80e6aeccb8))
- Remove auto flag from renovate pr merge command to prevent workflow errors ([41d2e1c](https://github.com/chitrank2050/meterplex/commit/41d2e1c9975c02fc9b5a1998b741a2050441a09e))
- Update git-cliff args to use HEAD and skip metadata fetch to resolve PR 404 errors ([368a014](https://github.com/chitrank2050/meterplex/commit/368a0143e4481cc6d26f8f376964bd5046a8f6da))

### 👷 CI/CD & Infra

- Add OpenSSF Scorecard workflow and update README documentation ([020af60](https://github.com/chitrank2050/meterplex/commit/020af60a6164437e717bf69b100d5f3fbf87536b))
- Workflow for automated PR and renovate auto approval (#78) ([95263f7](https://github.com/chitrank2050/meterplex/commit/95263f73ae5e21185a86e4b14b24c2302e85173e))
- Add automated labeler and stale issue management workflows and update project documentation ([9e8bc18](https://github.com/chitrank2050/meterplex/commit/9e8bc186c01a8ddc75759d6972d41ca5cb045082))
- Add prisma schema validation and comment out experimental knip analysis in CI workflow ([8fee8f4](https://github.com/chitrank2050/meterplex/commit/8fee8f41d2da507b6279b1329d85f5d822193b7e))
- Parallelize linting, formatting, and security audit tasks in the CI workflow ([c45eb8a](https://github.com/chitrank2050/meterplex/commit/c45eb8a6e4b5e70cd91862d0a4a032d9381a070c))
- Optimize Prisma caching in workflows, remove redundant pnpm & enforce zero warnings in TS lint ([d83f6e9](https://github.com/chitrank2050/meterplex/commit/d83f6e9c26b002b3f094f3917be71be41b84d9c2))
- Disable PR template autofill for releases, docs in CI change detection & release PR body content ([dd16026](https://github.com/chitrank2050/meterplex/commit/dd16026e8b3f8ac828c7f313b85e12bbf2b33620))

### 📚 Documentation

- Add documentation for CI/CD infrastructure and automated maintenance workflows ([df61e9a](https://github.com/chitrank2050/meterplex/commit/df61e9a970378ed74c672c690f541db1ee671546))
- Add build provenance and production environment access control sections to CI/CD guide ([c419e8f](https://github.com/chitrank2050/meterplex/commit/c419e8fc8259c41d64d267c6bcea138a5b92a206))
- Update CI/CD documentation with performance optimizations and improved governance policies ([4640c97](https://github.com/chitrank2050/meterplex/commit/4640c97b5fdd9361094da9e41277a97a26cf03cf))
- Update infrastructure principles and add documentation for Knip zombie code detection ([d0288a6](https://github.com/chitrank2050/meterplex/commit/d0288a6e1f06dd1d4677e413d5374748a7f15ef2))
- Update security policy & repo doc with current version sup & vulnerability report guidelines ([2b5aa63](https://github.com/chitrank2050/meterplex/commit/2b5aa6327b6c2a89f99d8803046f607b82f3b6ef))
- Update project documentation in README.md ([316e3e8](https://github.com/chitrank2050/meterplex/commit/316e3e8a0b0f95ad1ddad536792a44006d2e0bbb))
- Update minimum Node.js version requirement to 24.0.0 in README and setup documentation ([2d1f80f](https://github.com/chitrank2050/meterplex/commit/2d1f80fcec3cd5f08263cabadaf3a0c70f18d894))

### 🚀 Features

- Add required permissions and build provenance attestation to release workflow ([aadc436](https://github.com/chitrank2050/meterplex/commit/aadc4360a78214e4a6dba924b18672bbbc310de2))
- Implement branch name validation workflow and configuration ([be6d7cb](https://github.com/chitrank2050/meterplex/commit/be6d7cb727e02ddc2e2a32d5a666e02f9d0ad7e4))
- Implement smart auto-approval workflow for non-major Renovate deps updates and update doc ([d457376](https://github.com/chitrank2050/meterplex/commit/d45737620161b35bec805d4c6d7342f3110ac49e))
- Add security tool checks to installation script and expand obliviate cleanup scope ([13d163b](https://github.com/chitrank2050/meterplex/commit/13d163bb32eade7b0ecba81d4b2ce6eb71cff538))
- Add Kafdrop Kafka UI and configure resource limits for infrastructure services ([fa94af3](https://github.com/chitrank2050/meterplex/commit/fa94af3356dd1dc5db1fc0a3e0a9ce82abb1a5f9))
- Add automatic env configuration to install script & streamlined setup cmd in package.json ([2950a95](https://github.com/chitrank2050/meterplex/commit/2950a9511c44aec616f5aa6b9cb9c3987e455b2c))
- Implement centralized shell logging utility and standardize developer CLI scripts ([fa72ad9](https://github.com/chitrank2050/meterplex/commit/fa72ad9705c41b671016367ae97a14db18801b8c))
- Introduce interactive setup wizard with task selection and script execution automation ([9b42054](https://github.com/chitrank2050/meterplex/commit/9b42054b4060528501ae49b9a24a240a7de32e64))
- Rename setup to dev:init, enhance wizard with knip & streamline infra orchestration doc ([ac79abe](https://github.com/chitrank2050/meterplex/commit/ac79abedaa682ca00ec82976dd024ed84644462a))
- Update Kafka volumes and refine Postgres health checks and migration commands in setup scripts ([ad37606](https://github.com/chitrank2050/meterplex/commit/ad376060e8bcf1456356f8dd9629713084185492))
- Add Code of Conduct to docs, include transient files in CI, and configure Google Analytics ([8621115](https://github.com/chitrank2050/meterplex/commit/8621115691caa72aacb523281e33ab6017acf519))
- Upgrade auto-approval workflow to use dedicated GitHub App token for enhanced permissions ([6ba518b](https://github.com/chitrank2050/meterplex/commit/6ba518b77ad11e2b54d9b6eecbba1453e283dbbb))
- Workflow-generated pull requests to chitrank2050 across maintenance and release automation ([6544fe4](https://github.com/chitrank2050/meterplex/commit/6544fe45d3b3ed7e8e253880cf5600beb95f9257))
- Add maintenance branch type, update labeling and CI logic, and doc automation standards ([9efed5a](https://github.com/chitrank2050/meterplex/commit/9efed5acae2549c0e22c5b41d3eab996f339b1a6))
- Automated zero-noise PR descriptions using git-cliff and prune PR template boilerplate ([e24e781](https://github.com/chitrank2050/meterplex/commit/e24e7815a5b963736134233150e1ab501ad8178a))
- Add reopened trigger and workflow_dispatch to PR autofill action ([21d730f](https://github.com/chitrank2050/meterplex/commit/21d730f19fa3c7c6655401563a2c786f5983fd8f))
- Skip PR autofill for release-labeled pull requests to preserve existing descriptions ([794c577](https://github.com/chitrank2050/meterplex/commit/794c5772de63dcb661bbc5673abc0077d9aae81d))

### 🚜 Refactoring

- Migrate auto-approve workflow to triggered-by-workflow_run with verification logic ([037451d](https://github.com/chitrank2050/meterplex/commit/037451dbccb6316349846244ddd0ac7fb75553e6))
- Split linting jobs and add Prisma caching to CI while cleaning up auto-approve trigger ([a82436f](https://github.com/chitrank2050/meterplex/commit/a82436ff3bb05aa40435f3567f2c0a67f8da58bb))
- Simplify branch validation logic by removing redundant steps and using regex  eval ([6c97024](https://github.com/chitrank2050/meterplex/commit/6c970242ee1ceed2506e261536e38f99757c9a40))
- Centralized setup-bot action & update flows to use GH App tokens instead of GITHUB_TOKEN ([8e5a644](https://github.com/chitrank2050/meterplex/commit/8e5a6441928173a4fe39f069d0127ea5396d1dad))
- Refactor repo checkout order and adopt manual git authentication in CI workflows ([49242a3](https://github.com/chitrank2050/meterplex/commit/49242a375f8cce7b4a0eda599b0344f589884547))
- Rename to auto-approve instead of merging ([be09efd](https://github.com/chitrank2050/meterplex/commit/be09efd77113a1520abb5268f7c84eb43c6ce011))
- Consolidate linting and security audit jobs to reduce CI runner overhead ([d4e1179](https://github.com/chitrank2050/meterplex/commit/d4e11794258bd6801a4bc78306aa440ebc33b6e7))
- Decouple release workflow into separate prepare and release stages with manual approval ([71508dc](https://github.com/chitrank2050/meterplex/commit/71508dc533d81ff8e870f411c547b6d434815623))
- Move release PR check to job conditions & update auto-approve workflow to use GITHUB_TOKEN ([0a9afb8](https://github.com/chitrank2050/meterplex/commit/0a9afb8eafb08c4649c6edfab6bc78ef03af58df))
## [0.5.4] - 2026-04-25

### ⚙️ Maintenance

- Update linting pipeline to run TypeScript and Markdown checks and disable Knip ([2a4160f](https://github.com/chitrank2050/meterplex/commit/2a4160f2b6688b422d8f377c09eb6db081d489c1))
- Add pnpm installation step to git-release workflow ([82bb488](https://github.com/chitrank2050/meterplex/commit/82bb488b13998beeaca345f1db3bf18621bf4fe1))
- Update changelog generation to use git-cliff output directly instead of CLI command ([312d7a5](https://github.com/chitrank2050/meterplex/commit/312d7a544957bc6457fc52f53e0bdf4b735249e9))
- Enforce Node 24 for GitHub Actions in release and CI workflows ([e2fe257](https://github.com/chitrank2050/meterplex/commit/e2fe257ea508dcbb53fe5fc575152c7d0bfda9d3))
- Streamline changelog generation using git-cliff-action and clean up temporary files ([a565dfd](https://github.com/chitrank2050/meterplex/commit/a565dfd6a4f7a04b14dc276ec2e3205113c427fd))
- Pin GitHub Actions to specific commit hashes for security ([3de4382](https://github.com/chitrank2050/meterplex/commit/3de4382d43365c67bf929d44c89bc650bcc0d072))
- Update GitHub Actions dependencies to latest versions ([136d12a](https://github.com/chitrank2050/meterplex/commit/136d12ac85f9a82950ecacd7dd430592abf527d6))
- Disable persist-credentials in all GitHub Actions checkout steps ([d9f1a21](https://github.com/chitrank2050/meterplex/commit/d9f1a21fe2dd2582b0dd5dc30db9d38ee4f4fbfc))
- Pass git-cliff output to gh release via environment variable ([45a232f](https://github.com/chitrank2050/meterplex/commit/45a232f7f9604453656d1b011605c7652c1ed752))

### 👷 CI/CD & Infra

- **deps:** Bump the all-actions group across 1 directory with 3 updates (#72) ([5409df5](https://github.com/chitrank2050/meterplex/commit/5409df573d3069b5449002693dc92888f30e9e11)) by [dependabot[bot]](https://github.com/apps/dependabot)

### 📚 Documentation

- Add zizmor installation guide and security audit documentation ([4e3c6a5](https://github.com/chitrank2050/meterplex/commit/4e3c6a5eaef8b7e926f15439f8a2a65f33506902))

### 🚀 Features

- Add workflow_dispatch support to trigger releases with custom tags ([63de204](https://github.com/chitrank2050/meterplex/commit/63de204745c17e3b73b7ee4ab7b8251c5388a7a8))
- Add zizmor linting for GitHub Actions to project scripts and lefthook configuration ([25343ef](https://github.com/chitrank2050/meterplex/commit/25343efaab40f221d2bb991ed761de4ea4d1ab4d))

### 🚜 Refactoring

- Update release workflow to generate changelog via automated PR instead of direct commit ([8b12cfe](https://github.com/chitrank2050/meterplex/commit/8b12cfe45475f48978f194bf54620ce4d3e86d2a))
- Replace action-gh-release with GitHub CLI for release creation ([9a2d8d5](https://github.com/chitrank2050/meterplex/commit/9a2d8d5107daceeba3f3c0119540c007d9553cc5))
## [0.5.3] - 2026-04-24

### ⚙️ Maintenance

- Automate CHANGELOG.md updates in release workflow and document maintenance changes ([75f8b0c](https://github.com/chitrank2050/meterplex/commit/75f8b0c0405a5afdf7584862d68fd868830aaff4))

### 📚 Documentation

- Add developer workflow and automated maintenance sections to documentation ([18041fa](https://github.com/chitrank2050/meterplex/commit/18041fa41dd6cbcc1c46244f770048baae0cf8de))

### 🚀 Features

- Modernize documentation theme with custom CSS and enhanced MkDocs Material configuration ([566817e](https://github.com/chitrank2050/meterplex/commit/566817e101732d804e755f2634ce763ada4ca96b))
## [0.5.2] - 2026-04-24

### ⚙️ Maintenance

- Update lockfile dependencies ([b42ffa5](https://github.com/chitrank2050/meterplex/commit/b42ffa54a819b8a99db95b4e5a2243990c190cf5))
- Downgrade pnpm/action-setup to version 5 ([9d49dad](https://github.com/chitrank2050/meterplex/commit/9d49dad8c38c955fc067204b3f855c8a0172e1d2))
- Update pg dependency position and upgrade markdownlint-cli to v0.48.0 ([1ee8701](https://github.com/chitrank2050/meterplex/commit/1ee87012af721f51165ff74b4b238bcd55e30487))
- Update markdown tables to use consistent left-aligned formatting ([60383e9](https://github.com/chitrank2050/meterplex/commit/60383e9645dc2a9ee0d3e965d4bf84ba0dccfa0f))
- Upgrade PostgreSQL to 18, Kafka to 4.2, and Redis to 8 across infrastructure and doc ([f6f23ae](https://github.com/chitrank2050/meterplex/commit/f6f23ae1e95bc45a903a433fea9602fbbc25be9b))
- Update dependencies and add deps:update script ([efdb55d](https://github.com/chitrank2050/meterplex/commit/efdb55dc8eb1f7cba1dafad18e7249e8c8fb2c10))
- Update workflow trigger paths and replace husky with lefthook configuration ([9663e2b](https://github.com/chitrank2050/meterplex/commit/9663e2b5c1dac2d10ff8ff8a3b2e9772a03fd7ff))
- Prune pnpm dependency overrides and add automated maintenance workflow for cleanup ([1422ea5](https://github.com/chitrank2050/meterplex/commit/1422ea5ad786623cf095570b56a429d206847c41))
- Update lefthook configuration for improved pre-commit workflow ([eb8319f](https://github.com/chitrank2050/meterplex/commit/eb8319ff9e9ec41b6444d52f09d65080d4b02935))
- Update lefthook configuration to optimize pre-commit hook execution ([b87ae74](https://github.com/chitrank2050/meterplex/commit/b87ae741846df98ee80884cfea13a44aaaa242ba))
- Update git-cliff configuration with emojis and additional commit categories ([5a2576b](https://github.com/chitrank2050/meterplex/commit/5a2576b6d2d7add6fd2253baf8f28ac5659379d7))
- Update OSV-Scanner version to v2.3.5 in CI and maintenance workflows ([88fc1e4](https://github.com/chitrank2050/meterplex/commit/88fc1e4e49a9dc6659feb60944658b747fa04550))
- Enhance CI/CD workflow documentation and standardize naming with icons ([27fd769](https://github.com/chitrank2050/meterplex/commit/27fd769fc00bb3a50795b5b51fdce3edc5fc4273))
- Improve workflow maintainability with descriptive comments and updated ignore patterns ([9991736](https://github.com/chitrank2050/meterplex/commit/9991736abd817e1072a02055d6a627e4b227d4eb))

### 🐛 Bug Fixes

- **deps:** Update dependency uuid to v14 (#58) ([b5cecf1](https://github.com/chitrank2050/meterplex/commit/b5cecf141733bb46716ebf2a5f3fb3584bf7831b)) by [renovate[bot]](https://github.com/apps/renovate)

### 👷 CI/CD & Infra

- Replace OSV-Scanner action with direct binary execution in CI and maintenance workflows ([c2b9a9c](https://github.com/chitrank2050/meterplex/commit/c2b9a9c5f207032999299904129714503b2b0ab1))
- Add zizmor workflow for security analysis of GitHub Actions ([3eb326f](https://github.com/chitrank2050/meterplex/commit/3eb326f6324bbf22a74eed1cf9f18253c5843796))
- Add semantic pull request title validation workflow ([4403638](https://github.com/chitrank2050/meterplex/commit/44036386200ebba7c75725db393c70187d172b6b))

### 📚 Documentation

- Enhance README with badges and disable automatic documentation deploy workflow ([be257c1](https://github.com/chitrank2050/meterplex/commit/be257c137f9ee3f0c975f218303533aaff97fd2e))
- Replace em-dashes with hyphens in setup guide and cleanup lefthook configuration ([eabe5fc](https://github.com/chitrank2050/meterplex/commit/eabe5fcf0479d00250ec90eb737b79a7a546e312))

### 🚜 Refactoring

- Replace Husky and lint-staged with Lefthook for git hook management ([f94704c](https://github.com/chitrank2050/meterplex/commit/f94704c49495a67d952be7e30ad8a2d6228fdbcc))
## [0.5.1] - 2026-04-16

### ⚙️ Maintenance

- Upgrade pnpm/action-setup to v6 and update lockfile ([8fb9ed4](https://github.com/chitrank2050/meterplex/commit/8fb9ed402c15963d4dad5cb83ddc1de82dc1036d))

### 👷 CI/CD & Infra

- **deps-dev:** Bump globals from 16.5.0 to 17.5.0 (#40) ([b6e1b57](https://github.com/chitrank2050/meterplex/commit/b6e1b57809b612110efb8a3903db15e12980e0fa)) by [dependabot[bot]](https://github.com/apps/dependabot)

### 🚀 Features

- **usage:** Schema for usage events, outbox, aggregates, and dead letter queue ([173c6f6](https://github.com/chitrank2050/meterplex/commit/173c6f6a8ce7aa85eafb544fe80ae943eb0028ad))
## [0.5.0] - 2026-04-16

### ⚙️ Maintenance

- Add Bruno collection for all Phase 2 endpoints ([9d809e3](https://github.com/chitrank2050/meterplex/commit/9d809e3f5101705e7e5d9a5c8cd454e4b2fcc7c7))
- Update dependencies in pnpm-lock.yaml ([5814062](https://github.com/chitrank2050/meterplex/commit/5814062bc64bab8151c1572c71cac1b27c4990da))

### 🚀 Features

- Implement entitlement module DTOs and update eslint ignore configuration ([3b9be6b](https://github.com/chitrank2050/meterplex/commit/3b9be6bdf6a87dfac41259a7cc21a215b4eaa018))
- Implement entitlements module to manage plan-feature mappings and access rules ([d4653ab](https://github.com/chitrank2050/meterplex/commit/d4653ab30a8fb2848bf686a228b0313d14a1556a))
- Implement subscription module DTOs for creation and response handling ([e2d5629](https://github.com/chitrank2050/meterplex/commit/e2d562955ca7fd591eabc06fe919966aaa5120a9))
- Implement Subscriptions module with CRUD operations and tenant-scoped subscription management ([f5ce821](https://github.com/chitrank2050/meterplex/commit/f5ce8210b29f3d80ac97345017c8108152a8859e))
- Implement EntitlementCheckModule for runtime feature gating and usage consumption ([c17e458](https://github.com/chitrank2050/meterplex/commit/c17e4580a6414b1b25250031fc5c676c4748dbe2))
- Seed database with subscription plans, pricing, features, and entitlements ([ad61d65](https://github.com/chitrank2050/meterplex/commit/ad61d65727ad7da3e9ec52ae0041fa033923c1df))
- Implement plans, features, entitlements, and subscription management system ([e004670](https://github.com/chitrank2050/meterplex/commit/e00467029d6f945f5d1453378809674225b472f2))
## [0.4.5] - 2026-04-12

### ⚙️ Maintenance

- Update issue template titles to follow conventional commit ([2d4b97b](https://github.com/chitrank2050/meterplex/commit/2d4b97bad77886e3873ce057c1792906ca6ecadc))

### 📚 Documentation

- Update project documentation in README.md ([9695ed2](https://github.com/chitrank2050/meterplex/commit/9695ed2aa32c0e21d654e8cbe7f0fe15e11a67fc))

### 🚀 Features

- Implement DTOs for feature management module ([a769de1](https://github.com/chitrank2050/meterplex/commit/a769de11ae6f1e718de706ff1ca568a032502275))
- Implement features module with CRUD operations for the global feature catalog ([2daa31c](https://github.com/chitrank2050/meterplex/commit/2daa31c1e5eddf9e4b5969476616c4f050879a4d))
- Add DTOs for plan price creation and response schemas ([e0f58f1](https://github.com/chitrank2050/meterplex/commit/e0f58f1829f6721182be450d10e2d0ed96e6a6df))
- Implement plan pricing module with CRUD operations and nested routing ([380dc1e](https://github.com/chitrank2050/meterplex/commit/380dc1e8b92691c069e697d0ad5b8996ee926c3f))
- Add documentation and task issue templates and set default assignees for all templates ([de112e1](https://github.com/chitrank2050/meterplex/commit/de112e1cc857950279d1870ee908781449b79337))

### 🚜 Refactoring

- Replace hardcoded enum strings with Prisma generated enums across all DTOs ([ba7c0ff](https://github.com/chitrank2050/meterplex/commit/ba7c0fffaefc3feabe6f3c0c8d1c21b5fe4e5c2d))
- Replace hardcoded string enums with Prisma generated enum types across services ([7257470](https://github.com/chitrank2050/meterplex/commit/7257470f61603235dc9d72a190de27072c174184))
## [0.4.3] - 2026-04-12

### ⚙️ Maintenance

- Migrate dependency management from Dependabot to Renovate ([e01959c](https://github.com/chitrank2050/meterplex/commit/e01959ce9fdba6853b48fd91df5cae7b68e88a67))
- Update pnpm-lock.yaml dependencies ([7ef25d8](https://github.com/chitrank2050/meterplex/commit/7ef25d88a01791a458563bd8943bd8f8685c17ba))
- Standardize markdown code blocks, update linting configuration, and improve docs formatting ([29a9065](https://github.com/chitrank2050/meterplex/commit/29a90653cae1980bc32b44309b3be5d8f0b36a79))
- Reformat renovate config, add experimental path ignore rules, and disable vulnerability alert ([0407111](https://github.com/chitrank2050/meterplex/commit/0407111f0b988d84dedc204591e9537825725cb4))
- Replace em-dashes with hyphens and update import to type-only in logger configuration ([993f1fa](https://github.com/chitrank2050/meterplex/commit/993f1faa333e41a1dcd48939ce7a6b63a7ca97c2))
- Update dependencies, configure pnpm settings, and enforce non-null database URL type ([405b522](https://github.com/chitrank2050/meterplex/commit/405b5222fe5f036bcb0a8cec813cf119cdc2645d))
- Add format:check script and update CI workflow to use Node 24 ([7827991](https://github.com/chitrank2050/meterplex/commit/782799145628aeb183163254e9967422b5e92996))
- Reformat renovate configuration and disable Prisma client generation in CI workflow ([74b4bef](https://github.com/chitrank2050/meterplex/commit/74b4bef606609eb035e23aa06478d56edcbe0d5b))
- Update lockfile dependencies ([ab40b39](https://github.com/chitrank2050/meterplex/commit/ab40b39a02d7c5e56852154ebcf1b75dd286b4cd))
- Update @hono/node-server and add glob dependency to package.json ([d40c2a6](https://github.com/chitrank2050/meterplex/commit/d40c2a60b479f8557048e3afba359268e5762b63))
- Move pg dependency from devDependencies to dependencies ([f6b4f9f](https://github.com/chitrank2050/meterplex/commit/f6b4f9f157f3f622893041ee82c509cad1f47b3e))
- Move pg dependency from devDependencies to dependencies ([f338866](https://github.com/chitrank2050/meterplex/commit/f338866bb626991db39dfdea637403c7700a6c5a))

### 📚 Documentation

- Update project documentation in README.md ([f0a3fd5](https://github.com/chitrank2050/meterplex/commit/f0a3fd529470ab7a74b9992ffc7994ab9ec7c119))
- Update project documentation in README.md ([703c209](https://github.com/chitrank2050/meterplex/commit/703c2091799ff3e327410bee25fc6d51bdadf4c3))
- Update project documentation and installation instructions in README ([da7608d](https://github.com/chitrank2050/meterplex/commit/da7608d7e26c57350ea462107eb217add88fef0d))
- Update project documentation in README.md ([ec39718](https://github.com/chitrank2050/meterplex/commit/ec3971809e58b23d3bd4362a71567dfdbcc3c4f5))
- Update project documentation in README.md ([45f7834](https://github.com/chitrank2050/meterplex/commit/45f7834918f72fde595ec2548ff79a8c93c21bc7))

### 🚀 Features

- Add docker:prune script and include project banner assets ([e27c99f](https://github.com/chitrank2050/meterplex/commit/e27c99fcabd9c7d1354eaa2431745278bfebaed9))
- Implement Winston logging, configure import sorting, and standardize database script ([dbd094c](https://github.com/chitrank2050/meterplex/commit/dbd094cc14d12b75c21c995a220ed08c1e1c4459))
- Add markdownlint configuration and integrate linting into CI and pre-commit hooks ([f6ecd65](https://github.com/chitrank2050/meterplex/commit/f6ecd65e1f4192c36b148044ea484a42e032a8bb))
- Add weekly schedule to renovate configuration ([f7b3aba](https://github.com/chitrank2050/meterplex/commit/f7b3aba8f5bb9c7b64a25193f0c35ca7c77919b2))
- Enable Prisma client generation in CI pipeline ([9e07788](https://github.com/chitrank2050/meterplex/commit/9e07788e8e99490f9ae16239afcb49ecbcd7d7f5))
- Implement DTOs for plan creation, updates, and API responses ([60a62c2](https://github.com/chitrank2050/meterplex/commit/60a62c269ea29b58ebec6e2a68fd94ff3f232195))
- Implement PlansService and expand Prisma error utility helpers for robust db constraint handle ([06d114e](https://github.com/chitrank2050/meterplex/commit/06d114e77af2efdfb5f09f564e7f4a9eb760a6b6))
- Migrate NestJS build and test compilation to SWC for improved performance ([f4339f3](https://github.com/chitrank2050/meterplex/commit/f4339f33a4cde2866dedb140c1fd590d80908125))
- Implement plans module with CRUD endpoints for billing plan management ([c8f0187](https://github.com/chitrank2050/meterplex/commit/c8f01875ae31669fb39318e60e459addfa2bd2f4))
- Add API documentation and Bruno collections for plans, auth, users, tenants, and API keys ([ab3e86a](https://github.com/chitrank2050/meterplex/commit/ab3e86a2fa6d916cc39903be38a5154fb39c8be9))

### 🚜 Refactoring

- Standardize import ordering and formatting across the codebase ([7b8d074](https://github.com/chitrank2050/meterplex/commit/7b8d074f76a6101a666c4965a662c68f0e7b4541))
- Rename prisma CLI scripts to db prefix across codebase and documentation ([f963289](https://github.com/chitrank2050/meterplex/commit/f96328977f16a50fe3d16e754e142e063e7ac17c))
- Reformat renovate configuration and update experimental path pattern ([e5ff2e3](https://github.com/chitrank2050/meterplex/commit/e5ff2e3e7d5ff9267d9bfc717ed45d35c44d7530))
- Centralize correlation ID header constant and exclude health checks from request logging ([472c8c7](https://github.com/chitrank2050/meterplex/commit/472c8c79c9881236d08de6e05b2d053f8351aa04))
- Simplify environment variable usage ([5fdb1ca](https://github.com/chitrank2050/meterplex/commit/5fdb1ca717b98c49d832cd6b4b0f34b78a4b80ae))
- Replace manual existence checks with Prisma findUniqueOrThrow and error handling utilities ([3adc20f](https://github.com/chitrank2050/meterplex/commit/3adc20f12baaa5ebdc851cddb7d4a7c16ec28d32))
- Migrate test runner from Jest to Vitest ([5cac08b](https://github.com/chitrank2050/meterplex/commit/5cac08b08bcf0b3a177398d7d506e08845ed3a2f))
- Reorder color scheme definitions in mkdocs.yml to set dark mode as default ([d576205](https://github.com/chitrank2050/meterplex/commit/d576205c8a657dfd9fb3f2a6cd96a20fd9869227))
- Migrate Prisma client generation to node_modules and update import paths ([010a6f5](https://github.com/chitrank2050/meterplex/commit/010a6f53dd7d4119a4aa60f50d9ba1661d640aa0))
## [0.4.2] - 2026-04-10

### 📚 Documentation

- Update README and add CODEOWNERS file to define repository ownership ([bd5acc0](https://github.com/chitrank2050/meterplex/commit/bd5acc0cc0064d0373c1dcfe5ef96b9196bc8aa9))
## [0.4.1] - 2026-04-10

### ⚙️ Maintenance

- Replace em-dashes with hyphens in documentation and DTO comments ([f47ddc2](https://github.com/chitrank2050/meterplex/commit/f47ddc2abbdefe575483ee1328ad52e1ce56be3c))
- Update project metadata, simplify license terms, and add branding assets ([2515b1a](https://github.com/chitrank2050/meterplex/commit/2515b1a22032c0eec9cdfe152741f44fc08665d2))
- Update package metadata and keywords for better project discoverability ([c692d97](https://github.com/chitrank2050/meterplex/commit/c692d97dbcfb99dbff823ea9a36dd02cd1375141))

### 👷 CI/CD & Infra

- **deps-dev:** Bump @types/supertest from 6.0.3 to 7.2.0 (#10) ([10f86b4](https://github.com/chitrank2050/meterplex/commit/10f86b4a6f9183055b8922017002e8742209924c)) by [dependabot[bot]](https://github.com/apps/dependabot)

### 📚 Documentation

- Add audit log architecture documentation and standardize code comments ([9136838](https://github.com/chitrank2050/meterplex/commit/9136838bffa1be5f87b73ab1d38a81fffa3549eb))

### 🚀 Features

- Add AuditLog model and supporting enums to track system mutations ([bb78eca](https://github.com/chitrank2050/meterplex/commit/bb78eca1476d720c7dea2b1ff4d88e4ec3dd25c9))
- Implement global audit log interceptor with skip decorator for mutation tracking ([e28df80](https://github.com/chitrank2050/meterplex/commit/e28df80ba9166c6ae5d665582450a72ebb5e2beb))
- Implement global audit log interceptor with SkipAudit decorator support ([66587b6](https://github.com/chitrank2050/meterplex/commit/66587b6e0e02d50ac021709ed967a3d99dd8821a))
- Add audit log interceptor documentation and phase 1 summary updates ([734a81c](https://github.com/chitrank2050/meterplex/commit/734a81cbb7499ff8f1a9d28c9784f95d3973a23c))
- Implement plans, features, and entitlements schema with supporting documentation ([cf5a0a5](https://github.com/chitrank2050/meterplex/commit/cf5a0a588bc3d3e0deb4309c8fc1312eaaa172ed))
- Add support for plans, features, entitlements, and subscriptions to audit log resource mapping ([5fcefb1](https://github.com/chitrank2050/meterplex/commit/5fcefb19730404a6c6be7065c076912c60736d07))
## [0.4.0] - 2026-04-09

### 📚 Documentation

- Update project roadmap and document API authentication and endpoints ([a03eaad](https://github.com/chitrank2050/meterplex/commit/a03eaad6b5bea4fe09af9681ed8198cc5082fa8d))

### 🚀 Features

- Add Bruno API collection files for authentication endpoints ([1b3c562](https://github.com/chitrank2050/meterplex/commit/1b3c56288beadedf8b019a36d664f3321e1b4806))
- Add Bruno API requests for retrieving and updating tenants ([409fa7d](https://github.com/chitrank2050/meterplex/commit/409fa7d93c7ec490001ece8ba16248f22a68d6a2))
- Add Bruno API collections for tenant context and user management endpoints ([9d3434c](https://github.com/chitrank2050/meterplex/commit/9d3434c001495b7c3b2ab9ed9add39402f5e4fe6))
- Add Bruno API collections for creating, listing, and revoking API keys ([471ba01](https://github.com/chitrank2050/meterplex/commit/471ba01edc0c3f1ad7933f1e5dc71b02207d4a44))
## [0.3.5] - 2026-04-09

### 🚜 Refactoring

- Implement robust Prisma unique constraint error handling with dedicated utility ([198e3af](https://github.com/chitrank2050/meterplex/commit/198e3afd481ee9cef1b19dab1a9260abf25ddf0f))
## [0.3.4] - 2026-04-09

### ⚙️ Maintenance

- Centralize prettier endOfLine configuration in .prettierrc and remove from eslint config ([60f6370](https://github.com/chitrank2050/meterplex/commit/60f63703d45645f136ec31352023b0ae23c731f5))
- Update dependencies in pnpm-lock.yaml ([97828dc](https://github.com/chitrank2050/meterplex/commit/97828dc5d4c3f77f1d792997627e45cc027ed7f4))

### 👷 CI/CD & Infra

- **deps-dev:** Bump @types/node from 22.19.15 to 25.5.2 (#9) ([eca3095](https://github.com/chitrank2050/meterplex/commit/eca309543ce5ba553b0203d501ab232cfaecd80d)) by [dependabot[bot]](https://github.com/apps/dependabot)
- **deps:** Bump actions/setup-python in the all-actions group (#3) ([d73ee26](https://github.com/chitrank2050/meterplex/commit/d73ee26e257354b2ffeba7a980758c813e5fdcbb)) by [dependabot[bot]](https://github.com/apps/dependabot)
- **deps-dev:** Bump dotenv in the patch-and-minor group (#8) ([ed2a7be](https://github.com/chitrank2050/meterplex/commit/ed2a7bea9333b360100fd3a7e4d97b36e41c638c)) by [dependabot[bot]](https://github.com/apps/dependabot)
- **deps-dev:** Bump @types/uuid from 10.0.0 to 11.0.0 (#11) ([8e19a27](https://github.com/chitrank2050/meterplex/commit/8e19a270a4b7ae8eac89dc9bdd17318423b13d9b)) by [dependabot[bot]](https://github.com/apps/dependabot)

### 🚀 Features

- Add lodash dependency to package.json ([d261721](https://github.com/chitrank2050/meterplex/commit/d2617217992190c150c307464e140b8ca81cfe6d))
- Add standard pagination and error response DTOs for API consistency ([a5e9ac3](https://github.com/chitrank2050/meterplex/commit/a5e9ac356ce314549ca2a4f008f2bff7551c1659))
- Add TenantResponseDtos for API documentation ([5acd943](https://github.com/chitrank2050/meterplex/commit/5acd943fa786b72674e79f568e0b9f4bb04ba529))
- Add UserResponseDto for standardized user API responses ([00be6fb](https://github.com/chitrank2050/meterplex/commit/00be6fbb090b40a18d787b3c81a022be692f6762))
- Add IsNotEmpty validation to password and refactor Auth API status codes to use enums ([d8fc297](https://github.com/chitrank2050/meterplex/commit/d8fc297034d67024d329c675348191e457725fcd))
- Add installation and cleanup automation scripts with corresponding npm lifecycle commands ([5682d9f](https://github.com/chitrank2050/meterplex/commit/5682d9f6163fec94a9ecddd2557e909641d899a0))
- Implement response DTOs for auth and api-keys modules ([d0a2e40](https://github.com/chitrank2050/meterplex/commit/d0a2e40b97b77599f2bed98660258d87a4626bf6))
- Implement DTO factory methods and update tenant module to return typed responses ([cef7291](https://github.com/chitrank2050/meterplex/commit/cef7291505bbd5849f5104a55b962f2932c1b2e7))
- Add Swagger response DTOs and error schemas to Auth and Users controllers ([2df7061](https://github.com/chitrank2050/meterplex/commit/2df7061a725e1eb30c95e0f3983c6465c90883cb))

### 🚜 Refactoring

- Optimize membership lookup, update Swagger path, fix Prisma import, and standardize logger ([737cc62](https://github.com/chitrank2050/meterplex/commit/737cc62024d81da30064456c8cf8851bda724ff6))
- Centralize authentication error messages in constants and update auth service to use them ([1938e0f](https://github.com/chitrank2050/meterplex/commit/1938e0f7e6121dbf2b6cfd583d47dde3df06e87f))
- Migrate to eslint-config-prettier and update configuration structure ([694cbb0](https://github.com/chitrank2050/meterplex/commit/694cbb0d4e8ecd67cbb2ee92ca203fa8268506a8))
- Standardize documentation by replacing em-dashes with hyphens across the codebase ([4985382](https://github.com/chitrank2050/meterplex/commit/4985382898c380cbb986bfdd86104c3a01e66bf8))
- Add ErrorResponseDto to Swagger API response decorators in tenants controller ([0386406](https://github.com/chitrank2050/meterplex/commit/0386406a482245891b3c32766b2db92a7079f76b))
- Implement DTO factory methods for API key and tenant responses to decouple service layer ([3d7c3b3](https://github.com/chitrank2050/meterplex/commit/3d7c3b33963955c4413cec1697af1c254c682c4b))
- Remove static DTO factory methods to rely on direct service return types for serialization ([34a8558](https://github.com/chitrank2050/meterplex/commit/34a85581675142646b22af436f4f02a27b499773))
## [0.3.3] - 2026-04-04

### 📚 Documentation

- Add Phase 1 documentation ([d164a5b](https://github.com/chitrank2050/meterplex/commit/d164a5bd8d54a1ef197f103525878fbafd8ab257))
- Add summary of completed Phase 1 features to documentation ([b04bea3](https://github.com/chitrank2050/meterplex/commit/b04bea3ccf36b60628cfb36555eb0631806b897b))

### 🚀 Features

- Add API keys module with Stripe-style key generation, hashing, and revocation ([00f6c1a](https://github.com/chitrank2050/meterplex/commit/00f6c1a112c393cb03c7691d6c3744f9a9e9c443))
- Update seed script with users, memberships, and API keys across tenants ([0e1c217](https://github.com/chitrank2050/meterplex/commit/0e1c217b8d18cc5da8d761fd319521dbcf749320))
## [0.3.2] - 2026-04-04

### ⚙️ Maintenance

- Add Bruno collection with auto-login and environment variables ([cca55bc](https://github.com/chitrank2050/meterplex/commit/cca55bc47624c6618565b4469bd47132e004e7af))

### 🚀 Features

- Add custom decorators for CurrentUser, Roles, and TenantId extraction ([4d32acd](https://github.com/chitrank2050/meterplex/commit/4d32acdd385ba6fbd385dff66bcea5a0c4ef67e8))
- Implement TenantGuard and RolesGuard for multi-tenant RBAC enforcement ([9bea9bd](https://github.com/chitrank2050/meterplex/commit/9bea9bd3600f4b82ab43e465e1c44b4a54601eec))
- Add protected endpoint to retrieve authenticated tenant context with guard validation ([d4d3ab2](https://github.com/chitrank2050/meterplex/commit/d4d3ab26301d74caa03c95bf6c200f5e0a6e7f21))
- Add guards to tenants and users controllers, RBAC enforcement, tenant-scoped user creation ([fbb6bea](https://github.com/chitrank2050/meterplex/commit/fbb6bea203531ca584c0e92c1fd486181ad4ab74))
## [0.3.1] - 2026-04-04

### 👷 CI/CD & Infra

- **deps:** Bump the patch-and-minor group across 1 directory with 12 updates ([cf236af](https://github.com/chitrank2050/meterplex/commit/cf236af756a05f3c190bc08271360f11f115e9fb)) by [dependabot[bot]](https://github.com/apps/dependabot)

### 🚀 Features

- Add DTOs for token refresh and password management flows ([9aa9faa](https://github.com/chitrank2050/meterplex/commit/9aa9faa07254648359ea15c75f263e5b46a300cc))
- Implement full authentication lifecycle including refresh tokens, password management ([0089b18](https://github.com/chitrank2050/meterplex/commit/0089b18ee8b5bd1e02b9c5a76fef37919cf3e767))
- Add complete auth flow with dual JWT tokens, password reset, and token rotation ([25d3dfc](https://github.com/chitrank2050/meterplex/commit/25d3dfcbd874f07f13e08607f9f091fd4b1e257e))
## [0.3.0] - 2026-04-04

### ⚙️ Maintenance

- Add project governance, security policy, and contribution templates ([9727a65](https://github.com/chitrank2050/meterplex/commit/9727a658c5ba1f51b67a4fbcba62145129540e33))
- Rename commit-lint ([945118e](https://github.com/chitrank2050/meterplex/commit/945118ec83c0a1354bc110698a6e0ce36a4e03b6))
- Update pnpm overrides for hono, path-to-regexp, and picomatch ([9c4154a](https://github.com/chitrank2050/meterplex/commit/9c4154ac2724413a5e731341b23350eca6cb3046))
- Standardize configuration files by converting double quotes to single quotes ([7a0bf60](https://github.com/chitrank2050/meterplex/commit/7a0bf60787da9be120a1e2db6058af2a7f677b06))

### 🐛 Bug Fixes

- Patch handlebars transitive dependency (CVE injection via AST) ([3a8b582](https://github.com/chitrank2050/meterplex/commit/3a8b58213a08d143a327b32afd4b3ab3b2a7732e))
- Patch hono transitive dependency (static file access bypass) ([3999c07](https://github.com/chitrank2050/meterplex/commit/3999c071a4b2eec09b9df4e1a0258cc043f77bbc))
- Patch effect transitive dependency (ALS context leak) ([b0d3212](https://github.com/chitrank2050/meterplex/commit/b0d3212cfe8f29cf93df662377651253e32e1358))
- Patch @hono/node-server transitive dependency (static path bypass) ([ec76f87](https://github.com/chitrank2050/meterplex/commit/ec76f8780c401099bccd3bd3c92f6706957f3c8d))

### 👷 CI/CD & Infra

- **deps:** Bump picomatch in the npm_and_yarn group across 1 directory ([2158dd3](https://github.com/chitrank2050/meterplex/commit/2158dd3585564f3ee216e7d78d96d4b71398ba05)) by [dependabot[bot]](https://github.com/apps/dependabot)
- **deps:** Bump brace-expansion ([e83aec8](https://github.com/chitrank2050/meterplex/commit/e83aec8ac1724bbb6ceb6b3df41594f4e298ceb3)) by [dependabot[bot]](https://github.com/apps/dependabot)
- Refactor CI pipeline, update dependencies, and upgrade Python and Node.js versions ([b24209a](https://github.com/chitrank2050/meterplex/commit/b24209af9b1bca72dfefa0357a1e322eb5a15cb4))

### 📚 Documentation

- Update project documentation in README.md ([dc631c4](https://github.com/chitrank2050/meterplex/commit/dc631c4b58fd2281264132fac9ee1b4982ac3136))
- Add phase 1 ERD and placeholder docs ([969c9b9](https://github.com/chitrank2050/meterplex/commit/969c9b96f6b541e3d8c43006c5160db4ba7354f0))

### 🚀 Features

- Add User, Membership, and ApiKey models to Prisma schema ([25f9a32](https://github.com/chitrank2050/meterplex/commit/25f9a329ffa25874952cb393e89395328de4323e))
- Add CreateTenantDto and UpdateTenantDto for tenant management validation ([cbc7ea2](https://github.com/chitrank2050/meterplex/commit/cbc7ea2da5eb8014944406776bca0fab0fe3cb09))
- Implement TenantsService and update DTO metadata types with path aliases ([cc3d9ee](https://github.com/chitrank2050/meterplex/commit/cc3d9ee9ff8acdbf9651b7e97dd64710fb735712))
- Add centralized error message constants for consistent application-wide error handling ([d14eec8](https://github.com/chitrank2050/meterplex/commit/d14eec89b3387d7a4bf364ac3427f41da3eb4801))
- Add tenants CRUD module with pagination and validation ([d60a8b6](https://github.com/chitrank2050/meterplex/commit/d60a8b6e37d2c2807cc1b6cc2bba1a71a1766deb))
- Add bcryptjs dependency and implement user creation and update DTOs ([1d33b58](https://github.com/chitrank2050/meterplex/commit/1d33b58d6d0e64c4f59faaa96c0206207b254968))
- Implement UsersModule with CRUD operations and bcrypt password hashing ([0cc1ffa](https://github.com/chitrank2050/meterplex/commit/0cc1ffabac9995fa091bf5fb25c0542f3b263a5b))
- Add JWT authentication support and environment configuration ([173a04e](https://github.com/chitrank2050/meterplex/commit/173a04ebe28ea0b521fd3e8f501aac2cae8c4d61))
- Implement AuthModule with JWT authentication and user registration flow ([d624929](https://github.com/chitrank2050/meterplex/commit/d62492930f48bbaf11a38f377934212020cabea5))
- Add PasswordResetToken model and database migration for secure password resets ([0a19a97](https://github.com/chitrank2050/meterplex/commit/0a19a97c68aa86da3b54d6b7c058c0c46aea19cb))

### 🚜 Refactoring

- Replace hardcoded tenant error messages with centralized constants ([b4e7e6e](https://github.com/chitrank2050/meterplex/commit/b4e7e6ee4b2691d8af4d557355f26814b808f945))
## [0.2.1] - 2026-03-29

### ⚙️ Maintenance

- Remove explicit pnpm version specification from CI workflows ([b4f36fa](https://github.com/chitrank2050/meterplex/commit/b4f36fa600984cfde63fe920b70b2fd5a5b9f24b))
- Update contents permission to write in docs workflow ([7e20877](https://github.com/chitrank2050/meterplex/commit/7e208775ef9e6c343126b285f82ed97330d36afb))
- Update docs workflow to include changelog tracking, git configuration, and dependency caching ([663086d](https://github.com/chitrank2050/meterplex/commit/663086de1362bc925d691c54ecaf8321a13d0ba0))
- Remove pip cache from docs workflow and delete unused e2e test file ([8f9c077](https://github.com/chitrank2050/meterplex/commit/8f9c077c30bf8c9c5493a9c98988e9746e7642ed))
- Restrict prettier check to src directory in CI workflow ([2fec923](https://github.com/chitrank2050/meterplex/commit/2fec9230aea922fc1e19301f70faa67352be6ac2))

### 📚 Documentation

- Add phase 0 architecture diagram to documentation ([1d4a63a](https://github.com/chitrank2050/meterplex/commit/1d4a63aecc2049f9ad8edc6f0dba3a6cc4364644))

### 🚀 Features

- Add git-tag and git-release npm scripts ([ef39da2](https://github.com/chitrank2050/meterplex/commit/ef39da2d0cdb8f5b74480578414ad2fd0c42a410))
- Replace Swagger UI with Scalar API reference and update CSP configuration ([e292766](https://github.com/chitrank2050/meterplex/commit/e292766f7935dfe00dffd9a4bad4b2eca00753cf))

### 🚜 Refactoring

- Restrict prettier formatting scope to src directory in package.json ([76bf8a7](https://github.com/chitrank2050/meterplex/commit/76bf8a79b453d7962dd38f99e8552af87cbec2d5))
## [0.2.0] - 2026-03-29

### ⚙️ Maintenance

- Format prisma schema generator block and add newline to app module. ([5e6c495](https://github.com/chitrank2050/meterplex/commit/5e6c49507c812d3ed500d5a98bb9055ddb57a4de))
- Upgrade to Prisma 7 with driver adapter and CJS module configuration ([71c55e3](https://github.com/chitrank2050/meterplex/commit/71c55e3fd38f76ee4325cbacbe7da63b13c627b9))
- Add MIT license and update project documentation ([8d147a5](https://github.com/chitrank2050/meterplex/commit/8d147a5d9321c87c2cebf56fed81a727ea635407))
- Implement husky git hooks, commitlint, and project documentation with MkDocs ([b8de1e9](https://github.com/chitrank2050/meterplex/commit/b8de1e927f768b8949c9bb58ccb5a713b4d18e41))
- Setup CI/CD pipelines, Dependabot, funding, and update project documentation ([133b255](https://github.com/chitrank2050/meterplex/commit/133b255bb6a393119c84033e9a03ea5f151625ea))
- Add read permissions to CI workflow for contents access ([7f142de](https://github.com/chitrank2050/meterplex/commit/7f142de28786758d732dc2ae479ad2469bb3018c))

### ⚙️ Miscellaneous Tasks

- Initialize NestJS project with basic application structure, configurations, and testing setup. ([979e5ae](https://github.com/chitrank2050/meterplex/commit/979e5ae29b0edadaba81880f25917ec5422ae0fc))

### 🐛 Bug Fixes

- Update middleware route pattern to include wildcard path parameter ([5a413b6](https://github.com/chitrank2050/meterplex/commit/5a413b67d4eb5022807330634d089a623260f911))

### 📚 Documentation

- Initialize project documentation including development setup, architecture overview, and phase logs ([acbf8d3](https://github.com/chitrank2050/meterplex/commit/acbf8d39ddfb549d66bbdbed96905acbc88c0e02))

### 🚀 Features

- Initialize project with Prisma ORM, remove NestJS boilerplate, and configure core tooling and metadata. ([c231291](https://github.com/chitrank2050/meterplex/commit/c231291c7e6025f639921aa061a73cd859dc1910))
- Set up local development environment with Docker Compose for core services and configure Prisma 7 database connection via `prisma.config.ts`. ([e7277c0](https://github.com/chitrank2050/meterplex/commit/e7277c0a9fc06d7e4b7857532b2b14e717352ee9))
- Implement robust environment variable validation and comprehensive global application bootstrapping with security, CORS, API versioning, and Swagger. ([ab713f4](https://github.com/chitrank2050/meterplex/commit/ab713f449d3d9a7fc767285d55625bf5256bb824))
- Implement global PrismaModule and PrismaService for lifecycle-managed database connectivity ([3f7568b](https://github.com/chitrank2050/meterplex/commit/3f7568be92d747520724999477403ada19935431))
- Implement health check endpoint with Prisma connectivity monitoring and add Bruno API collection ([46fe263](https://github.com/chitrank2050/meterplex/commit/46fe2634b438a1d1974da8ef83086552dc763bd5))
- Modularize health check service and configure version-neutral endpoint ([35baacb](https://github.com/chitrank2050/meterplex/commit/35baacb934ed103786cc080c0f1820f679bef67f))
- Implement global exception filter and request tracing middleware for consistent error handling and logging ([aa81360](https://github.com/chitrank2050/meterplex/commit/aa81360393d9a1e72f716a383be9761218831a58))
- Implement Tenant model with initial migration and database seeding script ([59af51f](https://github.com/chitrank2050/meterplex/commit/59af51fd39cfcca3e0ad15e56fedf67eb0392f81))
- Add git-cliff configuration and release automation scripts with version bump to 0.2.0 ([1e754cb](https://github.com/chitrank2050/meterplex/commit/1e754cb82fd6705cb94a057266d5a2112c889d30))
- Copy root CHANGELOG.md to docs directory during CI build for MkDocs inclusion ([3aa9ca9](https://github.com/chitrank2050/meterplex/commit/3aa9ca9cfc64efdaea75a9982e8bdac6adb19ead))

