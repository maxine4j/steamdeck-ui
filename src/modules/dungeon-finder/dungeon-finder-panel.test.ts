import { expect, it, vi } from "vitest";
import type { IDungeonFinderClient } from "../../clients/dungeon-finder-client";
import { Frame } from "../../ui/components/frame";
import type { ModalOption } from "../../ui/components/modal";
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
		{
			setChecked: ReturnType<typeof vi.fn>;
			mount: ReturnType<typeof vi.fn>;
			icon: string;
		}
	>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		layout = vi.fn();
		setLabel = vi.fn();
		fill = vi.fn();
		setWindowBackground = vi.fn();
		setButtonBackground = vi.fn();
		setInsetBackground = vi.fn();
		setCloseButtonBackground = vi.fn();
		setParent = vi.fn();
		setColor = vi.fn();
		setFocused = vi.fn();
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
			public readonly icon: string,
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
				.map((row) => [
					{
						navId: row.id,
						onInteract: row.secondary?.onlyAction
							? row.secondary.activate
							: row.activate,
					},
				]);
		};
	},
}));

function setup(queued = false, canTank = true, canHeal = true) {
	const callbacks: (() => void)[] = [];
	let options: readonly ModalOption[] = [];
	const modal = {
		open: vi.fn((_title: string, next: readonly ModalOption[]) => {
			options = next;
		}),
		close: vi.fn(),
	};
	const confirm = () =>
		options.find((option) => option.id === "leave")?.select();
	const cancel = () =>
		options.find((option) => option.id === "cancel")?.select();
	const client: IDungeonFinderClient = {
		getRaids: () => [],
		canQueueRaid: () => true,
		joinRaid: vi.fn(),
		leaveRaid: vi.fn(),
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
		modal,
	);
	panel.onMount(new Frame("parent", {} as IFramePoolManager));
	callbacks.shift()?.();
	const rows = setRows.mock.lastCall?.at(0) as ListRow[];
	return { panel, client, rows, callbacks, modal, confirm, cancel };
}

function activate(row?: ListRow): void {
	if (row?.secondary?.onlyAction) row.secondary.activate();
	else row?.activate();
}

it("widens queue tiles and limits queue actions to the inset red button", () => {
	const { rows, client } = setup();
	const tile = rows.find((row) => row.id === "dungeon-3");
	expect(listOptions.mock.lastCall?.at(0)).toMatchObject({ buttonWidth: 420 });
	expect(tile?.secondary).toMatchObject({
		label: "Queue",
		width: 110,
		height: 32,
		onlyAction: true,
	});
	expect(tile?.backgroundSlice).toBe(16);
	expect(
		rows.find((row) => row.id === "heading-specific-dungeons"),
	).toMatchObject({ label: "Specific dungeons", heading: true, indent: 24 });
	expect(rows.find((row) => row.id === "list-follower")?.marginBottom).toBe(0);
	expect(rows.find((row) => row.id === "list-specific")?.marginBottom).toBe(0);
	tile?.activate();
	expect(client.join).not.toHaveBeenCalled();
	tile?.secondary?.activate();
	expect(client.join).toHaveBeenCalledOnce();
	const queued = setup(true);
	const active = queued.rows.find((row) => row.id === "dungeon-3");
	expect(active?.secondary).toMatchObject({
		label: "Leave Queue",
		tooltip: "In queue - leave?",
	});
	active?.activate();
	expect(queued.modal.open).not.toHaveBeenCalled();
	active?.secondary?.activate();
	expect(queued.modal.open).toHaveBeenCalled();
	queued.confirm();
	expect(queued.client.leave).toHaveBeenCalledOnce();
});

it.each(["follower", "specific"] as const)(
	"opens %s checkboxes with pinned roles and returns via controller B",
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
		expect(choices.some((row) => row.id === "dungeon-back")).toBe(false);
		expect(
			panel
				.getNavGrid()
				.flat()
				.map((node) => node.navId),
		).not.toContain("choice-12");
		callbacks.shift()?.();
		panel.onBack();
		callbacks.shift()?.();
		const overview = setRows.mock.lastCall?.at(0) as ListRow[];
		expect(overview.some((row) => row.id === "list-specific")).toBe(true);
	},
);

it("returns from an empty secondary page with the pinned Back button", () => {
	const { rows, client, panel, callbacks } = setup();
	client.getDungeonChoices = () => [];
	activate(rows.find((row) => row.id === "list-follower"));
	callbacks.shift()?.();
	const choices = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(choices).toMatchObject([
		{ id: "empty-choices", marginBottom: 28 },
		{ id: "queue-action", enabled: false },
	]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "dungeon-back"),
	).toBe(true);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "dungeon-back")
		?.onInteract();
	callbacks.shift()?.();
	const overview = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(overview.some((row) => row.id === "list-follower")).toBe(true);
});

it("greys competing queues and lets A leave the active random queue", () => {
	const { rows, client, panel, callbacks, modal, confirm } = setup(true);
	activate(rows.find((row) => row.id === "list-specific"));
	callbacks.shift()?.();
	expect(client.selectList).not.toHaveBeenCalled();
	expect(rows.find((row) => row.id === "dungeon-1")?.enabled).toBe(false);
	expect(rows.find((row) => row.id === "list-specific")?.enabled).toBe(false);
	expect(rows.find((row) => row.id === "dungeon-3")).toMatchObject({
		backgroundTint: [0.2, 0.8, 0.3],
		detail: undefined,
		secondary: { label: "Leave Queue", tooltip: "In queue - leave?" },
		animatedIcon: { atlas: "groupfinder-eye-flipbook-searching" },
		enabled: true,
	});
	activate(rows.find((row) => row.id === "dungeon-3"));
	expect(client.leave).not.toHaveBeenCalled();
	expect(modal.open).toHaveBeenCalledWith("Leave Queue?", expect.any(Array));
	confirm();
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
		"heading-dungeons",
		"heading-special",
		"heading-heroic",
		"heading-normal",
		"heading-specific-dungeons",
		"heading-raids",
		"empty-raids",
	]);
	expect(headings.at(1)?.label).toContain(
		"|A:ui-hud-calendar-1-up:20:20|a Special events",
	);
	expect(headings.at(2)?.label).toContain(
		"|TInterface\\LFGFrame\\UI-LFG-ICON-HEROIC:20:16:0:0:32:32:0:16:0:20|t Heroic random",
	);
	expect(headings.at(3)?.label).toContain(
		"|TInterface\\Icons\\Achievement_Dungeon_UlduarRaid_Archway_01:20:20|t Normal random",
	);
	expect(rows.find((row) => row.id === "dungeon-3")?.marginBottom).toBe(20);
	activate(rows.find((row) => row.id === "dungeon-3"));
	expect(client.select).toHaveBeenCalledWith(3);
	expect(client.join).toHaveBeenCalledOnce();
	expect(rows.find((row) => row.id === "dungeon-3")?.detail).toBeUndefined();
	expect(rows.find((row) => row.id === "dungeon-3")).toMatchObject({
		backgroundAtlas: "ui-journeys-renown-button",
		height: 60,
		secondary: { label: "Queue", tooltip: undefined },
	});
	activate(rows.find((row) => row.id === "dungeon-2"));
	expect(client.select).toHaveBeenCalledTimes(1);
});

it.each([
	[
		"Random Timewalking Dungeon (Mists of Pandaria)",
		"Random Timewalking Dungeon",
		"(Mists of Pandaria)",
	],
	["Dungeon (Heroic) Return", "Dungeon Return", "(Heroic)"],
	["Dungeon (unfinished", "Dungeon (unfinished", undefined],
])(
	"keeps parentheses when splitting %s onto a second line",
	(name, label, detail) => {
		const { client, panel, callbacks } = setup();
		client.getDungeons = () => [
			{ id: 3, name, section: "special", available: true },
		];
		panel.refresh();
		callbacks.shift()?.();
		const rows = setRows.mock.lastCall?.at(0) as ListRow[];
		expect(rows.find((row) => row.id === "dungeon-3")).toMatchObject({
			label,
			detail,
			secondary: { tooltip: undefined },
		});
	},
);

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
	expect(
		["tank", "healer", "damage", "leader"].map(
			(role) => checkboxes.get(`role-${role}`)?.icon,
		),
	).toEqual([
		"UI-LFG-RoleIcon-Tank",
		"UI-LFG-RoleIcon-Healer",
		"UI-LFG-RoleIcon-DPS",
		"UI-LFG-RoleIcon-Leader",
	]);
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
		top: 180,
		buttonWidth: 420,
		centerText: false,
		centerLabelsVertically: true,
		contentPadding: { horizontal: 24, vertical: 10 },
		centerSingleLine: true,
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
	const { panel, client, confirm } = setup(true);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["dungeon-3"]);
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
	confirm();
	expect(client.leave).toHaveBeenCalledOnce();
	expect(client.join).not.toHaveBeenCalled();
});

it.each(["specific", "follower"] as const)(
	"keeps %s queue action last, compacts choices and supports B",
	(list) => {
		const { panel, rows, client, callbacks } = setup();
		activate(rows.find((row) => row.id === `list-${list}`));
		callbacks.shift()?.();
		const choices = setRows.mock.lastCall?.at(0) as ListRow[];
		expect(
			choices
				.filter((row) => row.checked !== undefined)
				.every((row) => row.height === 24),
		).toBe(true);
		expect(choices.at(-1)?.id).toBe("queue-action");
		activate(choices.at(-1));
		expect(client.join).toHaveBeenCalledOnce();
		if (list === "specific")
			expect(
				choices.filter((row) => row.heading).map((row) => row.label),
			).toEqual(["Heroic", "Normal"]);
		else
			expect(choices.at(0)).toMatchObject({
				label: "Follower Dungeons",
				heading: true,
			});
		panel.onBack();
		callbacks.shift()?.();
		expect(
			((setRows.mock.lastCall?.at(0) as ListRow[] | undefined) ?? []).some(
				(row) => row.id === "list-specific",
			),
		).toBe(true);
	},
);

it("separates dungeons and raids, with independently queueable wings and leave actions at capacity", () => {
	const { client, panel, callbacks, confirm } = setup(true);
	let capacity = true;
	client.canQueueRaid = () => capacity;
	client.getRaids = () => [
		{
			id: 60,
			name: "New raid",
			wings: [
				{
					id: 102,
					name: "Wing one",
					available: true,
					queued: true,
					bosses: [
						{ name: "First Boss", killed: true },
						{ name: "Second Boss", killed: false },
					],
				},
				{
					id: 103,
					name: "Wing two (Raid Finder)",
					available: true,
					queued: false,
					bosses: [{ name: "Third Boss", killed: false }],
				},
				{
					id: 104,
					name: "Locked wing",
					available: false,
					queued: false,
					bosses: [],
				},
			],
		},
	];
	panel.refresh();
	callbacks.shift()?.();
	let rows = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(rows.at(0)).toMatchObject({
		id: "heading-dungeons",
		label: "Dungeons",
		marginTop: 16,
	});
	expect(rows.filter((row) => row.heading).slice(-2)).toMatchObject([
		{
			id: "heading-raids",
			label: expect.stringMatching(/\|T.+:22:22\|t Raid Finder/),
			fontSize: 22,
		},
		{ id: "raid-60", label: "New raid", fontSize: 18, indent: 24 },
	]);
	expect(rows.findIndex((row) => row.id === "heading-raids")).toBeGreaterThan(
		rows.findIndex((row) => row.id === "list-specific"),
	);
	activate(rows.find((row) => row.id === "wing-103"));
	expect(rows.find((row) => row.id === "wing-103")).toMatchObject({
		backgroundAtlas: "ui-journeys-renown-button",
		height: 60,
		secondary: {
			label: "Queue",
			tooltip: expect.stringContaining("Third Boss"),
		},
		label: "Wing two • 0/1",
		detail: "(Raid Finder)",
		marginBottom: 0,
	});
	expect(
		rows.find((row) => row.id === "wing-103")?.secondary?.tooltip,
	).not.toContain("Enter Queue?");
	expect(client.joinRaid).toHaveBeenCalledWith(103);
	activate(rows.find((row) => row.id === "wing-104"));
	expect(client.joinRaid).toHaveBeenCalledOnce();
	capacity = false;
	callbacks.shift()?.();
	rows = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(rows.find((row) => row.id === "wing-103")?.enabled).toBe(false);
	expect(rows.find((row) => row.id === "wing-102")).toMatchObject({
		backgroundTint: [0.2, 0.8, 0.3],
		label: "Wing one • 1/2",
		detail: undefined,
		enabled: true,
		animatedIcon: { atlas: "groupfinder-eye-flipbook-searching" },
		marginBottom: 0,
		secondary: {
			tooltip: expect.stringContaining("First Boss (killed)\nSecond Boss"),
		},
	});
	activate(rows.find((row) => row.id === "wing-103"));
	expect(client.joinRaid).toHaveBeenCalledOnce();
	activate(rows.find((row) => row.id === "wing-102"));
	expect(client.leaveRaid).not.toHaveBeenCalled();
	confirm();
	expect(client.leaveRaid).toHaveBeenCalledWith(102);
	expect(client.leave).not.toHaveBeenCalled();
	panel.onUnmount();
	activate(rows.find((row) => row.id === "wing-102"));
	expect(client.leaveRaid).toHaveBeenCalledOnce();
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

it.each(["specific", "follower"] as const)(
	"shows the active %s queue in green and leaves it from its bottom action",
	(list) => {
		const { panel, client, rows, callbacks, confirm } = setup();
		activate(rows.find((row) => row.id === `list-${list}`));
		callbacks.shift()?.();
		client.getSelected = () => list;
		client.isQueued = () => true;
		panel.refresh();
		callbacks.shift()?.();
		const choices = setRows.mock.lastCall?.at(0) as ListRow[];
		expect(choices.at(-1)).toMatchObject({
			id: "queue-action",
			label: list === "follower" ? "Follower Dungeon" : "Specific Dungeons",
			enabled: true,
			backgroundTint: [0.2, 0.8, 0.3],
			detail: undefined,
			animatedIcon: { atlas: "groupfinder-eye-flipbook-searching" },
		});
		activate(choices.at(-1));
		expect(client.leave).not.toHaveBeenCalled();
		confirm();
		expect(client.leave).toHaveBeenCalledOnce();
		expect(client.join).not.toHaveBeenCalled();
		panel.onBack();
		callbacks.shift()?.();
		expect(
			panel
				.getNavGrid()
				.flat()
				.some((node) => node.navId === `list-${list}`),
		).toBe(true);
	},
);

it("cancels leaving without dequeuing and rejects stale confirmation after queue changes or unmount", () => {
	const { rows, client, panel, confirm, cancel, modal } = setup(true);
	const action = rows.find((row) => row.id === "dungeon-3");
	activate(action);
	cancel();
	confirm();
	expect(client.leave).not.toHaveBeenCalled();
	activate(action);
	client.getSelected = () => 1;
	confirm();
	expect(client.leave).not.toHaveBeenCalled();
	client.getSelected = () => 3;
	activate(action);
	panel.onUnmount();
	expect(modal.close).toHaveBeenCalled();
	confirm();
	expect(client.leave).not.toHaveBeenCalled();
});

it.each(["follower", "specific"] as const)(
	"confirms leaving the active %s queue from the overview",
	(list) => {
		const { rows, client, confirm, modal } = setup(true);
		client.getSelected = () => list;
		activate(rows.find((row) => row.id === `list-${list}`));
		expect(modal.open).toHaveBeenCalled();
		expect(client.leave).not.toHaveBeenCalled();
		confirm();
		expect(client.leave).toHaveBeenCalledOnce();
	},
);
