# HonestJS Monorepo Migration Plan (Core + CLI + Skills)

This plan outlines the structural changes to transform HonestJS into a NestJS-like monorepo while maintaining Hono's high-performance characteristics and advancing our CLI ecosystem.

## 🚀 Performance & DX Core Principles

1.  **"Hot Path" Execution**: Pre-compile all route handlers, guards, and pipes during bootstrap to minimize request-time overhead.
2.  **Lightweight Abstractions**: `@honestjs/common` remains zero-dependency and tree-shakable.
3.  **Modular Skills**: Developers can add features (Skills) on-demand without bloating the core.
4.  **Extensible CLI**: A powerful scaffolding engine that supports dynamic templates and automated skill injection.

---

## 📦 Monorepo Package Structure

### 1. `@honestjs/common`
- **Goal**: Shared decorators and interfaces.
- **Content**: `@Controller`, `@Injectable`, `Guard`, `Interceptor`, etc.

### 2. `@honestjs/core`
- **Goal**: High-performance engine and DI.
- **Content**: `Container`, `Application`, `PipelineExecutor`.

### 3. `@honestjs/cli` (Advancement)
- **Engine**: Move to a schematic-based approach for code generation.
- **Templates**: Integrated project starters (`standard`, `microservice`, `edge`).
- **Skill Registry**: Logic to download, install, and auto-configure HonestJS Skills.

### 4. `@honestjs/skills-*` (The Ecosystem)
- **`@honestjs/skills-database`**: Integration with Prisma/Drizzle.
- **`@honestjs/skills-auth`**: JWT, Passport-like logic.
- **`@honestjs/skills-swagger`**: OpenAPI generation.
- **`@honestjs/skills-websockets`**: Gateway and adapter logic.

---

## 🛠 Strategic Pillars

### 1. The "Skills" System
A Skill is a modular package that extends the HonestJS runtime. 
- **Command**: `honest skill add auth`
- **Action**: 
  1. Installs `@honestjs/skills-auth`.
  2. Runs a `post-install` schematic to add `AuthModule` to `app.module.ts`.
  3. Generates boilerplate (e.g., `auth.service.ts`, `auth.controller.ts`).

### 2. Rich Project Templates
CLI templates will be optimized for different environments:
- **`standard`**: Full-featured backend for Node.js/Bun.
- **`edge`**: Stripped-down core optimized for Cloudflare Workers/Vercel Edge.
- **`microservice`**: Includes pre-configured transport layers (NATS, Redis).

### 3. CLI Schematics
The CLI will move from simple file copying to a **Template Engine** (e.g., EJS or Handlebars) to allow conditional code generation based on user choices.

---

## 🗺 Directory Mapping (Monorepo)

| Current Path | Target Package | Role |
|--------------|----------------|------|
| `src/di/` | `@honestjs/core/di` | DI Engine |
| `src/cli/` | `@honestjs/cli` | Scaffolding Tool |
| `src/decorators/` | `@honestjs/common/decorators` | Metadata |
| `src/swagger/` | `@honestjs/skills-swagger` | Optional Skill |
| `src/websockets/` | `@honestjs/skills-websockets` | Optional Skill |
| `packages/cli/templates/` | **NEW** | Scaffold Blueprints |

## ✅ Migration Checklist
- [ ] **Infrastructure**: Initialize Bun Workspace and root configurations.
- [ ] **Common & Core**: Extract base packages and implement "Hot Path" logic.
- [ ] **CLI Refactor**: Move CLI to its package and implement the Template Engine.
- [ ] **Skill Interface**: Define the standard way for skills to register themselves into an application.
- [ ] **Validation**: Port existing Zod/Class-validator logic to `@honestjs/skills-validation`.
