import { expect, it, vi } from "vitest";
import { CrossBar } from "./cross-bar";

const { configure, refresh, destroy, target } = vi.hoisted(() => ({
	configure: vi.fn(),
	refresh: vi.fn(),
	destroy: vi.fn(),
	target: { owner: {}, name: "CrossButton" },
}));
vi.mock("../../ui/components/secure-slot-button", () => ({
	SecureSlotButton: class {
		configure = configure;
		refresh = refresh;
		destroy = destroy;
		getBindingTarget = () => target;
	},
}));

it("lays out two crosses with Xbox face positions and binds exactly eight reusable controls", () => {
	const client = {
		bind: vi.fn(),
		read: vi.fn(),
		getSlotDriver: (slot: number) => `slot-${slot}`,
	};
	const view = new CrossBar({}, client);
	view.initialize();
	view.initialize();
	expect(configure).toHaveBeenCalledTimes(8);
	expect(
		configure.mock.calls.map(([label, x, y, slot]) => [label, x, y, slot]),
	).toEqual([
		["↑", -110, 160, 1],
		["→", -58, 108, 2],
		["↓", -110, 56, 3],
		["←", -162, 108, 4],
		["|cffffe74fY|r", 110, 160, 5],
		["|cffff4451B|r", 162, 108, 6],
		["|cff52c14eA|r", 110, 56, 7],
		["|cff00a2ffX|r", 58, 108, 8],
	]);
	expect(client.bind).toHaveBeenCalledWith(
		[
			"PADDUP",
			"PADDRIGHT",
			"PADDDOWN",
			"PADDLEFT",
			"PAD4",
			"PAD2",
			"PAD1",
			"PAD3",
		].map((key) => ({ key, target })),
	);
	view.refresh();
	expect(refresh).toHaveBeenCalledTimes(8);
	view.destroy();
	expect(destroy).toHaveBeenCalledTimes(8);
});
