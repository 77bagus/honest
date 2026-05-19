import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Application } from './application'
import { Module, Service, Controller, Get, UseInterceptors } from './decorators'
import type { HonestInterceptor, ExecutionContext, CallHandler } from './interfaces'

describe('Interceptors', () => {
	it('should wrap handler and transform response', async () => {
		@Service()
		class TransformInterceptor implements HonestInterceptor {
			async intercept(context: ExecutionContext, next: CallHandler) {
				const result = await next.handle()
				return { data: result, intercepted: true }
			}
		}

		@Controller('/test')
		class TestController {
			@Get('/')
			@UseInterceptors(TransformInterceptor)
			get() {
				return 'hello'
			}
		}

		@Module({
			controllers: [TestController],
			services: [TransformInterceptor]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		const res = await app.hono.request('/test')
		const body = await res.json()

		expect(body).toEqual({ data: 'hello', intercepted: true })
	})

	it('should have access to ExecutionContext', async () => {
		let className = ''
		let handlerName = ''

		@Service()
		class ContextInterceptor implements HonestInterceptor {
			async intercept(context: ExecutionContext, next: CallHandler) {
				className = context.getClass().name
				handlerName = String(context.getHandlerName())
				return next.handle()
			}
		}

		@Controller('/test')
		class TestController {
			@Get('/')
			@UseInterceptors(ContextInterceptor)
			myHandler() {
				return 'ok'
			}
		}

		@Module({
			controllers: [TestController],
			services: [ContextInterceptor]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		await app.hono.request('/test')

		expect(className).toBe('TestController')
		expect(handlerName).toBe('myHandler')
	})

	it('should chain multiple interceptors in correct order', async () => {
		const order: string[] = []

		class InterceptorA implements HonestInterceptor {
			async intercept(context: ExecutionContext, next: CallHandler) {
				order.push('A:before')
				const res = await next.handle()
				order.push('A:after')
				return res
			}
		}

		class InterceptorB implements HonestInterceptor {
			async intercept(context: ExecutionContext, next: CallHandler) {
				order.push('B:before')
				const res = await next.handle()
				order.push('B:after')
				return res
			}
		}

		@Controller('/test')
		@UseInterceptors(new InterceptorA())
		class TestController {
			@Get('/')
			@UseInterceptors(new InterceptorB())
			get() {
				order.push('handler')
				return 'ok'
			}
		}

		@Module({
			controllers: [TestController]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		await app.hono.request('/test')

		expect(order).toEqual(['A:before', 'B:before', 'handler', 'B:after', 'A:after'])
	})

	it('should support global interceptors', async () => {
		class GlobalInterceptor implements HonestInterceptor {
			async intercept(context: ExecutionContext, next: CallHandler) {
				const res = await next.handle()
				return { ...res, global: true }
			}
		}

		@Controller('/test')
		class TestController {
			@Get('/')
			get() {
				return { data: 'ok' }
			}
		}

		@Module({ controllers: [TestController] })
		class RootModule {}

		const { app } = await Application.create(RootModule, {
			components: {
				interceptors: [new GlobalInterceptor()]
			}
		})

		const res = await app.hono.request('/test')
		const body = await res.json()
		expect(body).toEqual({ data: 'ok', global: true })
	})
})
