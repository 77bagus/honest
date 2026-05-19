import type {
	ControllerOptions,
	IMetadataRepository,
	MetadataComponentType,
	MetadataComponentTypeMap,
	ModuleOptions,
	ParameterMetadata,
	RouteDefinition
} from '../interfaces'
import { MetadataRegistry } from './metadata.registry'
import { resolveForwardRef } from '../utils/forward-ref.util'
import type { Constructor } from '../types'

/**
 * Immutable metadata repository for a single Application instance.
 * Captures a deep copy of all metadata reachable from a root module at creation time,
 * isolating the application from later mutations to the static MetadataRegistry.
 */
export class MetadataRepository implements IMetadataRepository {
	private readonly controllerPaths = new Map<Constructor, string>()
	private readonly controllerOptions = new Map<Constructor, ControllerOptions>()
	private readonly routes = new Map<Constructor, RouteDefinition[]>()
	private readonly parameters = new Map<Constructor, Map<string | symbol, ParameterMetadata[]>>()
	private readonly contextIndices = new Map<Constructor, Map<string | symbol, number>>()
	private readonly modules = new Map<Constructor, ModuleOptions>()
	private readonly providerToModule = new Map<Constructor, Constructor>()
	private readonly moduleVisibleProviders = new Map<Constructor, Set<Constructor>>()

	private readonly controllerComponents = new Map<MetadataComponentType, Map<Constructor, unknown[]>>([
		['middleware', new Map<Constructor, unknown[]>()],
		['guard', new Map<Constructor, unknown[]>()],
		['pipe', new Map<Constructor, unknown[]>()],
		['filter', new Map<Constructor, unknown[]>()],
		['interceptor', new Map<Constructor, unknown[]>()]
	])
	private readonly handlerComponents = new Map<
		MetadataComponentType,
		Map<Constructor, Map<string | symbol, unknown[]>>
	>([
		['middleware', new Map()],
		['guard', new Map()],
		['pipe', new Map()],
		['filter', new Map()],
		['interceptor', new Map()]
	])

	static fromRootModule(rootModule: Constructor): MetadataRepository {
		const snapshot = new MetadataRepository()
		snapshot.captureModuleGraph(rootModule)
		return snapshot
	}

	hasController(controller: Constructor): boolean {
		return this.controllerPaths.has(controller)
	}

	getControllerPath(controller: Constructor): string {
		return this.controllerPaths.get(controller) || ''
	}

	getControllerOptions(controller: Constructor): ControllerOptions {
		const options = this.controllerOptions.get(controller)
		return options ? { ...options } : {}
	}

	getRoutes(controller: Constructor): RouteDefinition[] {
		return (this.routes.get(controller) || []).map((route) => this.cloneRouteDefinition(route))
	}

	getParameters(controller: Constructor): Map<string | symbol, ParameterMetadata[]> {
		const parameters = this.parameters.get(controller)
		if (!parameters) {
			return new Map()
		}

		const cloned = new Map<string | symbol, ParameterMetadata[]>()
		for (const [handlerName, entries] of parameters.entries()) {
			cloned.set(
				handlerName,
				entries.map((entry) => ({ ...entry }))
			)
		}

		return cloned
	}

	getContextIndices(controller: Constructor): Map<string | symbol, number> {
		return new Map(this.contextIndices.get(controller) || new Map())
	}

	getModuleOptions(module: Constructor): ModuleOptions | undefined {
		const options = this.modules.get(module)
		if (!options) {
			return undefined
		}

		return {
			controllers: options.controllers ? [...options.controllers] : undefined,
			services: options.services ? [...options.services] : undefined,
			imports: options.imports ? [...options.imports] : undefined,
			exports: options.exports ? [...options.exports] : undefined
		}
	}

	getControllerComponents<T extends MetadataComponentType>(
		type: T,
		controller: Constructor
	): MetadataComponentTypeMap[T][] {
		const map = this.controllerComponents.get(type)!
		const components = (map.get(controller) || []) as MetadataComponentTypeMap[T][]
		return [...components]
	}

	getHandlerComponents<T extends MetadataComponentType>(
		type: T,
		controller: Constructor,
		handlerName: string | symbol
	): MetadataComponentTypeMap[T][] {
		const typeMap = this.handlerComponents.get(type)!
		const controllerMap = typeMap.get(controller)
		if (!controllerMap) {
			return []
		}
		const components = (controllerMap.get(handlerName) || []) as MetadataComponentTypeMap[T][]
		return [...components]
	}

	isProviderVisible(provider: Constructor, consumer: Constructor): boolean {
		const moduleClass = this.providerToModule.get(consumer)
		if (!moduleClass) {
			// If consumer is not associated with a module, we allow it (e.g. global components or manual instantiation)
			return true
		}

		const visible = this.moduleVisibleProviders.get(moduleClass)
		return visible ? visible.has(provider) : true
	}

	private captureModuleGraph(rootModule: Constructor): void {
		const visitedModules = new Set<Constructor>()
		const controllers = new Set<Constructor>()

		const visitModule = (moduleClass: Constructor): void => {
			if (visitedModules.has(moduleClass)) {
				return
			}
			visitedModules.add(moduleClass)

			const moduleOptions = MetadataRegistry.getModuleOptions(moduleClass)
			if (!moduleOptions) {
				return
			}

			const moduleSnapshot: ModuleOptions = {
				controllers: moduleOptions.controllers ? [...moduleOptions.controllers] : undefined,
				services: moduleOptions.services ? [...moduleOptions.services] : undefined,
				imports: moduleOptions.imports ? [...moduleOptions.imports] : undefined,
				exports: moduleOptions.exports ? [...moduleOptions.exports] : undefined
			}
			this.modules.set(moduleClass, moduleSnapshot)

			for (const controller of moduleSnapshot.controllers || []) {
				controllers.add(controller)
				this.providerToModule.set(controller, moduleClass)
			}

			for (const service of moduleSnapshot.services || []) {
				const token = typeof service === 'function' ? service : service.provide
				if (typeof token === 'function') {
					this.providerToModule.set(token as Constructor, moduleClass)
				}
			}

			for (const importedModule of moduleSnapshot.imports || []) {
				const resolvedModule = resolveForwardRef(importedModule)
				visitModule(resolvedModule)
			}
		}

		visitModule(rootModule)

		for (const controller of controllers) {
			this.captureController(controller)
		}

		// Calculate visible providers for each module
		this.calculateVisibility(visitedModules)
	}

	private calculateVisibility(modules: Set<Constructor>): void {
		const moduleExports = new Map<Constructor, Set<Constructor>>()

		const getExports = (moduleClass: Constructor, visiting = new Set<Constructor>()): Set<Constructor> => {
			if (moduleExports.has(moduleClass)) return moduleExports.get(moduleClass)!
			if (visiting.has(moduleClass)) return new Set() // Circular
			visiting.add(moduleClass)

			const exports = new Set<Constructor>()
			const options = this.modules.get(moduleClass)
			if (options && options.exports) {
				for (const exportItem of options.exports) {
					const resolved = resolveForwardRef(exportItem) as Constructor
					if (this.modules.has(resolved)) {
						// It's a module re-export
						const nestedExports = getExports(resolved, visiting)
						nestedExports.forEach((e) => exports.add(e))
					} else {
						// It's a provider export (can be a Constructor or a Provider object)
						const token = typeof resolved === 'function' ? resolved : (resolved as any).provide
						if (typeof token === 'function') {
							exports.add(token as Constructor)
						}
					}
				}
			}
			moduleExports.set(moduleClass, exports)
			return exports
		}

		for (const moduleClass of modules) {
			const visible = new Set<Constructor>()
			const options = this.modules.get(moduleClass)
			if (options) {
				// 1. Its own services
				if (options.services) {
					for (const s of options.services) {
						const token = typeof s === 'function' ? s : s.provide
						if (typeof token === 'function') {
							visible.add(token as Constructor)
						}
					}
				}
				// 2. Its own controllers
				if (options.controllers) {
					options.controllers.forEach((c) => visible.add(c))
				}
				// 3. Exported services from imported modules
				if (options.imports) {
					for (const importedModule of options.imports) {
						const resolved = resolveForwardRef(importedModule) as Constructor
						const exportedFromImport = getExports(resolved)
						exportedFromImport.forEach((e) => visible.add(e))
					}
				}
			}
			this.moduleVisibleProviders.set(moduleClass, visible)
		}
	}

	private captureController(controller: Constructor): void {
		if (!MetadataRegistry.hasController(controller)) {
			return
		}

		this.controllerPaths.set(controller, MetadataRegistry.getControllerPath(controller) || '')
		this.controllerOptions.set(controller, { ...MetadataRegistry.getControllerOptions(controller) })

		const routes = (MetadataRegistry.getRoutes(controller) || []).map((route) => this.cloneRouteDefinition(route))
		this.routes.set(controller, routes)

		const parameters = MetadataRegistry.getParameters(controller)
		const parameterSnapshot = new Map<string | symbol, ParameterMetadata[]>()
		for (const [handlerName, entries] of parameters.entries()) {
			parameterSnapshot.set(
				handlerName,
				(entries || []).map((entry) => ({ ...entry }))
			)
		}
		this.parameters.set(controller, parameterSnapshot)

		this.contextIndices.set(controller, new Map(MetadataRegistry.getContextIndices(controller) || new Map()))

		for (const type of ['middleware', 'guard', 'pipe', 'filter', 'interceptor'] as const) {
			const controllerMap = this.controllerComponents.get(type)!
			controllerMap.set(controller, [...(MetadataRegistry.getController(type, controller) || [])])
		}

		for (const route of routes) {
			for (const type of ['middleware', 'guard', 'pipe', 'filter', 'interceptor'] as const) {
				const typeMap = this.handlerComponents.get(type)!
				if (!typeMap.has(controller)) {
					typeMap.set(controller, new Map())
				}
				const controllerHandlers = typeMap.get(controller)!
				controllerHandlers.set(route.handlerName, [
					...MetadataRegistry.getHandler(type, controller, route.handlerName)
				])
			}
		}
	}

	private cloneRouteDefinition(route: RouteDefinition): RouteDefinition {
		return {
			...route,
			version: Array.isArray(route.version) ? [...route.version] : route.version
		}
	}
}
