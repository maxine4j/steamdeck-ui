import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("embeds the repository's short commit and dirty state into the compiled diagnostics", () => {
	const directory = mkdtempSync(join(tmpdir(), "sdui-version-"));
	try {
		const bundle = join(directory, "main.lua");
		writeFileSync(bundle, 'local revision = "__STEAMDECKUI_BUILD_COMMIT__"');
		execFileSync(process.execPath, [
			"scripts/configure-addon-assets.mjs",
			bundle,
			"SteamDeckUI-dev",
		]);
		const hash = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
			encoding: "utf8",
		}).trim();
		expect(readFileSync(bundle, "utf8")).toContain(hash);
		expect(readFileSync(bundle, "utf8")).not.toContain(
			"__STEAMDECKUI_BUILD_COMMIT__",
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
