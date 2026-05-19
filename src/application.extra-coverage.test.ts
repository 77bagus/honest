import 'reflect-metadata'
import { describe, expect, it, spyOn, afterEach } from 'bun:test'
import { View, Page, MvcModule } from './decorators/mvc.decorator'
import { UseComponent } from './decorators/use-component.decorator'
import {
	Body,
	Param,
	Query,
	Header,
	Variable,
	Var,
	Req,
	Request,
	Res,
	Response,
	Ctx,
	Context
} from './decorators/parameter.decorator'
import { MetadataRegistry, StaticServiceRegistry, RouteRegistry, MetadataRepository } from './registries'
import { ExecutionContextHost } from './managers/execution-context.host'
import { ConsoleLogger, Logger, NoopLogger } from './loggers'
import { createControllerTestApplication, createTestingModule, createServiceTestContainer } from './testing'
import { Controller, Get } from './decorators'
import {
	resolvePlugin,
	resolvePluginName,
	normalizePluginEntry,
	normalizePluginEntries
} from './application/plugin-entries'
import { createStartupGuideHints, emitStartupGuide } from './application/startup-guide'
import { isPlainObject, addLeadingSlash, normalizePath, stripEndSlash } from './utils/common.util'
import { DocumentBuilder } from './swagger/document-builder'
import { MessageBody, ConnectedSocket } from './websockets/decorators/params.decorator'
import { ConfigService } from './config/config.service'
import * as fixtures from './testing/fixtures/application-test-fixtures'
import { ErrorHandler, NotFoundHandler } from './handlers'
import { SwaggerModule } from './swagger'
import { HandlerInvoker } from './managers/handler.invoker'
import { Container } from './di/container'

afterEach(() => {
	MetadataRegistry.clear()
})

describe('Functional Coverage Boost', () => {
	describe('Instantiate Classes (Implicit Constructors)', () => {
		it('should instantiate all classes with implicit constructors', () => {
			expect(new ErrorHandler()).toBeDefined()
			expect(new NotFoundHandler()).toBeDefined()
			expect(new ConsoleLogger()).toBeDefined()
			expect(new NoopLogger()).toBeDefined()
			expect(new StaticServiceRegistry()).toBeDefined()
			expect(new SwaggerModule()).toBeDefined()
			expect(new HandlerInvoker()).toBeDefined()
			expect(new MetadataRegistry()).toBeDefined()
			expect(new MetadataRepository()).toBeDefined()
			expect(new RouteRegistry()).toBeDefined()
		})
	})

	describe('Parameter Decorators (All Factories)', () => {
		it('should use all parameter decorators to hit their factories', async () => {
			@Controller('/all-params')
			class AllParamsController {
				@Get('/')
				handle(
					@Body() _b: any,
					@Param('id') _p: any,
					@Query('q') _q: any,
					@Header('h') _h: any,
					@Req() _req: any,
					@Request() _request: any,
					@Res() _res: any,
					@Response() _response: any,
					@Ctx() _ctx: any,
					@Context() _context: any,
					@Var('v') _v: any,
					@Variable('v2') _v2: any
				) {
					return 'ok'
				}
			}

			await createControllerTestApplication({ controller: AllParamsController })

			// To hit all factories, we need to actually resolve them
			const params = MetadataRegistry.getParameters(AllParamsController).get('handle')!
			const mockCtx = {
				get: () => 'val',
				req: {
					json: async () => ({}),
					param: () => ({}),
					query: () => ({}),
					header: () => ({})
				},
				res: {},
				next: () => {}
			} as any

			for (const p of params) {
				await p.factory(p.data, mockCtx)
			}
		})
	})

	describe('Testing Module constructor', () => {
		it('should hit the constructor of the dynamic module class', () => {
			const Mod = createTestingModule({ name: 'BoostModule' })
			expect(new Mod()).toBeDefined()
		})
	})

	describe('MVC Decorators', () => {
		it('View should act as Controller', () => {
			@View('/test')
			class TestView {}
			expect(MetadataRegistry.getControllerPath(TestView)).toBe('/test')
		})

		it('Page should be an alias for Get', () => {
			expect(Page).toBeDefined()
			class TestPage {
				@Page('/')
				index() {}
			}
			const routes = MetadataRegistry.getRoutes(TestPage)
			expect(routes[0].method).toBe('get')
		})

		it('MvcModule should concat views and controllers', () => {
			class View1 {}
			class Ctrl1 {}
			const mod = MvcModule({
				views: [View1],
				controllers: [Ctrl1]
			})
			@mod
			class TestMod {}
			const options = MetadataRegistry.getModuleOptions(TestMod)
			expect(options?.controllers).toContain(View1)
			expect(options?.controllers).toContain(Ctrl1)
		})
	})

	describe('UseComponent Decorator', () => {
		it('should register handler level component', () => {
			const guard = { canActivate: () => true }
			class TestCtrl {
				@UseComponent('guard', guard)
				method() {}
			}
			const components = MetadataRegistry.getHandler('guard', TestCtrl, 'method')
			expect(components).toContain(guard)
		})

		it('should register controller level component', () => {
			const guard = { canActivate: () => true }
			@UseComponent('guard', guard)
			class TestCtrl {}
			const components = MetadataRegistry.getController('guard', TestCtrl)
			expect(components).toContain(guard)
		})
	})

	describe('ExecutionContextHost', () => {
		it('getHandler and switchToHttp', () => {
			const handler = () => {}
			const ctx = { req: { raw: {} }, res: {}, next: {} } as any
			const host = new ExecutionContextHost(class {}, handler, ctx, 'myHandler')

			expect(host.getHandler()).toBe(handler)
			expect(host.getHandlerName()).toBe('myHandler')

			const http = host.switchToHttp()
			expect(http.getRequest()).toBe(ctx.req.raw)
			expect(http.getResponse()).toBe(ctx.res)
			expect(http.getNext()).toBe(ctx.next)
			expect(http.getContext()).toBe(ctx)
		})
	})

	describe('ConsoleLogger and LoggerService', () => {
		it('ConsoleLogger: all levels including debug and info', () => {
			const logger = new ConsoleLogger()
			const infoSpy = spyOn(console, 'info').mockImplementation(() => {})
			const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
			const errorSpy = spyOn(console, 'error').mockImplementation(() => {})

			logger.emit({ level: 'debug', category: 'test', message: 'dbg' })
			expect(infoSpy).toHaveBeenCalled()

			logger.emit({ level: 'info', category: 'test', message: 'inf' })
			expect(infoSpy).toHaveBeenCalledTimes(2)

			logger.emit({ level: 'warn', category: 'test', message: 'warning' })
			expect(warnSpy).toHaveBeenCalled()

			logger.emit({ level: 'error', category: 'test', message: 'err', details: { x: 1 } })
			expect(errorSpy).toHaveBeenCalled()

			infoSpy.mockRestore()
			warnSpy.mockRestore()
			errorSpy.mockRestore()
		})

		it('LoggerService: debug, warn, error methods and fallback', () => {
			const infoSpy = spyOn(console, 'info').mockImplementation(() => {})
			const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
			const errorSpy = spyOn(console, 'error').mockImplementation(() => {})

			const logger = new Logger('Test')
			logger.debug('debug msg')
			expect(infoSpy).toHaveBeenCalled()

			logger.warn('warn msg')
			expect(warnSpy).toHaveBeenCalled()

			logger.error('error msg', { detail: 1 })
			expect(errorSpy).toHaveBeenCalled()

			logger.log('log msg')
			expect(infoSpy).toHaveBeenCalledTimes(2)

			infoSpy.mockRestore()
			warnSpy.mockRestore()
			errorSpy.mockRestore()
		})
	})

	describe('Plugin Entries', () => {
		it('resolvePlugin handles instances', () => {
			const instance = { beforeModulesRegistered: async () => {} }
			expect(resolvePlugin(instance)).toBe(instance)
		})

		it('resolvePluginName handles DEFAULT_PLUGIN_NAME and fallbacks', () => {
			const name = resolvePluginName({} as any, 0, 'AnonymousPlugin')
			expect(name).toBe('AnonymousPlugin#1')

			const name2 = resolvePluginName({ meta: { name: 'P' } } as any, 0)
			expect(name2).toBe('P')
		})

		it('normalizePluginEntry and normalizePluginEntries coverage', () => {
			const instance = { beforeModulesRegistered: async () => {} }
			const entry = normalizePluginEntry(instance, 0)
			expect(entry.plugin).toBe(instance)

			expect(normalizePluginEntries(undefined)).toEqual([])
		})
	})

	describe('Startup Guide Hints', () => {
		it('should include all specific hints', () => {
			const h1 = createStartupGuideHints('has no route handlers')
			expect(h1).toContain('Add at least one HTTP method decorator such as @Get() or @Post() in the controller.')

			const h2 = createStartupGuideHints('not decorated with @Service()')
			expect(h2).toContain('Add @Service() to injectable classes used in constructor dependencies.')

			const h3 = createStartupGuideHints('reflect-metadata missing')
			expect(h3).toContain(
				"Import 'reflect-metadata' in your entry file and enable 'emitDecoratorMetadata' in tsconfig."
			)
		})

		it('emitStartupGuide with verbose and disabled', () => {
			const logger = { emit: () => {} } as any
			const spy = spyOn(logger, 'emit')
			emitStartupGuide(logger, { verbose: true }, new Error('err'), class {})
			expect(spy).toHaveBeenCalledTimes(2)

			spy.mockClear()
			emitStartupGuide(logger, false, new Error('err'), class {})
			expect(spy).not.toHaveBeenCalled()
		})
	})

	describe('Common Util', () => {
		it('isPlainObject edge cases', () => {
			expect(isPlainObject(null)).toBe(false)
			expect(isPlainObject(Object.create(null))).toBe(true)
		})

		it('addLeadingSlash edge cases', () => {
			expect(addLeadingSlash(undefined)).toBe('')
			expect(addLeadingSlash('/test')).toBe('/test')
		})

		it('normalizePath edge cases', () => {
			expect(normalizePath(undefined)).toBe('/')
			expect(normalizePath('test')).toBe('/test')
		})

		it('stripEndSlash edge cases', () => {
			expect(stripEndSlash('')).toBe('')
			expect(stripEndSlash(123 as any)).toBe('')
		})
	})

	describe('DocumentBuilder', () => {
		it('setTitle, setDescription, setVersion, addTag and addBearerAuth', () => {
			const builder = new DocumentBuilder()
			builder.setTitle('API').setDescription('DESC').setVersion('2.0')
			builder.addTag('cats', 'cat description')
			builder.addBearerAuth({ type: 'http' }, 'jwt')
			const doc = builder.build()

			expect(doc.info.title).toBe('API')
			expect(doc.info.description).toBe('DESC')
			expect(doc.info.version).toBe('2.0')
			expect(doc.tags).toContainEqual({ name: 'cats', description: 'cat description' })
			expect(doc.components.securitySchemes.jwt).toEqual({ type: 'http' })

			builder.addBearerAuth() // default values
		})
	})

	describe('Websocket Decorators coverage', () => {
		it('MessageBody and ConnectedSocket factory calls', async () => {
			@Controller('/')
			class MyWs {
				@Get('/')
				handle(@MessageBody('p') _p: any, @ConnectedSocket() _s: any) {}
			}

			await createControllerTestApplication({ controller: MyWs })
			const paramsMap = MetadataRegistry.getParameters(MyWs)
			const params = paramsMap.get('handle')!
			expect(params).toBeDefined()

			// factory is (data, ctx) => any where ctx is { socket, payload }
			const wsCtx = { socket: 'mock', payload: { p: 'val' } }

			// Find params by index to avoid order sensitivity
			const p0 = params.find((p) => p.index === 0)!
			const p1 = params.find((p) => p.index === 1)!

			expect(await p0.factory(p0.data, wsCtx as any)).toBe('val')
			expect(await p1.factory(p1.data, wsCtx as any)).toBe('mock')
		})
	})

	describe('ConfigService', () => {
		it('has() method and nested path edge cases', () => {
			const config = new ConfigService({ app: { name: 'test' } })
			expect(config.has('app.name')).toBe(true)
			expect(config.has('app.version')).toBe(false)
			expect(config.get('missing.path')).toBeUndefined()
			expect(config.get('app.name.too.deep')).toBeUndefined()
		})
	})

	describe('Static Registries and Handlers', () => {
		it('StaticServiceRegistry', () => {
			const reg = new StaticServiceRegistry()
			expect(reg.isService(class {})).toBe(false)
		})

		it('MetadataRegistry extra methods', () => {
			MetadataRegistry.setRoutes(class {}, [])
			MetadataRegistry.getAllServices()
		})

		it('MetadataRepository extra methods', () => {
			const repo = MetadataRepository.fromRootModule(class {})
			expect(repo.getControllerPath(class {})).toBe('')
			expect(repo.getControllerOptions(class {})).toEqual({})
			expect(repo.getRoutes(class {})).toHaveLength(0)
			expect(repo.getParameters(class {})).toBeDefined()
			expect(repo.getContextIndices(class {})).toBeDefined()
			expect(repo.getMetadata(class {}, 'key')).toBeUndefined()
			repo.getControllerComponents('guard', class {})
			repo.getHandlerComponents('guard', class {}, 'h')
		})

		it('RouteRegistry coverage', () => {
			const reg = new RouteRegistry()
			expect(reg.getRoutesByController('none')).toHaveLength(0)
			expect(reg.getRoutesByMethod('get')).toHaveLength(0)
			expect(reg.getRoutesByPath('/none')).toHaveLength(0)
		})

		it('Default Handlers', async () => {
			const ctx = {
				json: (data: any, status: number) => ({ data, status }),
				get: (k: string) => (k === 'requestId' ? 'id' : undefined),
				req: { path: '/404' }
			} as any
			const res1 = await NotFoundHandler.handle()(ctx)
			expect(res1.status).toBe(404)

			const res2 = await ErrorHandler.handle()(new Error('fail'), { ...ctx, req: { path: '/500' } } as any)
			expect(res2.status).toBe(500)
		})

		it('SwaggerModule document clone', () => {
			const doc = SwaggerModule.createDocument({ getRoutes: () => [] } as any, { paths: {} })
			expect(doc).toBeDefined()
		})
	})

	describe('Container extra', () => {
		it('setVisibilityChecker, getInstances, clearContext', () => {
			const container = new Container()
			container.setVisibilityChecker(() => true)
			expect(container.getInstances()).toHaveLength(0)

			container.register('token', { x: 1 })
			expect(container.getInstances()).toHaveLength(1)

			container.clearContext('ctx')
		})
	})

	describe('Fixtures Coverage', () => {
		it('should call all exported fixtures and execute their methods', async () => {
			expect(fixtures.createTestController()).toBeDefined()

			const Payload = fixtures.createPayloadController()
			const p = new Payload()
			await p.echo('1', '2')

			const Raw = fixtures.createRawResponseController()
			new Raw().raw()

			fixtures.createOnlyAController()
			fixtures.createOnlyBController()
			fixtures.createUndecoratedController()
			fixtures.createBrokenControllerModule()
			fixtures.createEmptyModule()
			fixtures.createDuplicateRouteControllers()

			const Unsafe = fixtures.createUnsafeParamController()
			new Unsafe().check('val')

			fixtures.createDiagnosticsAController()
			fixtures.createDiagnosticsBController()
			fixtures.createRuntimeMetadataController()
		})
	})

	describe('createServiceTestContainer extra', () => {
		it('should hit register and options edge cases', async () => {
			const c = await createServiceTestContainer({ debugDi: true })
			c.register('t', {})
			expect(c.has('t')).toBe(true)
			c.clear()
		})
	})
})
