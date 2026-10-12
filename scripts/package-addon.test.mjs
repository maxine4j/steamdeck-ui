import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";

test("packages all built files under SteamDeckUI and stamps only the packaged TOC", () => {
	const root = mkdtempSync(join(tmpdir(), "addon-test-"));
	try {
		const dist = join(root, "dist");
		mkdirSync(join(dist, "assets"), { recursive: true });
		writeFileSync(
			join(dist, "SteamDeckUI.toc"),
			"## Version: 0.0.1\nmain.lua\n",
		);
		writeFileSync(join(dist, "main.lua"), "print('addon')");
		writeFileSync(join(dist, "assets", "icon.txt"), "asset");
		const archive = join(root, "addon.zip");
		execFileSync("node", [
			"scripts/package-addon.mjs",
			dist,
			archive,
			"v1.2.3",
		]);
		const entries = execFileSync("unzip", ["-Z1", archive], {
			encoding: "utf8",
		});
		assert.ok(entries.includes("SteamDeckUI/main.lua\n"));
		assert.ok(entries.includes("SteamDeckUI/assets/icon.txt\n"));
		assert.equal(
			execFileSync("unzip", ["-p", archive, "SteamDeckUI/SteamDeckUI.toc"], {
				encoding: "utf8",
			}),
			"## Version: v1.2.3\nmain.lua\n",
		);
		assert.ok(
			readFileSync(join(dist, "SteamDeckUI.toc"), "utf8").includes("0.0.1"),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
