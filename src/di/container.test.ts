import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Container } from './container'
import { Service } from '../decorators'
import type { ILogger, LogEvent } from '../interfaces'

describe('Container', () => {
	it('should resolve() returns same instance for class with no deps (singleton)', async () => {
		class NoDeps {}
		const container = new Container()
		const a = await container.resolve(NoDeps)
		const b = await container.resolve(NoDeps)

		expect(a).toBeInstanceOf(NoDeps)
		expect(a).toBe(b)
	})

	it('should resolve() injects dependency when constructor has one param', async () => {
		class Dep {}
		class WithDep {
			constructor(public readonly dep: Dep) {}
		}
		Reflect.defineMetadata('design:paramtypes', [Dep], WithDep)

		const container = new Container()
		const instance = await container.resolve(WithDep)

		expect(instance).toBeInstanceOf(WithDep)
		expect(instance.dep).toBeInstanceOf(Dep)
		expect(instance.dep).toBe(await container.resolve(Dep))
	})

	it('should resolve() throws when circular dependency is detected', async () => {
		@Service()
		class CircularA {
			constructor(public readonly b: any) {}
		}
		@Service()
		class CircularB {
			constructor(public readonly a: any) {}
		}
		Reflect.defineMetadata('design:paramtypes', [CircularB], CircularA)
		Reflect.defineMetadata('design:paramtypes', [CircularA], CircularB)

		const container = new Container()
		try {
			await container.resolve(CircularA)
			throw new Error('Should have thrown')
		} catch (e: any) {
			expect(e.message).toContain('Circular dependency detected')
		}
	})

	it('should register() allows pre-created instance; resolve() returns it', async () => {
		class Service {}
		const container = new Container()
		const instance = new Service()

		container.register(Service, instance)
		expect(await container.resolve(Service)).toBe(instance)
	})

	it('should resolve() tells you to add @Service() when decorator is missing', async () => {
		class NeedsDep {
			constructor(public readonly dep: string) {}
		}

		const container = new Container()
		try {
			await container.resolve(NeedsDep)
			throw new Error('Should have thrown')
		} catch (e: any) {
			expect(e.message).toContain('not decorated with @Service()')
		}
	})

	it('should resolve() shows metadata error for decorated class with missing reflect-metadata', async () => {
		@Service()
		class DecoratedButNoMeta {
			constructor(public readonly dep: string) {}
		}
		Reflect.deleteMetadata('design:paramtypes', DecoratedButNoMeta)

		const container = new Container()
		try {
			await container.resolve(DecoratedButNoMeta)
			throw new Error('Should have thrown')
		} catch (e: any) {
			expect(e.message).toContain('constructor metadata is missing')
		}
	})

	it('should resolve() throws clear error for non-class dependency metadata', async () => {
		@Service()
		class BadDepController {
			constructor(public readonly dep: string) {}
		}
		Reflect.defineMetadata('design:paramtypes', [String], BadDepController)

		const container = new Container()
		try {
			await container.resolve(BadDepController)
			throw new Error('Should have thrown')
		} catch (e: any) {
			expect(e.message).toContain('Cannot resolve dependency at index 0')
		}
	})

	it('should resolve() uses injected service registry contract', async () => {
		const registry = { isService: () => false }
		@Service()
		class NeedsDep {
			constructor(public readonly dep: string) {}
		}
		Reflect.defineMetadata('design:paramtypes', [String], NeedsDep)

		const container = new Container(registry as any)
		try {
			await container.resolve(NeedsDep)
			throw new Error('Should have thrown')
		} catch (e: any) {
			expect(e.message).toContain('not decorated with @Service()')
		}
	})

	it('should resolve() emits DI diagnostics when debug mode is enabled', async () => {
		class Dependency {}
		class Consumer {
			constructor(public readonly dependency: Dependency) {}
		}
		Reflect.defineMetadata('design:paramtypes', [Dependency], Consumer)

		const events: LogEvent[] = []
		const logger: ILogger = {
			emit(event) {
				events.push(event)
			}
		}

		const container = new Container(undefined, logger, true)
		await container.resolve(Consumer)
		await container.resolve(Consumer)

		expect(events.some((event) => event.category === 'di' && event.message.includes('Resolving Consumer'))).toBe(
			true
		)
		expect(
			events.some((event) => event.category === 'di' && event.message.includes('Resolved Consumer from DI cache'))
		).toBe(true)
	})
})
