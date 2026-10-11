// Modules are isolated feature sets (Bags, Rep).
// They are loaded on Addon init.
export interface IModule {
    id: string
    initialize(): void;
}
