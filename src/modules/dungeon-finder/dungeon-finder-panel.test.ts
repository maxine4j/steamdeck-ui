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
		setTitle = vi.fn();
		resetScroll = vi.fn();
		getNavGrid = () => {
			const rows = setRows.mock.lastCall?.at(0) as ListRow[];
			return rows
				.filter((row) => !row.heading && row.enabled !== false)
				.map((row) => [{ navId: row.id, onInteract: row.activate }]);
		};
	},
}));

function setup(queued = false, canTank = true, canHeal = true) {
	const callbacks: (() => void)[] = [];
	const client: IDungeonFinderClient = {
		getDungeonLists: () => [
			{ id: "follower", label: "Follower Dungeon" },
			{ id: "specific", label: "Specific Dungeons" },
		],
		getDungeonChoices: (list) => [
			{
				id: list === "follower" ? 11 : 10,
				name: "Choice",
				available: true,
				checked: true,
				difficulty: "heroic",
			},
			{
				id: 12,
				name: "Locked",
				available: false,
				checked: false,
				difficulty: "normal",
			},
		],
		selectList: vi.fn(),
		toggleDungeon: vi.fn(),
		getAvailableRoles: () => ({
			leader: true,
			tank: canTank,
			healer: canHeal,
			damage: true,
		}),
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

it.each(["follower", "specific"] as const)(
	"opens %s checkboxes with pinned roles and a spaced Back button",
	(list) => {
		const { callbacks, client, panel } = setup();
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === `list-${list}`)
			?.onInteract();
		callbacks.shift()?.();
		const choices = setRows.mock.lastCall?.at(0) as ListRow[];
		expect(client.selectList).toHaveBeenCalledWith(list);
		expect(choices.find((row) => row.id === "choice-12")).toMatchObject({
			checked: false,
			enabled: false,
			marginBottom: 28,
		});
		const dungeon = choices.find(
			(row) => row.id === `choice-${list === "follower" ? 11 : 10}`,
		);
		expect(dungeon?.checked).toBe(true);
		dungeon?.activate();
		expect(client.toggleDungeon).toHaveBeenCalledWith(
			list,
			list === "follower" ? 11 : 10,
		);
		expect(panel.getNavGrid().at(0)?.at(0)?.navId).toBe("role-tank");
		expect(
			panel
				.getNavGrid()
				.flat()
				.map((node) => node.navId),
		).toContain("dungeon-back");
		expect(
			panel
				.getNavGrid()
				.flat()
				.map((node) => node.navId),
		).not.toContain("choice-12");
		callbacks.shift()?.();
		const updated = setRows.mock.lastCall?.at(0) as ListRow[];
		const back = updated.find((row) => row.id === "dungeon-back");
		expect(back).toMatchObject({ id: "dungeon-back", label: "Back" });
		back?.activate();
		callbacks.shift()?.();
		const overview = setRows.mock.lastCall?.at(0) as ListRow[];
		expect(overview.some((row) => row.id === "list-specific")).toBe(true);
	},
);

it("keeps Back accessible on an empty secondary page", () => {
	const { rows, client, panel, callbacks } = setup();
	client.getDungeonChoices = () => [];
	rows.find((row) => row.id === "list-follower")?.activate();
	callbacks.shift()?.();
	const choices = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(choices).toMatchObject([
		{ id: "empty-choices", marginBottom: 28 },
		{ id: "dungeon-back", label: "Back" },
		{ id: "queue-action", enabled: false },
	]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "dungeon-back"),
	).toBe(true);
});

it("greys competing queues and lets A leave the active random queue", () => {
	const { rows, client, panel, callbacks } = setup(true);
	rows.find((row) => row.id === "list-specific")?.activate();
	callbacks.shift()?.();
	expect(client.selectList).not.toHaveBeenCalled();
	expect(rows.find((row) => row.id === "dungeon-1")?.enabled).toBe(false);
	expect(rows.find((row) => row.id === "list-specific")?.enabled).toBe(false);
	expect(rows.find((row) => row.id === "dungeon-3")).toMatchObject({
		background: [0.05, 0.25, 0.5],
		animatedIcon: { atlas: "groupfinder-eye-flipbook-searching" },
		enabled: true,
	});
	rows.find((row) => row.id === "dungeon-3")?.activate();
	expect(client.leave).toHaveBeenCalledOnce();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "list-specific"),
	).toBe(false);
});

it("renders ordered sections and immediately joins available random dungeons", () => {
	const { rows, client } = setup();
	const headings = rows.filter((row) => row.heading);
	expect(headings.map((row) => row.id)).toEqual([
		"heading-special",
		"heading-heroic",
		"heading-normal",
	]);
	expect(headings.at(0)?.label).toContain(
		"|A:ui-hud-calendar-1-up:20:20|a Special events",
	);
	expect(headings.at(1)?.label).toContain(
		"|TInterface\\LFGFrame\\UI-LFG-ICON-HEROIC:20:16:0:0:32:32:0:16:0:20|t Heroic random",
	);
	expect(headings.at(2)?.label).toContain(
		"|TInterface\\Icons\\Achievement_Dungeon_UlduarRaid_Archway_01:20:20|t Normal random",
	);
	expect(rows.find((row) => row.id === "dungeon-3")?.marginBottom).toBe(20);
	rows.find((row) => row.id === "dungeon-3")?.activate();
	expect(client.select).toHaveBeenCalledWith(3);
	expect(client.join).toHaveBeenCalledOnce();
	expect(rows.find((row) => row.id === "dungeon-3")?.detail).toBeUndefined();
	rows.find((row) => row.id === "dungeon-2")?.activate();
	expect(client.select).toHaveBeenCalledTimes(1);
});

it("dims unsupported roles and excludes them from controller navigation", () => {
	const { panel } = setup(false, false, false);
	expect(checkboxes.get("role-tank")?.setChecked).toHaveBeenCalledWith(
		false,
		false,
	);
	expect(checkboxes.get("role-healer")?.setChecked).toHaveBeenCalledWith(
		false,
		false,
	);
	expect(
		panel
			.getNavGrid()
			.at(0)
			?.map((node) => node.navId),
	).toEqual(["role-damage", "role-leader"]);
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
		false,
	);
	expect(checkboxes.get("role-leader")?.mount).toHaveBeenCalledWith(
		expect.anything(),
		354,
		70,
		false,
	);
});

it("removes the overview queue footer and compacts the role area", () => {
	const { panel } = setup();
	expect(listOptions.mock.lastCall?.at(0)).toMatchObject({
		top: 144,
		bottom: 30,
		background: false,
	});
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "queue-action"),
	).toBe(false);
});

it("locks pinned roles while queued and offers Leave Queue", () => {
	const { panel, client } = setup(true);
	expect(checkboxes.get("role-damage")?.setChecked).toHaveBeenCalledWith(
		true,
		false,
	);
	panel.getNavGrid().at(0)?.at(3)?.onInteract();
	expect(client.toggleRole).not.toHaveBeenCalled();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "dungeon-3")
		?.onInteract();
	expect(client.leave).toHaveBeenCalledOnce();
	expect(client.join).not.toHaveBeenCalled();
});

it.each(["specific", "follower"] as const)(
	"keeps %s queue action last, compacts choices and supports B",
	(list) => {
		const { panel, rows, client, callbacks } = setup();
		rows.find((row) => row.id === `list-${list}`)?.activate();
		callbacks.shift()?.();
		const choices = setRows.mock.lastCall?.at(0) as ListRow[];
		expect(
			choices
				.filter((row) => row.checked !== undefined)
				.every((row) => row.height === 24),
		).toBe(true);
		expect(choices.at(-1)?.id).toBe("queue-action");
		choices.at(-1)?.activate();
		expect(client.join).toHaveBeenCalledOnce();
		if (list === "specific")
			expect(
				choices.filter((row) => row.heading).map((row) => row.label),
			).toEqual(["Heroic", "Normal"]);
		panel.onBack();
		callbacks.shift()?.();
		expect(
			((setRows.mock.lastCall?.at(0) as ListRow[] | undefined) ?? []).some(
				(row) => row.id === "list-specific",
			),
		).toBe(true);
	},
);

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
