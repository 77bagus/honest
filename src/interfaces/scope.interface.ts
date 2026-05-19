/**
 * Injection scopes for providers.
 */
export enum Scope {
	/**
	 * The provider is a singleton and is instantiated only once.
	 */
	DEFAULT = 0,
	/**
	 * A new instance of the provider is created for each request.
	 */
	REQUEST = 1,
	/**
	 * A new instance of the provider is created each time it is resolved.
	 */
	TRANSIENT = 2
}
