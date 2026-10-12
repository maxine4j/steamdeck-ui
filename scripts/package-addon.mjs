import { execFileSync } from "node:child_process";
import {
	cpSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [dist, archive, version] = process.argv.slice(2);
if (!dist || !archive || !version || /[\r\n]/.test(version)) {
	throw new Error(
		"Usage: node scripts/package-addon.mjs <dist> <archive.zip> <version>",
	);
}
const staging = mkdtempSync(join(tmpdir(), "steamdeck-release-"));
try {
	const addon = join(staging, "SteamDeckUI");
	cpSync(resolve(dist), addon, { recursive: true });
	const toc = join(addon, "SteamDeckUI.toc");
	const source = readFileSync(toc, "utf8");
	if (!/^## Version:.*$/m.test(source))
		throw new Error("TOC has no version field");
	writeFileSync(
		toc,
		source.replace(/^## Version:.*$/m, () => `## Version: ${version}`),
	);
	// Remove an existing archive so zip cannot retain stale files on a rerun.
	rmSync(resolve(archive), { force: true });
	execFileSync("zip", ["-qr", resolve(archive), "SteamDeckUI"], {
		cwd: staging,
	});
} finally {
	rmSync(staging, { recursive: true, force: true });
}
