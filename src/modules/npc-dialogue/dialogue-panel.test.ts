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
			return { width: 1280, height: this.id.includes("720") ? 720 : 800 };
		}
		labelHeight(key: string) {
			return (
				Math.ceil((records.labels.get(this.id)?.get(key)?.length ?? 0) / 30) *
				22
			);
		}
		setParent = vi.fn();
		setColor = () => records.skins.set(this.id, "flat");
		setAtlasBackground = (atlas: string) => records.skins.set(this.id, atlas);
		setLabelStyle = vi.fn();
		setCloseButtonBackground = vi.fn();
		setButtonBackground = () => records.skins.set(this.id, "red-button");
		setWindowBackground = vi.fn();
		setInsetBackground = vi.fn();
		setFocusBorder = vi.fn();
		setFocused = vi.fn();
		setTooltip = vi.fn();
		setHoverTooltip = vi.fn();
		showTooltip = vi.fn();
		hideTooltip = vi.fn();
		setIcon = vi.fn();
		setLabelWordWrap = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		configureInput = vi.fn();
		clearInput = vi.fn();
		focusInput = vi.fn();
		fill = vi.fn();
		inset = vi.fn();
		onClick = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		resetScroll = vi.fn();
		revealVerticalRange = vi.fn();
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

it.each([720, 800])(
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
		expect(h).toBeLessThan(height);
		expect(records.anchors.get("dialogue-window")?.at(0)).toBe("RIGHT");
		const readingTop = -(
			records.anchors.get("dialogue-reading-host")?.at(2) ?? 0
		);
		const readingHeight =
			records.layouts.get("dialogue-reading-host")?.at(1) ?? 0;
		const choicesTop = -(
			records.anchors.get("dialogue-choices-host")?.at(2) ?? 0
		);
		expect(choicesTop).toBeGreaterThanOrEqual(readingTop + readingHeight);
		expect(records.skins.get("dialogue-window")).toBe("QuestBG-Parchment");
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
it("makes reward selection, claiming, reading and closing separate reachable controls", () => {
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
		new Set([
			"dialogue-reading",
			"xp",
			"choice:1",
			"choice:2",
			"dialogue-primary",
			"dialogue-cancel",
		]),
	);
	graph.get("choice:2")?.onInteract();
	expect(actions.choose).toHaveBeenCalledWith(d.page, 2);
	expect(actions.primary).not.toHaveBeenCalled();
	graph.get("dialogue-primary")?.onInteract();
	expect(actions.primary).toHaveBeenCalledWith(d.page);
});
it("exposes owned code input, confirm and cancel with exclusive B handling", () => {
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
	expect(records.labels.get("dialogue-window")?.get("hint")).toContain(
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
	nav.moveDown();
	nav.moveDown();
	expect(nav.focusedId).toBe("choice:2");
	panel.show({ ...d, resetReading: false, selected: 2 });
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
		["dialogue-reading"],
		["talk"],
		["dialogue-cancel"],
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
