import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

it("passes the captured controller chord as the first Lua callback argument", {
	timeout: 30_000,
}, () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
	const capture = lua
		.match(
			/function ControllerInputClient.prototype.captureUp[\s\S]*?function ControllerInputClient.prototype.releaseDirections/,
		)
		?.at(0);
	expect(capture).toContain("self.capture(key)");
	expect(capture).toContain("self.capture(button)");
	expect(capture).not.toContain("self:capture(");
});
