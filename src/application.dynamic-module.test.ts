import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Application } from './application'
import { Module, Service, Controller, Get } from './decorators'
import { ConfigModule, ConfigService } from './config'

describe('Dynamic Modules & ConfigModule', () => {
	it('should support Dynamic Modules in Application.create', async () => {
		@Service()
		class DynamicService {
			getValue() {
				return 'dynamic'
			}
		}

		@Module()
		class DynamicTestModule {
			static register(val: string) {
				return {
					module: DynamicTestModule,
					services: [{ provide: 'VALUE', useValue: val }, DynamicService],
					exports: ['VALUE', DynamicService]
				}
			}
		}

		@Controller('/test')
		class TestController {
			constructor(private readonly service: DynamicService) {}
			@Get('/')
			get() {
				return this.service.getValue()
			}
		}

		@Module({
			imports: [DynamicTestModule.register('hello')],
			controllers: [TestController]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		const val = await app.getContainer().resolve('VALUE')
		expect(val).toBe('hello')

		const service = await app.getContainer().resolve(DynamicService)
		expect(service.getValue()).toBe('dynamic')
	})

	it('should support ConfigModule with forRoot', async () => {
		@Controller('/config')
		class ConfigController {
			constructor(private readonly configService: ConfigService) {}
			@Get('/')
			get() {
				return this.configService.get('app.name')
			}
		}

		@Module({
			imports: [
				ConfigModule.forRoot({
					load: [() => ({ app: { name: 'honest-app' } })]
				})
			],
			controllers: [ConfigController]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		const res = await app.hono.request('/config')
		expect(await res.text()).toBe('honest-app')
	})

	it('should support global modules', async () => {
		@Service()
		class GlobalService {
			get() {
				return 'global'
			}
		}

		@Module()
		class GlobalModule {
			static forRoot() {
				return {
					module: GlobalModule,
					services: [GlobalService],
					exports: [GlobalService],
					isGlobal: true
				}
			}
		}

		@Module({})
		class FeatureModule {}

		@Controller('/global')
		class GlobalController {
			constructor(private readonly service: GlobalService) {}
			@Get('/')
			get() {
				return this.service.get()
			}
		}

		@Module({
			imports: [
				GlobalModule.forRoot(),
				FeatureModule // FeatureModule doesn't explicitly import GlobalModule
			],
			controllers: [GlobalController]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		const res = await app.hono.request('/global')
		expect(await res.text()).toBe('global')
	})
})
