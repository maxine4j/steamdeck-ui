export interface IModule {
	readonly id: string;
	disableBuiltIn(): void;
	initialize(): void;
	shutdown(): void;
}
