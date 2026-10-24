import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavigationManager } from "../../ui/navigation/navigation-manager";
import { ModuleManager } from "../module-manager";
import { registerSystemDialogs } from "./register-system-dialogs";

const { playerMenuCreated, playerChoiceCreated } = vi.hoisted(() => ({
	playerMenuCreated: vi.fn(),
	playerChoiceCreated: vi.fn(),
}));
vi.mock("../../clients/player-choice-client", () => ({
	PlayerChoiceClient: class {
		constructor() {
			playerChoiceCreated();
		}
	},
}));
vi.mock("../../clients/player-menu-client", () => ({
	PlayerMenuClient: class {
		constructor() {
			playerMenuCreated();
		}
	},
}));

it("registers player settings and shared player choices as system dialogs", () => {
	registerSystemDialogs(
		{} as IFramePoolManager,
		new ModuleManager(),
		createTestEventBus(),
		{} as NavigationManager,
		{ nextFrame: vi.fn(), delay: vi.fn() },
	);
	expect(playerMenuCreated).toHaveBeenCalledOnce();
	expect(playerChoiceCreated).toHaveBeenCalledOnce();
});
