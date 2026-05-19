import type { Constructor } from '../types'

/**
 * Type for a provider token
 */
export type ProviderToken = string | symbol | Constructor

/**
 * Interface for a Value Provider
 */
export interface ValueProvider<T = any> {
	provide: ProviderToken
	useValue: T
}

/**
 * Interface for a Class Provider
 */
export interface ClassProvider<T = any> {
	provide: ProviderToken
	useClass: Constructor<T>
}

/**
 * Interface for a Factory Provider
 */
export interface FactoryProvider<T = any> {
	provide: ProviderToken
	useFactory: (...args: any[]) => T | Promise<T>
	inject?: any[]
}

/**
 * Type for a provider definition
 */
export type Provider<T = any> = Constructor<T> | ValueProvider<T> | ClassProvider<T> | FactoryProvider<T>
