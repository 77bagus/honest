import { MetadataRegistry } from '../registries'
import type { InterceptorType } from '../interfaces'

/**
 * Decorator that binds interceptors to a controller or handler.
 * @param interceptors - Interceptors to be applied
 */
export function UseInterceptors(...interceptors: InterceptorType[]): MethodDecorator & ClassDecorator {
	return (target: any, propertyKey?: string | symbol) => {
		if (propertyKey) {
			// Handler level
			interceptors.forEach((interceptor) => {
				MetadataRegistry.registerHandler('interceptor', target.constructor, propertyKey, interceptor)
			})
		} else {
			// Controller level
			interceptors.forEach((interceptor) => {
				MetadataRegistry.registerController('interceptor', target, interceptor)
			})
		}
	}
}
