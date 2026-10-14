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

// Frame methods require self even when called through a navigation interface.
it("passes the viewport as self when scrolling upward out of its navigation nodes", {
	timeout: 30_000,
}, () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
	const move = lua
		.match(
			/function NavigationManager\.prototype\.move\(self, direction\)([\s\S]*?)\nend/,
		)
		?.at(1);
	expect(move).toBeDefined();
	// The caller supplies self; wrappers must consume it before the direction.
	expect(move).toMatch(/(\w+):scrollToEdge\(direction\)/);
	expect(lua).toContain(
		"function Frame.prototype.scrollToEdge(self, direction)",
	);
	const wrappers = Array.from(
		lua.matchAll(
			/self\.navigationScroll = \{scrollToEdge = function\(([^)]*)\)/g,
		),
		(match) =>
			match
				.at(1)
				?.split(",")
				.map((parameter) => parameter.trim()),
	);
	expect(wrappers).toHaveLength(4);
	for (const parameters of wrappers) {
		expect(parameters).toHaveLength(2);
		expect(parameters?.at(1)).toBe("direction");
	}
});
