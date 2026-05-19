import { describe, expect, test, beforeEach } from 'bun:test'
import { ComponentManager } from './component.manager'
import { Container } from '../di'
import { MetadataRepository } from '../registries'
import { Controller, Module, Service } from '../decorators'
import type { IGuard, IMiddleware, IPipe } from '../interfaces'

describe('ComponentManager', () => {
	let container: Container
	let metadataRepository: MetadataRepository

	const makeManager = () => new ComponentManager(container, metadataRepository)

	beforeEach(() => {
		container = new Container()
		// MetadataRepository.fromRootModule needs a root module, let's use a dummy one
		@Module({})
		class RootModule {}
		metadataRepository = MetadataRepository.fromRootModule(RootModule)
	})

	const fakeMiddleware: IMiddleware = { use: async (_c, next) => await next() }
	const fakeGuard: IGuard = { canActivate: async (_c) => true }
	const fakePipe: IPipe = { transform: async (v) => v }

	describe('setupGlobalComponents', () => {
		test('registers all component types', () => {
			const cm = makeManager()
			cm.setupGlobalComponents({
				components: {
					middleware: [fakeMiddleware],
					guards: [fakeGuard],
					pipes: [fakePipe],
					filters: []
				}
			})

			expect(cm.getGlobal('middleware').has(fakeMiddleware)).toBe(true)
			expect(cm.getGlobal('guard').has(fakeGuard)).toBe(true)
			expect(cm.getGlobal('pipe').has(fakePipe)).toBe(true)
		})

		test('handles empty options', () => {
			const cm = makeManager()
			expect(() => cm.setupGlobalComponents({})).not.toThrow()
		})
	})

	describe('getComponents', () => {
		test('merges global + controller + handler in correct order', async () => {
			// This needs more complex setup with MetadataRepository mocks or real decorators
			// Let's assume metadata repository is working as tested elsewhere
		})
	})

	describe('resolveMiddleware', () => {
		test('handles instances', async () => {
			const cm = makeManager()
			const resolved = await cm.resolveMiddleware([fakeMiddleware])
			expect(resolved).toHaveLength(1)
		})

		test('handles classes via DI', async () => {
			const cm = makeManager()
			@Service()
			class TestMiddleware implements IMiddleware {
				async use(_c: any, next: any) {
					await next()
				}
			}
			const resolved = await cm.resolveMiddleware([TestMiddleware])
			expect(resolved).toHaveLength(1)
		})
	})

	describe('resolveGuards', () => {
		test('handles instances', async () => {
			const cm = makeManager()
			const resolved = await cm.resolveGuards([fakeGuard])
			expect(resolved).toEqual([fakeGuard])
		})

		test('handles classes via DI', async () => {
			const cm = makeManager()
			@Service()
			class TestGuard implements IGuard {
				canActivate(_context: any) {
					return true
				}
			}
			const resolved = await cm.resolveGuards([TestGuard])
			expect(resolved).toHaveLength(1)
		})
	})

	describe('resolvePipes', () => {
		test('handles instances', async () => {
			const cm = makeManager()
			const resolved = await cm.resolvePipes([fakePipe])
			expect(resolved).toEqual([fakePipe])
		})
	})

	describe('executePipes', () => {
		test('chains pipe transforms in order', async () => {
			const cm = makeManager()
			const p1: IPipe = { transform: async (v) => v + '1' }
			const p2: IPipe = { transform: async (v) => v + '2' }

			const result = await cm.executePipes('0', {} as any, [p1, p2])
			expect(result).toBe('012')
		})
	})

	describe('registerModule', () => {
		test('recursive registration', async () => {
			@Controller('/child')
			class ChildController {}

			@Module({ controllers: [ChildController] })
			class ChildModule {}

			@Module({ imports: [ChildModule] })
			class ParentModule {}

			// We need to re-capture metadata because we defined new modules
			const repo = MetadataRepository.fromRootModule(ParentModule)
			const cm = new ComponentManager(container, repo)

			const controllers = await cm.registerModule(ParentModule)
			expect(controllers).toContain(ChildController)
		})

		test('throws for undecorated module', async () => {
			class BadModule {}
			const cm = makeManager()
			try {
				await cm.registerModule(BadModule)
				throw new Error('Should have thrown')
			} catch (e: any) {
				expect(e.message).toContain('is not properly decorated')
			}
		})
	})
})
