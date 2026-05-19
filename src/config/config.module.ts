import { Module } from '../decorators'
import { ConfigService } from './config.service'
import type { DynamicModule } from '../interfaces'

/**
 * Options for configuring the ConfigModule.
 */
export interface ConfigModuleOptions {
	/**
	 * If true, the module will be global.
	 */
	isGlobal?: boolean
	/**
	 * Custom configuration objects or functions.
	 */
	load?: (Record<string, any> | (() => Record<string, any>))[]
	/**
	 * If true, environment variables will be ignored.
	 */
	ignoreEnvVars?: boolean
}

/**
 * Module that provides application configuration.
 */
@Module()
export class ConfigModule {
	/**
	 * Configures the module dynamically.
	 * @param options - Configuration options
	 */
	static forRoot(options: ConfigModuleOptions = {}): DynamicModule {
		const config = (options.load || []).reduce((acc, curr) => {
			const values = typeof curr === 'function' ? curr() : curr
			return { ...acc, ...values }
		}, {})

		const configService = new ConfigService(config)

		const serviceProviders = [
			{
				provide: ConfigService,
				useValue: configService
			}
		]

		return {
			module: ConfigModule,
			services: serviceProviders,
			exports: serviceProviders,
			isGlobal: options.isGlobal
		}
	}
}
