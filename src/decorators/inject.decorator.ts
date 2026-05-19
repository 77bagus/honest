import { MetadataRegistry } from '../registries'

/**
 * Decorator that specifies a custom provider to be injected.
 * Can be used to inject tokens or resolve circular dependencies with forwardRef().
 *
 * @param token - The token or forwardRef() to inject
 */
export function Inject(token: any): ParameterDecorator {
	return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
		// Only support constructor injection for now (propertyKey is undefined)
		if (propertyKey === undefined) {
			MetadataRegistry.setInjectToken(target, parameterIndex, token)
		}
	}
}
