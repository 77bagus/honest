# HonestJS Framework Audit & Future Roadmap

This document provides a comprehensive audit of the HonestJS framework, identifying potential issues, architectural gaps, and a roadmap for future features inspired by industry standards like NestJS.

## 📋 Framework Audit Checklist

### Core Architecture & Modules
- [ ] **Dynamic Modules:** Current `@Module()` is static. Lack of `register()`, `forRoot()`, or `forFeature()` patterns for runtime configuration.
- [ ] **Module Encapsulation (Exports):** Lack of `exports` property in `ModuleOptions`. Currently, all services registered in any module are effectively public once resolved.
- [ ] **Circular Dependencies:** Detected but not resolvable. Missing `forwardRef()` utility for handling cross-module or cross-service circularities.
- [ ] **Lifecycle Hooks:** No support for `OnModuleInit`, `OnApplicationBootstrap`, `OnModuleDestroy`, or `BeforeApplicationShutdown`.
- [ ] **Async Providers:** Providers are resolved synchronously. Missing `useFactory` with `async/await` support.
- [ ] **Factory Providers:** No formal `useFactory`, `useValue`, or `useExisting` provider patterns.
- [ ] **Dependency Graph:** No built-in way to visualize or inspect the dependency graph at startup.

### Dependency Injection (DI)
- [ ] **Injection Scopes:** Only Singleton scope is supported. Missing `Request` and `Transient` scopes.
- [ ] **Property Injection:** Currently only constructor injection is supported. Missing `@Inject()` for properties.
- [ ] **String/Symbol Tokens:** DI seems limited to class constructors as tokens. No support for string or symbol-based tokens.
- [ ] **Multi-instance Providers:** No support for `multi: true` providers (e.g., for registering multiple plugins to one token).

### Pipeline (Middleware, Guards, Pipes, Filters)
- [ ] **Interceptors:** No Interceptor layer for cross-cutting concerns (transforming responses, mapping streams, etc.).
- [ ] **Global Pipeline Granularity:** Global guards/pipes/filters are applied to all routes. Missing logic to exclude specific routes from global components.
- [ ] **Execution Context:** The pipeline passes Hono's `Context`. Missing a framework-level `ExecutionContext` that provides metadata about the class and handler being invoked.
- [ ] **Native Validation Pipe:** No built-in validation pipe integrated with `class-validator` or `zod`.
- [ ] **Filter Priority:** Unclear priority/ordering for multiple exception filters.

### Routing & Controllers
- [ ] **Header/Media-Type Versioning:** Currently only URI-based versioning is explicitly handled.
- [ ] **Versioning Logic:** No support for "Neutral" versioning that defaults to the latest version.
- [ ] **Redirect Decorator:** Missing `@Redirect()` for declarative redirects.
- [ ] **Render Decorator:** Missing `@Render()` for template engine integration.
- [ ] **SSE Support:** No native support for Server-Sent Events via decorators.

### Observability & DX
- [ ] **Swagger/OpenAPI:** No built-in or plugin-based OpenAPI generation.
- [ ] **Logger Injection:** No easy way to inject the framework logger into user services.
- [ ] **Diagnostics:** While there are some debug logs, there is no "Inspector" mode for real-time monitoring.
- [ ] **Error Messages:** Circular dependency errors could be more descriptive about the path of the cycle.

### Ecosystem & Advanced Features
- [ ] **Configuration Module:** No official way to handle hierarchical configuration and `.env` files.
- [ ] **File Upload:** No native `@UploadedFile()` or `@UploadedFiles()` decorators for multipart handling.
- [ ] **Websockets:** No support for Socket.io or native WebSockets via decorators.
- [ ] **Microservices:** No transport layers for TCP, Redis, NATS, etc.
- [ ] **Task Scheduling:** No built-in Cron or interval decorators.
- [ ] **Event Emitter:** No internal event bus for decoupled communication.
- [ ] **Cache Module:** Missing standard caching abstraction.
- [ ] **Health Checks:** No built-in support for Terminus or health check endpoints.
- [ ] **CLI:** Lack of a scaffolding tool for generating boilerplate code.

---

## 🚀 Recommended Development Plan

### Phase 1: Core Robustness (Short Term)
1. **Lifecycle Hooks:** Implement `OnModuleInit` and `OnApplicationBootstrap` to allow services to initialize (e.g., DB connections).
2. **Circular Dependency Resolution:** Introduce `forwardRef()` to handle complex dependency chains.
3. **Module Exports:** Implement encapsulation in `@Module` to restrict service visibility.
4. **Enhanced Providers:** Add support for `useValue` and `useFactory` (sync).

### Phase 2: Pipeline & DX (Medium Term)
1. **Interceptors:** Add the Interceptor layer to the `PipelineExecutor`.
2. **Async Providers:** Enable `async` support for `useFactory`.
3. **Validation Pipe:** Create a native `ZodValidationPipe` or `ClassValidatorPipe`.
4. **Configuration Module:** Develop a `@honestjs/config` package.
5. **Logger Injection:** Allow `@InjectLogger()` or standard injection for the framework logger.

### Phase 3: Ecosystem Expansion (Long Term)
1. **Swagger Integration:** Automate OpenAPI 3.0 spec generation.
2. **Request Scoping:** Implement `Request` scope in the DI container.
3. **Websockets & SSE:** Add real-time communication support.
4. **CLI Tool:** Develop `honest-cli` for rapid prototyping.

## 🐛 Bug Fix Roadmap
1. **Metadata Collision:** Ensure `MetadataRegistry` (static) doesn't cause issues in multi-app environments where the same class might need different metadata (rare but technically possible).
2. **Memory Leaks:** Verify `clear()` methods in registries are exhaustive and called during application shutdown.
3. **Error Handling in Filters:** Ensure that if a filter throws, it doesn't crash the whole pipeline but falls back to a global error handler. (Partially addressed, but needs rigorous testing).
