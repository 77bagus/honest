import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Application } from './application'
import { Module, Service, Controller, Get, Inject } from './decorators'

describe('Enhanced Providers', () => {
	it('should support useValue providers', async () => {
		const API_KEY = 'API_KEY'

		@Controller('/')
		class TestController {
			constructor(@Inject(API_KEY) private readonly apiKey: string) {}
			@Get('/')
			get() {
				return this.apiKey
			}
		}

		@Module({
			controllers: [TestController],
			services: [{ provide: API_KEY, useValue: 'secret-123' }]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		const apiKey = await app.getContainer().resolve(API_KEY)
		expect(apiKey).toBe('secret-123')
	})

	it('should support useClass providers', async () => {
		abstract class Logger {
			abstract log(): string
		}

		@Service()
		class ConsoleLogger extends Logger {
			log() {
				return 'console'
			}
		}

		@Controller('/')
		class TestController {
			constructor(private readonly logger: Logger) {}
			@Get('/')
			get() {
				return this.logger.log()
			}
		}

		@Module({
			controllers: [TestController],
			services: [{ provide: Logger, useClass: ConsoleLogger }]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		const logger = await app.getContainer().resolve(Logger)
		expect(logger).toBeInstanceOf(ConsoleLogger)
		expect(logger.log()).toBe('console')
	})

	it('should support useFactory providers', async () => {
		const CONFIG = 'CONFIG'

		@Service()
		class Dependency {
			getValue() {
				return 'dep'
			}
		}

		@Controller('/')
		class TestController {
			@Get('/')
			get() {
				return 'ok'
			}
		}

		@Module({
			controllers: [TestController],
			services: [
				Dependency,
				{
					provide: CONFIG,
					useFactory: (dep: Dependency) => ({ val: dep.getValue() }),
					inject: [Dependency]
				}
			]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)
		const config = await app.getContainer().resolve<any>(CONFIG)
		expect(config.val).toBe('dep')
	})
})
