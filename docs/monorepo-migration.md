# FluxonJS Monorepo Migration Plan (Core + CLI + DX + Strict Standards)

This plan outlines the structural changes to transform **FluxonJS** (formerly HonestJS) into a NestJS-like monorepo while maintaining Hono's high-performance characteristics and enforcing elite coding standards.

## 🎯 Vision: FluxonJS — High Velocity, Solid Foundation

FluxonJS combines the **modularity of NestJS** (monorepo, package boundaries) with the **extreme speed of Hono** (low overhead, explicit logic).

---

## 📦 Monorepo Package Structure

### 1. `@fluxonjs/common` (Light Foundation)
- **Role**: Shared public API. Zero dependencies (safe for Edge/Workers).
- **Content**: Decorators, interfaces, standard exceptions, lightweight logger/config types.

### 2. `@fluxonjs/core` (High-Performance Engine)
- **Role**: The bootstrap and execution logic.
- **"Hot Path"**: Pre-compiled handlers to ensure request-time performance matches raw Hono.

### 3. `@fluxonjs/cli` (The Fluxon Power Tool)
- **Role**: Schematic-based scaffolding and ecosystem manager.
- **Command**: `fluxon new <name>` and `fluxon skill add <name>`.

### 4. `@fluxonjs/platform-hono` (The Bridge)
- **Role**: Optimized Hono routing and context mapping.

---

## 🚀 The "Rich Templates" Ecosystem

The CLI will offer a diverse catalog of pre-engineered starters:

| Template Name | Description | Key Features |
|---------------|-------------|--------------|
| `standard` | General purpose Node/Bun. | Core + DI + Config. |
| `edge` | Optimized for Cloudflare/Vercel. | Minimal footprint, no Node-only deps. |
| `fullstack` | Integrated Backend + Frontend. | FluxonJS + Next.js/React + Shared DTOs. |
| `gateway` | API Gateway & Proxy. | Pre-configured CORS, Proxy, Rate Limiting. |
| `event-driven` | Async messaging starter. | NATS/Redis PubSub + @fluxonjs/skills-events. |
| `enterprise` | Production-ready boilerplate. | Auth, DB (Prisma/Drizzle), Swagger, ELK Logger. |
| `serverless` | Minimalist cloud-function kit. | Fast cold starts, optimized for AWS Lambda. |

---

## 🛡️ Strict Architectural Standards

1.  **Project Blueprint**: standard folder structures (`src/`, `test/`, `INDEX.md`).
2.  **Centralized Linting**: Strict Monorepo-wide ESLint and Prettier.
3.  **Naming Protocol**:
    *   Files: `kebab-case.ts`.
    *   Classes/Decorators: `PascalCase`.
4.  **No-Any Policy**: Strict TypeScript rules enforced via Husky hooks.

---

## 🛠️ The "Skills" Registry

Extend FluxonJS on-demand with `@fluxonjs/skills-*`:
- **`skills-swagger`**: OpenAPI 3.0 generation.
- **`skills-auth`**: JWT, OAuth2, and Passport adapters.
- **`skills-database`**: Type-safe ORM integrations.
- **`skills-validation`**: Zod and Class-Validator integration.

---

## 🗺 Directory Mapping (Transition)

| Component | Path in Monorepo | Status |
|-----------|------------------|--------|
| DI Engine | `packages/core/di` | Rebranding |
| Decorators | `packages/common/decorators` | Rebranding |
| CLI Tool | `packages/cli` | Rebranding |
| Project Templates | `packages/cli/templates` | **EXPANDING** |
| Swagger | `packages/skills-swagger` | Skill |

---

## ✅ Actionable Implementation TODOs

### Phase 1: Infrastructure & Rebranding (Current Phase)
- [x] Rename root `package.json` to `@fluxonjs/monorepo`.
- [x] Configure `"workspaces": ["packages/*"]` in root `package.json`.
- [x] Create directory structure: `packages/common`, `packages/core`, `packages/cli`, `packages/platform-hono`.
- [x] Initialize baseline `package.json` files for `@fluxonjs/common` and `@fluxonjs/core`.
- [ ] Create shared `tsconfig.base.json` at root and extend it in packages.
- [ ] Create shared `eslint.config.js` and `prettierrc` at root.
- [ ] Setup `turborepo` or native Bun workspace scripts for orchestrating tests and builds.

### Phase 2: Extracting `@fluxonjs/common`
- [ ] Move `src/interfaces/*` to `packages/common/src/interfaces/`.
- [ ] Move `src/decorators/*` to `packages/common/src/decorators/`.
- [ ] Move `src/errors/*` to `packages/common/src/errors/`.
- [ ] Move `src/utils/*` to `packages/common/src/utils/`.
- [ ] Move `src/loggers/console.logger.ts`, `noop.logger.ts` to `packages/common/src/loggers/`.
- [ ] Ensure `@fluxonjs/common` has `reflect-metadata` as its only peerDependency.
- [ ] Run `bun test` in `@fluxonjs/common` to verify isolation.

### Phase 3: Extracting `@fluxonjs/core`
- [ ] Move `src/di/*` to `packages/core/src/di/`.
- [ ] Move `src/registries/*` to `packages/core/src/registries/`.
- [ ] Move `src/managers/*` to `packages/core/src/managers/`.
- [ ] Move `src/application.ts` and `src/application-context.ts` to `packages/core/src/`.
- [ ] Refactor `Application` to pre-compile routes (Hot Path Execution).
- [ ] Add dependency `"@fluxonjs/common": "workspace:*"` to `core/package.json`.
- [ ] Fix all import paths.
- [ ] Run `bun test` in `@fluxonjs/core`.

### Phase 4: `@fluxonjs/platform-hono`
- [ ] Move Hono-specific context adapters to `packages/platform-hono`.
- [ ] Move `src/handlers/error.handler.ts` and `not-found.handler.ts` to `packages/platform-hono`.
- [ ] Create adapter interface so `core` can blindly execute handlers without knowing it is Hono.

### Phase 5: The Fluxon CLI & Templates
- [ ] Move `src/cli/*` to `packages/cli/`.
- [ ] Implement Handlebars (or EJS) template engine inside CLI.
- [ ] Create `packages/cli/templates/standard`.
- [ ] Create `packages/cli/templates/fullstack`.
- [ ] Create `packages/cli/templates/serverless`.
- [ ] Implement `fluxon skill add <name>` logic in the CLI.

### Phase 6: Ecosystem & Skills
- [ ] Move `src/swagger/*` to `packages/skills-swagger/`.
- [ ] Move `src/websockets/*` to `packages/skills-websockets/`.
- [ ] Create standard API for Skills (e.g., `FluxonSkill` interface) that the CLI can call upon installation.
