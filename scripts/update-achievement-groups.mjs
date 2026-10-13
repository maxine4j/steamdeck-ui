import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// Run from the repository root: node scripts/update-achievement-groups.mjs | apply_patch
// Then format achievement-groups.ts with Biome. Only classification is copied.
const root = new URL("../.libraries/SimpleArmory/", import.meta.url);
const source = await readFile(
	new URL("static/data/achievements.json", root),
	"utf8",
);
const license = await readFile(new URL("LICENSE", root), "utf8");
const definitions = JSON.parse(source).supercats.flatMap((category) =>
	category.cats.flatMap((section) =>
		section.subcats.map((group) => ({
			category: category.name,
			section: section.name,
			name: group.name.trim() || "General",
			ids: group.items.map((item) => item.id),
		})),
	),
);
const lines = [
	"// SimpleArmory completion groups; regenerate with scripts/update-achievement-groups.mjs.",
	"// Source: https://github.com/kevinclement/SimpleArmory (static/data/achievements.json).",
	`// Snapshot SHA-256: ${createHash("sha256").update(source).digest("hex")}.`,
	"// Classification only. Live game APIs own presence, names and completion.",
	"/*",
	license.trim(),
	"*/",
	"export const achievementGroups: readonly {",
	"\tcategory: string; section: string; name: string; ids: readonly number[];",
	"}[] = [",
	...definitions.map((group) => `\t${JSON.stringify(group)},`),
	"];",
];
console.log(
	"*** Begin Patch\n*** Add File: src/modules/achievements/achievement-groups.ts\n" +
		lines
			.join("\n")
			.split("\n")
			.map((line) => `+${line}`)
			.join("\n") +
		"\n*** End Patch",
);
