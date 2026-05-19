# HonestJS Monorepo Migration Plan

This document outlines the strategy for refactoring HonestJS into a monorepo structure, inspired by the architecture of NestJS. This change will improve modularity, allow independent versioning of packages, and align with industry standards for framework design.

## 📦 Proposed Package Structure

We will adopt a multi-package repository (monorepo) using **Bun Workspaces**.

### 1. `@honestjs/common`
The foundation of the framework. Contains code that is independent of the execution environment or execution core.
- **Decorators:** `@Controller()`, `@Get()`, `@Post()`, `@Inject()`, `@Module()`, `@Service()`, etc.
- **Interfaces:** `IPlugin`, `Middleware`, `Guard`, `Pipe`, `Filter`, `Interceptor`.
- **Built-in Components:** Standard Pipes (Validation), Guards, Interceptors.
- **Utilities:** `Logger`, `ConfigService` (base), and common helper functions.
- **Exceptions:** `FrameworkError` and standard HTTP exceptions.

### 2. `@honestjs/core`
The "brain" of the framework. Handles the internal mechanics.
- **DI Container:** The `Container` class and dependency resolution logic.
- **Application Engine:** `Application` class, bootstrap sequence, and lifecycle management.
- **Metadata Management:** `MetadataRegistry` and `MetadataRepository`.
- **Pipeline Executor:** The logic that chains middleware, guards, pipes, and interceptors.
- **Discovery:** Logic to scan modules and register components.

### 3. `@honestjs/platform-hono`
The Hono-specific implementation. HonestJS is currently built on Hono, so this package will contain the adapters.
- **Routing:** Hono-specific route registration.
- **Context Adapter:** Mapping Hono's `Context` to framework-neutral abstractions if necessary.
- **HTTP Server:** Hono integration logic.

### 4. `@honestjs/swagger`
The OpenAPI/Swagger integration.
- **Logic:** OpenAPI document generator and builder.
- **Decorators:** Swagger-specific decorators (`@ApiTags`, etc.).

### 5. `@honestjs/websockets`
Real-time communication support.
- **Logic:** `WsManager` and adapter interfaces.
- **Decorators:** `@WebSocketGateway`, `@SubscribeMessage`, etc.

### 6. `@honestjs/testing`
Utilities for unit and integration testing.
- **Harness:** `createTestingModule`, `createTestApplication`.

### 7. `@honestjs/cli`
The scaffolding and generation tool.
- **Commands:** `new`, `generate`.

---

## 🛠 Transition Strategy

### Phase 1: Infrastructure Setup
1. **Workspace Configuration:** Create a `packages/` directory and configure `package.json` for Bun workspaces.
2. **Global Config:** Consolidate `tsconfig.json`, `eslint.config.js`, and `prettierrc` at the root.
3. **Internal Linking:** Use workspace protocols (e.g., `"@honestjs/common": "workspace:*"`).

### Phase 2: Code Extraction (Sequential)
1. **Extract `common`:** Move decorators, interfaces, and utils. Update imports.
2. **Extract `core`:** Move the DI container and lifecycle logic.
3. **Extract `platform-hono`:** Isolate Hono-specific routing.
4. **Extract feature packages:** Move `swagger`, `websockets`, `config`, and `testing`.

### Phase 3: Build & CI Update
1. **Build Orchestration:** Use Bun's build capabilities or a tool like `turborepo` for efficient cross-package builds.
2. **CI Pipeline:** Update GitHub Actions to run tests across all packages in the workspace.

---

## 🗺 Directory Mapping (Current -> New)

| Current Path | Target Package |
|--------------|----------------|
| `src/di/` | `@honestjs/core/di` |
| `src/decorators/` | `@honestjs/common/decorators` |
| `src/interfaces/` | `@honestjs/common/interfaces` |
| `src/managers/` | `@honestjs/core/managers` |
| `src/registries/` | `@honestjs/core/registries` |
| `src/swagger/` | `@honestjs/swagger` |
| `src/websockets/` | `@honestjs/websockets` |
| `src/testing/` | `@honestjs/testing` |
| `src/cli/` | `@honestjs/cli` |
| `src/application.ts` | `@honestjs/core` |
| `src/utils/` | `@honestjs/common/utils` |

## ✅ Success Criteria
- [ ] Project builds successfully as a monorepo.
- [ ] All 260 tests pass in the new structure.
- [ ] Packages are correctly isolated with explicit dependencies in their `package.json`.
- [ ] Users can import from `@honestjs/common` or `@honestjs/core` just like in NestJS.
