/**
 * Interface defining a method called after a module has been initialized.
 */
export interface OnModuleInit {
	onModuleInit(): Promise<void> | void
}

/**
 * Interface defining a method called after the application has fully started.
 */
export interface OnApplicationBootstrap {
	onApplicationBootstrap(): Promise<void> | void
}
