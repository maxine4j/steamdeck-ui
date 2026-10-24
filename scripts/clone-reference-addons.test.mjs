import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "vitest";

test("clones the additional addon references once and removes their Git metadata", () => {
	const root = mkdtempSync(join(tmpdir(), "reference-addons-test-"));
	const script = resolve("scripts/clone-reference-addons.sh");
	const references = [
		["0xbs/premade-groups-filter", "PremadeGroupsFilter"],
		["klaufel/ItemEra", "ItemEra"],
		["ahakola/AlreadyKnown", "AlreadyKnown"],
		["Peterodox/Plumber", "Plumber"],
		["typicalzergling/vendor", "Vendor"],
		["Adaptvx/Waypoint-UI", "WaypointUI"],
	];
	try {
		for (const name of [
			"ConsolePort",
			"BetterBags",
			"BugSack",
			"DialogueUI",
			"SimpleArmory",
			"wow-ui-source",
			"BugGrabber-source",
		]) {
			mkdirSync(join(root, ".libraries", name), { recursive: true });
		}
		for (const name of [
			"BugGrabber.lua",
			"!BugGrabber.toc",
			"load.xml",
			".pkgmeta",
			".luacheckrc",
		]) {
			writeFileSync(join(root, ".libraries/BugGrabber-source", name), "cached");
		}
		mkdirSync(join(root, "bin"));
		writeFileSync(
			join(root, "bin/git"),
			'#!/usr/bin/env bash\nset -eu\nprintf "%s\\n" "$*" >> "$REFERENCE_CLONE_LOG"\nmkdir -p "$5/.git"\n',
			{ mode: 0o755 },
		);
		const log = join(root, "clones.log");
		writeFileSync(log, "");
		const options = {
			cwd: root,
			env: {
				...process.env,
				PATH: `${join(root, "bin")}:${process.env.PATH}`,
				REFERENCE_CLONE_LOG: log,
			},
		};
		execFileSync("bash", [script], options);
		const clones = readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
		assert.equal(clones.length, references.length);
		for (const [repository, destination] of references) {
			assert.ok(
				clones.includes(
					`clone --depth 1 https://github.com/${repository} .libraries/${destination}`,
				),
			);
			assert.ok(existsSync(join(root, ".libraries", destination)));
			assert.ok(!existsSync(join(root, ".libraries", destination, ".git")));
		}
		execFileSync("bash", [script], options);
		assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), clones);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
