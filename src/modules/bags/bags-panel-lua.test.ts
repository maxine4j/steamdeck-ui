import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

// Compiles the whole addon; shared CI runners can exceed the unit-test timeout.
it("does not defer bag cleanup using a shared Lua loop counter", {
	timeout: 30_000,
}, () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
	const cleanup = lua.match(/local i = index\n[\s\S]*?local cursor = 0/)?.at(0);
	expect(cleanup).toBeDefined();
	// Lua 5.1 shares the while-loop counter across deferred callbacks, unlike JS.
	const callbacks = cleanup?.matchAll(
		/jobs\[#jobs \+ 1\] = function\(\)([\s\S]*?)\n {12}i = i \+ 1/g,
	);
	expect(callbacks).toBeDefined();
	const bodies = Array.from(callbacks ?? [], (match) => match.at(1));
	expect(bodies).toHaveLength(2);
	for (const body of bodies) {
		expect(body).not.toMatch(/__TS__ArrayAt\(self\.(?:headers|icons), i\)/);
	}
});
