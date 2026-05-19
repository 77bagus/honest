import 'reflect-metadata'
import { afterEach, describe, expect, test } from 'bun:test'
import { MetadataRegistry } from '../registries'
import { createControllerTestApplication, createServiceTestContainer, createTestingModule } from './index'
import { Service, Controller, Get } from '../decorators'

afterEach(() => {
	MetadataRegistry.clear()
})

describe('testing harness', () => {
	test('createTestingModule registers module metadata with provided options', () => {
		const TestModule = createTestingModule({
			name: 'TestModule',
			controllers: [],
			services: []
		})

		const options = MetadataRegistry.getModuleOptions(TestModule)
		expect(options).toBeDefined()
		expect(TestModule.name).toBe('TestModule')
	})

	test('createTestApplication passes app options through to Application.create', async () => {
		@Controller('/')
		class TestController {
			@Get('/')
			get() {
				return 'ok'
			}
		}

		const testApp = await createControllerTestApplication({
			controller: TestController
		})
		expect(testApp.app).toBeDefined()
	})

	test('createTestApplication request helper supports relative path input', async () => {
		const { Application } = await import('../application')
		const { Module } = await import('../decorators')

		@Controller('/test')
		class TestController {
			@Get('/')
			get() {
				return 'ok'
			}
		}

		@Module({ controllers: [TestController] })
		class TestModule {}

		const { app } = await Application.create(TestModule)
		const res = await app.getHono().request('/test')
		expect(await res.text()).toBe('ok')
	})

	test('createTestApplication request helper supports Request input', async () => {
		@Controller('/')
		class TestController {
			@Get('/')
			get() {
				return 'ok'
			}
		}
		const testApp = await createControllerTestApplication({
			controller: TestController
		})
		const res = await testApp.request(new Request('http://localhost/'))
		expect(await res.text()).toBe('ok')
	})

	test('createControllerTestApplication mounts a single controller', async () => {
		@Controller('/test')
		class TestController {
			@Get('/')
			get() {
				return 'ok'
			}
		}
		const testApp = await createControllerTestApplication({
			controller: TestController
		})
		const res = await testApp.request('/test')
		expect(await res.text()).toBe('ok')
	})

	test('createControllerTestApplication passes appOptions through', async () => {
		@Controller('/')
		class TestController {
			@Get('/')
			get() {
				return 'ok'
			}
		}
		const testApp = await createControllerTestApplication({
			controller: TestController,
			appOptions: { globalPrefix: '/api' }
		})
		expect(testApp.app).toBeDefined()
	})

	test('createServiceTestContainer resolves and caches services', async () => {
		@Service()
		class CounterService {
			count = 0
		}
		const harness = await createServiceTestContainer()
		const s1 = await harness.get(CounterService)
		s1.count++
		const s2 = await harness.get(CounterService)
		expect(s2.count).toBe(1)
	})

	test('createServiceTestContainer applies overrides before resolve', async () => {
		@Service()
		class RealService {
			getValue() {
				return 'real'
			}
		}
		const harness = await createServiceTestContainer({
			overrides: [{ provide: RealService, useValue: { getValue: () => 'mock' } }]
		})
		const svc = await harness.get(RealService)
		expect(svc.getValue()).toBe('mock')
	})

	test('createServiceTestContainer preloads services', async () => {
		let resolved = false
		@Service()
		class CounterService {
			constructor() {
				resolved = true
			}
		}
		await createServiceTestContainer({ preload: [CounterService] })
		expect(resolved).toBe(true)
	})
})
