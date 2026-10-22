import { afterEach, expect, it, vi } from "vitest";
import { SkyridingClient } from "./skyriding-client";

afterEach(() => vi.unstubAllGlobals());

function setup(gliding = true, canGlide = true, mounted = true) {
	vi.stubGlobal("C_PlayerInfo", {
		GetGlidingInfo: () => [gliding, canGlide, 72],
	});
	vi.stubGlobal("IsMounted", () => mounted);
	vi.stubGlobal("GetInstanceInfo", () => ["", "", 0, "", 0, 0, false, 2601]);
	vi.stubGlobal("C_UnitAuras", { GetPlayerAuraBySpellID: () => undefined });
	vi.stubGlobal("C_Secrets", { ShouldSpellCooldownBeSecret: () => false });
	return new SkyridingClient();
}

it("reads forward speed with reduced cruising and boost limits outside the Dragon Isles", () => {
	expect(setup().read()).toEqual({
		active: true,
		speed: 72,
		cruisingSpeed: 55.25,
		maximumSpeed: 85,
	});
});

it.each([2444, 2454, 2548, 2549, 2516])(
	"uses the full speed range in instance %i",
	(instance) => {
		const client = setup();
		vi.stubGlobal("GetInstanceInfo", () => [
			"",
			"",
			0,
			"",
			0,
			0,
			false,
			instance,
		]);
		expect(client.read()).toMatchObject({
			cruisingSpeed: 65,
			maximumSpeed: 100,
		});
	},
);

it("uses full speed during a dragon race outside the Dragon Isles", () => {
	const client = setup();
	vi.stubGlobal("C_UnitAuras", {
		GetPlayerAuraBySpellID: (id: number) => (id === 369968 ? {} : undefined),
	});
	expect(client.read().maximumSpeed).toBe(100);
});

it("does not inspect a protected race aura", () => {
	const client = setup();
	const aura = vi.fn();
	vi.stubGlobal("C_Secrets", { ShouldSpellCooldownBeSecret: () => true });
	vi.stubGlobal("C_UnitAuras", { GetPlayerAuraBySpellID: aura });
	expect(client.read().maximumSpeed).toBe(85);
	expect(aura).not.toHaveBeenCalled();
});

it.each([
	[false, true, true],
	[true, false, true],
	[true, true, false],
])(
	"hides for grounded, steady flight, falling, and unmounted states (%j)",
	(gliding, canGlide, mounted) => {
		expect(setup(gliding, canGlide, mounted).read().active).toBe(false);
	},
);
