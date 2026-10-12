import { beforeEach, expect, it, vi } from "vitest";
import { AbilityRing } from "./ability-ring";

const { configure, refresh, destroy, setActions, target } = vi.hoisted(() => ({
	configure: vi.fn(),
	refresh: vi.fn(),
	destroy: vi.fn(),
	setActions: vi.fn(),
	target: { owner: {}, name: "AbilityRing" },
}));
vi.mock("../../ui/components/secure-radial-menu", () => ({
	SecureRadialMenu: class {
		configure = configure;
		refresh = refresh;
		destroy = destroy;
		setActions = setActions;
		getBindingTarget = () => target;
	},
}));
beforeEach(() => vi.clearAllMocks());

it("binds the three utility rings only to unmodified directions and releases them on shutdown", () => {
	const driver = {
		slots: [37, 40, 48],
		occupied: "query",
		position: "position",
	};
	const client = {
		bind: vi.fn(),
		read: vi.fn(() => ({ icon: 123 })),
		readRing: vi.fn(() => ({ icon: 123 })),
		canModify: () => true,
		getRingDriver: () => driver,
	};
	const ring = new AbilityRing({}, client);
	ring.initialize();
	ring.initialize();
	expect(configure).toHaveBeenCalledTimes(3);
	expect(configure).toHaveBeenCalledWith(
		"PADDUP",
		driver,
		expect.any(Function),
		"Right stick to select\nRelease ↑ to use",
		0.2,
	);
	for (const key of ["PADDUP", "PADDLEFT", "PADDRIGHT"])
		expect(client.bind).toHaveBeenCalledWith([{ key, target, prefixes: [""] }]);
	expect(configure.mock.calls.at(0)?.at(2)(40)).toEqual({ icon: 123 });
	expect(client.readRing).toHaveBeenCalledWith("abilities", 40);
	ring.refresh();
	expect(refresh).toHaveBeenCalledTimes(3);
	ring.destroy();
	ring.destroy();
	expect(destroy).toHaveBeenCalledTimes(3);
});

it("defers content changes in combat and avoids scanning sources on cooldown refresh", () => {
	let combat = false;
	const client = {
		bind: vi.fn(),
		canModify: () => !combat,
		getRingDriver: vi.fn(() => ({ slots: [], occupied: "", position: "" })),
		readRing: vi.fn(),
	};
	const rings = new AbilityRing({}, client);
	rings.initialize();
	client.getRingDriver.mockClear();
	rings.refresh();
	expect(client.getRingDriver).not.toHaveBeenCalled();
	combat = true;
	rings.refreshContents();
	expect(setActions).not.toHaveBeenCalled();
	combat = false;
	client.getRingDriver.mockReturnValue({
		slots: [1],
		occupied: "",
		position: "",
	});
	rings.refreshContents();
	expect(setActions).toHaveBeenCalledTimes(2);
	expect(client.getRingDriver.mock.calls.map((call) => call.at(0))).toEqual([
		"class",
		"utility",
	]);
});
