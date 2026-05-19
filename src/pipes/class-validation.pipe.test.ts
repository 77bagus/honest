import 'reflect-metadata'
import { describe, expect, it } from 'bun:test'
import { ClassValidationPipe } from './class-validation.pipe'

describe('ClassValidationPipe', () => {
	it('should return value when metatype is simple JS type', async () => {
		const pipe = new ClassValidationPipe()
		const result = await pipe.transform('test', { metatype: String } as any)
		expect(result).toBe('test')
	})

	it('should throw error when libraries are missing', async () => {
		const pipe = new ClassValidationPipe()
		try {
			await pipe.transform({ x: 1 }, { metatype: class Dto {} } as any)
			throw new Error('Should have thrown')
		} catch (error: any) {
			expect(error.message).toContain('requires "class-validator"')
		}
	})
})
