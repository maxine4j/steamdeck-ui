import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

// Node cannot reproduce Lua's implicit self shifting a callback payload.
it("receives native quest details in the event bus payload argument", {
	timeout: 30_000,
}, () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics
			.filter((diagnostic) => diagnostic.category === 1)
			.map((diagnostic) => diagnostic.messageText),
	).toEqual([]);
	const module = lua
		.split('["src.modules.map.map-module"] = function(...)')
		.at(1)
		?.split("\n end,")
		.at(0);
	expect(module).toBeDefined();
	const parameters = module
		?.match(/self\.details = function\(([^)]*)\)/)
		?.at(1)
		?.split(",");
	expect(parameters).toHaveLength(1);
	expect(lua).toContain("handler(__TS__ArrayAt(args, 0))");
});
