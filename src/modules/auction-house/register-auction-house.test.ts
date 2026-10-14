import { expect, it, vi } from "vitest";
import type { IAuctionHouseClient } from "../../clients/auction-house-client";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import { registerAuctionHouse } from "./register-auction-house";

vi.mock("./auction-house-panel", () => ({
	AuctionHousePanel: class {
		constructor(readonly id: string) {}
		refresh() {}
		reset() {}
		destroy() {}
	},
}));
it("registers buy, sell, and owned auctions in one left container", () => {
	const ui = {
		registerPanel: vi.fn(),
		openPanel: vi.fn(),
		closePanel: vi.fn(),
	};
	const modules = { register: vi.fn() };
	registerAuctionHouse(
		{} as IFramePoolManager,
		createTestEventBus(),
		ui as unknown as IUIOrchestrator,
		modules,
		{} as IAuctionHouseClient,
		{ nextFrame: () => () => {} },
	);
	expect(
		ui.registerPanel.mock.calls.map(([panel, dock, container]) => [
			panel.id,
			dock,
			container,
		]),
	).toEqual([
		["auction-buy", "left", "auction-house"],
		["auction-sell", "left", "auction-house"],
		["auction-owned", "left", "auction-house"],
	]);
	expect(modules.register).toHaveBeenCalledOnce();
});
