# HonestJS Monorepo Migration Plan (Refined for Performance)

This plan outlines the structural changes to transform HonestJS into a NestJS-like monorepo while maintaining Hono's high-performance characteristics.

## 🚀 Performance Core Principles

To ensure HonestJS remains as fast as raw Hono, the migration will adhere to these principles:

1.  **Zero-Overhead Abstractions**: Decorators in `@honestjs/common` will be pure metadata providers. No logic will execute at request-time inside decorators.
2.  **Bootstrap Pre-computation**: All module discovery, dependency resolution, and pipeline chaining (guards, interceptors, pipes) will be performed **once** during the bootstrap phase.
3.  **Flat Pipeline Execution**: The `PipelineExecutor` will compile component chains into a flat, optimized execution sequence. We will avoid deep recursive calls or complex observable streams (like RxJS) in the request hot-path.
4.  **Native Hono Integration**: The framework will register "finalized" handlers directly to Hono. At request time, Hono will call a pre-compiled function that has all its dependencies already resolved.
5.  **Dependency Isolation**: The monorepo structure will ensure that only the code you use ends up in your bundle (tree-shakability).

---

## 📦 Revised Package Structure

### 1. `@honestjs/common` (The Light Foundation)
- **Goal**: Zero external dependencies (besides `reflect-metadata`).
- **Content**:
  - All public decorators (`@Controller`, `@Get`, `@Inject`, etc.).
  - Component interfaces (`Guard`, `Pipe`, `Interceptor`).
  - Standard HTTP exception classes.
  - Lightweight Logger and Config interfaces.
- **Performance**: Designed to be fully tree-shakable and safe for Edge/Cloudflare Workers.

### 2. `@honestjs/core` (The High-Performance Engine)
- **DI Container**: Async-first, singleton-optimized resolution.
- **Application Engine**: Manages the bootstrap lifecycle and pre-computes the routing table.
- **Scanner & Discovery**: Efficiently crawls the module graph to build the application state.
- **Metadata Repository**: A fast, read-only snapshot of metadata used after bootstrap.

### 3. `@honestjs/platform-hono` (The Bridge)
- **Hono Adapter**: Translates framework-neutral pipeline executions into Hono middleware and handlers.
- **Fast Path**: Ensures that the mapping from Hono `Context` to Controller parameters is direct and uses pre-calculated indices.

### 4. `@honestjs/swagger`, `@honestjs/websockets`, `@honestjs/microservices`
- **Optional Features**: These will remain as separate packages to ensure their dependencies (like `socket.io` or `swagger-ui`) don't bloat the core framework.

---

## 🛠 Strategic Refinements

### Pre-Compiled Handlers
Instead of resolving guards/pipes at request time:
```typescript
// During Bootstrap:
const chain = [
  ...globalGuards,
  ...controllerGuards,
  ...handlerGuards
];
// We create a single "Hot Handler":
const hotHandler = async (c) => {
  for(const guard of chain) {
    if (!await guard.canActivate(ctx)) return c.json({ error: 'Forbidden' }, 403);
  }
  const args = await resolveParams(c); // using pre-computed indices
  return controller.method(...args);
};
hono.get(path, hotHandler);
```

### Lightweight Execution Context
We will avoid creating a heavy `ExecutionContext` object for every request. Instead, we will pass a recycled or minimal "Host" object that provides just enough metadata for guards and interceptors to function.

### Optimized DI Access
Singleton services will be resolved once and stored in a flat array/map for instant access during request-scoped resolution, minimizing the overhead of the DI container.

---

## 🗺 Directory Mapping

| Current Path | Target Package | Status |
|--------------|----------------|--------|
| `src/di/` | `@honestjs/core/di` | Core Logic |
| `src/decorators/` | `@honestjs/common/decorators` | Metadata Only |
| `src/interfaces/` | `@honestjs/common/interfaces` | Shared Types |
| `src/managers/` | `@honestjs/core/managers` | Execution Logic |
| `src/registries/` | `@honestjs/core/registries` | Registry Logic |
| `src/swagger/` | `@honestjs/swagger` | Plugin |
| `src/websockets/` | `@honestjs/websockets` | Plugin |
| `src/application.ts` | `@honestjs/core` | Entry Point |

## ✅ Migration Checklist
- [ ] Initialize Bun Workspace.
- [ ] Extract `@honestjs/common` and verify it has no heavy dependencies.
- [ ] Refactor `Application` to pre-compile route handlers.
- [ ] Move Hono-specific logic to `@honestjs/platform-hono`.
- [ ] Ensure all 260 tests pass with the new "Hot Path" execution.
