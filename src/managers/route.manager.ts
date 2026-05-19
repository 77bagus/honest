import type { Hono } from 'hono'
import { VERSION_NEUTRAL } from '../constants'
import { NoopLogger } from '../loggers'
import type {
	DiContainer,
	ILogger,
	IMetadataRepository,
	ParameterMetadata,
	RouteDefinition,
	HonestOptions
} from '../interfaces'
import type { RouteRegistry } from '../registries'
import type { Constructor } from '../types'
import { addLeadingSlash, normalizePath, stripEndSlash } from '../utils'
import { ComponentManager } from './component.manager'
import { PipelineExecutor } from './pipeline.executor'

/**
 * Orchestrates the registration of routes from controller metadata into Hono
 * Handles path building, versioning, and pipeline integration.
 */
export class RouteManager {
	constructor(
		private readonly hono: Hono,
		private readonly metadataRepository: IMetadataRepository,
		private readonly componentManager: ComponentManager,
		private readonly pipelineExecutor: PipelineExecutor,
		private readonly routeRegistry: RouteRegistry,
		private readonly container: DiContainer,
		private readonly options: HonestOptions = {},
		private readonly logger: ILogger = new NoopLogger(),
		private readonly debugRoutes = false
	) {}

	/**
	 * Registers all controllers from a module into Hono.
	 * @param controllers - List of controller classes to register
	 * @param globalPrefix - Optional global prefix for all routes
	 */
	async register(controllers: Constructor[], globalPrefix?: string): Promise<void> {
		const prefixSegment = globalPrefix ? addLeadingSlash(stripEndSlash(globalPrefix)) : ''

		for (const controllerClass of controllers) {
			const start = Date.now()
			const routeCountBefore = this.routeRegistry.getRoutes().length
			try {
				await this.registerController(controllerClass, prefixSegment)
				if (this.debugRoutes) {
					this.logger.emit({
						level: 'info',
						category: 'routes',
						message: 'Registered controller routes',
						details: {
							controller: controllerClass.name,
							routeCountAdded: this.routeRegistry.getRoutes().length - routeCountBefore,
							registrationDurationMs: Date.now() - start
						}
					})
				}
			} catch (error) {
				if (this.debugRoutes) {
					this.logger.emit({
						level: 'error',
						category: 'routes',
						message: 'Failed to register controller routes',
						details: {
							controller: controllerClass.name,
							error: error instanceof Error ? error.message : String(error),
							errorMessage: error instanceof Error ? error.message : String(error)
						}
					})
				}
				throw error
			}
		}
	}

	private async registerController(controllerClass: Constructor, prefixSegment: string): Promise<void> {
		if (!this.metadataRepository.hasController(controllerClass)) {
			throw new Error(`Class ${controllerClass.name} is not decorated with @Controller()`)
		}

		const controllerInstance = await this.container.resolve(controllerClass)
		const controllerPath = this.metadataRepository.getControllerPath(controllerClass)
		const controllerOptions = this.metadataRepository.getControllerOptions(controllerClass)
		const routes = this.metadataRepository.getRoutes(controllerClass)
		const parameterMetadata = this.metadataRepository.getParameters(controllerClass)
		const contextIndices = this.metadataRepository.getContextIndices(controllerClass)

		if (routes.length === 0) {
			throw new Error(`Controller ${controllerClass.name} has no registered routes.`)
		}

		const controllerSegment = addLeadingSlash(stripEndSlash(controllerPath))

		for (const route of routes) {
			const { method, path, version, prefix } = route
			const methodSegment = addLeadingSlash(stripEndSlash(path))

			const effectiveVersion = version ?? controllerOptions.version ?? this.options.routing?.version
			const effectivePrefix = prefix ?? controllerOptions.prefix

			if (effectivePrefix === false) {
				await this.registerRoute(
					controllerInstance,
					route,
					parameterMetadata,
					contextIndices,
					controllerClass,
					'',
					'',
					'',
					methodSegment,
					method
				)
				continue
			}

			const versionSegment = this.formatVersionSegment(effectiveVersion)
			await this.registerRoute(
				controllerInstance,
				route,
				parameterMetadata,
				contextIndices,
				controllerClass,
				prefixSegment,
				versionSegment,
				controllerSegment,
				methodSegment,
				method
			)
		}
	}

	private async registerRoute(
		controllerInstance: any,
		route: RouteDefinition,
		parameterMetadata: Map<string | symbol, ParameterMetadata[]>,
		contextIndices: Map<string | symbol, number>,
		controllerClass: Constructor,
		prefixSegment: string,
		versionSegment: string,
		controllerSegment: string,
		methodSegment: string,
		method: string
	): Promise<void> {
		const { handlerName } = route

		const fullPath = this.buildRoutePath(prefixSegment, versionSegment, controllerSegment, methodSegment)

		const handler = controllerInstance[handlerName].bind(controllerInstance)

		const handlerParams = parameterMetadata.get(handlerName) || []
		const contextIndex = contextIndices.get(handlerName)

		const globalMiddleware = await this.componentManager.getGlobalMiddleware()
		const handlerMiddleware = await this.componentManager.getHandlerMiddleware(controllerClass, handlerName)

		const handlerPipes = await this.componentManager.getHandlerPipes(controllerClass, handlerName)

		this.routeRegistry.registerRoute({
			controller: controllerClass.name,
			controllerClass,
			handler: handlerName,
			method,
			prefix: prefixSegment,
			version: versionSegment,
			route: controllerSegment,
			path: methodSegment,
			fullPath,
			parameters: handlerParams
		})

		const wrapperHandler = async (c: any) => {
			try {
				return await this.pipelineExecutor.execute({
					controllerClass,
					handlerName,
					handler,
					handlerParams,
					handlerPipes,
					contextIndex,
					context: c
				})
			} catch (error) {
				return this.componentManager.handleException(error, c)
			}
		}

		this.registerRouteHandler(method, fullPath, [...globalMiddleware, ...handlerMiddleware], wrapperHandler)
	}

	private isVersionNeutral(version: any): boolean {
		return version === VERSION_NEUTRAL || version === 'neutral'
	}

	private formatVersionSegment(version?: number | typeof VERSION_NEUTRAL | number[]): string {
		if (version === undefined || this.isVersionNeutral(version)) {
			return ''
		}
		if (Array.isArray(version)) {
			return `/v${version[0]}`
		}
		return `/v${version}`
	}

	private buildRoutePath(
		prefixSegment: string,
		versionSegment: string,
		controllerSegment: string,
		methodSegment: string
	): string {
		return normalizePath(`${prefixSegment}${versionSegment}${controllerSegment}${methodSegment}`)
	}

	private registerRouteHandler(
		method: string,
		fullPath: string,
		middleware: any[],
		handler: (c: any) => Promise<any>
	): void {
		const normalizedMethod = method.toLowerCase()
		switch (normalizedMethod) {
			case 'get':
				this.hono.get(fullPath, ...middleware, handler)
				break
			case 'post':
				this.hono.post(fullPath, ...middleware, handler)
				break
			case 'put':
				this.hono.put(fullPath, ...middleware, handler)
				break
			case 'delete':
				this.hono.delete(fullPath, ...middleware, handler)
				break
			case 'patch':
				this.hono.patch(fullPath, ...middleware, handler)
				break
			default:
				throw new Error(`Unsupported HTTP method: ${method}`)
		}
	}
}
