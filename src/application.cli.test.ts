import { describe, expect, it } from 'bun:test'
import { existsSync, unlinkSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'

// We'll test the CLI by running it as a script or importing its logic if we can refactor it.
// For now, let's just test if we can run it via bun.

describe('HonestJS CLI', () => {
	const cliPath = join(import.meta.dir, 'cli', 'index.ts')

	it('should show help when run without args', async () => {
		const proc = Bun.spawn(['bun', cliPath])
		const output = await new Response(proc.stdout).text()
		expect(output).toContain('HonestJS CLI')
		expect(output).toContain('Usage: honest')
	})

	it('should generate a controller', async () => {
		const proc = Bun.spawn(['bun', cliPath, 'generate', 'controller', 'users'])
		await proc.exited

		expect(existsSync('src/users.controller.ts')).toBe(true)
		const content = readFileSync('src/users.controller.ts', 'utf-8')
		expect(content).toContain('class UsersController')
		expect(content).toContain("@Controller('/users')")

		unlinkSync('src/users.controller.ts')
	})

	it('should generate a service', async () => {
		const proc = Bun.spawn(['bun', cliPath, 'g', 'service', 'auth'])
		await proc.exited

		expect(existsSync('src/auth.service.ts')).toBe(true)
		const content = readFileSync('src/auth.service.ts', 'utf-8')
		expect(content).toContain('class AuthService')
		expect(content).toContain('@Service()')

		unlinkSync('src/auth.service.ts')
	})

	it('should generate a module', async () => {
		const proc = Bun.spawn(['bun', cliPath, 'generate', 'module', 'app'])
		await proc.exited

		expect(existsSync('src/app.module.ts')).toBe(true)
		const content = readFileSync('src/app.module.ts', 'utf-8')
		expect(content).toContain('class AppModule')
		expect(content).toContain('@Module')

		unlinkSync('src/app.module.ts')
	})

	it('should create a new project folder', async () => {
		const proc = Bun.spawn(['bun', cliPath, 'new', 'my-project'])
		await proc.exited

		expect(existsSync('my-project')).toBe(true)
		rmSync('my-project', { recursive: true, force: true })
	})
})
