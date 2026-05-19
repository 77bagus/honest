import type { LogEvent, ILogger } from '../interfaces'

/**
 * User-facing logger service that provides a simple API for logging.
 * It wraps the internal framework logger.
 */
export class Logger {
	constructor(
		private readonly context: string = 'App',
		private readonly internalLogger?: ILogger
	) {}

	/**
	 * Log an info message.
	 */
	log(message: string, details?: any): void {
		this.emit('info', message, details)
	}

	/**
	 * Log a debug message.
	 */
	debug(message: string, details?: any): void {
		this.emit('debug', message, details)
	}

	/**
	 * Log a warning message.
	 */
	warn(message: string, details?: any): void {
		this.emit('warn', message, details)
	}

	/**
	 * Log an error message.
	 */
	error(message: string, details?: any): void {
		this.emit('error', message, details)
	}

	private emit(level: LogEvent['level'], message: string, details?: any): void {
		if (this.internalLogger) {
			this.internalLogger.emit({
				level,
				category: this.context,
				message,
				details
			})
		} else {
			// Fallback to console if no internal logger (e.g. testing without Application)
			const prefix = `[HonestJS:${this.context}]`
			const payload = details ? [prefix, message, details] : [prefix, message]
			console[level === 'debug' ? 'info' : level](...payload)
		}
	}
}
