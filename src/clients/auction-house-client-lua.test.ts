import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

// ItemLocation is a FrameXML mixin; omitting self shifts both bag coordinates.
it("passes the ItemLocation receiver when constructing a bag slot in Lua", {
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
});
