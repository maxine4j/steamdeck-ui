import { expect, it, vi } from "vitest";
import { CrossBar } from "./cross-bar";

const { configure, refresh, destroy, target, indicators } = vi.hoisted(() => ({
	configure: vi.fn(),
	refresh: vi.fn(),
	destroy: vi.fn(),
	target: { owner: {}, name: "CrossButton" },
	indicators: [] as {
		id: string;
		layout: ReturnType<typeof vi.fn>;
		setLabel: ReturnType<typeof vi.fn>;
		setColor: ReturnType<typeof vi.fn>;
		setBorder: ReturnType<typeof vi.fn>;
		show: ReturnType<typeof vi.fn>;
		destroy: ReturnType<typeof vi.fn>;
	}[],
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		layout = vi.fn();
		setLabel = vi.fn();
		setColor = vi.fn();
		setBorder = vi.fn();
		show = vi.fn();
		destroy = vi.fn();
		constructor(public readonly id: string) {
			indicators.push(this);
		}
	},
}));
vi.mock("../../ui/components/secure-slot-button", () => ({
	SecureSlotButton: class {
		configure = configure;
		refresh = refresh;
		destroy = destroy;
		getBindingTarget = () => target;
	},
}));

it("uses the minimal crossbar layout with ten actions and two unbound modifier indicators", () => {
	const client = {
		bind: vi.fn(),
		read: vi.fn(),
		getSlotDriver: (slot: number, command?: string) =>
			command ? `slot-${slot}-${command}` : `slot-${slot}`,
	};
	const view = new CrossBar({}, client);
	view.initialize();
	view.initialize();
	expect(configure).toHaveBeenCalledTimes(10);
	expect(
		configure.mock.calls.map(([label, x, y, slot]) => [label, x, y, slot]),
	).toEqual([
		["↑", -200, 106, -1],
		["→", -150, 81, 6],
		["↓", -200, 56, 7],
		["←", -250, 81, 8],
		["|cffffe74fY|r", 200, 106, 2],
		["|cffff4451B|r", 250, 81, 3],
		["|cff52c14eA|r", 200, 56, 0],
		["|cff00a2ffX|r", 150, 81, 1],
		["RT", 100, 56, 9],
		["RB", 100, 106, 10],
	]);
	for (const call of configure.mock.calls) {
		const slot = call.at(3);
		expect(call.at(4)).toBe(
			slot === -1 ? "slot-5-RING" : slot === 0 ? "slot-4-JUMP" : `slot-${slot}`,
		);
	}
	expect(indicators).toHaveLength(2);
	for (const indicator of indicators)
		expect(indicator.setBorder).toHaveBeenCalledWith([0.32, 0.6, 0.85, 1]);
	expect(indicators.at(0)?.layout).toHaveBeenCalledExactlyOnceWith(
		48,
		48,
		"BOTTOM",
		undefined,
		-100,
		106,
	);
	expect(indicators.at(0)?.setLabel).toHaveBeenCalledWith(
		"modifier",
		"LB\nCTRL",
	);
	expect(indicators.at(1)?.layout).toHaveBeenCalledExactlyOnceWith(
		48,
		48,
		"BOTTOM",
		undefined,
		-100,
		56,
	);
	expect(indicators.at(1)?.setLabel).toHaveBeenCalledWith(
		"modifier",
		"LT\nSHIFT",
	);
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
			"PADRTRIGGER",
			"PADRSHOULDER",
		].map((key) =>
			key === "PADDUP"
				? { key, target, prefixes: ["SHIFT-", "CTRL-", "CTRL-SHIFT-"] }
				: key === "PAD1"
					? { key, target, defaultCommand: "JUMP" }
					: { key, target },
		),
	);
	view.refresh();
	expect(refresh).toHaveBeenCalledTimes(10);
	view.destroy();
	expect(destroy).toHaveBeenCalledTimes(10);
	for (const indicator of indicators)
		expect(indicator.destroy).toHaveBeenCalledOnce();
});
