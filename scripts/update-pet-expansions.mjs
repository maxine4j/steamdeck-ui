import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// SimpleArmory records acquisition expansions. Other categories (profession,
// promotion, world event, etc.) do not establish an expansion and stay unknown.
const names = [
	"Classic",
	"The Burning Crusade",
	"Wrath of the Lich King",
	"Cataclysm",
	"Mists of Pandaria",
	"Warlords of Draenor",
	"Legion",
	"Battle for Azeroth",
	"Shadowlands",
	"Dragonflight",
	"The War Within",
	"Midnight",
];
const aliases = new Map([
	["Outland", 1],
	["Northrend", 2],
	["Pandaria", 4],
	["Draenor", 5],
	["Kalimdor", 0],
	["Eastern Kingdoms", 0],
]);
const groups = names.map(() => new Set());
const hashes = [];
for (const file of ["pets", "battlepets"]) {
	const path = `${process.argv[2] ?? ".libraries/SimpleArmory/static/data"}/${file}.json`;
	const source = await readFile(path, "utf8");
	hashes.push(
		`// ${file}.json SHA256: ${createHash("sha256").update(source).digest("hex")}`,
	);
	for (const group of JSON.parse(source)) {
		const index = names.indexOf(group.name);
		const expansion = index >= 0 ? index : aliases.get(group.name);
		if (expansion === undefined) continue;
		for (const category of group.subcats)
			for (const pet of category.items) {
				if (!Number.isInteger(pet.ID) || pet.ID <= 0)
					throw new Error("Invalid species ID");
				groups.at(expansion).add(pet.ID);
			}
	}
}
if (groups.some((group) => group.size === 0))
	throw new Error("Incomplete expansion metadata");
const lines = [
	"// Acquisition expansion facts from SimpleArmory static/data/pets.json and battlepets.json.",
	"// Source: https://github.com/SimpleArmory/SimpleArmory/tree/master/static/data",
	...hashes,
	"// Regenerate with node scripts/update-pet-expansions.mjs [SimpleArmory data directory].",
	"// Unknown species remain unknown; never guess from numeric ID ranges.",
	"const species: readonly (readonly number[])[] = [",
	...groups.map((group) => `[${[...group].sort((a, b) => a - b).join(", ")}],`),
	"];",
	"const expansions = new Map<number, number>();",
	"species.forEach((ids, expansion) => { for (const id of ids) expansions.set(id, expansion); });",
	"export function getPetExpansion(id: number): number | undefined { return expansions.get(id); }",
];
await writeFile(
	new URL("../src/clients/pet-expansions.ts", import.meta.url),
	`${lines.join("\n")}\n`,
);
console.log(
	`Updated ${groups.reduce((count, group) => count + group.size, 0)} species across ${groups.length} expansions.`,
);
