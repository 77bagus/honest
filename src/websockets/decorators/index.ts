import { MetadataRegistry } from '../../registries'

export const GATEWAY_METADATA = Symbol('GATEWAY_METADATA')
export const SUBSCRIBE_MESSAGE_METADATA = Symbol('SUBSCRIBE_MESSAGE_METADATA')
export const WEBSOCKET_SERVER_METADATA = Symbol('WEBSOCKET_SERVER_METADATA')

/**
 * Decorator that marks a class as a WebSocket Gateway.
 */
export function WebSocketGateway(portOrOptions?: number | any, options?: any): ClassDecorator {
	return (target: any) => {
		const port = typeof portOrOptions === 'number' ? portOrOptions : undefined
		const gatewayOptions = typeof portOrOptions === 'object' ? portOrOptions : options || {}
		MetadataRegistry.setMetadata(target, GATEWAY_METADATA, { port, ...gatewayOptions })
	}
}

/**
 * Decorator that marks a method as a message subscriber.
 */
export function SubscribeMessage(message: string): MethodDecorator {
	return (target: any, propertyKey: string | symbol) => {
		MetadataRegistry.setMetadata(target.constructor, Symbol.for(`WS_SUB_${String(propertyKey)}`), message)
	}
}

/**
 * Decorator that injects the WebSocket server instance.
 */
export function WebSocketServer(): PropertyDecorator {
	return (target: any, propertyKey: string | symbol) => {
		MetadataRegistry.setMetadata(target.constructor, WEBSOCKET_SERVER_METADATA, propertyKey)
	}
}
