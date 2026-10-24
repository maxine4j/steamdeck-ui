import { transpileProject } from "typescript-to-lua";
import { beforeAll, expect, it } from "vitest";

let lua = "";
beforeAll(() => {
	const result = transpileProject("tsconfig.json", {}, (name, content) => {
		if (name.endsWith("main.lua")) lua = content;
	});
	expect(
		result.diagnostics.filter((diagnostic) => diagnostic.category === 1),
	).toEqual([]);
}, 30_000);

function implementation(name: string): string {
	const start = lua.indexOf(`function ${name}.prototype.____constructor(`);
	expect(start).toBeGreaterThan(-1);
	return lua.slice(start).split("\n end,").at(0) ?? "";
}

// Node callbacks hide Lua's implicit self argument. Check the emitted calls.
it("delivers preferred focus to the container in its first callback argument", () => {
	const mount = lua
		.match(
			/function PanelContainer\.prototype\.mount\(self, panel\)([\s\S]*?)\nend/,
		)
		?.at(1);
	expect(mount).toContain("function(focusId)");
	expect(mount).toContain(":refreshGrid(self.id, focusId)");
});

it("passes achievement selection targets without a panel argument", () => {
	expect(
		implementation("AchievementsPanel")
			.match(
				/local (\w+) = self.navigationChanged[\s\S]{0,200}?\1\(\s*"achievement-" \.\. tostring\(achievement.id\)/,
			)
			?.at(0),
	).toBeDefined();
});

it("refreshes mount actions without replacing the current focus with the panel", () => {
	const render = lua
		.match(
			/function MountsPanel\.prototype\.render\(self[^)]*\)([\s\S]*?)\nend/,
		)
		?.at(1);
	expect(render).toBeDefined();
	const callback = render?.match(/local (\w+) = self.navigationChanged/)?.at(1);
	expect(callback).toBeDefined();
	expect(render).toContain(`${callback}()`);
});

it("uses the same payload-only dispatch for every panel and collection dropdown", () => {
	const panels = Array.from(
		lua.matchAll(/function (\w+)\.prototype\.setNavigationChanged\(/g),
		(match) => match.at(1) ?? "",
	);
	expect(panels.length).toBeGreaterThan(20);
	for (const name of [...panels, "Dropdown"]) {
		const source = implementation(name);
		const callbacks = Array.from(
			source.matchAll(/local (\w+) = self\.(?:navigationChanged|changed)\n/g),
			(match) => match.at(1),
		);
		expect(
			callbacks.length > 0 || source.includes("self.navigationChanged("),
			name,
		).toBe(true);
		expect(source.includes("self:navigationChanged("), name).toBe(false);
		for (const callback of callbacks) {
			expect(
				new RegExp(`${callback}\\(\\s*self\\s*[,)]`).test(source),
				`${name} dispatches ${callback} without self`,
			).toBe(false);
		}
	}
});
