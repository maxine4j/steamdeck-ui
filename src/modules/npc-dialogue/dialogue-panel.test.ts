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
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(readonly id: string) {
			records.created++;
			records.labels.set(id, new Map());
		}
		layout(w: number, h: number) {
			records.layouts.set(this.id, [w, h]);
		}
		setLabel(key: string, text: string) {
			records.labels.get(this.id)?.set(key, text);
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
		setColor = vi.fn();
		setCloseButtonBackground = vi.fn();
		setButtonBackground = vi.fn();
		setWindowBackground = vi.fn();
		setInsetBackground = vi.fn();
		setFocusBorder = vi.fn();
		setFocused = vi.fn();
		setTooltip = vi.fn();
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
	"fits a centered conversation within a 1280×%i host and reuses controls",
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
		expect(w).toBeLessThan(1280);
		expect(h).toBeLessThan(height);
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
	nav.moveRight();
	nav.moveDown();
	nav.moveDown();
	expect(nav.focusedId).toBe("choice:2");
	panel.show({ ...d, resetReading: false, selected: 2 });
	expect(nav.focusedId).toBe("choice:2");
	panel.onUnmount();
	expect(nav.focusedId).toBe("bags-item");
});
