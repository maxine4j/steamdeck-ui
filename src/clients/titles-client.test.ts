import { afterEach, expect, it, vi } from "vitest";
import { TitlesClient } from "./titles-client";

afterEach(() => vi.unstubAllGlobals());
it("lists only earned player titles sorted by name, includes None and validates selection", () => {
	const count = vi.fn(() => 3);
	vi.stubGlobal("GetNumTitles", count);
	vi.stubGlobal("IsTitleKnown", (id: number) => id !== 2);
	vi.stubGlobal("GetTitleName", (id: number) => [
		id === 1 ? " Zulu " : " Alpha ",
		true,
	]);
	vi.stubGlobal("GetCurrentTitle", () => 1);
	const select = vi.fn();
	vi.stubGlobal("SetCurrentTitle", select);
	const client = new TitlesClient();
	expect(client.getTitles()).toEqual([
		{ id: -1, name: "None", selected: false },
		{ id: 3, name: "Alpha", selected: false },
		{ id: 1, name: "Zulu", selected: true },
	]);
	expect(count).toHaveBeenCalledOnce();
	client.select(2);
	expect(select).not.toHaveBeenCalled();
	client.select(3);
	client.select(-1);
	expect(select.mock.calls).toEqual([[3], [-1]]);
});
