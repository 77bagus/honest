import 'reflect-metadata'
import { describe, expect, it, spyOn, afterEach } from 'bun:test'
import { View, Page, MvcModule } from './decorators/mvc.decorator'
import { UseComponent } from './decorators/use-component.decorator'
import { Body, Param, Query, Header, Variable } from './decorators/parameter.decorator'
import { MetadataRegistry } from './registries'
import { ExecutionContextHost } from './managers/execution-context.host'
import { ConsoleLogger } from './loggers'
import { createParamDecorator } from './helpers/create-param-decorator.helper'
import { createControllerTestApplication } from './testing'
import { Controller, Get, Post } from './decorators'
import { resolvePlugin, resolvePluginName, normalizePluginEntry } from './application/plugin-entries'
import { createStartupGuideHints } from './application/startup-guide'
import { isPlainObject, addLeadingSlash, normalizePath, stripEndSlash } from './utils/common.util'

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

	describe('ConsoleLogger', () => {
		it('all levels including debug and info', () => {
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
			const { Context: CtxDec } = await import('./decorators/parameter.decorator')
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

		it('normalizePluginEntry handles direct plugin type', () => {
			const instance = { beforeModulesRegistered: async () => {} }
			const entry = normalizePluginEntry(instance, 0)
			expect(entry.plugin).toBe(instance)
		})
	})

	describe('Startup Guide Hints', () => {
		it('should include all specific hints', () => {
			const h1 = createStartupGuideHints('has no route handlers')
			expect(h1).toContain('Add at least one HTTP method decorator such as @Get() or @Post() in the controller.')

			const h2 = createStartupGuideHints('not decorated with @Service()')
			expect(h2).toContain('Add @Service() to injectable classes used in constructor dependencies.')
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
})
