import 'reflect-metadata'
import { describe, expect, test, afterEach } from 'bun:test'
import { Application } from '../application'
import { Controller, Get, Module } from '../decorators'
import { MetadataRegistry } from '../registries'
import { VERSION_NEUTRAL } from '../constants'

afterEach(() => {
	MetadataRegistry.clear()
})

describe('RouteManager', () => {
	describe('global prefix', () => {
		test('applied correctly', async () => {
			@Controller('/users')
			class UsersCtrl {
				@Get('/')
				list() {
					return ['user1']
				}
			}

			@Module({ controllers: [UsersCtrl] })
			class RootModule {}

			const { app } = await Application.create(RootModule, { routing: { prefix: '/api' } })

			const res = await app.getHono().request('/api/users')
			expect(res.status).toBe(200)
		})
	})

	describe('versioning', () => {
		test('numeric version creates /v{N} prefix', async () => {
			@Controller('/items')
			class ItemsCtrl {
				@Get('/')
				list() {
					return []
				}
			}

			@Module({ controllers: [ItemsCtrl] })
			class RootModule {}

			const { app } = await Application.create(RootModule, { routing: { version: 1 } })

			const res = await app.getHono().request('/v1/items')
			expect(res.status).toBe(200)
		})

		test('VERSION_NEUTRAL skips version prefix', async () => {
			@Controller('/items')
			class ItemsCtrl {
				@Get('/', { version: VERSION_NEUTRAL })
				list() {
					return []
				}
			}

			@Module({ controllers: [ItemsCtrl] })
			class RootModule {}

			const { app } = await Application.create(RootModule, { routing: { version: 1 } })

			const res = await app.getHono().request('/items')
			expect(res.status).toBe(200)
		})
	})

	describe('error cases', () => {
		test('undecorated controller throws', async () => {
			class UndecoratedCtrl {}
			@Module({ controllers: [UndecoratedCtrl] })
			class RootModule {}

			await expect(Application.create(RootModule)).rejects.toThrow('is not decorated with @Controller()')
		})

		test('controller with no routes throws', async () => {
			@Controller('/empty')
			class EmptyCtrl {}

			@Module({ controllers: [EmptyCtrl] })
			class RootModule {}

			await expect(Application.create(RootModule)).rejects.toThrow('has no registered routes')
		})
	})
})
