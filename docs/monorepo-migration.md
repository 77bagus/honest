# HonestJS Monorepo Migration Plan (Core + CLI + DX + Strict Standards)

This plan outlines the structural changes to transform HonestJS into a NestJS-like monorepo while maintaining Hono's high-performance characteristics and enforcing elite coding standards.

## 🎯 Vision: NestJS Structure, Hono Performance

We want the **modularity of NestJS** (monorepo, clear package boundaries) with the **agility of Hono** (low overhead, explicit logic).

---

## 📦 Monorepo Package Structure

### 1. `@honestjs/common` (Light Foundation)
- **Role**: Shared public API. Zero dependencies (safe for Edge/Workers).
- **Content**: Decorators, interfaces, standard exceptions, lightweight logger/config types.
- **Strictness**: No internal logic here. Purely metadata and contracts.

### 2. `@honestjs/core` (High-Performance Engine)
- **Role**: The bootstrap and execution logic.
- **Content**: DI Container (Async/Singleton-optimized), `Application` manager, `PipelineExecutor`.
- **"Hot Path"**: Implements pre-compiled handlers to ensure request-time performance is identical to raw Hono.

### 3. `@honestjs/cli` (Power DX)
- **Role**: The developer's Swiss Army knife.
- **Features**:
  - **Schematics**: Advanced code generation (Handles nested modules, automatic registration).
  - **Templates**: `standard` (Node/Bun), `edge` (Cloudflare/Vercel), `microservice` (NATS/Redis).
  - **Skill Manager**: `honest skill add <name>` to modularly extend the framework.

### 4. `@honestjs/platform-hono` (The Bridge)
- **Role**: Hono-specific routing and context management.
- **Strictness**: Ensures that the Hono `Context` is mapped efficiently to framework decorators.

---

## 🛡️ Strict Architectural Standards

To maintain a clean and reliable codebase, we will enforce:

### 1. Strict Project Blueprint (Per Package)
Each package in `packages/*` must follow this structure:
```plaintext
packages/<name>/
├── src/            # Source code
├── test/           # Unit and integration tests
├── dist/           # Compiled output (ignored by git)
├── package.json    # Package-specific dependencies
├── tsconfig.json   # Extends root tsconfig.json
├── README.md       # Documentation
└── INDEX.md        # API Summary
```

### 2. Centralized Quality Control
- **Monorepo-wide Linting**: Single `eslint.config.js` at the root that all packages follow.
- **Strict TypeScript**: `strict: true` in root `tsconfig.json`. No `any` allowed without explicit suppression and justification.
- **Naming Conventions**: 
  - Files: `kebab-case.ts` (e.g., `application-context.ts`).
  - Classes: `PascalCase` (e.g., `ApplicationContext`).
  - Decorators: `PascalCase` (e.g., `@Controller`).
- **Husky & Lint-Staged**: Mandatory linting and formatting on every commit.

### 3. Documentation First (DX)
- Every public function/class must have JSDoc.
- Package `README.md` must contain a "Usage with Hono" example to preserve the Hono-flavor.

---

## 🚀 The "Skills" & Template Ecosystem

The CLI will be the gateway to these modular features:
- **Skills**: `@honestjs/skills-swagger`, `@honestjs/skills-auth`, `@honestjs/skills-database`.
- **Templates**: Our templates won't just be folders; they will be pre-configured with **Strict Linting** and **Prettier** settings so every HonestJS project feels consistent.

---

## 🗺 Directory Mapping (Current -> Monorepo)

| Component | Path in Monorepo | Flavor |
|-----------|------------------|--------|
| DI Engine | `packages/core/di` | Core |
| Decorators | `packages/common/decorators` | Metadata |
| Hono Glue | `packages/platform-hono` | Implementation |
| CLI Tool | `packages/cli` | DX |
| Swagger | `packages/skills-swagger` | Skill |
| Testing | `packages/testing` | Utility |

## ✅ Migration Checklist
- [ ] **Phase 1**: Initialize Bun Workspaces and root `eslint`/`tsconfig` configs.
- [ ] **Phase 2**: Extract `@honestjs/common` and verify Zero-Dep status.
- [ ] **Phase 3**: Refactor `@honestjs/core` with "Hot Path" execution logic.
- [ ] **Phase 4**: Implement the CLI Schematic engine and first `standard` template.
- [ ] **Phase 5**: Migrating existing tests (260+) to the new package structure.
