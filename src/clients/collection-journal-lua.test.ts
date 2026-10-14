import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

it("forwards collection page reads, results and numeric progress without implicit self arguments", {
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
	const start = lua
		.match(
			/function CollectionJournal\.prototype\.start\(self\)([\s\S]*?)\nend/,
		)
		?.at(1);
	expect(start).toBeDefined();
	expect(start).toContain("observer(index, reader.count)");
	expect(start).not.toMatch(/observer\(self,/);
	expect(start).not.toMatch(/page\.read\(page,/);
	const load = lua
		.match(
			/function CollectionJournal\.prototype\.load\(self, done, progress\)([\s\S]*?)\nend/,
		)
		?.at(1);
	expect(load).toBeDefined();
	expect(load).toContain("done(");
	expect(load).not.toContain("done(self,");
	expect(load).toContain("progress(completed, total)");
});
