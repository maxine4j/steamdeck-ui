import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import luaparse from "luaparse";

const defaultPath =
	"/Applications/World of Warcraft/_retail_/WTF/Account/TIMOTHYANDSIMON/SavedVariables/SteamDeckUI-dev.lua";

// Lua strings contain UTF-8 bytes. Parse as bytes so decimal escapes and literal
// UTF-8 both decode consistently, including non-ASCII zone names and messages.
function value(node) {
	switch (node.type) {
		case "StringLiteral":
			return Buffer.from(node.value, "latin1").toString("utf8");
		case "NumericLiteral":
		case "BooleanLiteral":
			return node.value;
		case "NilLiteral":
			return null;
		case "UnaryExpression":
			if (node.operator === "-" && node.argument.type === "NumericLiteral")
				return -node.argument.value;
			break;
		case "TableConstructorExpression": {
			const table = Object.create(null);
			let index = 1;
			for (const field of node.fields) {
				const key =
					field.type === "TableValue"
						? index++
						: field.type === "TableKeyString"
							? field.key.name
							: value(field.key);
				if (typeof key !== "string" && typeof key !== "number")
					throw new Error("Unsupported table key");
				table[key] = value(field.value);
			}
			const keys = Object.keys(table);
			if (keys.length > 0 && keys.every((key, i) => key === String(i + 1)))
				return Object.values(table);
			return table;
		}
		default:
			break;
	}
	throw new Error(`Unsupported SavedVariables expression: ${node.type}`);
}

try {
	if (process.argv.length > 3)
		throw new Error("Usage: yarn debug:extract [SavedVariables.lua]");
	const source = resolve(process.argv[2] ?? defaultPath);
	const ast = luaparse.parse(readFileSync(source).toString("latin1"), {
		encodingMode: "pseudo-latin1",
		comments: false,
		luaVersion: "5.1",
	});
	const saved = Object.create(null);
	for (const statement of ast.body) {
		if (
			statement.type !== "AssignmentStatement" ||
			statement.variables.length !== 1 ||
			statement.variables[0].type !== "Identifier" ||
			statement.init.length !== 1
		)
			throw new Error("Expected a SavedVariables assignment");
		saved[statement.variables[0].name] = value(statement.init[0]);
	}
	const config = saved.SteamDeckUIConfig ?? null;
	if (config) delete config.collectionCache;
	// Lua serializes empty arrays and objects identically; restore known arrays.
	for (const [table, key] of [
		[saved.SteamDeckUIErrors, "errors"],
		[saved.SteamDeckUILogs, "entries"],
		[config, "currencyFavourites"],
	]) {
		if (table?.[key] && Object.keys(table[key]).length === 0) table[key] = [];
	}
	for (const error of saved.SteamDeckUIErrors?.errors ?? []) {
		const environment = error.environment;
		if (
			environment?.unavailableFields &&
			Object.keys(environment.unavailableFields).length === 0
		)
			environment.unavailableFields = [];
	}
	process.stdout.write(
		`${JSON.stringify(
			{
				source,
				fileModifiedAt: statSync(source).mtime.toISOString(),
				SteamDeckUIErrors: saved.SteamDeckUIErrors ?? null,
				SteamDeckUILogs: saved.SteamDeckUILogs ?? null,
				SteamDeckUIConfig: config,
			},
			null,
			2,
		)}\n`,
	);
} catch (error) {
	process.stderr.write(`Unable to extract diagnostics: ${error.message}\n`);
	process.exitCode = 1;
}
