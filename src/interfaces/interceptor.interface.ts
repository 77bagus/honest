import type { Context } from 'hono'
import type { Constructor } from '../types'

/**
 * Interface for providing metadata about the current execution process.
 */
export interface ExecutionContext {
	/**
	 * Returns the type of the controller class which the current handler belongs to.
	 */
	getClass<T = any>(): Constructor<T>

	/**
	 * Returns a reference to the handler (method) that will be invoked next in the request pipeline.
	 */
	getHandler(): (...args: any[]) => any

	/**
	 * Returns the name of the handler method.
	 */
	getHandlerName(): string | symbol | undefined

	/**
	 * Returns the Hono context object.
	 */
	switchToHttp(): {
		getRequest(): any
		getResponse(): any
		getNext(): any
		getContext(): Context
	}
}

/**
 * Interface that provides access to the next interceptor or the final route handler.
 */
export interface CallHandler<T = any> {
	/**
	 * Invokes the next interceptor or the route handler.
	 */
	handle(): Promise<T>
}

/**
 * Interface that defines an interceptor.
 */
export interface HonestInterceptor<T = any, R = any> {
	/**
	 * Method that is called to intercept the request.
	 * @param context - The execution context
	 * @param next - The call handler to continue execution
	 */
	intercept(context: ExecutionContext, next: CallHandler<T>): Promise<R> | R
}

/**
 * Type for an interceptor class or instance.
 */
export type InterceptorType = Constructor<HonestInterceptor> | HonestInterceptor
