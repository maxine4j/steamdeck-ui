export interface IModule {
	readonly id: string;
	initialize(): void;
	shutdown(): void;
}
