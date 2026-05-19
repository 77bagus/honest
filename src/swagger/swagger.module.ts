import type { Application } from '../application'
import { SWAGGER_TAGS_KEY } from './decorators'
import type { IMetadataRepository } from '../interfaces'

/**
 * Module for generating and serving OpenAPI specifications.
 */
export class SwaggerModule {
	constructor() {}

	/**
	 * Creates an OpenAPI document for the given application.
	 * @param app - The application instance
	 * @param config - The base OpenAPI document configuration
	 */
	static createDocument(app: Application, config: any): any {
		const document = { ...config, paths: { ...config.paths } }
		const routes = app.getRoutes()
		const metadataRepository = (app as any).metadataRepository as IMetadataRepository

		for (const route of routes) {
			const { method, fullPath, controllerClass, handler } = route

			if (!document.paths[fullPath]) {
				document.paths[fullPath] = {}
			}

			const operationId = `${controllerClass.name}_${String(handler)}`

			const summaryMetadata = metadataRepository.getMetadata(
				controllerClass,
				Symbol.for(`SWAGGER_OP_${String(handler)}`)
			)
			const tagsMetadata = metadataRepository.getMetadata(controllerClass, SWAGGER_TAGS_KEY) || []
			const responsesMetadata =
				metadataRepository.getMetadata(controllerClass, Symbol.for(`SWAGGER_RES_${String(handler)}`)) || []

			const operation: any = {
				operationId,
				summary: summaryMetadata?.summary || String(handler),
				description: summaryMetadata?.description || '',
				tags: tagsMetadata,
				responses: {}
			}

			if (responsesMetadata.length > 0) {
				for (const res of responsesMetadata) {
					operation.responses[res.status] = {
						description: res.description
					}
				}
			} else {
				operation.responses['200'] = { description: 'OK' }
			}

			document.paths[fullPath][method.toLowerCase()] = operation
		}

		return document
	}

	/**
	 * Sets up the Swagger UI and documentation endpoints.
	 * @param path - The path to serve the UI and JSON
	 * @param app - The application instance
	 * @param document - The OpenAPI document
	 */
	static setup(path: string, app: Application, document: any): void {
		const jsonPath = path.endsWith('/') ? `${path}json` : `${path}/json`
		const hono = app.getHono()

		hono.get(jsonPath, (c) => c.json(document))

		// For now, we only serve the JSON.
		// A full UI would require serving static HTML/JS/CSS.
	}
}
