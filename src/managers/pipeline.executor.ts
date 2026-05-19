import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { HONEST_PIPELINE_CONTROLLER_KEY, HONEST_PIPELINE_HANDLER_KEY } from '../constants'
import { NoopLogger } from '../loggers'
import type {
	ILogger,
	ParameterMetadata,
	HonestInterceptor,
	CallHandler,
	ExecutionContext,
	DiContainer
} from '../interfaces'
import type { IPipe } from '../interfaces'
import { ComponentManager } from './component.manager'
import { HandlerInvoker } from './handler.invoker'
import { ParameterResolver } from './parameter.resolver'
import { ExecutionContextHost } from './execution-context.host'
import type { Constructor } from '../types'

export interface PipelineExecutionInput {
	controllerClass: Constructor
	handlerName: string | symbol
	handlerParams: ReadonlyArray<ParameterMetadata>
	handlerPipes: ReadonlyArray<IPipe>
	contextIndex?: number
	context: Context
}

/**
 * Executes guard, parameter-resolution, and handler invocation stages.
 */
export class PipelineExecutor {
	constructor(
		private readonly container: DiContainer,
		private readonly componentManager: ComponentManager,
		private readonly parameterResolver: ParameterResolver,
		private readonly handlerInvoker: HandlerInvoker,
		private readonly logger: ILogger = new NoopLogger(),
		private readonly debugPipeline = false
	) {}

	async execute(input: PipelineExecutionInput): Promise<unknown> {
		const { controllerClass, handlerName, handlerParams, handlerPipes, contextIndex, context } = input

		// Use Hono's requestId if available, or generate one
		const contextId = (context.get('requestId') as string) || Math.random().toString(36).substring(7)

		context.set(HONEST_PIPELINE_CONTROLLER_KEY, controllerClass)
		context.set(HONEST_PIPELINE_HANDLER_KEY, String(handlerName))

		try {
			// Resolve controller instance per request (Container handles singleton caching)
			const controllerInstance = await this.container.resolve(controllerClass, contextId)
			const handler = controllerInstance[handlerName].bind(controllerInstance)

			const guards = await this.componentManager.getHandlerGuards(controllerClass, handlerName)

			for (const guard of guards) {
				const canActivate = await guard.canActivate(context)
				if (!canActivate) {
					if (this.debugPipeline) {
						this.logger.emit({
							level: 'warn',
							category: 'pipeline',
							message: `Guard rejected request at ${controllerClass.name}.${String(handlerName)}`,
							details: { guard: guard.constructor?.name || 'UnknownGuard' }
						})
					}
					throw new HTTPException(403, {
						message: `Forbidden by ${guard.constructor?.name || 'UnknownGuard'} at ${controllerClass.name}.${String(handlerName)}`
					})
				}
			}

			const interceptors = await this.componentManager.getHandlerInterceptors(controllerClass, handlerName)
			const executionContext = new ExecutionContextHost(controllerClass, handler, context, handlerName)

			const handlerWrapper = async () => {
				const args = await this.parameterResolver.resolveArguments({
					controllerName: controllerClass.name,
					handlerName,
					handlerArity: handler.length,
					handlerParams,
					handlerPipes,
					context
				})

				if (this.debugPipeline) {
					this.logger.emit({
						level: 'debug',
						category: 'pipeline',
						message: `Resolved handler arguments for ${controllerClass.name}.${String(handlerName)}`,
						details: {
							guardCount: guards.length,
							parameterCount: handlerParams.length,
							pipeCount: handlerPipes.length,
							interceptorCount: interceptors.length
						}
					})
				}

				return handler(...args)
			}

			const result = await this.chainInterceptors(interceptors, executionContext, handlerWrapper)

			return this.handlerInvoker.mapResult(result, context, contextIndex)
		} finally {
			// Clean up request-scoped instances after request ends
			this.container.clearContext(contextId)
		}
	}

	private async chainInterceptors(
		interceptors: HonestInterceptor[],
		context: ExecutionContext,
		finalHandler: () => Promise<unknown>
	): Promise<unknown> {
		let index = 0

		const next: CallHandler = {
			handle: async () => {
				if (index >= interceptors.length) {
					return finalHandler()
				}
				const interceptor = interceptors[index++]
				return interceptor.intercept(context, next)
			}
		}

		return next.handle()
	}
}
