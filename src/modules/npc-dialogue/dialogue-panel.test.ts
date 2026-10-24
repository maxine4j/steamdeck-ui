import { beforeEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationGrid } from "../../ui/navigation/navigation-grid";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import type { DialogueDisplay } from "./dialogue-module";
import { DialoguePanel } from "./dialogue-panel";

const records = vi.hoisted(() => ({
	created: 0,
	layouts: new Map<string, [number, number]>(),
	labels: new Map<string, Map<string, string>>(),
	anchors: new Map<string, [string, number, number]>(),
	skins: new Map<string, string>(),
	labelAnchors: new Map<string, string>(),
	textures: new Map<string, [number | string, readonly number[]]>(),
	icons: new Map<string, number | string>(),
	parents: new Map<string, string>(),
	textColors: new Map<string, readonly number[]>(),
	colors: new Map<string, readonly number[]>(),
	insets: new Map<string, number[]>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(readonly id: string) {
			records.created++;
			records.labels.set(id, new Map());
		}
		layout(
			w: number,
			h: number,
			point: string,
			_parent: unknown,
			x = 0,
			y = 0,
		) {
			records.layouts.set(this.id, [w, h]);
			records.anchors.set(this.id, [point, x, y]);
		}
		setLabel(key: string, text: string, point: string) {
			records.labels.get(this.id)?.set(key, text);
			records.labelAnchors.set(`${this.id}:${key}`, point);
		}
		getSize() {
			return {
				width: 1280,
				height: Number(this.id.match(/^parent-(\d+)$/)?.at(1) ?? 800),
			};
		}
		labelHeight(key: string) {
			return (
				Math.ceil((records.labels.get(this.id)?.get(key)?.length ?? 0) / 30) *
				22
			);
		}
		setParent = (parent: { id: string }) =>
			records.parents.set(this.id, parent.id);
		setColor = (...color: number[]) => {
			records.skins.set(this.id, "flat");
			records.colors.set(this.id, color);
		};
		setAtlasBackground = (atlas: string) => records.skins.set(this.id, atlas);
		setLabelStyle = (key: string, color: readonly number[]) =>
			records.textColors.set(`${this.id}:${key}`, color);
		setCloseButtonBackground = vi.fn();
		setButtonBackground = () => records.skins.set(this.id, "red-button");
		setWindowBackground = () => records.skins.set(this.id, "metal-window");
		setTextureBackground = (file: string, coords: readonly number[]) =>
			records.textures.set(this.id, [file, coords]);
		setInsetBackground = vi.fn();
		setFocusBorder = vi.fn();
		setFocused = vi.fn();
		setNavigationFocus = vi.fn();
		setTooltip = vi.fn();
		setHoverTooltip = vi.fn();
		showTooltip = vi.fn();
		hideTooltip = vi.fn();
		setIcon = (icon: number | string) => records.icons.set(this.id, icon);
		setLabelWordWrap = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		configureInput = vi.fn();
		clearInput = vi.fn();
		focusInput = vi.fn();
		fill = vi.fn();
		inset = (_parent: unknown, ...values: number[]) =>
			records.insets.set(this.id, values);
		onClick = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		resetScroll = vi.fn();
		revealVerticalRange = vi.fn();
		scrollToEdge = vi.fn();
		scrollBy = () => ({ offset: 0, range: 0 });
	},
}));
beforeEach(() => {
	records.created = 0;
	records.labels.clear();
	records.layouts.clear();
	records.anchors.clear();
	records.skins.clear();
	records.labelAnchors.clear();
	records.textures.clear();
	records.icons.clear();
	records.parents.clear();
	records.textColors.clear();
	records.colors.clear();
});

const page = {
	session: 1,
	revision: 1,
	speaker: "Keeper",
	title: "A quest",
	text: "Long text. ".repeat(300),
	questID: 51,
	rewards: [{ id: "xp", label: "100 XP" }],
	choices: [
		{ id: "choice:1", index: 1, label: "Sword" },
		{ id: "choice:2", index: 2, label: "Shield" },
	],
	cost: 0,
};
function setup(display: DialogueDisplay, height = 800) {
	const actions = {
		select: vi.fn(),
		choose: vi.fn(),
		primary: vi.fn(),
		confirm: vi.fn(),
		cancel: vi.fn(),
	};
	const navigation = { pushModal: vi.fn(), popModal: vi.fn() };
	const panel = new DialoguePanel({} as IFramePoolManager, navigation);
	panel.setActions(actions);
	panel.show(display);
	panel.onMount(new Frame(`parent-${height}`, {} as IFramePoolManager));
	return { panel, actions, navigation };
}
const display = (p: DialogueDisplay["page"]): DialogueDisplay => ({
	page: p,
	suspended: false,
	waiting: false,
	resetReading: true,
});

it.each([
	display({ ...page, kind: "gossip", entries: [] }),
	display({ ...page, kind: "greeting", entries: [] }),
	display({ ...page, kind: "offer", autoAccepted: false }),
	display({ ...page, kind: "progress", requirements: [], completable: false }),
	display({ ...page, kind: "rewards" }),
	display({ ...page, kind: "remote" }),
	display({ ...page, kind: "shared", eligible: true }),
	{
		...display({ ...page, kind: "gossip", entries: [] }),
		confirmation: { text: "Confirm?", code: false },
	},
])("omits close controls and keeps modal cancellation on $page.kind", (d) => {
	const { panel, actions, navigation } = setup(d);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).not.toContain("dialogue-cancel");
	const labels = [...records.labels.values()].flatMap((values) => [
		...values.values(),
	]);
	expect(labels.some((label) => label.includes("CloseButton.png"))).toBe(false);
	navigation.pushModal.mock.lastCall?.at(2)?.();
	expect(actions.cancel).toHaveBeenCalledOnce();
});

it("shows controller graphics beside conversation actions", () => {
	setup(display(page));
	expect(records.labels.get("dialogue-surface")?.get("hint")).toContain(
		"xbox_r_x.blp:18:18|t Select",
	);
	expect(records.labels.get("dialogue-surface")?.get("hint")).not.toContain(
		"Read",
	);
});

it("moves options down and gives buttons more room without enlarging prose", () => {
	setup(
		display({
			...page,
			kind: "gossip",
			title: "Conversation",
			entries: [{ id: "talk", label: "Talk" }],
		}),
	);
	expect(records.anchors.get("dialogue-choices-host")).toEqual([
		"BOTTOMLEFT",
		28,
		40,
	]);
	expect(
		records.layouts.get("dialogue-choices-row-0")?.at(1),
	).toBeGreaterThanOrEqual(56);
	// Previously one option and Close left 396px for prose in this 640px window.
	expect(
		records.layouts.get("dialogue-reading-host")?.at(1),
	).toBeLessThanOrEqual(396);
});

it("focuses the first option on each new page and confirmation without navigating prose", () => {
	const nav = new NavigationManager(createTestEventBus());
	const panel = new DialoguePanel({} as IFramePoolManager, nav);
	const d = display({
		...page,
		kind: "gossip",
		entries: [
			{ id: "first", label: "First" },
			{ id: "second", label: "Second" },
		],
	});
	panel.show(d);
	panel.onMount(new Frame("parent-800", {} as IFramePoolManager));
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).not.toContain("dialogue-reading");
	expect(nav.focusedId).toBe("first");
	nav.moveDown();
	expect(nav.focusedId).toBe("second");
	panel.show({ ...d, page: { ...d.page, revision: 2 } });
	expect(nav.focusedId).toBe("first");
	panel.show({ ...d, confirmation: { text: "Confirm?", code: false } });
	expect(nav.focusedId).toBe("dialogue-confirm");
	nav.moveDown();
	panel.show(d);
	expect(nav.focusedId).toBe("first");
	nav.moveDown();
	panel.onUnmount();
	panel.onMount(new Frame("parent-800", {} as IFramePoolManager));
	expect(nav.focusedId).toBe("first");
});

it("keeps prose, headings and options readable on a dark background", () => {
	setup(
		display({
			...page,
			kind: "gossip",
			entries: [{ id: "talk", label: "Talk" }],
		}),
	);
	expect(records.textColors.get("dialogue-reading-content:text")).toEqual([
		0.7, 0.7, 0.7,
	]);
	expect(records.textColors.get("dialogue-surface:title")).toEqual([
		0.9, 0.9, 0.9,
	]);
	expect(records.textColors.get("dialogue-choices-row-0:label")).toEqual([
		0.796, 0.784, 0.584,
	]);
	expect(records.textColors.get("dialogue-surface:hint")).toEqual([
		0.7, 0.7, 0.7,
	]);
});

it("keeps selected reward text legible against its highlight", () => {
	setup({ ...display({ ...page, kind: "rewards" }), selected: 1 });
	expect(records.colors.get("dialogue-choices-row-3")).toEqual([
		0.24, 0.22, 0.14,
	]);
});

it("focuses accepting a quest with reward previews without accepting or choosing", () => {
	const { actions, navigation } = setup(
		display({ ...page, kind: "offer", autoAccepted: false }),
	);
	expect(navigation.pushModal.mock.lastCall?.at(3)).toBe("dialogue-primary");
	expect(actions.primary).not.toHaveBeenCalled();
	expect(actions.choose).not.toHaveBeenCalled();
});

it("preserves reward-preview focus on refresh and focuses acceptance for a new offer", () => {
	const nav = new NavigationManager(createTestEventBus());
	const panel = new DialoguePanel({} as IFramePoolManager, nav);
	const d = display({ ...page, kind: "offer", autoAccepted: false });
	panel.show(d);
	panel.onMount(new Frame("parent-800", {} as IFramePoolManager));
	expect(nav.focusedId).toBe("dialogue-primary");
	nav.moveUp();
	expect(nav.focusedId).toBe("choice:1");
	panel.show({ ...d, resetReading: false, page: { ...d.page, revision: 2 } });
	expect(nav.focusedId).toBe("choice:1");
	panel.show({ ...d, page: { ...d.page, questID: 52, revision: 3 } });
	expect(nav.focusedId).toBe("dialogue-primary");
});

it.each([
	{ rewards: [] },
	{ rewards: [{ id: "guaranteed", label: "100 XP" }] },
])(
	"focuses quest completion without claiming when rewards require no choice: %j",
	({ rewards }) => {
		const d = display({ ...page, kind: "rewards", rewards, choices: [] });
		const { panel, actions, navigation } = setup(d);
		expect(navigation.pushModal.mock.lastCall?.at(3)).toBe("dialogue-primary");
		expect(actions.primary).not.toHaveBeenCalled();
		panel.show({ ...d, resetReading: false, page: { ...d.page, revision: 2 } });
		expect(navigation.pushModal.mock.lastCall?.at(3)).toBeUndefined();
	},
);

it("leaves rewards requiring a choice focused on the reward list", () => {
	const { actions, navigation } = setup(display({ ...page, kind: "rewards" }));
	expect(navigation.pushModal.mock.lastCall?.at(3)).toBe("xp");
	expect(actions.choose).not.toHaveBeenCalled();
	expect(actions.primary).not.toHaveBeenCalled();
});

it("focuses completion when the only reward choice is already selected", () => {
	const { actions, navigation } = setup({
		...display({ ...page, kind: "rewards", choices: page.choices.slice(0, 1) }),
		selected: 1,
	});
	expect(navigation.pushModal.mock.lastCall?.at(3)).toBe("dialogue-primary");
	expect(actions.primary).not.toHaveBeenCalled();
});

it("keeps a sole reward needing selection focused on the reward list", () => {
	const { navigation } = setup(
		display({ ...page, kind: "rewards", choices: page.choices.slice(0, 1) }),
	);
	expect(navigation.pushModal.mock.lastCall?.at(3)).toBe("xp");
});

it.each(["offer", "rewards"] as const)(
	"compacts %s reward rows and icons to reduce overflow while keeping rewards reachable",
	(kind) => {
		const rewards = Array.from({ length: 4 }, (_, i) => ({
			id: `reward:${i}`,
			label: "Reward",
			icon: 123,
		}));
		const { panel } = setup(
			display({
				...page,
				kind,
				rewards,
				choices: [],
				autoAccepted: false,
				pvp: false,
			}),
		);
		expect(records.layouts.get("dialogue-choices-row-1")?.at(1)).toBe(56);
		expect(records.layouts.get("dialogue-choices-icon-1")).toEqual([28, 28]);
		const content = records.layouts.get("dialogue-choices-content")?.at(1) ?? 0;
		const viewport = records.layouts.get("dialogue-choices-host")?.at(1) ?? 0;
		expect(content - viewport).toBeLessThan(30);
		expect(
			panel
				.getNavGrid()
				.flat()
				.map((node) => node.navId),
		).toContain("reward:3");
	},
);

it("hosts dialogue content inside the shared window", () => {
	setup(display(page));
	expect(records.labels.get("dialogue-window")?.get("window-title")).toBe(
		"Keeper",
	);
	for (const id of [
		"dialogue-reading-host",
		"dialogue-choices-host",
		"dialogue-code",
		"dialogue-divider",
	])
		expect(records.parents.get(id)).toBe("dialogue-surface");
});

it("puts the NPC in the title bar and balances gossip text padding without a Conversation heading", () => {
	const d = display({
		...page,
		kind: "gossip",
		title: "Conversation",
		entries: [],
	});
	const { panel } = setup(d);
	expect(records.labels.get("dialogue-window")?.get("window-title")).toBe(
		"Keeper",
	);
	expect(records.labelAnchors.get("dialogue-window:window-title")).toBe("TOP");
	expect(
		records.labels.get("dialogue-surface")?.get("speaker"),
	).toBeUndefined();
	expect(records.labels.get("dialogue-surface")?.get("title")).toBe("");
	// The reader adds 8px internally: 36px at the sides and below the 20px title bar.
	expect(records.anchors.get("dialogue-reading-host")).toEqual([
		"TOPLEFT",
		28,
		-48,
	]);
	panel.show({ ...d, page: { ...d.page, speaker: "Another NPC" } });
	expect(records.labels.get("dialogue-window")?.get("window-title")).toBe(
		"Another NPC",
	);
});

it("retains real quest titles and clears them when returning to gossip", () => {
	const { panel } = setup(
		display({ ...page, kind: "offer", autoAccepted: false, pvp: false }),
	);
	expect(records.labels.get("dialogue-surface")?.get("title")).toBe("A quest");
	expect(records.anchors.get("dialogue-reading-host")).toEqual([
		"TOPLEFT",
		28,
		-76,
	]);
	panel.show(
		display({ ...page, kind: "gossip", title: "Conversation", entries: [] }),
	);
	expect(records.labels.get("dialogue-surface")?.get("title")).toBe("");
	expect(records.anchors.get("dialogue-reading-host")).toEqual([
		"TOPLEFT",
		28,
		-48,
	]);
});

it.each([720, 800, 1080, 1440])(
	"keeps the right-side conversation narrow with options below prose at 1280×%i and reuses controls",
	(height) => {
		const d = display({
			...page,
			kind: "gossip",
			entries: Array.from({ length: 40 }, (_, i) => ({
				id: `option:${i}`,
				label: "Long dialogue choice ".repeat(12),
			})),
		});
		const { panel } = setup(d, height);
		const dimensions = records.layouts.get("dialogue-window");
		if (!dimensions) throw new Error("Expected conversation layout");
		const [w, h] = dimensions;
		expect(w).toBeLessThanOrEqual(520);
		expect(h).toBeCloseTo(height * 0.8);
		expect(records.anchors.get("dialogue-window")?.at(0)).toBe("RIGHT");
		const readingTop = -(
			records.anchors.get("dialogue-reading-host")?.at(2) ?? 0
		);
		const readingHeight =
			records.layouts.get("dialogue-reading-host")?.at(1) ?? 0;
		const choicesTop =
			h - 40 - (records.layouts.get("dialogue-choices-host")?.at(1) ?? 0);
		expect(choicesTop).toBeGreaterThanOrEqual(readingTop + readingHeight);
		expect(records.anchors.get("dialogue-choices-host")).toEqual([
			"BOTTOMLEFT",
			28,
			40,
		]);
		expect(readingHeight).toBeGreaterThanOrEqual(h / 3);
		expect(records.skins.get("dialogue-window")).toBe("metal-window");
		expect(records.textures.size).toBe(0);
		expect(records.skins.get("dialogue-surface")).toBeUndefined();
		expect([...records.skins.values()]).not.toContain("red-button");
		expect(
			[...records.labels.values()]
				.flatMap((labels) => [...labels.values()])
				.join(" "),
		).not.toContain("% read");
		const count = records.created;
		panel.show({ ...d, resetReading: false });
		panel.onUnmount();
		panel.onMount(new Frame(`parent-${height}`, {} as IFramePoolManager));
		expect(records.created).toBe(count + 1);
	},
);
it("keeps options at the bottom and the reader spacious when prose is short", () => {
	const d = display({
		...page,
		kind: "gossip",
		entries: [{ id: "talk", label: "Talk" }],
	});
	const { panel } = setup(d);
	const reading = records.layouts.get("dialogue-reading-host");
	const options = records.anchors.get("dialogue-choices-host");
	panel.show({ ...d, page: { ...d.page, text: "Hello." }, resetReading: true });
	expect(records.layouts.get("dialogue-reading-host")).toEqual(reading);
	expect(records.anchors.get("dialogue-choices-host")).toEqual(options);
	expect(options).toEqual(["BOTTOMLEFT", 28, 40]);
});

it("uses crisp speech artwork while preserving service and reward icons", () => {
	const { panel } = setup(
		display({
			...page,
			kind: "gossip",
			entries: [
				{ id: "talk", label: "Talk", icon: 132053 },
				{ id: "vendor", label: "Shop", icon: 132060 },
			],
		}),
	);
	expect(records.icons.get("dialogue-choices-icon-0")).toBe(
		"Interface\\AddOns\\SteamDeckUI\\assets\\dialogue\\Gossip.png",
	);
	expect(records.layouts.get("dialogue-choices-icon-0")).toEqual([24, 24]);
	expect(records.icons.get("dialogue-choices-icon-1")).toBe(132060);
	panel.show(
		display({
			...page,
			kind: "rewards",
			rewards: [{ id: "item", label: "Reward", icon: 132053 }],
		}),
	);
	expect(records.icons.get("dialogue-choices-icon-1")).toBe(132053);
});

it("keeps confirmation input between prose and bottom options", () => {
	setup({
		...display({ ...page, kind: "gossip", entries: [] }),
		confirmation: { text: "Code?", code: true },
	});
	const readerBottom =
		-(records.anchors.get("dialogue-reading-host")?.at(2) ?? 0) +
		(records.layouts.get("dialogue-reading-host")?.at(1) ?? 0);
	const inputTop = -(records.anchors.get("dialogue-code")?.at(2) ?? 0);
	const choicesTop =
		(records.layouts.get("dialogue-window")?.at(1) ?? 0) -
		40 -
		(records.layouts.get("dialogue-choices-host")?.at(1) ?? 0);
	expect(inputTop).toBeGreaterThanOrEqual(readerBottom + 12);
	expect(inputTop + 40).toBeLessThanOrEqual(choicesTop);
});

it("fits four guaranteed rewards without scrolling on a 1080-pixel screen", () => {
	setup(
		display({
			...page,
			kind: "rewards",
			rewards: Array.from({ length: 4 }, (_, i) => ({
				id: `reward:${i}`,
				label: "Reward",
			})),
			choices: [],
		}),
		1080,
	);
	expect(records.layouts.get("dialogue-choices-host")?.at(1)).toBe(
		records.layouts.get("dialogue-choices-content")?.at(1),
	);
});

it("fits rewards in two columns and grows upward before scrolling, reserving a third for prose", () => {
	const rewards = Array.from({ length: 2 }, (_, i) => ({
		id: `reward:${i}`,
		label: "Reward",
		icon: 123,
	}));
	const d = display({ ...page, kind: "rewards", rewards, choices: [] });
	const { panel } = setup(d);
	expect(records.insets.get("dialogue-choices-scroll")).toEqual([0, 0, -20, 0]);
	expect(
		panel.getNavGrid().map((row) => row.map((node) => node.navId)),
	).toEqual([["reward:0", "reward:1"], ["dialogue-primary"]]);
	const contentHeight =
		records.layouts.get("dialogue-choices-content")?.at(1) ?? 0;
	expect(records.layouts.get("dialogue-choices-host")?.at(1)).toBe(
		contentHeight,
	);
	expect(records.layouts.get("dialogue-choices-row-1")?.at(0)).toBeLessThan(
		250,
	);
	const shortReader = records.layouts.get("dialogue-reading-host")?.at(1) ?? 0;
	panel.show(
		display({
			...d.page,
			rewards: Array.from({ length: 20 }, (_, i) => ({
				id: `reward:${i}`,
				label: "Reward",
			})),
		}),
	);
	const tallReader = records.layouts.get("dialogue-reading-host")?.at(1) ?? 0;
	expect(tallReader).toBeLessThan(shortReader);
	expect(tallReader).toBeGreaterThanOrEqual(
		(records.layouts.get("dialogue-window")?.at(1) ?? 0) / 3,
	);
	expect(records.layouts.get("dialogue-choices-host")?.at(1)).toBeLessThan(
		records.layouts.get("dialogue-choices-content")?.at(1) ?? 0,
	);
});

it("keeps reward choices paired and confirmation actions full width", () => {
	const { panel } = setup(display({ ...page, kind: "rewards" }));
	expect(
		panel.getNavGrid().map((row) => row.map((node) => node.navId)),
	).toContainEqual(["choice:1", "choice:2"]);
	panel.show({
		...display({ ...page, kind: "rewards" }),
		confirmation: { text: "Claim?", code: false },
	});
	expect(
		panel.getNavGrid().map((row) => row.map((node) => node.navId)),
	).toEqual([["dialogue-confirm"]]);
});

it.each([
	["offer", "AvailableQuest.png"],
	["rewards", "CompleteQuest.png"],
	["progress", "CompleteQuest.png"],
] as const)("adds DialogueUI icons to %s actions", (kind, icon) => {
	setup(
		display({
			...page,
			kind,
			rewards: [],
			choices: [],
			requirements: [],
			completable: true,
			autoAccepted: false,
			pvp: false,
		}),
	);
	expect(records.icons.get("dialogue-choices-icon-0")).toBe(
		`Interface\\AddOns\\SteamDeckUI\\assets\\dialogue\\${icon}`,
	);
});

it("adds available and active quest markers to greeting options", () => {
	setup(
		display({
			...page,
			kind: "greeting",
			entries: [
				{ id: "greeting-available:1", label: "Quest" },
				{ id: "greeting-active:1", label: "Quest", detail: "Complete" },
				{ id: "greeting-active:2", label: "Quest", detail: "Incomplete" },
			],
		}),
	);
	expect(records.icons.get("dialogue-choices-icon-0")).toContain(
		"AvailableQuest.png",
	);
	expect(records.icons.get("dialogue-choices-icon-1")).toContain(
		"CompleteQuest.png",
	);
	expect(records.icons.get("dialogue-choices-icon-2")).toContain(
		"IncompleteQuest.png",
	);
});
it("makes reward selection and claiming separate reachable controls", () => {
	const d = display({ ...page, kind: "rewards" });
	const { panel, actions } = setup(d);
	const graph = new NavigationGrid(panel.getNavGrid());
	const visited = new Set<string>();
	const first = graph.first;
	if (!first) throw new Error("Expected dialogue controls");
	const pending = [first];
	while (pending.length) {
		const node = pending.shift();
		if (!node) throw new Error("Expected queued control");
		if (visited.has(node.navId)) continue;
		visited.add(node.navId);
		for (const direction of ["up", "down", "left", "right"] as const) {
			const next = graph.neighbor(node.navId, direction);
			if (next) pending.push(next);
		}
	}
	expect(visited).toEqual(
		new Set(["xp", "choice:1", "choice:2", "dialogue-primary"]),
	);
	graph.get("choice:2")?.onInteract();
	expect(actions.choose).toHaveBeenCalledWith(d.page, 2);
	expect(actions.primary).not.toHaveBeenCalled();
	graph.get("dialogue-primary")?.onInteract();
	expect(actions.primary).toHaveBeenCalledWith(d.page);
});
it("exposes owned code input and confirmation with exclusive B handling", () => {
	const d = {
		...display({ ...page, kind: "gossip", entries: [] }),
		confirmation: { text: "Enter code", code: true },
	};
	const { panel, actions, navigation } = setup(d);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((n) => n.navId),
	).toContain("dialogue-input");
	panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "dialogue-confirm")
		?.onInteract();
	expect(actions.confirm).toHaveBeenCalledWith(d.page, "");
	navigation.pushModal.mock.lastCall?.at(2)?.();
	expect(actions.cancel).toHaveBeenCalledOnce();
	panel.onUnmount();
	expect(navigation.popModal).toHaveBeenCalledWith("npc-dialogue");
});
it("keeps unavailable and suspended actions readable without committing", () => {
	const d = {
		...display({
			...page,
			kind: "progress",
			requirements: [
				{ id: "required:1", label: "Tokens", detail: "0/4 · Incomplete" },
			],
			completable: false,
		}),
		suspended: true,
	};
	const { panel, actions } = setup(d);
	panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "dialogue-primary")
		?.onInteract();
	expect(actions.primary).not.toHaveBeenCalled();
	expect(records.labels.get("dialogue-surface")?.get("hint")).toContain(
		"combat",
	);
});
it("preserves focused reward identity through refresh and restores previous panel focus", () => {
	const nav = new NavigationManager(createTestEventBus());
	const previous = {
		navId: "bags-item",
		onFocus: vi.fn(),
		onBlur: vi.fn(),
		onInteract: vi.fn(),
	};
	nav.registerGrid("bags", [[previous]]);
	nav.setActiveGrid("bags");
	const panel = new DialoguePanel({} as IFramePoolManager, nav);
	const d = display({ ...page, kind: "rewards" });
	panel.show(d);
	panel.onMount(new Frame("parent-800", {} as IFramePoolManager));
	nav.moveDown();
	nav.moveRight();
	expect(nav.focusedId).toBe("choice:2");
	panel.show({
		...d,
		page: { ...d.page, revision: 2 },
		resetReading: false,
		selected: 2,
	});
	expect(nav.focusedId).toBe("choice:2");
	panel.onUnmount();
	expect(nav.focusedId).toBe("bags-item");
});

it("uses vertical navigation and aligns plain options inside their padded rows", () => {
	const { panel } = setup(
		display({
			...page,
			kind: "gossip",
			entries: [{ id: "talk", label: "Tell me more." }],
		}),
	);
	expect(panel.getNavGrid().map((row) => row.map((n) => n.navId))).toEqual([
		["talk"],
	]);
	expect(records.labelAnchors.get("dialogue-choices-row-0:label")).toBe("LEFT");
});

it.each(["offer", "rewards"] as const)(
	"groups guaranteed and choice rewards on the %s page",
	(kind) => {
		setup(display({ ...page, kind, autoAccepted: false, pvp: false }));
		const labels = [...records.labels.values()].flatMap((values) => [
			...values.values(),
		]);
		expect(labels).toContain("Rewards");
		expect(labels).toContain(
			kind === "offer" ? "Choose on completion" : "Choose one reward",
		);
	},
);
