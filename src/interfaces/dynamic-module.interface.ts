import type { Constructor } from '../types'
import type { ModuleOptions } from './module-options.interface'

/**
 * Interface representing a Dynamic Module.
 * Dynamic modules allow for runtime configuration of modules.
 */
export interface DynamicModule extends ModuleOptions {
	/**
	 * The module class constructor.
	 */
	module: Constructor

	/**
	 * Whether the module should be global.
	 * Global modules are available to all modules without explicit import.
	 */
	isGlobal?: boolean
}
