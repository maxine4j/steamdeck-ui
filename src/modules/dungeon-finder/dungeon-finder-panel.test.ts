import { expect, it, vi } from "vitest";
import type { IDungeonFinderClient } from "../../clients/dungeon-finder-client";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { DungeonFinderPanel } from "./dungeon-finder-panel";

const { setRows } = vi.hoisted(() => ({ setRows: vi.fn() }));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		mount = vi.fn();
		unmount = vi.fn();
		setRows = setRows;
	},
}));

it("renders ordered sections with margins and selects a dungeon without joining immediately", () => {
	const callbacks: (() => void)[] = [];
	const client: IDungeonFinderClient = {
		getDungeons: () => [
			{ id: 1, name: "Normal", section: "normal", available: true },
			{ id: 2, name: "Heroic", section: "heroic", available: false },
			{ id: 3, name: "Timewalking", section: "special", available: true },
		],
		getSelected: () => 3,
		getRoles: () => ({
			leader: false,
			tank: false,
			healer: false,
			damage: true,
		}),
		toggleRole: vi.fn(),
		isQueued: () => false,
		select: vi.fn(),
		join: vi.fn(),
		leave: vi.fn(),
	};
	const panel = new DungeonFinderPanel(
		{} as IFramePoolManager,
		client,
		vi.fn(),
		{
			nextFrame: (callback) => {
				callbacks.push(callback);
				return vi.fn();
			},
		},
	);
	panel.onMount({} as IUIComponent);
	callbacks.shift()?.();
	const rows = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(rows.filter((row) => row.heading).map((row) => row.label)).toEqual([
		"Special events & Timewalking",
		"Heroic random",
		"Normal random",
		"Queue",
	]);
	expect(rows.find((row) => row.id === "dungeon-3")?.marginBottom).toBe(20);
	rows.find((row) => row.id === "dungeon-3")?.activate();
	expect(client.select).toHaveBeenCalledWith(3);
	expect(client.join).not.toHaveBeenCalled();
	rows.find((row) => row.id === "dungeon-2")?.activate();
	expect(client.select).toHaveBeenCalledTimes(1);
	rows.find((row) => row.id === "queue-action")?.activate();
	expect(client.join).toHaveBeenCalledOnce();
});
