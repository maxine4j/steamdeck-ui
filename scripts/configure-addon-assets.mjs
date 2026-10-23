import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [bundle, addonName] = process.argv.slice(2);
if (!bundle || !["SteamDeckUI", "SteamDeckUI-dev"].includes(addonName))
	throw new Error(
		"Usage: node scripts/configure-addon-assets.mjs <bundle.lua> <SteamDeckUI|SteamDeckUI-dev>",
	);

// TSTL escapes backslashes in Lua string literals. Specialize only our asset root.
const assetRoot = "Interface\\\\AddOns\\\\SteamDeckUI\\\\assets\\\\";
const repository = fileURLToPath(new URL("../", import.meta.url));
const git = (args) =>
	execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
const revision = git(["rev-parse", "--short=12", "HEAD"]);
const dirty = git(["status", "--porcelain"]).length > 0;
writeFileSync(
	bundle,
	readFileSync(bundle, "utf8")
		.replaceAll(
			"__STEAMDECKUI_BUILD_COMMIT__",
			`${revision}${dirty ? "-dirty" : ""}`,
		)
		.replaceAll(assetRoot, `Interface\\\\AddOns\\\\${addonName}\\\\assets\\\\`),
);
