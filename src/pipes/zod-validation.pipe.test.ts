import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { ZodValidationPipe } from './zod-validation.pipe'

describe('ZodValidationPipe', () => {
	it('should validate and return value when schema passes', async () => {
		const schema = {
			parse: (v: any) => v
		}
		const pipe = new ZodValidationPipe(schema)
		const value = { name: 'honest' }
		const result = await pipe.transform(value, {} as any)
		expect(result).toEqual(value)
	})

	it('should throw 400 error when schema fails', async () => {
		const schema = {
			parse: () => {
				throw new Error('zod error')
			}
		}
		const pipe = new ZodValidationPipe(schema)
		try {
			await pipe.transform({}, {} as any)
			throw new Error('Should have thrown')
		} catch (error: any) {
			expect(error.status).toBe(400)
			expect(error.message).toBe('Validation failed')
		}
	})

	it('should support async parse', async () => {
		const schema = {
			parse: (v: any) => v,
			parseAsync: async (v: any) => {
				await new Promise((r) => setTimeout(r, 10))
				return { ...v, async: true }
			}
		}
		const pipe = new ZodValidationPipe(schema)
		const result = await pipe.transform({ x: 1 }, {} as any)
		expect(result).toEqual({ x: 1, async: true })
	})
})
