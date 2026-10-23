import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavigationManager } from "../../ui/navigation/navigation-manager";
import { ModuleManager } from "../module-manager";
import { registerSystemDialogs } from "./register-system-dialogs";

const { playerMenuCreated } = vi.hoisted(() => ({
	playerMenuCreated: vi.fn(),
}));
vi.mock("../../clients/player-menu-client", () => ({
	PlayerMenuClient: class {
		constructor() {
			playerMenuCreated();
		}
	},
}));

it("keeps the player portrait companion detached from Escape while it is disabled", () => {
	registerSystemDialogs(
		{} as IFramePoolManager,
		new ModuleManager(),
		createTestEventBus(),
		{} as NavigationManager,
		{ nextFrame: vi.fn(), delay: vi.fn() },
	);
	expect(playerMenuCreated).not.toHaveBeenCalled();
});
