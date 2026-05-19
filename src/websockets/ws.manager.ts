import { GATEWAY_METADATA, WEBSOCKET_SERVER_METADATA } from './decorators'
import type { IMetadataRepository, DiContainer, ILogger, ParameterMetadata } from '../interfaces'
import { NoopLogger } from '../loggers'
import type { Constructor } from '../types'
import { ParameterResolver } from '../managers/parameter.resolver'

/**
 * Interface for WebSocket adapters.
 */
export interface WsAdapter {
	create(port: number, options?: any): any
	bindClientConnect(server: any, callback: (client: any) => void): void
	bindClientDisconnect(client: any, callback: () => void): void
	bindMessageHandlers(
		client: any,
		handlers: any[],
		process: (handler: (...args: any[]) => any, payload: any) => void
	): void
	close(server: any): void
}

/**
 * Manager for WebSocket gateways.
 */
export class WsManager {
	private readonly gateways = new Map<Constructor, any>()
	private readonly pendingGateways = new Set<Constructor>()
	private adapter?: WsAdapter

	constructor(
		private readonly container: DiContainer,
		private readonly metadataRepository: IMetadataRepository,
		private readonly _parameterResolver: ParameterResolver,
		private readonly logger: ILogger = new NoopLogger()
	) {}

	async useAdapter(adapter: WsAdapter): Promise<void> {
		this.adapter = adapter
		if (this.pendingGateways.size > 0) {
			const gateways = Array.from(this.pendingGateways)
			this.pendingGateways.clear()
			await this.registerGateways(gateways)
		}
	}

	async registerGateways(controllers: Constructor[]): Promise<void> {
		if (!this.adapter) {
			controllers.forEach((c) => this.pendingGateways.add(c))
			return
		}

		for (const gatewayClass of controllers) {
			const metadata = this.metadataRepository.getMetadata(gatewayClass, GATEWAY_METADATA)
			if (!metadata) {
				continue
			}

			const server = this.adapter.create(metadata.port || 0, metadata)
			const instance = await this.container.resolve(gatewayClass)

			// Inject server instance if @WebSocketServer is used
			const serverProperty = this.metadataRepository.getMetadata<string | symbol>(
				gatewayClass,
				WEBSOCKET_SERVER_METADATA
			)
			if (serverProperty) {
				instance[serverProperty] = server
			}

			this.adapter.bindClientConnect(server, (client: any) => {
				this.handleConnection(instance, client)

				// Bind message handlers
				const handlers = this.discoverHandlers(gatewayClass, instance)
				this.adapter!.bindMessageHandlers(client, handlers, async (handler: any, payload: any) => {
					return this.processMessage(
						gatewayClass,
						handler.methodName,
						instance,
						handler.callback,
						client,
						payload
					)
				})

				this.adapter!.bindClientDisconnect(client, () => {
					this.handleDisconnect(instance, client)
				})
			})

			this.gateways.set(gatewayClass, server)
		}
	}

	private discoverHandlers(gatewayClass: Constructor, instance: any): any[] {
		const handlers: any[] = []
		const prototype = Object.getPrototypeOf(instance)

		for (const methodName of Object.getOwnPropertyNames(prototype)) {
			const message = this.metadataRepository.getMetadata<string>(
				gatewayClass,
				Symbol.for(`WS_SUB_${methodName}`)
			)
			if (message) {
				handlers.push({
					message,
					methodName,
					callback: instance[methodName].bind(instance)
				})
			}
		}
		return handlers
	}

	private async processMessage(
		gatewayClass: Constructor,
		methodName: string | symbol,
		_instance: any,
		handler: (...args: any[]) => any,
		client: any,
		payload: any
	): Promise<void> {
		const params = [...(this.metadataRepository.getParameters(gatewayClass).get(methodName) || [])]
		params.sort((a, b) => a.index - b.index)

		const wsContext = { socket: client, payload }

		const args = await Promise.all(
			params.map(async (param: ParameterMetadata) => {
				return await param.factory(param.data, wsContext as any)
			})
		)

		if (args.length === 0) {
			await handler(payload)
		} else {
			await handler(...args)
		}
	}

	private handleConnection(instance: any, client: any): void {
		if (typeof instance.handleConnection === 'function') {
			instance.handleConnection(client)
		}
	}

	private handleDisconnect(instance: any, client: any): void {
		if (typeof instance.handleDisconnect === 'function') {
			instance.handleDisconnect(client)
		}
	}
}
