import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Application } from './application'
import { Module, Controller, Get, Inject } from './decorators'

describe('Async Providers', () => {
	it('should support async useFactory providers', async () => {
		const ASYNC_VAL = 'ASYNC_VAL'

		@Module({
			services: [
				{
					provide: ASYNC_VAL,
					useFactory: async () => {
						await new Promise((resolve) => setTimeout(resolve, 50))
						return 'async-ok'
					}
				}
			],
			exports: [ASYNC_VAL]
		})
		class AsyncModule {}

		@Controller('/test')
		class TestController {
			constructor(@Inject(ASYNC_VAL) private readonly val: string) {}
			@Get('/')
			get() {
				return this.val
			}
		}

		@Module({
			imports: [AsyncModule],
			controllers: [TestController]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		const val = await app.getContainer().resolve(ASYNC_VAL)
		expect(val).toBe('async-ok')

		const res = await app.getHono().request('/test')
		expect(await res.text()).toBe('async-ok')
	})

	it('should resolve async dependency tree correctly', async () => {
		const BASE = 'BASE'
		const DERIVED = 'DERIVED'

		@Module({
			services: [
				{
					provide: BASE,
					useFactory: async () => {
						await new Promise((resolve) => setTimeout(resolve, 10))
						return 10
					}
				},
				{
					provide: DERIVED,
					useFactory: async (base: number) => {
						await new Promise((resolve) => setTimeout(resolve, 10))
						return base * 2
					},
					inject: [BASE]
				}
			],
			exports: [DERIVED]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule, { strict: { requireRoutes: false } })
		const derived = await app.getContainer().resolve<number>(DERIVED)
		expect(derived).toBe(20)
	})
})
