import { writeFile } from "node:fs/promises";

// The journal API has no expansion field. Refresh verified mount ID facts from
// LiteMount's maintained metadata; do not classify unknown IDs by numeric range.
const path = "MountDB/Expansion.lua";
const response = await fetch(
	`https://api.github.com/repos/xod-wow/LiteMount/contents/${path}`,
);
if (!response.ok)
	throw new Error(`Metadata download failed: ${response.status}`);
const { content, sha } = await response.json();
const source = Buffer.from(content, "base64").toString("utf8");
const groups = new Map();
const seen = new Set();
let expansion;
for (const line of source.split("\n")) {
	const heading = line.match(/^\s*\[(\d+)\] = \{ -- /);
	if (heading) {
		expansion = Number(heading[1]);
		groups.set(expansion, []);
	}
	const entry = line.match(/^\s*\[\s*(\d+)\] = true,/);
	if (!entry) continue;
	const id = Number(entry[1]);
	if (expansion === undefined || seen.has(id))
		throw new Error(`Invalid or duplicate mount ${id}`);
	seen.add(id);
	groups.get(expansion).push(id);
}
if (groups.size < 12 || seen.size < 1400)
	throw new Error("Incomplete expansion metadata");
const lines = [
	"// Mount ID → expansion facts from LiteMount's MountDB/Expansion.lua.",
	"// Source: https://github.com/xod-wow/LiteMount/blob/main/MountDB/Expansion.lua",
	`// Snapshot blob: ${sha} (${new Date().toISOString().slice(0, 10)}).`,
	"// Regenerate with node scripts/update-mount-expansions.mjs.",
	"// Unknown IDs remain unknown; they are never guessed from ID ranges.",
	"const expansionMounts: readonly (readonly number[])[] = [",
];
for (const [id, mounts] of groups) {
	if (id !== [...groups.keys()].indexOf(id))
		throw new Error("Non-contiguous expansion IDs");
	lines.push(`\t[ // Expansion ${id}`);
	for (let i = 0; i < mounts.length; i += 12)
		lines.push(`\t\t${mounts.slice(i, i + 12).join(", ")},`);
	lines.push("\t],");
}
lines.push(
	"];",
	"const expansions = new Map<number, number>();",
	"expansionMounts.forEach((mounts, expansion) => {",
	"\tfor (const id of mounts) expansions.set(id, expansion);",
	"});",
	"export function getMountExpansion(id: number): number | undefined {",
	"\treturn expansions.get(id);",
	"}",
);
await writeFile(
	new URL("../src/clients/mount-expansions.ts", import.meta.url),
	`${lines.join("\n")}\n`,
);
console.log(
	`Updated ${seen.size} mounts across ${groups.size} expansions (${sha}).`,
);
