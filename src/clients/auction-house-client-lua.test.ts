import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

// ItemLocation is a FrameXML mixin; omitting self shifts both bag coordinates.
it("preserves native bag locations and auction update payloads in Lua", {
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
	expect(
		/ItemLocation(?::CreateFromBagAndSlot\(slot\.bagId, slot\.slotId\)|\.CreateFromBagAndSlot\(ItemLocation, slot\.bagId, slot\.slotId\))/.test(
			lua,
		),
	).toBe(true);
	const module = lua
		.split('["src.modules.auction-house.auction-house-module"] = function(...)')
		.at(1)
		?.split("\n end,")
		.at(0);
	expect(module).toBeDefined();
	// The bus calls handler(payload); an implicit self would consume the payload.
	expect(
		module
			?.match(/self\.changed = function\(([^)]*)\)/)
			?.at(1)
			?.split(","),
	).toHaveLength(1);
	expect(lua).toContain("handler(__TS__ArrayAt(args, 0))");
});
