import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Application } from './application'
import { Module, Service, Controller, Get } from './decorators'
import type { OnModuleInit, OnApplicationBootstrap } from './interfaces'

describe('Application Lifecycle Hooks', () => {
	it('should trigger OnModuleInit and OnApplicationBootstrap in correct order', async () => {
		const callOrder: string[] = []

		@Service()
		class LifecycleService implements OnModuleInit, OnApplicationBootstrap {
			async onModuleInit() {
				callOrder.push('service:onModuleInit')
			}

			async onApplicationBootstrap() {
				callOrder.push('service:onApplicationBootstrap')
			}
		}

		@Controller('/test')
		class LifecycleController implements OnModuleInit, OnApplicationBootstrap {
			constructor(private readonly service: LifecycleService) {}

			async onModuleInit() {
				callOrder.push('controller:onModuleInit')
			}

			async onApplicationBootstrap() {
				callOrder.push('controller:onApplicationBootstrap')
			}

			@Get('/')
			test() {
				return 'ok'
			}
		}

		@Module({
			controllers: [LifecycleController],
			services: [LifecycleService]
		})
		class RootModule {}

		await Application.create(RootModule)

		// OnModuleInit should come before OnApplicationBootstrap
		// Services are resolved before Controllers in our registerModule implementation (or at least in this order here)

		expect(callOrder).toContain('service:onModuleInit')
		expect(callOrder).toContain('controller:onModuleInit')
		expect(callOrder).toContain('service:onApplicationBootstrap')
		expect(callOrder).toContain('controller:onApplicationBootstrap')

		const moduleInitIndices = [
			callOrder.indexOf('service:onModuleInit'),
			callOrder.indexOf('controller:onModuleInit')
		]
		const bootstrapIndices = [
			callOrder.indexOf('service:onApplicationBootstrap'),
			callOrder.indexOf('controller:onApplicationBootstrap')
		]

		// All OnModuleInit should happen before any OnApplicationBootstrap
		for (const mIdx of moduleInitIndices) {
			for (const bIdx of bootstrapIndices) {
				expect(mIdx).toBeLessThan(bIdx)
			}
		}
	})

	it('should handle async hooks and wait for them', async () => {
		let completed = false

		@Service()
		class AsyncService implements OnModuleInit {
			async onModuleInit() {
				await new Promise((resolve) => setTimeout(resolve, 50))
				completed = true
			}
		}

		@Controller('/')
		class AsyncController {
			@Get('/')
			index() {
				return 'ok'
			}
		}

		@Module({
			controllers: [AsyncController],
			services: [AsyncService]
		})
		class AsyncModule {}

		await Application.create(AsyncModule)
		expect(completed).toBe(true)
	})
})
