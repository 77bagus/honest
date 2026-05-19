import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Application } from './application'
import { Module, Service, Controller, Get } from './decorators'

describe('Module Encapsulation (Exports)', () => {
	it('should allow injecting a service from an imported module if it is exported', async () => {
		@Service()
		class ExportedService {
			getValue() {
				return 'exported'
			}
		}

		@Module({
			services: [ExportedService],
			exports: [ExportedService]
		})
		class ModuleB {}

		@Controller('/a')
		class ControllerA {
			constructor(private readonly service: ExportedService) {}
			@Get('/')
			get() {
				return this.service.getValue()
			}
		}

		@Module({
			controllers: [ControllerA],
			imports: [ModuleB]
		})
		class ModuleA {}

		const { app } = await Application.create(ModuleA)
		const routes = app.getRoutes()
		expect(routes.length).toBe(1)
	})

	it('should throw an error if a service is injected from an imported module but not exported', async () => {
		@Service()
		class PrivateService {
			getValue() {
				return 'private'
			}
		}

		@Module({
			services: [PrivateService]
			// Not exported
		})
		class ModuleB {}

		@Controller('/a')
		class ControllerA {
			constructor(private readonly service: PrivateService) {}
			@Get('/')
			get() {
				return this.service.getValue()
			}
		}

		@Module({
			controllers: [ControllerA],
			imports: [ModuleB]
		})
		class ModuleA {}

		// Should fail during registration when resolving dependencies
		try {
			await Application.create(ModuleA)
			throw new Error('Should have thrown an encapsulation violation error')
		} catch (error: any) {
			expect(error.message).toContain('Encapsulation violation')
			expect(error.message).toContain('PrivateService is not visible to ControllerA')
		}
	})

	it('should allow re-exporting modules', async () => {
		@Service()
		class GrandChildService {
			getValue() {
				return 'grandchild'
			}
		}

		@Module({
			services: [GrandChildService],
			exports: [GrandChildService]
		})
		class ModuleC {}

		@Module({
			imports: [ModuleC],
			exports: [ModuleC] // Re-export ModuleC
		})
		class ModuleB {}

		@Controller('/a')
		class ControllerA {
			constructor(private readonly service: GrandChildService) {}
			@Get('/')
			get() {
				return this.service.getValue()
			}
		}

		@Module({
			controllers: [ControllerA],
			imports: [ModuleB]
		})
		class ModuleA {}

		const { app } = await Application.create(ModuleA)
		expect(app.getRoutes().length).toBe(1)
	})
})
