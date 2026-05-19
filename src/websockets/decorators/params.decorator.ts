import { createParamDecorator } from '../../helpers'

/**
 * Decorator that extracts the message body.
 */
export const MessageBody = (data?: any) =>
	createParamDecorator('ws:body', (payload) => {
		return data ? payload?.[data] : payload
	})

/**
 * Decorator that extracts the socket instance.
 */
export const ConnectedSocket = () =>
	createParamDecorator('ws:socket', (_, ctx) => {
		// In WS context, we'll store the socket in the 'context' passed to the factory
		return ctx
	})
