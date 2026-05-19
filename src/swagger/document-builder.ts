/**
 * Builder class for creating OpenAPI documents.
 */
export class DocumentBuilder {
	private readonly document: any = {
		openapi: '3.0.0',
		info: {
			title: '',
			description: '',
			version: '1.0.0'
		},
		paths: {},
		components: {
			schemas: {},
			securitySchemes: {}
		},
		tags: []
	}

	setTitle(title: string): this {
		this.document.info.title = title
		return this
	}

	setDescription(description: string): this {
		this.document.info.description = description
		return this
	}

	setVersion(version: string): this {
		this.document.info.version = version
		return this
	}

	addTag(name: string, description?: string): this {
		this.document.tags.push({ name, description })
		return this
	}

	addBearerAuth(
		options: any = { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
		name: string = 'bearer'
	): this {
		this.document.components.securitySchemes[name] = options
		return this
	}

	build(): any {
		return this.document
	}
}
