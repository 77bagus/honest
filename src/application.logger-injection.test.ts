import 'reflect-metadata'
import { describe, expect, it, spyOn } from 'bun:test'
import { Application } from './application'
import { Module, Service, Controller, Get } from './decorators'
import { Logger } from './loggers'

describe('Logger Injection', () => {
	it('should allow injecting framework logger into services', async () => {
		@Service()
		class LoggedService {
			constructor(private readonly logger: Logger) {}
			doSomething() {
				this.logger.log('hello from service')
			}
		}

		@Controller('/log')
		class LogController {
			constructor(private readonly service: LoggedService) {}
			@Get('/')
			get() {
				this.service.doSomething()
				return 'ok'
			}
		}

		@Module({
			controllers: [LogController],
			services: [LoggedService]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)

		const infoSpy = spyOn(console, 'info').mockImplementation(() => {})
		await app.hono.request('/log')

		expect(infoSpy).toHaveBeenCalled()
		// First arg is prefix [HonestJS:App], second is message
		expect(
			infoSpy.mock.calls.some((call) => call[0].includes('[HonestJS:App]') && call[1] === 'hello from service')
		).toBe(true)

		infoSpy.mockRestore()
	})
})
