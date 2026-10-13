// ConsolePort's Steam Deck layout uses Xbox buttons and shared direction icons.
const assets = {
	Steam: "steam_c_system",
	A: "xbox_r_a",
	B: "xbox_r_b",
	X: "xbox_r_x",
	Y: "xbox_r_y",
	LB: "xbox_s_lb",
	RB: "xbox_s_rb",
	LT: "xbox_s_lt",
	RT: "xbox_s_rt",
	Up: "all_l_up",
	Down: "all_l_down",
	Left: "all_l_left",
	Right: "all_l_right",
} as const;

function texture(asset: string): string {
	return `|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\${asset}.blp:18:18|t`;
}

/** Inline textures for existing pooled labels; no native frames or addon dependency. */
export function controllerIcon(button: keyof typeof assets | "D-pad"): string {
	if (button === "D-pad")
		return ["up", "down", "left", "right"]
			.map((direction) => texture(`all_l_${direction}`))
			.join("");
	return texture(assets[button]);
}
