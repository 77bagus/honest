import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Application } from './application'
import { Module, Service, Controller, Get } from './decorators'
import { Scope } from './interfaces'

describe('Request Scoping', () => {
	it('should create a new instance of a request-scoped service for each request', async () => {
		let instanceCount = 0

		@Service({ scope: Scope.REQUEST })
		class RequestScopedService {
			id: number
			constructor() {
				this.id = ++instanceCount
			}
		}

		@Controller('/test', { scope: Scope.REQUEST })
		class TestController {
			constructor(private readonly service: RequestScopedService) {}
			@Get('/')
			get() {
				return { id: this.service.id }
			}
		}

		@Module({
			controllers: [TestController],
			services: [RequestScopedService]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)

		const res1 = await app.hono.request('/test')
		const body1 = await res1.json()

		const res2 = await app.hono.request('/test')
		const body2 = await res2.json()

		expect(body1.id).toBe(1)
		expect(body2.id).toBe(2)
		expect(instanceCount).toBe(2)
	})

	it('should share the same request-scoped instance within the same request', async () => {
		let instanceCount = 0

		@Service({ scope: Scope.REQUEST })
		class RequestScopedService {
			id: number
			constructor() {
				this.id = ++instanceCount
			}
		}

		@Service({ scope: Scope.REQUEST })
		class AnotherRequestScopedService {
			constructor(public readonly service: RequestScopedService) {}
		}

		@Controller('/test', { scope: Scope.REQUEST })
		class TestController {
			constructor(
				public readonly s1: RequestScopedService,
				public readonly s2: AnotherRequestScopedService
			) {}
			@Get('/')
			get() {
				return { match: this.s1 === this.s2.service }
			}
		}

		@Module({
			controllers: [TestController],
			services: [RequestScopedService, AnotherRequestScopedService]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)

		const res = await app.hono.request('/test')
		const body = await res.json()

		expect(body.match).toBe(true)
		expect(instanceCount).toBe(1)
	})

	it('should throw error when a singleton depends on a request-scoped service', async () => {
		@Service({ scope: Scope.REQUEST })
		class RequestScopedService {}

		@Service()
		class SingletonService {
			constructor(private readonly service: RequestScopedService) {}
		}

		@Module({
			services: [RequestScopedService, SingletonService]
		})
		class RootModule {}

		try {
			await Application.create(RootModule)
			throw new Error('Should have thrown')
		} catch (error: any) {
			expect(error.message).toContain('Encapsulation violation')
			expect(error.message).toContain('cannot depend on request-scoped')
		}
	})
})
