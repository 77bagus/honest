/**
 * Interface for forward references.
 */
export interface ForwardReference<T = any> {
	forwardRef: () => T
}

/**
 * Utility function to handle circular dependencies.
 * It allows referencing classes that are not yet defined.
 *
 * @param fn - A function that returns the target class
 * @returns A ForwardReference object
 */
export function forwardRef<T = any>(fn: () => T): ForwardReference<T> {
	return { forwardRef: fn }
}

/**
 * Checks if a value is a forward reference.
 * @param value - The value to check
 */
export function isForwardRef(value: any): value is ForwardReference {
	return value && typeof value === 'object' && typeof value.forwardRef === 'function'
}

/**
 * Resolves a forward reference if necessary.
 * @param value - The value to resolve
 */
export function resolveForwardRef<T>(value: T | ForwardReference<T>): T {
	const resolved = isForwardRef(value) ? value.forwardRef() : value
	if (resolved === undefined) {
		// This can happen if forwardRef is used but the target is not yet defined
		// or if there is a hoisting issue in the environment.
	}
	return resolved
}
