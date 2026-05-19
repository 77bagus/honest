import type { ControllerOptions } from '../interfaces'
import { MetadataRegistry } from '../registries'

/**
 * Decorator that marks a class as a controller.
 * Controllers are responsible for handling incoming requests and returning responses.
 * @param route - The base route for all endpoints in this controller
 * @param options - Configuration options for the controller
 * @returns A class decorator function
 */
export function Controller(route = '', options: ControllerOptions = {}): ClassDecorator {
	return (target: any) => {
		// Store the prefix in the registry
		MetadataRegistry.setControllerPath(target, route)

		// Store the controller options in the registry
		MetadataRegistry.setControllerOptions(target, options)

		// Handle scope if provided in options
		if ((options as any).scope !== undefined) {
			MetadataRegistry.setMetadata(target, Symbol.for('HONEST_SCOPE'), (options as any).scope)
		}
	}
}
