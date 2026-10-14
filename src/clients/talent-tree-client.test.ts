import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import type { Frame } from "../ui/components/frame";
import type { NativeLayout } from "../ui/components/native-layout";
import type { NativeNavigation } from "../ui/components/native-navigation";
import { TalentTreeClient } from "./talent-tree-client";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	const button = (id: number, x: number, y: number, visible = true) => ({
		GetNodeID: () => id,
		GetEntryID: () => id + 100,
		GetCenter: () => [x, y],
		GetEffectiveScale: () => 1,
		GetParent: vi.fn(),
		IsVisible: () => visible,
		OnClick: vi.fn(),
		OnEnter: vi.fn(),
		OnLeave: vi.fn(),
		ShowSelections: vi.fn(),
		talentSelections: [1, 2],
	});
	const nodes = [
		button(1, 10, 100),
		button(2, 90, 100),
		button(3, 50, 60),
		button(4, 50, 20),
		button(5, 10, 30, false),
	];
	const choices = [button(11, 40, 110), button(12, 60, 110)];
	let choicesOpen = false;
	const hooks = new Map<string, () => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		(_frame: unknown, name: string, callback: () => void) =>
			hooks.set(`method-${name}`, callback),
	);
	const hero = {
		isCollapsed: true,
		SetCollapsed: vi.fn((collapsed: boolean) => {
			hero.isCollapsed = collapsed;
		}),
	};
	const control = (x: number, y: number) => {
		const scripts = { OnEnter: vi.fn(), OnLeave: vi.fn() };
		return {
			GetCenter: () => [x, y],
			GetEffectiveScale: () => 1,
			IsVisible: vi.fn(() => false),
			IsEnabled: vi.fn(() => true),
			Click: vi.fn(),
			GetScript: (name: keyof typeof scripts) => scripts[name],
			scripts,
		};
	};
	const apply = control(50, 0);
	const heroSelector = control(50, 140);
	const specs = [20, 80].map((x, index) => ({
		subTreeID: index + 10,
		NodesContainer: {},
		ActivateButton: control(x, 10),
		ApplyChangesButton: control(x, 10),
	}));
	const heroDialog = {
		IsShown: vi.fn(() => false),
		Hide: vi.fn(() => heroDialog.IsShown.mockReturnValue(false)),
		HookScript: (name: string, callback: () => void) =>
			hooks.set(`hero-${name}`, callback),
		SpecContentFramePool: { EnumerateActive: () => specs },
	};
	const tree = {
		GetSize: () => [1000, 600],
		EnumerateAllTalentButtons: () => nodes,
		SelectionChoiceFrame: {
			IsShown: () => choicesOpen,
			selectionFrameArray: choices,
			HookScript: (name: string, callback: () => void) =>
				hooks.set(`choices-${name}`, callback),
		},
		ApplyButton: apply,
		heroSpecSelectionDialog: heroDialog,
		HeroTalentsContainer: Object.assign(hero, { HeroSpecButton: heroSelector }),
		HideSelections: vi.fn(() => {
			choicesOpen = false;
		}),
	};
	nodes.at(1)?.ShowSelections.mockImplementation(() => {
		choicesOpen = true;
	});
	const tabs = { IsShown: () => true, Show: vi.fn(), Hide: vi.fn() };
	const border = { IsShown: () => true, Show: vi.fn(), Hide: vi.fn() };
	vi.stubGlobal("PlayerSpellsFrame", {
		TabSystem: tabs,
		NineSlice: border,
		TalentsFrame: tree,
		GetSize: () => [1000, 600],
		GetScale: () => 1,
	});
	vi.stubGlobal("TalentDisplayMixin", { OnEnter: vi.fn(), OnLeave: vi.fn() });
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("TALENTS_CHANGED", changed);
	const native = {
		openFull: vi.fn(),
		close: vi.fn(),
		isFullOpen: vi.fn(() => true),
	};
	const layout = { bind: vi.fn(), release: vi.fn() };
	const chrome = { hide: vi.fn(), restore: vi.fn() };
	const navigation = {
		navigation: vi.fn(
			(
				_frame: unknown,
				_scroll: unknown,
				navId: string,
				activate: () => void,
			) => ({ navId, onFocus: vi.fn(), onBlur: vi.fn(), onInteract: activate }),
		),
		release: vi.fn(),
	};
	const client = new TalentTreeClient(
		native,
		layout as unknown as NativeLayout,
		navigation as unknown as NativeNavigation,
		events,
		chrome,
	);
	const parent = { getSize: () => ({ width: 800, height: 500 }) } as Frame;
	return {
		client,
		native,
		layout,
		navigation,
		parent,
		tree,
		nodes,
		choices,
		hooks,
		changed,
		chrome,
		apply,
		heroSelector,
		heroDialog,
		specs,
	};
}

it("navigates Apply and the hero selector spatially, using native control actions and hover scripts", () => {
	const { client, parent, apply, heroSelector } = setup();
	apply.IsVisible.mockReturnValue(true);
	heroSelector.IsVisible.mockReturnValue(true);
	client.mount(parent);
	const grid = client.navigation();
	expect(grid.at(0)?.at(0)?.navId).toBe("talent-hero-select");
	const node = grid.at(-1)?.at(0);
	expect(node?.navId).toBe("talent-apply");
	node?.onFocus();
	expect(apply.scripts.OnEnter).toHaveBeenCalledWith(apply);
	expect(TalentDisplayMixin.OnEnter).not.toHaveBeenCalled();
	node?.onInteract();
	expect(apply.Click).toHaveBeenCalledWith("LeftButton");
	apply.IsEnabled.mockReturnValue(false);
	node?.onInteract();
	expect(apply.Click).toHaveBeenCalledOnce();
	node?.onBlur();
	expect(apply.scripts.OnLeave).toHaveBeenCalledWith(apply);
	grid.at(0)?.at(0)?.onInteract();
	expect(heroSelector.Click).toHaveBeenCalledWith("LeftButton");
});

it("restricts hero dialog navigation to its talents and visible activation/apply controls, and closes it on Back", () => {
	const { client, parent, heroDialog, specs, nodes, hooks, changed } = setup();
	client.mount(parent);
	heroDialog.IsShown.mockReturnValue(true);
	specs.at(0)?.ActivateButton.IsVisible.mockReturnValue(true);
	specs.at(1)?.ApplyChangesButton.IsVisible.mockReturnValue(true);
	nodes.at(2)?.GetParent.mockReturnValue(specs.at(0)?.NodesContainer);
	const grid = client.navigation();
	expect(grid.map((row) => row.map((node) => node.navId))).toEqual([
		["talent-node-3"],
		["talent-hero-activate-10", "talent-hero-apply-11"],
	]);
	grid.at(-1)?.at(0)?.onInteract();
	expect(specs.at(0)?.ActivateButton.Click).toHaveBeenCalledWith("LeftButton");
	grid.at(-1)?.at(1)?.onInteract();
	expect(specs.at(1)?.ApplyChangesButton.Click).toHaveBeenCalledWith(
		"LeftButton",
	);
	changed.mockClear();
	hooks.get("hero-OnShow")?.();
	expect(changed).toHaveBeenCalledOnce();
	expect(client.dismissChoices()).toBe(true);
	expect(heroDialog.Hide).toHaveBeenCalledOnce();
	expect(client.dismissChoices()).toBe(false);
});

it("closes the hero dialog when the fullscreen tree unmounts", () => {
	const { client, parent, heroDialog } = setup();
	client.mount(parent);
	heroDialog.IsShown.mockReturnValue(true);
	client.unmount();
	expect(heroDialog.Hide).toHaveBeenCalledOnce();
});

it("hosts and fits the native tree, includes visible class/spec/hero/apex nodes spatially, and restores on close", () => {
	const { client, native, layout, navigation, parent, nodes, tree, chrome } =
		setup();
	expect(client.navigation()).toEqual([]);
	client.mount(parent);
	expect(native.openFull).toHaveBeenCalledOnce();
	expect(layout.bind).toHaveBeenCalledWith(
		tree,
		expect.objectContaining({
			parent: PlayerSpellsFrame,
			reparent: false,
			scale: 1,
			anchors: [["CENTER", "CENTER", 0, 0]],
		}),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		PlayerSpellsFrame,
		expect.objectContaining({ parent, size: [1000, 600], scale: 0.8 }),
	);
	expect(chrome.hide).toHaveBeenCalledWith([
		PlayerSpellsFrame?.NineSlice,
		PlayerSpellsFrame?.TabSystem,
	]);
	expect(client.presentation({ width: 800, height: 500 })).toEqual({
		width: 800,
		height: 480,
	});
	expect(tree.HeroTalentsContainer.SetCollapsed).toHaveBeenCalledWith(
		false,
		true,
	);
	const grid = client.navigation();
	expect(grid.map((row) => row.map((node) => node.navId))).toEqual([
		["talent-node-1", "talent-node-2"],
		["talent-node-3"],
		["talent-node-4"],
	]);
	expect(grid.at(0)?.at(1)?.navColumn).toBe(90);
	const hero = grid.at(1)?.at(0);
	hero?.onFocus();
	expect(TalentDisplayMixin.OnEnter).toHaveBeenCalledWith(nodes.at(2));
	expect(nodes.at(2)?.OnEnter).not.toHaveBeenCalled();
	hero?.onInteract();
	expect(nodes.at(2)?.OnClick).toHaveBeenCalledWith("LeftButton");
	hero?.onBlur();
	expect(TalentDisplayMixin.OnLeave).toHaveBeenCalledWith(nodes.at(2));
	client.unmount();
	expect(layout.release).toHaveBeenCalledOnce();
	expect(chrome.restore).toHaveBeenCalledOnce();
	expect(navigation.release).toHaveBeenCalledOnce();
	expect(native.close).toHaveBeenCalledOnce();
	expect(client.navigation()).toEqual([]);
});

it("opens choices with Y, navigates their tooltips and actions, and dismisses them before leaving the tree", () => {
	const { client, parent, choices, nodes, tree, hooks, changed } = setup();
	client.mount(parent);
	client.navigation().at(0)?.at(1)?.onContext?.();
	expect(nodes.at(1)?.ShowSelections).toHaveBeenCalledOnce();
	const grid = client.navigation();
	expect(grid.flat().map((node) => node.navId)).toEqual([
		"talent-choice-111",
		"talent-choice-112",
	]);
	grid.at(0)?.at(0)?.onFocus();
	expect(TalentDisplayMixin.OnEnter).toHaveBeenCalledWith(choices.at(0));
	grid.at(0)?.at(0)?.onInteract();
	expect(choices.at(0)?.OnClick).toHaveBeenCalledWith("LeftButton");
	expect(client.dismissChoices()).toBe(true);
	expect(tree.HideSelections).toHaveBeenCalled();
	expect(client.dismissChoices()).toBe(false);
	hooks.get("method-OnUpdate")?.();
	hooks.get("choices-OnHide")?.();
	expect(changed).toHaveBeenCalled();
	changed.mockClear();
	client.unmount();
	hooks.get("method-OnUpdate")?.();
	expect(changed).not.toHaveBeenCalled();
});

it("keeps hero nodes expanded after Blizzard updates and restores the collapse state without closing a different native tab", () => {
	const { client, parent, tree, hooks, native } = setup();
	client.mount(parent);
	tree.HeroTalentsContainer.isCollapsed = true;
	hooks.get("method-OnUpdate")?.();
	expect(tree.HeroTalentsContainer.isCollapsed).toBe(false);
	native.isFullOpen.mockReturnValue(false);
	client.unmount();
	expect(tree.HeroTalentsContainer.SetCollapsed).toHaveBeenLastCalledWith(
		true,
		true,
	);
	expect(native.close).not.toHaveBeenCalled();
});
