import { MetadataRegistry } from '../registries'
import { Scope } from '../interfaces'

/**
 * Options for configuring a service.
 */
export interface ServiceOptions {
	/**
	 * Injection scope of the service.
	 * @default Scope.DEFAULT (Singleton)
	 */
	scope?: Scope
}

/**
 * Decorator that marks a class as a service.
 * Services are classes that can be injected as dependencies.
 * @param options - Service configuration options
 * @returns A class decorator function
 */
export function Service(options: ServiceOptions = {}): ClassDecorator {
	return (target: any) => {
		MetadataRegistry.addService(target)
		if (options.scope !== undefined) {
			MetadataRegistry.setMetadata(target, Symbol.for('HONEST_SCOPE'), options.scope)
		}
	}
}
