import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Container } from './container'
import { Service, Inject, Module, Controller, Get } from '../decorators'
import { forwardRef } from '../utils/forward-ref.util'
import { Application } from '../application'

@Service()
class ServiceA {
	constructor(@Inject(forwardRef(() => ServiceB)) public serviceB: any) {}
	getName() {
		return 'serviceA'
	}
}

@Service()
class ServiceB {
	constructor(@Inject(forwardRef(() => ServiceA)) public serviceA: any) {}
	getName() {
		return 'serviceB'
	}
}

@Controller('/b')
class ControllerB {
	@Get('/')
	get() {
		return 'b'
	}
}

@Controller('/a')
class ControllerA {
	@Get('/')
	get() {
		return 'a'
	}
}

@Module({
	controllers: [ControllerB],
	imports: [forwardRef(() => ModuleA)]
})
class ModuleB {}

@Module({
	controllers: [ControllerA],
	imports: [forwardRef(() => ModuleB)]
})
class ModuleA {}

describe('Circular Dependency Resolution', () => {
	it('should resolve circular dependencies using forwardRef and @Inject', () => {
		const container = new Container()

		const instanceA = container.resolve(ServiceA)
		const instanceB = container.resolve(ServiceB)

		expect(instanceA).toBeInstanceOf(ServiceA)
		expect(instanceB).toBeInstanceOf(ServiceB)

		// Testing the proxy
		expect(instanceA.serviceB.getName()).toBe('serviceB')
		expect(instanceB.serviceA.getName()).toBe('serviceA')
	})

	it('should resolve circular module dependencies using forwardRef', async () => {
		expect(ModuleA).toBeDefined()
		expect(ModuleB).toBeDefined()
		const { app } = await Application.create(ModuleA)
		const routes = app.getRoutes()

		const paths = routes.map((r) => r.fullPath)
		expect(paths).toContain('/a')
		expect(paths).toContain('/b')
	})
})
