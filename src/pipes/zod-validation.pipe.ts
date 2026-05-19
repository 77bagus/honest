import type { ArgumentMetadata, IPipe } from '../interfaces'
import { HTTPException } from 'hono/http-exception'

/**
 * Interface for Zod-like schemas.
 */
export interface ZodSchema {
	parse(data: unknown): any
	parseAsync?(data: unknown): Promise<any>
}

/**
 * Validation pipe that uses Zod schemas to validate and transform data.
 */
export class ZodValidationPipe implements IPipe {
	constructor(private readonly schema: ZodSchema) {}

	async transform(value: unknown, _metadata: ArgumentMetadata): Promise<unknown> {
		try {
			if (this.schema.parseAsync) {
				return await this.schema.parseAsync(value)
			}
			return this.schema.parse(value)
		} catch (error: any) {
			throw new HTTPException(400, {
				message: 'Validation failed',
				cause: error
			})
		}
	}
}
