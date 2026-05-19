import type { Constructor } from '../types'
import type { Provider } from './provider.interface'

/**
 * Options for configuring a module
 */
export interface ModuleOptions {
	/**
	 * List of controller classes
	 */
	controllers?: Constructor[]
	/**
	 * List of service classes or provider definitions
	 */
	services?: Provider[]
	/**
	 * List of imported modules
	 */
	imports?: Constructor[]
	/**
	 * List of exported services or modules
	 */
	exports?: (Constructor | string | symbol | Provider)[]
}
