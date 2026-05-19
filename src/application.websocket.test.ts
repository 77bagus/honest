import 'reflect-metadata'
import { describe, expect, it, mock } from 'bun:test'
import { Application } from './application'
import { Module } from './decorators'
import { WebSocketGateway, SubscribeMessage, WebSocketServer, MessageBody, ConnectedSocket } from './websockets'
import type { WsAdapter } from './websockets'

describe('WebSocket Integration', () => {
	it('should discover gateways and bind message handlers', async () => {
		let connectedClient: any = null
		let receivedMessage: any = null
		let receivedSocket: any = null
		let serverInstance: any = null
		let disconnectCalled = false

		@WebSocketGateway({ namespace: 'chat' })
		class ChatGateway {
			@WebSocketServer()
			server: any

			handleConnection(client: any) {
				connectedClient = client
			}

			handleDisconnect(_client: any) {
				disconnectCalled = true
			}

			@SubscribeMessage('ping')
			onPing(@MessageBody('data') data: string, @ConnectedSocket() socket: any) {
				receivedMessage = data
				receivedSocket = socket
				return 'pong'
			}
		}

		@Module({
			services: [ChatGateway]
		})
		class RootModule {}

		let disconnectCb: any = null

		const mockAdapter: WsAdapter = {
			create: mock((port, options) => ({ port, options })),
			bindClientConnect: mock((server, cb) => {
				serverInstance = server
				cb({ id: 'client1' })
			}),
			bindClientDisconnect: mock((client, cb) => {
				disconnectCb = cb
			}),
			bindMessageHandlers: mock((client, handlers, process) => {
				const pingHandler = handlers.find((h) => h.message === 'ping')
				if (pingHandler) {
					// Pass the whole handler object so WsManager can find methodName
					process(pingHandler, { data: 'hello' })
				}
			}),
			close: mock(() => {})
		}

		const { app } = await Application.create(RootModule, { strict: { requireRoutes: false } })
		await app.useWebSocketAdapter(mockAdapter)

		expect(mockAdapter.create).toHaveBeenCalled()
		expect(mockAdapter.bindClientConnect).toHaveBeenCalled()
		expect(connectedClient).toEqual({ id: 'client1' })
		// Expect 'hello' (extracted from {data: 'hello'} by @MessageBody('data'))
		expect(receivedMessage).toBe('hello')
		expect(receivedSocket).toEqual({ id: 'client1' })
		expect(serverInstance).toBeDefined()

		// Trigger disconnect
		if (disconnectCb) {
			disconnectCb()
			expect(disconnectCalled).toBe(true)
		}
	})
})
