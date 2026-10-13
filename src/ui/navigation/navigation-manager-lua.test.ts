import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

// Node execution cannot catch an implicit Lua self shifting the event payload.
it("receives directional payloads in the same argument slot the event bus dispatches", {
	timeout: 30_000,
}, () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
	const parameters = lua
		.match(/self\.directionChanged = function\(([^)]*)\)/)
		?.at(1)
		?.split(",");
	expect(parameters).toHaveLength(1);
	const payload = parameters?.at(0)?.trim();
	expect(lua).toContain(`direction = ${payload}.direction`);
	expect(lua).toContain(`pressed = ${payload}.pressed`);
	expect(lua).toContain("handler(__TS__ArrayAt(args, 0))");
});
