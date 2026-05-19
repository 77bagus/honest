import type { Constructor } from '../types'

/**
 * Interface for dependency injection containers
 * Defines the contract that DI containers must implement to work with the Honest framework
 * Handles the creation and management of dependency instances
 */
export interface DiContainer {
	/**
	 * Resolves a dependency from the container
	 * Creates a new instance or returns an existing one based on the container's configuration
	 * @param token - The token or class constructor to resolve
	 * @returns An instance of the requested dependency
	 * @throws {Error} If the dependency cannot be resolved
	 */
	resolve<T>(token: Constructor<T> | string | symbol): T

	/**
	 * Registers a pre-created instance in the container
	 * Used for singleton instances or mocks in testing
	 * @param token - The token or class constructor to register the instance for
	 * @param instance - The pre-created instance to use
	 * @throws {Error} If registration fails
	 */
	register<T>(token: Constructor<T> | string | symbol, instance: T): void

	/**
	 * Checks whether the container already holds an instance for the given token
	 * @param token - The token or class constructor to check
	 * @returns true if an instance has been resolved or registered
	 */
	has<T>(token: Constructor<T> | string | symbol): boolean

	/**
	 * Removes all cached instances from the container
	 * Useful for resetting state between tests
	 */
	clear(): void

	/**
	 * Registers a provider definition in the container
	 * @param provider - The provider definition (class or object-based)
	 */
	addProvider(provider: any): void

	/**
	 * Returns all currently managed instances
	 */
	getInstances(): any[]

	/**
	 * Sets a visibility checker for dependency resolution
	 */
	setVisibilityChecker(checker: (provider: Constructor, consumer: Constructor) => boolean): void
}
