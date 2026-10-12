import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

// Node tests cannot detect an extra implicit self argument in compiled Lua.
it("forwards journal results, previews and numeric progress without shifting callback arguments", {
	timeout: 30_000,
}, () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
	const start = lua
		.match(/function JournalPrefetch\.prototype\.start\(self\)([\s\S]*?)\nend/)
		?.at(1);
	expect(start).toBeDefined();
	expect(start).toContain("observer.done(value)");
	expect(start).not.toMatch(/____opt_\d+\(observer,/);
	expect(start).toMatch(/____opt_\d+\(value\)/);
	expect(start).toMatch(/____opt_\d+\(completed, total\)/);
});
