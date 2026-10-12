import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

it("compiles the cross-bar reader with the same Lua calling convention as its caller", () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
	// Node tests cannot detect an extra implicit self parameter in compiled Lua.
	const readerParameters = lua.match(/self\.read = function\(([^)]*)\)/)?.at(1);
	expect(readerParameters).toBe("slot");
	expect(lua).toContain("local visual = read(slot)");
});
