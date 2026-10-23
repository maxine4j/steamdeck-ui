import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

function run(source) {
	const directory = mkdtempSync(join(tmpdir(), "sdui-debug-"));
	const path = join(directory, "Saved Variables.lua");
	try {
		if (source !== undefined) writeFileSync(path, source);
		return spawnSync(process.execPath, ["scripts/extract-debug.mjs", path], {
			encoding: "utf8",
		});
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

it("exports errors, context, logs and settings as JSON, without collection caches", () => {
	const result = run(`
SteamDeckUIConfig = { ["controllerOptions"] = { ["mode"] = "gamepad" }, ["collectionCache"] = { ["namespaces"] = {} } }
SteamDeckUIErrors = { ["version"] = 1, ["suppressedCount"] = 7, ["errors"] = {
 { ["id"] = 1, ["timestamp"] = 123, ["message"] = "bad \\"Lua\\"\\nCafé", ["stack"] = [=[first\nsecond]=], ["context"] = "NAV_INTERACT" },
} }
SteamDeckUILogs = { version = 1, entries = { [1] = "event MAIL_SHOW", [2] = "panel open" }, droppedCount = 5 }
`);
	expect(result.status).toBe(0);
	expect(result.stderr).toBe("");
	const data = JSON.parse(result.stdout);
	expect(data.SteamDeckUIErrors).toMatchObject({
		suppressedCount: 7,
		errors: [
			{
				message: 'bad "Lua"\nCafé',
				stack: "first\nsecond",
				context: "NAV_INTERACT",
			},
		],
	});
	expect(data.SteamDeckUILogs).toEqual({
		version: 1,
		entries: ["event MAIL_SHOW", "panel open"],
		droppedCount: 5,
	});
	expect(data.SteamDeckUIConfig).toEqual({
		controllerOptions: { mode: "gamepad" },
	});
	expect(data.source).toContain("Saved Variables.lua");
	expect(Number.isNaN(Date.parse(data.fileModifiedAt))).toBe(false);
});

it("exports per-error environment snapshots with empty unavailable-fields arrays", () => {
	const result = run(
		'SteamDeckUIErrors = { errors = { { environment = { buildCommit = "abc123", details = { zone = "Café" }, unavailableFields = {} } } } }',
	);
	expect(result.status).toBe(0);
	expect(
		JSON.parse(result.stdout).SteamDeckUIErrors.errors.at(0).environment,
	).toEqual({
		buildCommit: "abc123",
		details: { zone: "Café" },
		unavailableFields: [],
	});
});

it("handles old saves with missing logs, empty arrays, escaped bytes and CRLF", () => {
	const result = run(
		'SteamDeckUIErrors = { errors = {}, message = "\\195\\169", flag = false, offset = -2 }\r\n',
	);
	expect(result.status).toBe(0);
	expect(JSON.parse(result.stdout)).toMatchObject({
		SteamDeckUIErrors: { errors: [], message: "é", flag: false, offset: -2 },
		SteamDeckUILogs: null,
		SteamDeckUIConfig: null,
	});
});

it.each([
	undefined,
	"SteamDeckUIErrors = {",
	'SteamDeckUIErrors = os.execute("echo unsafe")',
	'print("unsafe")',
])(
	"fails with stderr and no partial JSON for missing, malformed or executable input: %s",
	(source) => {
		const result = run(source);
		expect(result.status).not.toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Unable to extract diagnostics:");
	},
);
