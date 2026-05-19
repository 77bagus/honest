import { Hono } from 'hono'
import { emitStartupGuide as emitStartupGuideLogs } from './application/startup-guide'
import { normalizePluginEntries } from './application/plugin-entries'
import { ApplicationContext } from './application-context'
import { ConsoleLogger } from './loggers'
import { RouteRegistry, MetadataRepository } from './registries'
import { RouteManager, PipelineExecutor, ComponentManager, ParameterResolver, HandlerInvoker } from './managers'
import { Container } from './di'
import { Logger } from './loggers'
import type {
	HonestOptions,
	IApplicationContext,
	RouteInfo,
	DiContainer,
	ILogger,
	IMetadataRepository,
	DynamicModule
} from './interfaces'
import type { Constructor } from './types'
import { ErrorHandler, NotFoundHandler } from './handlers'

/**
 * Main application class for the Honest framework.
 * Orchestrates DI, routing, and lifecycle management.
 */
export class Application {
	private readonly hono: Hono
	private readonly container: DiContainer
	private readonly context: IApplicationContext
	private readonly logger: ILogger
	private readonly routeRegistry: RouteRegistry
	private readonly metadataRepository: IMetadataRepository
	private readonly componentManager: ComponentManager
	private readonly routeManager: RouteManager

	constructor(
		private readonly options: HonestOptions = {},
		metadataRepository: IMetadataRepository
	) {
		const debugDi =
			this.options.debug === true || (typeof this.options.debug === 'object' && Boolean(this.options.debug.di))
		const debugRoutes =
			this.options.debug === true ||
			(typeof this.options.debug === 'object' && Boolean(this.options.debug.routes))
		const debugPipeline =
			this.options.debug === true ||
			(typeof this.options.debug === 'object' && Boolean(this.options.debug.pipeline))

		this.hono = new Hono(this.options.hono)

		this.logger = this.options.logger || new ConsoleLogger()

		this.container = this.options.container || new Container(undefined, this.logger, debugDi)
		this.container.register(Logger, new Logger('App', this.logger))
		this.container.setVisibilityChecker((provider, consumer) =>
			this.metadataRepository.isProviderVisible(provider, consumer)
		)

		this.context = new ApplicationContext()

		this.routeRegistry = new RouteRegistry()
		this.metadataRepository = metadataRepository

		this.componentManager = new ComponentManager(this.container, this.metadataRepository, this.logger)
		this.componentManager.setupGlobalComponents(this.options)

		const parameterResolver = new ParameterResolver(this.componentManager, this.logger)
		const handlerInvoker = new HandlerInvoker()
		const pipelineExecutor = new PipelineExecutor(
			this.container,
			this.componentManager,
			parameterResolver,
			handlerInvoker,
			this.logger,
			debugPipeline
		)

		this.routeManager = new RouteManager(
			this.hono,
			this.metadataRepository,
			this.componentManager,
			pipelineExecutor,
			this.routeRegistry,
			this.container,
			this.options,
			this.logger,
			debugRoutes
		)

		this.setupErrorHandlers()
	}

	private setupErrorHandlers(): void {
		this.hono.notFound(this.options.notFound || NotFoundHandler.handle())
		this.hono.onError(this.options.onError || ErrorHandler.handle())
	}

	private emitStartupGuide(error: unknown, rootModule: Constructor): void {
		emitStartupGuideLogs(this.logger, this.options.startupGuide, error, rootModule)
	}

	async register(moduleItem: Constructor | DynamicModule): Promise<Application> {
		const controllers = await this.componentManager.registerModule(moduleItem)
		const debugStartup =
			this.options.debug === true ||
			(typeof this.options.debug === 'object' && Boolean(this.options.debug.startup))

		await this.routeManager.register(controllers, this.options.routing?.prefix)

		if (debugStartup) {
			const moduleName = typeof moduleItem === 'function' ? moduleItem.name : moduleItem.module.name
			this.logger.emit({
				level: 'info',
				category: 'startup',
				message: 'Application registered',
				details: {
					rootModule: moduleName,
					controllerCount: controllers.length,
					routeCount: this.getRoutes().length
				}
			})
		}
		return this
	}

	/**
	 * Bootstraps the application from a root module.
	 * @param rootModule - The main application module (static or dynamic)
	 * @param options - Configuration options
	 * @returns An object containing the application instance and the underlying Hono app
	 */
	static async create(
		rootModule: Constructor | DynamicModule,
		options: HonestOptions = {}
	): Promise<{ app: Application; hono: Hono }> {
		const debugStartup =
			options.debug === true || (typeof options.debug === 'object' && Boolean(options.debug.startup))
		const requireRoutes = options.strict?.requireRoutes ?? true

		const metadataRepository = MetadataRepository.fromRootModule(rootModule)
		const app = new Application(options, metadataRepository)

		const startedAt = Date.now()
		try {
			const plugins = normalizePluginEntries(options.plugins)

			for (const entry of plugins) {
				const { plugin, preProcessors } = entry
				for (const pre of preProcessors) {
					await pre(app, app.hono, app.context)
				}
				if (plugin.beforeModulesRegistered) {
					await plugin.beforeModulesRegistered(app, app.hono)
				}
			}

			await app.register(rootModule)

			// Trigger onApplicationBootstrap for all instances
			const instances = app.getContainer().getInstances()
			for (const instance of instances) {
				if (typeof instance.onApplicationBootstrap === 'function') {
					await instance.onApplicationBootstrap()
				}
			}

			const routes = app.getRoutes()
			if (debugStartup) {
				app.logger.emit({
					level: 'info',
					category: 'startup',
					message: 'Application startup completed',
					details: {
						rootModule: rootModule.name,
						routeCount: routes.length,
						startupDurationMs: Date.now() - startedAt
					}
				})
			}

			if (requireRoutes && routes.length === 0) {
				const error = new Error('Strict mode: no routes were registered during application startup.')

				// Emit error log regardless of debug mode because it's a fatal startup error
				app.logger.emit({
					level: 'error',
					category: 'startup',
					message: 'Strict mode failed: no routes were registered',
					details: {
						rootModule: rootModule.name,
						requireRoutes,
						startupDurationMs: Date.now() - startedAt
					}
				})

				app.emitStartupGuide(error, rootModule)
				throw error
			}

			for (const entry of plugins) {
				const { plugin, postProcessors } = entry
				if (plugin.afterModulesRegistered) {
					await plugin.afterModulesRegistered(app, app.hono)
				}
				for (const post of postProcessors) {
					await post(app, app.hono, app.context)
				}
			}

			return { app, hono: app.hono }
		} catch (error) {
			if (debugStartup) {
				app.logger.emit({
					level: 'error',
					category: 'startup',
					message: 'Application startup failed',
					details: {
						rootModule: rootModule.name,
						errorMessage: error instanceof Error ? error.message : String(error),
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined
					}
				})
			}
			app.emitStartupGuide(error, rootModule)
			throw error
		}
	}

	getHono(): Hono {
		return this.hono
	}

	getContainer(): DiContainer {
		return this.container
	}

	getContext(): IApplicationContext {
		return this.context
	}

	getRoutes(): ReadonlyArray<RouteInfo> {
		return this.routeRegistry.getRoutes()
	}
}
