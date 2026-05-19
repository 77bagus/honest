import { createParamDecorator } from '../../helpers'

/**
 * Decorator that extracts the message body.
 */
export const MessageBody = createParamDecorator('ws:body', (data, ctx: any) => {
	const payload = ctx.payload
	return data ? payload?.[data as string] : payload
})

/**
 * Decorator that extracts the socket instance.
 */
export const ConnectedSocket = createParamDecorator('ws:socket', (_data, ctx: any) => {
	return ctx.socket
})
