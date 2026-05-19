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
import { StaticServiceRegistry } from '../registries'
import type { Constructor } from '../types'

/**
 * Dependency Injection container that manages class instances and their dependencies
 */
export class Container implements DiContainer {
	constructor(
		private readonly serviceRegistry: IServiceRegistry = new StaticServiceRegistry(),
		private readonly logger: ILogger = new NoopLogger(),
		private readonly debugDi = false
	) {}

	/**
	 * Map of tokens to their instances
	 */
	private instances = new Map<ProviderToken, any>()

	/**
	 * Map of tokens to their provider definitions
	 */
	private providers = new Map<ProviderToken, Provider>()

	/**
	 * Optional visibility checker
	 */
	private visibilityChecker?: (provider: Constructor, consumer: Constructor) => boolean

	private emitLog(event: LogEvent): void {
		if (!this.debugDi) {
			return
		}
		this.logger.emit(event)
	}

	/**
	 * Registers a provider definition
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
	 * Resolves a dependency from the container
	 * @param token - The token or class constructor to resolve
	 * @returns An instance of the requested dependency
	 */
	resolve<T>(token: ProviderToken): T {
		return this.resolveWithTracking(token, new Set<ProviderToken>())
	}

	/**
	 * Internal recursive resolver with circular dependency tracking
	 */
	private resolveWithTracking<T>(
		token: ProviderToken,
		resolving: Set<ProviderToken>,
		isForwardRef = false,
		consumer?: Constructor
	): T {
		// Visibility check only applies to class-based providers/consumers
		if (
			this.visibilityChecker &&
			consumer &&
			typeof token === 'function' &&
			!this.visibilityChecker(token as Constructor, consumer)
		) {
			this.emitLog({
				level: 'error',
				category: 'di',
				message: `Encapsulation violation: ${token.name} is not visible to ${consumer.name}. Did you forget to export it from its module?`
			})
			throw new Error(
				`Encapsulation violation: ${token.name} is not visible to ${consumer.name}. Check your @Module() exports.`
			)
		}

		if (this.instances.has(token)) {
			this.emitLog({
				level: 'debug',
				category: 'di',
				message: `Resolved ${typeof token === 'function' ? token.name : String(token)} from DI cache`
			})
			return this.instances.get(token)
		}

		if (resolving.has(token)) {
			if (!isForwardRef) {
				const cycle = [...resolving.keys(), token]
					.map((t) => (typeof t === 'function' ? t.name : String(t)))
					.join(' -> ')
				this.emitLog({
					level: 'error',
					category: 'di',
					message: `Circular dependency detected while resolving ${String(token)}`,
					details: { cycle }
				})
				throw new Error(`Circular dependency detected: ${cycle}`)
			}

			const cycle = [...resolving.keys(), token]
				.map((t) => (typeof t === 'function' ? t.name : String(t)))
				.join(' -> ')
			this.emitLog({
				level: 'debug',
				category: 'di',
				message: `Circular dependency detected while resolving ${String(token)}, returning proxy`,
				details: { cycle }
			})

			// Basic proxy to resolve circular dependency
			return new Proxy({} as any, {
				get: (t, prop) => {
					const instance = this.instances.get(token)
					if (!instance) {
						throw new Error(
							`Circular dependency proxy accessed before ${String(token)} was instantiated. Cycle: ${cycle}`
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
			message: `Resolving ${typeof token === 'function' ? token.name : String(token)}`,
			details: { resolving: [...resolving].map((t) => (typeof t === 'function' ? t.name : String(t))) }
		})

		const provider = this.providers.get(token) || (typeof token === 'function' ? token : undefined)

		if (!provider) {
			throw new Error(`No provider found for token: ${String(token)}`)
		}

		let instance: T

		if (typeof provider === 'function') {
			// Class Provider (direct constructor)
			instance = this.instantiateClass(provider as Constructor<T>, resolving)
		} else if ('useValue' in provider) {
			// Value Provider
			instance = (provider as ValueProvider).useValue
		} else if ('useClass' in provider) {
			// Class Provider (via useClass)
			instance = this.instantiateClass((provider as ClassProvider).useClass, resolving)
		} else if ('useFactory' in provider) {
			// Factory Provider
			const factoryProvider = provider as FactoryProvider
			const inject = factoryProvider.inject || []
			const args = inject.map((argToken) => this.resolveWithTracking(argToken, new Set(resolving)))
			const result = factoryProvider.useFactory(...args)
			// Note: We don't handle async factories here yet as per audit point 4 (Phase 1 is sync)
			// Phase 2 will add async support.
			instance = result as T
		} else {
			throw new Error(`Invalid provider definition for token: ${String(token)}`)
		}

		this.instances.set(token, instance)

		this.emitLog({
			level: 'debug',
			category: 'di',
			message: `Created instance for ${typeof token === 'function' ? token.name : String(token)}`
		})

		return instance
	}

	private instantiateClass<T>(target: Constructor<T>, resolving: Set<ProviderToken>): T {
		const paramTypes = Reflect.getMetadata('design:paramtypes', target) || []
		const injectTokens = MetadataRegistry.getInjectTokens(target)

		if (target.length > 0 && paramTypes.length === 0 && injectTokens.size === 0) {
			if (!this.serviceRegistry.isService(target)) {
				this.emitLog({
					level: 'error',
					category: 'di',
					message: `Cannot resolve ${target.name}: missing @Service() decorator`
				})
				throw new Error(
					`Cannot resolve ${target.name}: it is not decorated with @Service(). Did you forget to add @Service() to the class?`
				)
			}
			this.emitLog({
				level: 'error',
				category: 'di',
				message: `Cannot resolve ${target.name}: missing constructor metadata`
			})
			throw new Error(
				`Cannot resolve dependencies for ${target.name}: constructor metadata is missing. Ensure 'reflect-metadata' is imported and 'emitDecoratorMetadata' is enabled.`
			)
		}

		const dependencies = paramTypes.map((paramType: Constructor, index: number) => {
			const token = injectTokens.get(index)
			const hasForwardRef = !!(token && typeof token === 'object' && 'forwardRef' in token)
			const effectiveToken = token ? resolveForwardRef(token) : paramType

			if (
				!effectiveToken ||
				effectiveToken === Object ||
				effectiveToken === Array ||
				effectiveToken === Function
			) {
				this.emitLog({
					level: 'error',
					category: 'di',
					message: `Cannot resolve dependency at index ${index} of ${target.name}`
				})
				throw new Error(
					`Cannot resolve dependency at index ${index} of ${target.name}. Use concrete class types or @Inject() for constructor dependencies.`
				)
			}
			return this.resolveWithTracking(effectiveToken, new Set(resolving), hasForwardRef, target)
		})

		return new target(...dependencies)
	}

	/**
	 * Registers a pre-created instance for a token
	 * @param token - The token or class constructor to register
	 * @param instance - The instance to register
	 */
	register<T>(token: ProviderToken, instance: T): void {
		this.instances.set(token, instance)
	}

	has(token: ProviderToken): boolean {
		return this.instances.has(token)
	}

	clear(): void {
		this.instances.clear()
		this.providers.clear()
	}

	getInstances(): any[] {
		return Array.from(this.instances.values())
	}

	setVisibilityChecker(checker: (provider: Constructor, consumer: Constructor) => boolean): void {
		this.visibilityChecker = checker
	}
}
