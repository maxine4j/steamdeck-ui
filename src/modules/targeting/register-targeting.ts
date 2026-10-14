import { TargetingClient } from "../../clients/targeting-client";
import { ScreenPlus } from "../../ui/components/screen-plus";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { ModuleManager } from "../module-manager";
import { TargetingModule } from "./targeting-module";

export function registerTargeting(
	pool: IFramePoolManager,
	modules: ModuleManager,
): void {
	modules.register(
		new TargetingModule(new ScreenPlus(pool), new TargetingClient()),
	);
}
