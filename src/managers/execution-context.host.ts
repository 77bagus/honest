import type { Context } from 'hono'
import type { ExecutionContext } from '../interfaces'
import type { Constructor } from '../types'

/**
 * Concrete implementation of ExecutionContext.
 */
export class ExecutionContextHost implements ExecutionContext {
	constructor(
		private readonly controllerClass: Constructor,
		private readonly handler: (...args: any[]) => any,
		private readonly context: Context,
		private readonly handlerName?: string | symbol
	) {}

	getClass<T = any>(): Constructor<T> {
		return this.controllerClass as Constructor<T>
	}

	getHandler(): (...args: any[]) => any {
		return this.handler
	}

	getHandlerName(): string | symbol | undefined {
		return this.handlerName
	}

	switchToHttp() {
		return {
			getRequest: () => this.context.req.raw,
			getResponse: () => this.context.res,
			getNext: () => (this.context as any).next,
			getContext: () => this.context
		}
	}
}
