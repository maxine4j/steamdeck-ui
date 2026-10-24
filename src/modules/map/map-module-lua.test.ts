import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

// Node callbacks do not reproduce Lua's implicit self argument.
it("passes the requested quest focus as the container callback's first argument", {
	timeout: 30_000,
}, () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
	const render = lua
		.match(/function MapPanel\.prototype\.render\(self\)([\s\S]*?)\nend/)
		?.at(1);
	expect(render).toBeDefined();
	// Both the details grid and quest list restore focus through this boundary.
	const callbacks = Array.from(
		render?.matchAll(/local (\w+) = self\.navigationChanged/g) ?? [],
		(match) => match.at(1),
	);
	expect(callbacks).toHaveLength(2);
	for (const callback of callbacks) {
		expect(render).toContain(`${callback}(self.section == "map"`);
	}
});

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
