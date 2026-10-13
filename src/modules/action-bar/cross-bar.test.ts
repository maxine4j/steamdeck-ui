import { expect, it, vi } from "vitest";
import { CrossBar } from "./cross-bar";

const { configure, refresh, destroy, setSpell, target, indicators } =
	vi.hoisted(() => ({
		configure: vi.fn(),
		refresh: vi.fn(),
		destroy: vi.fn(),
		setSpell: vi.fn(),
		target: { owner: {}, name: "CrossButton" },
		indicators: [] as {
			id: string;
			layout: ReturnType<typeof vi.fn>;
			setLabel: ReturnType<typeof vi.fn>;
			setIcon: ReturnType<typeof vi.fn>;
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
		setIcon = vi.fn();
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
		setSpell = setSpell;
	},
}));

it("keeps LB and RT on reserved slots and displays unbound LT and RB icons", () => {
	const client = {
		bind: vi.fn(),
		read: vi.fn(() => ({})),
		getSlotDriver: (slot: number, command?: string) =>
			command ? `slot-${slot}-${command}` : `slot-${slot}`,
	};
	const view = new CrossBar({}, client);
	view.initialize();
	view.initialize();
	expect(setSpell).not.toHaveBeenCalled();
	expect(configure).toHaveBeenCalledTimes(10);
	expect(
		configure.mock.calls.map(([label, x, y, slot]) => [label, x, y, slot]),
	).toEqual([
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\all_l_up.blp:18:18|t",
			-200,
			106,
			-1,
		],
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\all_l_right.blp:18:18|t",
			-150,
			81,
			-1,
		],
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\all_l_down.blp:18:18|t",
			-200,
			56,
			-3,
		],
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\all_l_left.blp:18:18|t",
			-250,
			81,
			-1,
		],
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\xbox_r_y.blp:18:18|t",
			200,
			106,
			2,
		],
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\xbox_r_b.blp:18:18|t",
			250,
			81,
			3,
		],
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\xbox_r_a.blp:18:18|t",
			200,
			56,
			0,
		],
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\xbox_r_x.blp:18:18|t",
			150,
			81,
			1,
		],
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\xbox_s_rt.blp:18:18|t",
			100,
			56,
			156,
		],
		[
			"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\xbox_s_lb.blp:18:18|t",
			-100,
			106,
			155,
		],
	]);
	expect(configure.mock.calls.map((call) => call.at(4))).toEqual([
		"slot-5-RING",
		"slot-6-RING",
		"slot-7-MOUNT",
		"slot-8-RING",
		"slot-2",
		"slot-3",
		"slot-4-JUMP",
		"slot-1",
		"slot-156-FIXED",
		"slot-155-FIXED",
	]);
	expect(indicators).toHaveLength(2);
	expect(indicators.at(1)?.id).toBe("cross-bar-PADRSHOULDER");
	expect(indicators.at(1)?.layout).toHaveBeenCalledExactlyOnceWith(
		48,
		48,
		"BOTTOM",
		undefined,
		100,
		106,
	);
	expect(indicators.at(1)?.setIcon).toHaveBeenCalledWith(
		"Interface\\AddOns\\SteamDeckUI\\assets\\Target_Wide_Enemy.png",
		false,
	);
	expect(indicators.at(1)?.setLabel).toHaveBeenCalledWith(
		"modifier",
		"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\xbox_s_rb.blp:18:18|t",
	);
	for (const indicator of indicators)
		expect(indicator.setBorder).toHaveBeenCalledWith([0.32, 0.6, 0.85, 1]);
	expect(indicators.at(0)?.layout).toHaveBeenCalledExactlyOnceWith(
		48,
		48,
		"BOTTOM",
		undefined,
		-100,
		56,
	);
	expect(indicators.at(0)?.setIcon).toHaveBeenCalledWith(
		"Interface\\AddOns\\SteamDeckUI\\assets\\xbox_s_lt.blp",
		false,
	);
	expect(indicators.at(0)?.setLabel).not.toHaveBeenCalled();
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
			"PADLSHOULDER",
		].map((key) =>
			["PADDUP", "PADDLEFT", "PADDRIGHT"].includes(key)
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
