#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

async function main() {
	const args = process.argv.slice(2)
	const command = args[0]
	const subCommand = args[1]
	const name = args[2]

	if (command === 'generate' || command === 'g') {
		await handleGenerate(subCommand, name)
	} else if (command === 'new') {
		await handleNew(subCommand)
	} else {
		printHelp()
	}
}

function toPascalCase(str: string): string {
	return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase())
}

function toKebabCase(str: string): string {
	return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

async function handleGenerate(schematic: string, name: string) {
	if (!schematic || !name) {
		console.error('Usage: honest generate <controller|service|module> <name>')
		return
	}

	const kebabName = toKebabCase(name)
	const pascalName = toPascalCase(name)

	let content: string
	let fileName: string

	switch (schematic.toLowerCase()) {
		case 'controller':
			content = `import { Controller, Get } from 'honestjs'

@Controller('/${kebabName}')
export class ${pascalName}Controller {
	@Get('/')
	findAll() {
		return 'This action returns all items'
	}
}
`
			fileName = `${kebabName}.controller.ts`
			break

		case 'service':
			content = `import { Service } from 'honestjs'

@Service()
export class ${pascalName}Service {
	findAll() {
		return []
	}
}
`
			fileName = `${kebabName}.service.ts`
			break

		case 'module':
			content = `import { Module } from 'honestjs'

@Module({
	controllers: [],
	services: []
})
export class ${pascalName}Module {}
`
			fileName = `${kebabName}.module.ts`
			break

		default:
			console.error(`Unknown schematic: ${schematic}`)
			return
	}

	if (!existsSync('src')) {
		mkdirSync('src')
	}

	writeFileSync(join('src', fileName), content)
	console.log(`Successfully generated ${schematic} at src/${fileName}`)
}

async function handleNew(name: string) {
	if (!name) {
		console.error('Usage: honest new <project-name>')
		return
	}
	console.log(`Creating new HonestJS project: ${name}...`)
	// In a real CLI, we would clone a template or run 'npm init'
	if (!existsSync(name)) {
		mkdirSync(name)
	}
	console.log(`Project ${name} created. Next steps:`)
	console.log(`  cd ${name}`)
	console.log(`  npm init -y`)
	console.log(`  npm install honestjs`)
}

function printHelp() {
	console.log(`
HonestJS CLI
Usage: honest <command> [options]

Commands:
  new <name>               Scaffold a new project folder
  generate <type> <name>   Generate a new component (alias: g)
    types: controller, service, module
	`)
}

main().catch(console.error)
