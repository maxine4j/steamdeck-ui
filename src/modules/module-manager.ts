import type { IModule } from "./types";
export class ModuleManager {
	private readonly modules = new Map<string, IModule>();
	private started = false;
	register(module: IModule): void {
		if (this.started) throw new Error("Cannot register modules after startup");
		if (this.modules.has(module.id))
			throw new Error(`Duplicate module: ${module.id}`);
		this.modules.set(module.id, module);
	}
	start(): void {
		if (this.started) return;
		for (const module of this.modules.values()) module.initialize();
		this.started = true;
	}
	stop(): void {
		if (!this.started) return;
		for (const module of this.modules.values()) module.shutdown();
		this.started = false;
	}
}
