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

## ✅ Migration Checklist
- [1] **Rename Repository References**: Update all internal "HonestJS" to "FluxonJS".
- [2] **Workspace Init**: Create `packages/` and update root `package.json`.
- [3] **Common Extraction**: Move decorators to `@fluxonjs/common`.
- [4] **Core Implementation**: Build the "Hot Path" engine in `@fluxonjs/core`.
- [5] **Template Engine**: Build the schematic engine in `@fluxonjs/cli` with Handlebars support.
