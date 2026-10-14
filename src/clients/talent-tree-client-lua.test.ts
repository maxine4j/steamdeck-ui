import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

// JS returns an array in mocks; WoW returns separate width/height values.
it("retains both native dimensions when sizing the window before mounting", {
	timeout: 30_000,
}, () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
	const presentation = lua
		.match(
			/function TalentTreeClient.prototype.presentation[\s\S]*?function TalentTreeClient.prototype.resize/,
		)
		?.at(0);
	expect(presentation).toMatch(/local width, height = .*:GetSize\(\)/);
});
