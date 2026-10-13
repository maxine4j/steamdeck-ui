import { readFileSync, writeFileSync } from "node:fs";

const [bundle, addonName] = process.argv.slice(2);
if (!bundle || !["SteamDeckUI", "SteamDeckUI-dev"].includes(addonName))
	throw new Error(
		"Usage: node scripts/configure-addon-assets.mjs <bundle.lua> <SteamDeckUI|SteamDeckUI-dev>",
	);

// TSTL escapes backslashes in Lua string literals. Specialize only our asset root.
const assetRoot = "Interface\\\\AddOns\\\\SteamDeckUI\\\\assets\\\\";
writeFileSync(
	bundle,
	readFileSync(bundle, "utf8").replaceAll(
		assetRoot,
		`Interface\\\\AddOns\\\\${addonName}\\\\assets\\\\`,
	),
);
