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
	async resolve<T>(token: ProviderToken): Promise<T> {
		return this.resolveWithTracking(token, new Set<ProviderToken>())
	}

	/**
	 * Internal recursive resolver with circular dependency tracking
	 */
	private async resolveWithTracking<T>(
		token: ProviderToken,
		resolving: Set<ProviderToken>,
		isForwardRef = false,
		consumer?: Constructor
	): Promise<T> {
		const tokenName = typeof token === 'function' ? token.name : String(token)

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
				message: `Encapsulation violation: ${tokenName} is not visible to ${consumer.name}. Did you forget to export it from its module?`
			})
			throw new Error(
				`Encapsulation violation: ${tokenName} is not visible to ${consumer.name}. Check your @Module() exports.`
			)
		}

		if (this.instances.has(token)) {
			this.emitLog({
				level: 'debug',
				category: 'di',
				message: `Resolved ${tokenName} from DI cache`
			})
			return this.instances.get(token)
		}

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

			// Basic proxy to resolve circular dependency
			return new Proxy({} as any, {
				get: (t, prop) => {
					// Don't trigger resolution error for internal JS symbols or common properties
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
					// Important: prevent Proxy from being treated as a Thenable (Promise)
					if (prop === 'then') {
						return undefined
					}
					const instance = this.instances.get(token)
					if (!instance) {
						// Fallback for some library inspection tools (like node's util.inspect or bun's internal checks)
						if (typeof prop === 'string' && (prop.startsWith('__') || prop === 'as-instance')) {
							return undefined
						}
						throw new Error(
							`Circular dependency detected: proxy accessed before ${tokenName} was instantiated. Cycle: ${cycle}`
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
			// Class Provider (direct constructor)
			instance = await this.instantiateClass(provider as Constructor<T>, resolving)
		} else if ('useValue' in provider) {
			// Value Provider
			instance = (provider as ValueProvider).useValue
		} else if ('useClass' in provider) {
			// Class Provider (via useClass)
			instance = await this.instantiateClass((provider as ClassProvider).useClass, resolving)
		} else if ('useFactory' in provider) {
			// Factory Provider
			const factoryProvider = provider as FactoryProvider
			const inject = factoryProvider.inject || []
			const args = []
			for (const argToken of inject) {
				args.push(await this.resolveWithTracking(argToken, new Set(resolving)))
			}
			instance = await factoryProvider.useFactory(...args)
		} else {
			throw new Error(`Invalid provider definition for token: ${tokenName}`)
		}

		this.instances.set(token, instance)

		this.emitLog({
			level: 'debug',
			category: 'di',
			message: `Created instance for ${tokenName}`
		})

		return instance
	}

	private async instantiateClass<T>(target: Constructor<T>, resolving: Set<ProviderToken>): Promise<T> {
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
				dependency = await this.resolveWithTracking(effectiveToken, new Set(resolving), hasForwardRef, target)
			} catch (error: any) {
				// Re-throw if it's already an Honest error message we expect in tests
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
