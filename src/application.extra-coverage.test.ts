import 'reflect-metadata'
import { describe, expect, it, spyOn, afterEach } from 'bun:test'
import { View, Page, MvcModule } from './decorators/mvc.decorator'
import { UseComponent } from './decorators/use-component.decorator'
import { Body, Param, Query, Header, Variable, Context as CtxDec } from './decorators/parameter.decorator'
import { MetadataRegistry, StaticServiceRegistry, RouteRegistry } from './registries'
import { ExecutionContextHost } from './managers/execution-context.host'
import { ConsoleLogger, Logger, NoopLogger } from './loggers'
import { createParamDecorator } from './helpers/create-param-decorator.helper'
import { createControllerTestApplication } from './testing'
import { Controller, Get, Post } from './decorators'
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

afterEach(() => {
	MetadataRegistry.clear()
})

describe('Extra Coverage Tests', () => {
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

	describe('Parameter Decorators Edge Cases', () => {
		it('Body with data should extract property and handle cache', async () => {
			@Controller('/test')
			class TestController {
				@Post('/')
				post(@Body('name') name: string, @Body() body: any) {
					return { name, body }
				}
			}

			const testApp = await createControllerTestApplication({ controller: TestController })
			const res = await testApp.request('/test', {
				method: 'POST',
				body: JSON.stringify({ name: 'honest', age: 25 }),
				headers: { 'Content-Type': 'application/json' }
			})
			const result = await res.json()
			expect(result.name).toBe('honest')
			expect(result.body).toEqual({ name: 'honest', age: 25 })
		})

		it('Param, Query, Header without data should return all', async () => {
			@Controller('/test/:id')
			class TestController {
				@Get('/')
				get(@Param() params: any, @Query() queries: any, @Header() headers: any) {
					return { params, queries, headerCount: Object.keys(headers).length > 0 }
				}
			}

			const testApp = await createControllerTestApplication({ controller: TestController })
			const res = await testApp.request('/test/123?a=1&b=2', {
				headers: { 'X-Test': 'true' }
			})
			const result = await res.json()
			expect(result.params.id).toBe('123')
			expect(result.queries.a).toBe('1')
			expect(result.headerCount).toBe(true)
		})

		it('Variable with undefined data should return undefined', async () => {
			@Controller('/test')
			class TestController {
				@Get('/')
				get(@Variable() v: any) {
					return { v: v === undefined }
				}
			}

			const testApp = await createControllerTestApplication({ controller: TestController })
			const res = await testApp.request('/test')
			const result = await res.json()
			expect(result.v).toBe(true)
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

		it('NoopLogger', () => {
			const logger = new NoopLogger()
			logger.emit({ level: 'info', category: 'test', message: 'msg' })
		})
	})

	describe('createParamDecorator fallbackFactory', () => {
		it('should return context variable when data is provided to fallback', async () => {
			const Custom = createParamDecorator('custom')
			@Controller('/test')
			class TestController {
				@Get('/')
				get(@Custom('myVar') val: any) {
					return { val }
				}
			}

			const testApp = await createControllerTestApplication({
				controller: TestController,
				appOptions: {
					components: {
						middleware: [
							{
								use: async (c: any, next: any) => {
									c.set('myVar', 'custom-value')
									await next()
								}
							}
						]
					}
				}
			})

			const res = await testApp.request('/test')
			const result = await res.json()
			expect(result.val).toBe('custom-value')
		})

		it('should handle context tracker already initialized', async () => {
			@Controller('/test')
			class TestController {
				@Get('/')
				get(@CtxDec() _c1: any, @CtxDec() _c2: any) {
					return 'ok'
				}
			}
			await createControllerTestApplication({ controller: TestController })
			expect(MetadataRegistry.getContextIndices(TestController).get('get')).toBeDefined()
		})
	})

	describe('Plugin Entries', () => {
		it('resolvePlugin handles instances', () => {
			const instance = { beforeModulesRegistered: async () => {} }
			expect(resolvePlugin(instance)).toBe(instance)
		})

		it('resolvePluginName handles DEFAULT_PLUGIN_NAME', () => {
			const name = resolvePluginName({} as any, 0, 'AnonymousPlugin')
			expect(name).toBe('AnonymousPlugin#1')
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

			const h3 = createStartupGuideHints('generic error')
			expect(h3).toHaveLength(1)
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
			const params = MetadataRegistry.getParameters(MyWs).get('handle')!
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

	describe('Fixtures Coverage', () => {
		it('should call all exported fixtures', () => {
			expect(fixtures.createTestController()).toBeDefined()
			expect(fixtures.createPayloadController()).toBeDefined()
			expect(fixtures.createRawResponseController()).toBeDefined()
			expect(fixtures.createRuntimeMetadataController()).toBeDefined()
			expect(fixtures.createEmptyModule()).toBeDefined()
			expect(fixtures.createBrokenControllerModule()).toBeDefined()
			expect(fixtures.createDuplicateRouteControllers()).toBeDefined()
			expect(fixtures.createUnsafeParamController()).toBeDefined()
			expect(fixtures.createDiagnosticsAController()).toBeDefined()
			expect(fixtures.createDiagnosticsBController()).toBeDefined()
			expect(fixtures.createOnlyAController()).toBeDefined()
			expect(fixtures.createOnlyBController()).toBeDefined()
			expect(fixtures.createUndecoratedController()).toBeDefined()
		})
	})
})
