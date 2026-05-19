import { NoopLogger } from '../loggers'
import { MetadataRegistry } from '../registries'
import { resolveForwardRef } from '../utils/forward-ref.util'
import type {
	LogEvent,
	DiContainer,
	ILogger,
	IServiceRegistry,
	Provider,
	ProviderToken,
	ValueProvider,
	ClassProvider,
	FactoryProvider
} from '../interfaces'
import { Scope } from '../interfaces'
import { StaticServiceRegistry } from '../registries'
import type { Constructor } from '../types'

/**
 * Dependency Injection container that manages class instances and their dependencies.
 * Supports Singleton (default), Request, and Transient scopes.
 */
export class Container implements DiContainer {
	constructor(
		private readonly serviceRegistry: IServiceRegistry = new StaticServiceRegistry(),
		private readonly logger: ILogger = new NoopLogger(),
		private readonly debugDi = false
	) {}

	/**
	 * Map of singleton tokens to their instances.
	 */
	private readonly singletonInstances = new Map<ProviderToken, any>()

	/**
	 * Map of context IDs to their request-scoped instances.
	 */
	private readonly requestInstances = new Map<string, Map<ProviderToken, any>>()

	/**
	 * Map of tokens to their provider definitions.
	 */
	private readonly providers = new Map<ProviderToken, Provider>()

	/**
	 * Optional visibility checker.
	 */
	private visibilityChecker?: (provider: Constructor, consumer: Constructor) => boolean

	private emitLog(event: LogEvent): void {
		if (!this.debugDi) {
			return
		}
		this.logger.emit(event)
	}

	/**
	 * Registers a provider definition.
	 * @param provider - The provider definition
	 */
	addProvider(provider: Provider): void {
		if (typeof provider === 'function') {
			this.providers.set(provider, provider)
		} else {
			this.providers.set(provider.provide, provider)
		}
	}

	/**
	 * Resolves a dependency from the container.
	 * @param token - The token or class constructor to resolve
	 * @param contextId - Optional context ID for request-scoped resolution
	 * @returns An instance of the requested dependency
	 */
	async resolve<T>(token: ProviderToken, contextId?: string): Promise<T> {
		return this.resolveWithTracking(token, new Set<ProviderToken>(), false, undefined, contextId)
	}

	/**
	 * Internal recursive resolver with circular dependency tracking.
	 */
	private async resolveWithTracking<T>(
		token: ProviderToken,
		resolving: Set<ProviderToken>,
		isForwardRef = false,
		consumer?: Constructor,
		contextId?: string
	): Promise<T> {
		const tokenName = typeof token === 'function' ? token.name : String(token)
		const scope = this.getScope(token)

		// Visibility check
		if (
			this.visibilityChecker &&
			consumer &&
			typeof token === 'function' &&
			!this.visibilityChecker(token as Constructor, consumer)
		) {
			this.emitLog({
				level: 'error',
				category: 'di',
				message: `Encapsulation violation: ${tokenName} is not visible to ${consumer.name}.`
			})
			throw new Error(
				`Encapsulation violation: ${tokenName} is not visible to ${consumer.name}. Check your @Module() exports.`
			)
		}

		// Singleton check
		if (scope === Scope.DEFAULT && this.singletonInstances.has(token)) {
			this.emitLog({
				level: 'debug',
				category: 'di',
				message: `Resolved ${tokenName} from DI cache`
			})
			return this.singletonInstances.get(token)
		}

		// Request scope check
		if (scope === Scope.REQUEST && contextId) {
			const contextMap = this.requestInstances.get(contextId)
			if (contextMap?.has(token)) {
				this.emitLog({
					level: 'debug',
					category: 'di',
					message: `Resolved ${tokenName} from DI cache`
				})
				return contextMap.get(token)
			}
		}

		// Circular dependency detection
		if (resolving.has(token)) {
			const cycle = [...resolving.keys(), token]
				.map((t) => (typeof t === 'function' ? t.name : String(t)))
				.join(' -> ')

			if (!isForwardRef) {
				this.emitLog({
					level: 'error',
					category: 'di',
					message: `Circular dependency detected while resolving ${tokenName}`,
					details: { cycle }
				})
				throw new Error(`Circular dependency detected: ${cycle}`)
			}

			this.emitLog({
				level: 'debug',
				category: 'di',
				message: `Circular dependency detected while resolving ${tokenName}, returning proxy`,
				details: { cycle }
			})

			// Circular Proxy
			return new Proxy({} as any, {
				get: (t, prop) => {
					if (
						prop === 'toString' ||
						prop === Symbol.toStringTag ||
						prop === 'valueOf' ||
						prop === 'constructor' ||
						prop === 'toJSON' ||
						prop === Symbol.toPrimitive
					) {
						return () => `[HonestProxy:${tokenName}]`
					}
					if (prop === 'then') return undefined

					const instance = this.getInstance(token, contextId)
					if (!instance) {
						if (typeof prop === 'string' && (prop.startsWith('__') || prop === 'as-instance'))
							return undefined
						throw new Error(
							`Circular dependency detected: proxy accessed before ${tokenName} was instantiated.`
						)
					}
					return instance[prop]
				}
			})
		}

		resolving.add(token)

		this.emitLog({
			level: 'debug',
			category: 'di',
			message: `Resolving ${tokenName}`,
			details: { resolving: [...resolving].map((t) => (typeof t === 'function' ? t.name : String(t))) }
		})

		const provider = this.providers.get(token) || (typeof token === 'function' ? token : undefined)
		if (!provider) {
			throw new Error(
				`Cannot resolve ${tokenName}: it is not decorated with @Service(). Did you forget to add @Service() to the class?`
			)
		}

		let instance: T

		if (typeof provider === 'function') {
			instance = await this.instantiateClass(provider as Constructor<T>, resolving, contextId)
		} else if ('useValue' in provider) {
			instance = (provider as ValueProvider).useValue
		} else if ('useClass' in provider) {
			instance = await this.instantiateClass((provider as ClassProvider).useClass, resolving, contextId)
		} else if ('useFactory' in provider) {
			const factoryProvider = provider as FactoryProvider
			const inject = factoryProvider.inject || []
			const args = []
			for (const argToken of inject) {
				args.push(await this.resolveWithTracking(argToken, new Set(resolving), false, undefined, contextId))
			}
			instance = await factoryProvider.useFactory(...args)
		} else {
			throw new Error(`Invalid provider definition for token: ${tokenName}`)
		}

		this.instancesSet(token, instance, contextId)

		this.emitLog({
			level: 'debug',
			category: 'di',
			message: `Created instance for ${tokenName}`
		})

		return instance
	}

	private async instantiateClass<T>(
		target: Constructor<T>,
		resolving: Set<ProviderToken>,
		contextId?: string
	): Promise<T> {
		const paramTypes = Reflect.getMetadata('design:paramtypes', target) || []
		const injectTokens = MetadataRegistry.getInjectTokens(target)

		if (target.length > 0 && paramTypes.length === 0 && injectTokens.size === 0) {
			if (!this.serviceRegistry.isService(target)) {
				throw new Error(
					`Cannot resolve ${target.name}: it is not decorated with @Service(). Did you forget to add @Service() to the class?`
				)
			}
			throw new Error(
				`Cannot resolve dependencies for ${target.name}: constructor metadata is missing. Ensure 'reflect-metadata' is imported and 'emitDecoratorMetadata' is enabled.`
			)
		}

		// Check if any dependency is request-scoped but we are resolving as singleton
		const targetScope = this.getScope(target)
		if (targetScope === Scope.DEFAULT && !contextId) {
			for (let i = 0; i < paramTypes.length; i++) {
				const depToken = injectTokens.get(i) || paramTypes[i]
				if (this.getScope(depToken) === Scope.REQUEST) {
					throw new Error(
						`Encapsulation violation: Singleton ${target.name} cannot depend on request-scoped ${typeof depToken === 'function' ? depToken.name : String(depToken)}.`
					)
				}
			}
		}

		const dependencies: any[] = []
		for (let index = 0; index < paramTypes.length; index++) {
			const paramType = paramTypes[index]
			const token = injectTokens.get(index)
			const hasForwardRef = !!(token && typeof token === 'object' && 'forwardRef' in token)
			const effectiveToken = token ? resolveForwardRef(token) : paramType

			if (
				!effectiveToken ||
				effectiveToken === Object ||
				effectiveToken === Array ||
				effectiveToken === Function
			) {
				const name = typeof target === 'function' ? target.name : String(target)
				throw new Error(
					`Cannot resolve dependency at index ${index} of ${name}. Use concrete class types or @Inject() for constructor dependencies.`
				)
			}

			let dependency: any
			try {
				dependency = await this.resolveWithTracking(
					effectiveToken,
					new Set(resolving),
					hasForwardRef,
					target,
					contextId
				)
			} catch (error: any) {
				if (error.message.includes('Cannot resolve dependency at index')) {
					throw error
				}
				throw new Error(
					`Cannot resolve dependency at index ${index} of ${target.name}. Cause: ${error.message}`,
					{
						cause: error
					}
				)
			}
			dependencies.push(dependency)
		}

		return new target(...dependencies)
	}

	private getScope(token: ProviderToken): Scope {
		if (typeof token !== 'function') return Scope.DEFAULT
		return MetadataRegistry.getMetadata(token, Symbol.for('HONEST_SCOPE')) ?? Scope.DEFAULT
	}

	private getInstance(token: ProviderToken, contextId?: string): any {
		if (this.singletonInstances.has(token)) return this.singletonInstances.get(token)
		if (contextId) return this.requestInstances.get(contextId)?.get(token)
		return undefined
	}

	private instancesSet(token: ProviderToken, instance: any, contextId?: string): void {
		const scope = this.getScope(token)
		if (scope === Scope.DEFAULT) {
			this.singletonInstances.set(token, instance)
		} else if (scope === Scope.REQUEST && contextId) {
			if (!this.requestInstances.has(contextId)) {
				this.requestInstances.set(contextId, new Map())
			}
			this.requestInstances.get(contextId)!.set(token, instance)
		}
	}

	register<T>(token: ProviderToken, instance: T): void {
		this.singletonInstances.set(token, instance)
	}

	has(token: ProviderToken): boolean {
		return this.singletonInstances.has(token)
	}

	clear(): void {
		this.singletonInstances.clear()
		this.requestInstances.clear()
		this.providers.clear()
	}

	/**
	 * Clears request-scoped instances for a given context ID.
	 */
	clearContext(contextId: string): void {
		this.requestInstances.delete(contextId)
	}

	getInstances(): any[] {
		const all = Array.from(this.singletonInstances.values())
		for (const map of this.requestInstances.values()) {
			all.push(...map.values())
		}
		return all
	}

	setVisibilityChecker(checker: (provider: Constructor, consumer: Constructor) => boolean): void {
		this.visibilityChecker = checker
	}
}
