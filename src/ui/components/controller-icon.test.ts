import { expect, it } from "vitest";
import { controllerIcon } from "./controller-icon";

it("renders the Steam button with the local Steam asset", () => {
	expect(controllerIcon("Steam")).toBe(
		"|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\steam_c_system.blp:18:18|t",
	);
});

it.each([
	["A", "xbox_r_a"],
	["B", "xbox_r_b"],
	["X", "xbox_r_x"],
	["Y", "xbox_r_y"],
	["LB", "xbox_s_lb"],
	["RB", "xbox_s_rb"],
	["LT", "xbox_s_lt"],
	["RT", "xbox_s_rt"],
	["Up", "all_l_up"],
	["Down", "all_l_down"],
	["Left", "all_l_left"],
	["Right", "all_l_right"],
] as const)("renders %s using ConsolePort's Deck fallback", (button, asset) => {
	expect(controllerIcon(button)).toBe(
		`|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\${asset}.blp:18:18|t`,
	);
});

it("shows all four D-pad directions for movement hints", () => {
	expect(controllerIcon("D-pad")).toBe(
		["up", "down", "left", "right"]
			.map(
				(direction) =>
					`|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\all_l_${direction}.blp:18:18|t`,
			)
			.join(""),
	);
});
