import { transpileProject } from "typescript-to-lua";
import { expect, it } from "vitest";

it("keeps startup's captured module locals within WoW's 60-upvalue limit", {
	timeout: 30_000,
}, () => {
	let lua = "";
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
	const module = lua
		.split('["src.start"] = function(...)')
		.at(1)
		?.split("\n end,")
		.at(0);
	expect(module).toBeDefined();
	const declaration = "function ____exports.startSteamDeckUI(";
	const boundary = module?.indexOf(declaration) ?? -1;
	expect(boundary).toBeGreaterThan(0);
	const bindings = Array.from(
		module
			?.slice(0, boundary)
			.matchAll(/^local (?:function )?(\w+)(?: =|\()/gm) ?? [],
		(match) => match.at(1) ?? "",
	);
	const body =
		module
			?.slice(boundary + declaration.length)
			.split("\nreturn ____exports")
			.at(0) ?? "";
	// References in nested callbacks also require the enclosing function to capture them.
	const captured = bindings.filter((name) =>
		new RegExp(`\\b${name}\\b`).test(body),
	);
	expect(
		captured.length,
		`Startup captures: ${captured.join(", ")}`,
	).toBeLessThanOrEqual(60);
});
