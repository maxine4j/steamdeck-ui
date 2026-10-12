import { expect, it, vi } from "vitest";
import type { IDungeonFinderClient } from "../../clients/dungeon-finder-client";
import { Frame } from "../../ui/components/frame";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { DungeonFinderPanel } from "./dungeon-finder-panel";

const { setRows, frames, listOptions, checkboxes } = vi.hoisted(() => ({
	setRows: vi.fn(),
	frames: new Map<
		string,
		{ layout: ReturnType<typeof vi.fn>; setLabel: ReturnType<typeof vi.fn> }
	>(),
	listOptions: vi.fn(),
	checkboxes: new Map<
		string,
		{ setChecked: ReturnType<typeof vi.fn>; mount: ReturnType<typeof vi.fn> }
	>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		layout = vi.fn();
		setLabel = vi.fn();
		fill = vi.fn();
		setBlackBackground = vi.fn();
		setParent = vi.fn();
		setColor = vi.fn();
		setBorder = vi.fn();
		onClick = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		constructor(id: string) {
			frames.set(id, this);
		}
		navigationNode(navId: string, onInteract: () => void) {
			return { navId, onInteract, onFocus: vi.fn(), onBlur: vi.fn() };
		}
	},
}));
vi.mock("../../ui/components/icon-checkbox", () => ({
	IconCheckbox: class {
		setChecked = vi.fn();
		mount = vi.fn();
		unmount = vi.fn();
		destroy = vi.fn();
		constructor(
			public readonly navId: string,
			_pool: unknown,
			_label: string,
			_icon: string,
			public readonly onInteract: () => void,
		) {
			checkboxes.set(navId, this);
		}
	},
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		constructor(
			_id: string,
			_pool: unknown,
			_title: string,
			_close: unknown,
			options: unknown,
		) {
			listOptions(options);
		}
		mount = vi.fn();
		unmount = vi.fn();
		setRows = setRows;
		getNavGrid = () => [[{ navId: "dungeon-3", onInteract: vi.fn() }]];
	},
}));

function setup(queued = false) {
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
		isQueued: () => queued,
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
	panel.onMount(new Frame("parent", {} as IFramePoolManager));
	callbacks.shift()?.();
	const rows = setRows.mock.lastCall?.at(0) as ListRow[];
	return { panel, client, rows, callbacks };
}

it("renders ordered sections and selects available dungeons without joining", () => {
	const { rows, client } = setup();
	expect(rows.filter((row) => row.heading).map((row) => row.label)).toEqual([
		"Special events & Timewalking",
		"Heroic random",
		"Normal random",
	]);
	expect(rows.find((row) => row.id === "dungeon-3")?.marginBottom).toBe(20);
	rows.find((row) => row.id === "dungeon-3")?.activate();
	expect(client.select).toHaveBeenCalledWith(3);
	expect(client.join).not.toHaveBeenCalled();
	rows.find((row) => row.id === "dungeon-2")?.activate();
	expect(client.select).toHaveBeenCalledTimes(1);
});

it("pins four horizontal icon checkboxes above the scrolling dungeons", () => {
	const { panel, rows, client } = setup();
	expect(
		rows.some((row) => row.id.startsWith("role-") || row.id === "queue-action"),
	).toBe(false);
	expect(
		panel
			.getNavGrid()
			.at(0)
			?.map((node) => node.navId),
	).toEqual(["role-tank", "role-healer", "role-damage", "role-leader"]);
	expect(checkboxes.get("role-damage")?.setChecked).toHaveBeenCalledWith(
		true,
		true,
	);
	panel.getNavGrid().at(0)?.at(3)?.onInteract();
	expect(client.toggleRole).toHaveBeenCalledWith("leader");
	expect(checkboxes.get("role-tank")?.mount).toHaveBeenCalledWith(
		expect.anything(),
		30,
		70,
	);
	expect(checkboxes.get("role-leader")?.mount).toHaveBeenCalledWith(
		expect.anything(),
		354,
		70,
	);
});

it("pins a prominent Find Dungeon footer with space around it", () => {
	const { panel, client } = setup();
	expect(listOptions.mock.lastCall?.at(0)).toMatchObject({
		top: 190,
		bottom: 120,
		background: false,
	});
	expect(frames.get("queue-action")?.layout).toHaveBeenCalledWith(
		420,
		56,
		"BOTTOM",
		expect.anything(),
		0,
		30,
	);
	expect(frames.get("queue-action")?.setLabel).toHaveBeenCalledWith(
		"action",
		"Find Dungeon",
		"CENTER",
		0,
		0,
		20,
	);
	panel.getNavGrid().at(-1)?.at(0)?.onInteract();
	expect(client.join).toHaveBeenCalledOnce();
});

it("locks pinned roles while queued and offers Leave Queue", () => {
	const { panel, client } = setup(true);
	expect(checkboxes.get("role-damage")?.setChecked).toHaveBeenCalledWith(
		true,
		false,
	);
	panel.getNavGrid().at(0)?.at(3)?.onInteract();
	expect(client.toggleRole).not.toHaveBeenCalled();
	expect(frames.get("queue-action")?.setLabel).toHaveBeenCalledWith(
		"action",
		"Leave Queue",
		"CENTER",
		0,
		0,
		20,
	);
	panel.getNavGrid().at(-1)?.at(0)?.onInteract();
	expect(client.leave).toHaveBeenCalledOnce();
	expect(client.join).not.toHaveBeenCalled();
});

it("removes navigation and guards retained controls when unmounted", () => {
	const { panel, client } = setup();
	const grid = panel.getNavGrid();
	panel.onUnmount();
	expect(panel.getNavGrid()).toEqual([]);
	grid.at(0)?.at(0)?.onInteract();
	grid.at(-1)?.at(0)?.onInteract();
	expect(client.toggleRole).not.toHaveBeenCalled();
	expect(client.join).not.toHaveBeenCalled();
});
