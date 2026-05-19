import 'reflect-metadata'
import { describe, expect, it, mock } from 'bun:test'
import { Application } from './application'
import { Module } from './decorators'
import { WebSocketGateway, SubscribeMessage, WebSocketServer, MessageBody } from './websockets'
import type { WsAdapter } from './websockets'

describe('WebSocket Integration', () => {
	it('should discover gateways and bind message handlers', async () => {
		let connectedClient: any = null
		let receivedMessage: string = ''
		let serverInstance: any = null

		@WebSocketGateway({ namespace: 'chat' })
		class ChatGateway {
			@WebSocketServer()
			server: any

			handleConnection(client: any) {
				connectedClient = client
			}

			@SubscribeMessage('ping')
			onPing(@MessageBody() data: string) {
				receivedMessage = data
				return 'pong'
			}
		}

		@Module({
			services: [ChatGateway]
		})
		class RootModule {}

		const mockAdapter: WsAdapter = {
			create: mock((port, options) => ({ port, options })),
			bindClientConnect: mock((server, cb) => {
				serverInstance = server
				cb({ id: 'client1' })
			}),
			bindClientDisconnect: mock(() => {}),
			bindMessageHandlers: mock((client, handlers, process) => {
				const pingHandler = handlers.find((h) => h.message === 'ping')
				if (pingHandler) {
					process(pingHandler.callback, 'hello')
				}
			}),
			close: mock(() => {})
		}

		const { app } = await Application.create(RootModule, { strict: { requireRoutes: false } })
		await app.useWebSocketAdapter(mockAdapter)

		expect(mockAdapter.create).toHaveBeenCalled()
		expect(mockAdapter.bindClientConnect).toHaveBeenCalled()
		expect(connectedClient).toEqual({ id: 'client1' })
		expect(receivedMessage).toBe('hello')
		expect(serverInstance).toBeDefined()
	})
})
