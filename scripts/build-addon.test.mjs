import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "vitest";

test("packages textures and TOC for the selected addon directory across build modes", () => {
	const root = mkdtempSync(join(tmpdir(), "addon-build-test-"));
	try {
		mkdirSync(join(root, "bin"));
		mkdirSync(join(root, "assets"));
		mkdirSync(join(root, "assets", "controller"));
		const texturePaths = [
			"controller\\\\xbox_r_a.blp",
			"Jump.png",
			"Target_Wide_Enemy.png",
			"xbox_s_lt.blp",
		];
		const assetLua = texturePaths
			.map(
				(path) =>
					`print("Interface\\\\AddOns\\\\SteamDeckUI\\\\assets\\\\${path}")`,
			)
			.join("\n");
		const unrelatedLua = '\nprint("SteamDeckUI")';
		const lua = assetLua + unrelatedLua;
		writeFileSync(join(root, "compiled.lua"), lua);
		writeFileSync(join(root, "assets", "controller", "xbox_r_a.blp"), "icon");
		writeFileSync(
			join(root, "bin", "yarn"),
			"#!/usr/bin/env bash\ncp compiled.lua dist/main.lua\n",
			{
				mode: 0o755,
			},
		);
		writeFileSync(
			join(root, "SteamDeckUI.toc"),
			"## Title: SteamDeckUI\n## Version: 0.0.1\nmain.lua\n",
		);
		writeFileSync(join(root, "LICENSE"), "license");
		writeFileSync(join(root, "README.md"), "readme");
		const script = resolve("scripts/build-addon.sh");
		const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
		for (const command of ["build:release", "build", "build:release"]) {
			const args = scripts[command].split(" ").slice(1);
			execFileSync("bash", [script, ...args], {
				cwd: root,
				env: {
					...process.env,
					PATH: `${join(root, "bin")}:${process.env.PATH}`,
				},
			});
			const name = command === "build" ? "SteamDeckUI-dev" : "SteamDeckUI";
			const other = command === "build" ? "SteamDeckUI" : "SteamDeckUI-dev";
			assert.equal(
				readFileSync(join(root, "dist", `${name}.toc`), "utf8"),
				`## Title: ${name}\n## Version: 0.0.1\nmain.lua\n`,
			);
			assert.equal(
				readFileSync(join(root, "SteamDeckUI.toc"), "utf8"),
				"## Title: SteamDeckUI\n## Version: 0.0.1\nmain.lua\n",
			);
			assert.equal(existsSync(join(root, "dist", `${other}.toc`)), false);
			assert.equal(
				readFileSync(join(root, "dist", "main.lua"), "utf8"),
				assetLua.replaceAll("SteamDeckUI", name) + unrelatedLua,
			);
			assert.equal(
				readFileSync(
					join(root, "dist", "assets", "controller", "xbox_r_a.blp"),
					"utf8",
				),
				"icon",
			);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
