import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { Application } from './application'
import { Module, Controller, Get, Post } from './decorators'
import { SwaggerModule, DocumentBuilder, ApiTags, ApiOperation, ApiResponse } from './swagger'

describe('Swagger Integration', () => {
	it('should generate OpenAPI document from decorators', async () => {
		@ApiTags('cats')
		@Controller('/cats')
		class CatsController {
			@Get('/')
			@ApiOperation({ summary: 'Find all cats' })
			@ApiResponse({ status: 200, description: 'Return all cats' })
			findAll() {
				return []
			}

			@Post('/')
			@ApiOperation({ summary: 'Create a cat' })
			@ApiResponse({ status: 201, description: 'Cat created' })
			create() {
				return {}
			}
		}

		@Module({
			controllers: [CatsController]
		})
		class RootModule {}

		const { app } = await Application.create(RootModule)

		const config = new DocumentBuilder()
			.setTitle('Cats API')
			.setDescription('The cats API description')
			.setVersion('1.0')
			.build()

		const document = SwaggerModule.createDocument(app, config)

		expect(document.info.title).toBe('Cats API')
		expect(document.paths['/cats']).toBeDefined()
		expect(document.paths['/cats'].get.summary).toBe('Find all cats')
		expect(document.paths['/cats'].get.tags).toContain('cats')
		expect(document.paths['/cats'].post.responses['201']).toBeDefined()
	})

	it('should serve OpenAPI JSON document', async () => {
		@Controller('/test')
		class TestController {
			@Get('/')
			get() {
				return 'ok'
			}
		}

		@Module({ controllers: [TestController] })
		class RootModule {}

		const { app } = await Application.create(RootModule)
		const config = new DocumentBuilder().setTitle('Test API').build()
		const document = SwaggerModule.createDocument(app, config)

		SwaggerModule.setup('/swagger', app, document)

		const res = await app.hono.request('/swagger/json')
		const body = await res.json()

		expect(res.status).toBe(200)
		expect(body.info.title).toBe('Test API')
	})
})
