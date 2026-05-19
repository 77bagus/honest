import { MetadataRegistry } from '../../registries'

export const SWAGGER_TAGS_KEY = Symbol('SWAGGER_TAGS')
export const SWAGGER_OPERATION_KEY = Symbol('SWAGGER_OPERATION')
export const SWAGGER_RESPONSE_KEY = Symbol('SWAGGER_RESPONSE')

/**
 * Decorator that adds tags to a controller or handler.
 */
export function ApiTags(...tags: string[]): ClassDecorator & MethodDecorator {
	return (target: any, propertyKey?: string | symbol) => {
		const decoratorTarget = propertyKey ? target.constructor : target
		const metadataKey = SWAGGER_TAGS_KEY
		const existingTags = MetadataRegistry.getMetadata(decoratorTarget, metadataKey) || []
		MetadataRegistry.setMetadata(decoratorTarget, metadataKey, [...existingTags, ...tags])
	}
}

/**
 * Decorator that describes an operation.
 */
export function ApiOperation(options: { summary?: string; description?: string }): MethodDecorator {
	return (target: any, propertyKey: string | symbol) => {
		MetadataRegistry.setMetadata(target.constructor, Symbol.for(`SWAGGER_OP_${String(propertyKey)}`), options)
	}
}

/**
 * Decorator that describes a response.
 */
export function ApiResponse(options: { status: number; description: string; type?: any }): MethodDecorator {
	return (target: any, propertyKey: string | symbol) => {
		const metadataKey = Symbol.for(`SWAGGER_RES_${String(propertyKey)}`)
		const existingResponses = MetadataRegistry.getMetadata(target.constructor, metadataKey) || []
		MetadataRegistry.setMetadata(target.constructor, metadataKey, [...existingResponses, options])
	}
}
