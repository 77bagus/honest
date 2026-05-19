import type { ArgumentMetadata, IPipe } from '../interfaces'
import { HTTPException } from 'hono/http-exception'

/**
 * Options for ClassValidationPipe.
 */
export interface ClassValidationOptions {
	/**
	 * Whether to transform the plain object to a class instance.
	 * Requires class-transformer.
	 */
	transform?: boolean
	/**
	 * Options for class-validator.
	 */
	validatorOptions?: any
	/**
	 * Options for class-transformer.
	 */
	transformerOptions?: any
	/**
	 * Custom error factory.
	 */
	exceptionFactory?: (errors: any[]) => any
}

/**
 * Validation pipe that uses class-validator and class-transformer.
 */
export class ClassValidationPipe implements IPipe {
	constructor(private readonly options: ClassValidationOptions = {}) {}

	async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<unknown> {
		if (!metatype || !this.toValidate(metatype)) {
			return value
		}

		let classValidator: any
		let classTransformer: any

		try {
			// We try to import them dynamically to avoid hard dependencies
			// @ts-expect-error dynamic import
			classValidator = await import('class-validator')
			// @ts-expect-error dynamic import
			classTransformer = await import('class-transformer')
		} catch (error) {
			throw new Error('ClassValidationPipe requires "class-validator" and "class-transformer" to be installed.', {
				cause: error
			})
		}

		let object = value
		if (this.options.transform) {
			object = classTransformer.plainToInstance(metatype, value, this.options.transformerOptions)
		}

		const errors = await classValidator.validate(object, this.options.validatorOptions)
		if (errors.length > 0) {
			if (this.options.exceptionFactory) {
				throw this.options.exceptionFactory(errors)
			}
			throw new HTTPException(400, {
				message: 'Validation failed',
				cause: errors
			})
		}

		return this.options.transform ? object : value
	}

	private toValidate(metatype: (...args: any[]) => any): boolean {
		const types: ((...args: any[]) => any)[] = [String, Boolean, Number, Array, Object]
		return !types.includes(metatype)
	}
}
