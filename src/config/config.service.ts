/**
 * Service that provides access to application configuration and environment variables.
 */
export class ConfigService {
	private readonly internalConfig: Record<string, any>

	constructor(config: Record<string, any> = {}) {
		this.internalConfig = {
			...config,
			...process.env
		}
	}

	/**
	 * Gets a configuration value by key.
	 * @param key - The configuration key (supports dot notation)
	 * @param defaultValue - Optional default value if key not found
	 */
	get<T = any>(key: string, defaultValue?: T): T {
		const value = this.getValueByPath(key)
		return (value !== undefined ? value : defaultValue) as T
	}

	/**
	 * Checks if a configuration key exists.
	 * @param key - The configuration key
	 */
	has(key: string): boolean {
		return this.getValueByPath(key) !== undefined
	}

	private getValueByPath(path: string): any {
		return path.split('.').reduce((acc, part) => acc && acc[part], this.internalConfig)
	}
}
