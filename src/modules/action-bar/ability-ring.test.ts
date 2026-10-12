import { expect, it, vi } from "vitest";
import { AbilityRing } from "./ability-ring";

const { configure, refresh, destroy, target } = vi.hoisted(() => ({
	configure: vi.fn(),
	refresh: vi.fn(),
	destroy: vi.fn(),
	target: { owner: {}, name: "AbilityRing" },
}));
vi.mock("../../ui/components/secure-radial-menu", () => ({
	SecureRadialMenu: class {
		configure = configure;
		refresh = refresh;
		destroy = destroy;
		getBindingTarget = () => target;
	},
}));

it("binds one ring to unmodified Up, delegates reads, and releases it on shutdown", () => {
	const driver = {
		slots: [37, 40, 48],
		occupied: "query",
		position: "position",
	};
	const client = {
		bind: vi.fn(),
		read: vi.fn(() => ({ icon: 123 })),
		getRingDriver: () => driver,
	};
	const ring = new AbilityRing({}, client);
	ring.initialize();
	ring.initialize();
	expect(configure).toHaveBeenCalledExactlyOnceWith(
		"PADDUP",
		driver,
		expect.any(Function),
		"Right stick to select\nRelease ↑ to use",
	);
	expect(client.bind).toHaveBeenCalledExactlyOnceWith([
		{ key: "PADDUP", target, prefixes: [""] },
	]);
	expect(configure.mock.calls.at(0)?.at(2)(40)).toEqual({ icon: 123 });
	expect(client.read).toHaveBeenCalledWith(40);
	ring.refresh();
	expect(refresh).toHaveBeenCalledOnce();
	ring.destroy();
	ring.destroy();
	expect(destroy).toHaveBeenCalledOnce();
});
