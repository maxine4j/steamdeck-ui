import { afterEach, expect, it, vi } from "vitest";
import { SavedLogHistory } from "./saved-log-history";

afterEach(() => vi.unstubAllGlobals());

it("retains loaded logs across sessions and evicts oldest entries within count and character budgets", () => {
	vi.stubGlobal("SteamDeckUILogs", undefined);
	const history = new SavedLogHistory(3, 12);
	history.append("first");
	history.append("second");
	const reloaded = new SavedLogHistory(3, 12);
	reloaded.append("third");
	expect(SteamDeckUILogs).toMatchObject({
		version: 1,
		entries: ["second", "third"],
		droppedCount: 1,
	});
	reloaded.append("fourth");
	reloaded.append("fifth");
	expect(SteamDeckUILogs?.entries).toEqual(["fourth", "fifth"]);
	expect(SteamDeckUILogs?.droppedCount).toBe(3);
});

it("bounds individual entries and count independently, including a loaded oversized history", () => {
	vi.stubGlobal("SteamDeckUILogs", {
		version: 1,
		entries: ["a", "b", "c"],
		droppedCount: 0,
	});
	const history = new SavedLogHistory(2, 20);
	history.append("d");
	expect(SteamDeckUILogs?.entries).toEqual(["c", "d"]);
	history.append("x".repeat(30));
	expect(SteamDeckUILogs?.entries).toEqual(["x".repeat(20)]);
	expect(SteamDeckUILogs?.droppedCount).toBe(4);
});
