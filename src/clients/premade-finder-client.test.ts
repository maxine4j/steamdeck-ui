import { afterEach, expect, it, vi } from "vitest";
import type { Frame } from "../ui/components/frame";
import type { NativeDialogFrame } from "../ui/components/native-dialog-navigation";
import { PremadeFinderClient } from "./premade-finder-client";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	const frame = () => ({
		IsVisible: vi.fn(() => true),
		IsEnabled: vi.fn(() => true),
		GetText: vi.fn(() => ""),
		Click: vi.fn(),
	});
	const search = {
		...frame(),
		SearchBox: frame(),
		FilterButton: frame(),
		RefreshButton: frame(),
		BackButton: frame(),
		SignUpButton: frame(),
		ScrollBox: frame(),
		shouldAlwaysShowCreateGroupButton: false,
	};
	const creation = {
		...frame(),
		Name: frame(),
		selectedActivity: 10,
		selectedGroup: 20,
		selectedPlaystyle: 0,
		generalPlaystyle: 0,
		editMode: false,
	};
	const category = { ...frame(), categoryID: 2, filters: 4 };
	const categories = {
		...frame(),
		CategoryButtons: [category],
		FindGroupButton: frame(),
		StartGroupButton: frame(),
	};
	const root = {
		...frame(),
		CategorySelection: categories,
		SearchPanel: search,
		EntryCreation: creation,
		ApplicationViewer: frame(),
		activePanel: categories,
	};
	const hooks = new Map<string, (...args: unknown[]) => void>();
	const objectHooks = new Map<object, () => void>();
	vi.stubGlobal("LFGListFrame", root);
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	vi.stubGlobal("_G", { Enum: { LFGListFilter: { PvE: 4, PvP: 8 } } });
	const setBase = vi.fn();
	vi.stubGlobal("LFGListFrame_SetBaseFilters", setBase);
	vi.stubGlobal("LFGListFrame_FixPanelValid", vi.fn());
	vi.stubGlobal(
		"LFGListFrame_SetActivePanel",
		vi.fn((_root, panel) => {
			root.activePanel = panel;
		}),
	);
	vi.stubGlobal(
		"hooksecurefunc",
		(
			name: string | object,
			callback: string | ((...args: unknown[]) => void),
			handler?: () => void,
		) => {
			if (typeof name === "string" && typeof callback === "function")
				hooks.set(name, callback);
			else if (typeof name === "object" && handler)
				objectHooks.set(name, handler);
		},
	);
	const title = vi.fn();
	const matches = vi.fn(() => true);
	vi.stubGlobal("C_LFGList", {
		SetEntryTitle: title,
		DoesEntryTitleMatchPrebuiltTitle: matches,
	});
	const layout = { bind: vi.fn(), release: vi.fn() };
	const actions = { bind: vi.fn(), release: vi.fn() };
	const select = vi.fn();
	const find = vi.fn();
	const create = vi.fn();
	const signup = vi.fn();
	const clearCreation = vi.fn();
	vi.stubGlobal("LFGListCategorySelection_SelectCategory", select);
	vi.stubGlobal("LFGListCategorySelectionFindGroupButton_OnClick", find);
	vi.stubGlobal("LFGListCategorySelectionStartGroupButton_OnClick", create);
	vi.stubGlobal("LFGListSearchPanel_SignUp", signup);
	vi.stubGlobal("LFGListEntryCreation_ClearAutoCreateMode", clearCreation);
	const controls = {
		watch: vi.fn(),
		grid: vi.fn(() => [[{ navId: "native", onInteract: vi.fn() }]]),
		menu: vi.fn(() => [[{ navId: "menu", onInteract: vi.fn() }]]),
		list: vi.fn(() => [[{ navId: "result:123", onInteract: vi.fn() }]]),
		control: vi.fn((_id, native: { Click(): void }) => ({
			navId: _id,
			onInteract: () => native.Click(),
		})),
		release: vi.fn(),
	};
	const events = { emit: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() };
	const client = new PremadeFinderClient(events, layout, controls, actions);
	const host = { getSize: () => ({ width: 448, height: 600 }) } as Frame;
	return {
		client,
		host,
		root,
		search,
		creation,
		categories,
		hooks,
		objectHooks,
		title,
		matches,
		layout,
		controls,
		setBase,
		events,
		actions,
		category,
		select,
		find,
		create,
		signup,
		clearCreation,
	};
}

it("hosts Retail premade content in the styled host and restores its layout on exit", () => {
	const s = setup();
	s.client.mount(s.host, false);
	expect(s.setBase).toHaveBeenCalledWith(s.root, 4);
	expect(s.layout.bind).toHaveBeenCalledWith(
		s.root,
		expect.objectContaining({ parent: s.host, reparent: true, visible: true }),
	);
	expect(s.controls.watch).toHaveBeenCalled();
	s.client.unmount();
	expect(s.layout.release).toHaveBeenCalledOnce();
	expect(s.client.navigation()).toEqual([]);
});

it("opens PvP categories using Blizzard's PvP filter", () => {
	const s = setup();
	s.client.mount(s.host, true);
	expect(s.setBase).toHaveBeenCalledWith(s.root, 8);
});

it("keeps search controls reachable and applies to the selected result with X, refreshing with Y", () => {
	const s = setup();
	s.client.mount(s.host, false);
	s.root.activePanel = s.search;
	const ids = s.client
		.navigation()
		.flat()
		.map((node) => node.navId);
	expect(ids).toContain("premade-search");
	expect(ids).toContain("premade-filters");
	expect(ids).toContain("result:123");
	expect(ids).not.toContain("premade-signup");
	const result = s.client
		.navigation()
		.flat()
		.find((node) => node.navId === "result:123");
	result?.onInteract();
	expect(s.signup).toHaveBeenCalledWith(s.search);
	result?.onContext?.();
	expect(s.search.RefreshButton.Click).toHaveBeenCalledOnce();
	s.search.SignUpButton.IsEnabled.mockReturnValue(false);
	result?.onInteract();
	expect(s.signup).toHaveBeenCalledOnce();
});

it("hides stock category actions and binds immediate search and creation to category rows", () => {
	const s = setup();
	s.client.mount(s.host, false);
	const node = s.client.navigation().flat().at(0);
	node?.onInteract();
	expect(s.select).toHaveBeenLastCalledWith(s.categories, 2, 4);
	expect(s.find).toHaveBeenCalledWith(s.categories.FindGroupButton);
	expect(s.clearCreation).toHaveBeenCalledWith(s.creation);
	node?.onContext?.();
	expect(s.create).toHaveBeenCalledWith(s.categories.StartGroupButton);
	expect(s.actions.bind).toHaveBeenCalledWith(
		s.category,
		expect.any(Function),
		"Start Group",
		expect.any(Function),
	);
	for (const button of [
		s.categories.FindGroupButton,
		s.categories.StartGroupButton,
	])
		expect(s.layout.bind).toHaveBeenCalledWith(button, { visible: false });
	s.categories.StartGroupButton.IsEnabled.mockReturnValue(false);
	node?.onContext?.();
	expect(s.create).toHaveBeenCalledOnce();
	s.client.unmount();
	expect(s.actions.release).toHaveBeenCalledOnce();
});

it("restores the native create-row policy after leaving the finder", () => {
	const s = setup();
	s.search.shouldAlwaysShowCreateGroupButton = true;
	s.client.mount(s.host, false);
	s.client.unmount();
	expect(s.search.shouldAlwaysShowCreateGroupButton).toBe(true);
});

it("suppresses default creation controls in search and after native searches", () => {
	const s = setup();
	Object.assign(s.search.ScrollBox, { StartGroupButton: s.search.BackButton });
	s.client.mount(s.host, false);
	s.root.activePanel = s.search;
	expect(
		s.client
			.navigation()
			.flat()
			.map((node) => node.navId),
	).not.toContain("premade-create");
	s.search.shouldAlwaysShowCreateGroupButton = true;
	s.hooks.get("LFGListCategorySelection_StartFindGroup")?.();
	expect(s.search.shouldAlwaysShowCreateGroupButton).toBe(false);
	expect(s.layout.bind).toHaveBeenCalledWith(s.search.BackButton, {
		visible: false,
	});
});

it("returns to categories before leaving the premade page", () => {
	const s = setup();
	s.client.mount(s.host, false);
	s.root.activePanel = s.search;
	expect(s.client.back()).toBe(true);
	expect(s.search.BackButton.Click).toHaveBeenCalledOnce();
	s.root.activePanel = s.categories;
	expect(s.client.back()).toBe(false);
});

it("generates protected titles through Blizzard's API and preserves edited names", () => {
	const s = setup();
	s.client.mount(s.host, false);
	s.hooks.get("LFGListEntryCreation_SetTitleFromActivityInfo")?.(s.creation);
	expect(s.title).toHaveBeenLastCalledWith(10, 20, 0, 0);
	s.creation.Name.GetText.mockReturnValue("My custom group");
	s.matches.mockReturnValue(false);
	s.creation.selectedActivity = 11;
	s.hooks.get("LFGListEntryCreation_SetTitleFromActivityInfo")?.(s.creation);
	expect(s.title).toHaveBeenCalledTimes(1);
	s.matches.mockReturnValue(true);
	s.hooks.get("LFGListEntryCreation_SetTitleFromActivityInfo")?.(s.creation);
	expect(s.title).toHaveBeenLastCalledWith(11, 20, 0, 0);
	s.client.unmount();
	s.hooks.get("LFGListEntryCreation_SetTitleFromActivityInfo")?.(s.creation);
	expect(s.title).toHaveBeenCalledTimes(2);
});

it("traps controller input in an open filter menu and closes it first on Back", () => {
	const s = setup();
	const menu = { IsVisible: () => true } as NativeDialogFrame;
	const close = vi.fn();
	Object.assign(s.search.FilterButton, {
		IsMenuOpen: () => true,
		menu,
		CloseMenu: close,
	});
	s.client.mount(s.host, false);
	s.root.activePanel = s.search;
	s.client.navigation();
	expect(s.controls.menu).toHaveBeenLastCalledWith("premade-menu", menu);
	expect(s.client.back()).toBe(true);
	expect(close).toHaveBeenCalledOnce();
});

it("follows acquired filter submenus and closes nested menus before the root", () => {
	const s = setup();
	let acquired: ((menu: NativeDialogFrame) => void) | undefined;
	let released: ((menu: NativeDialogFrame) => void) | undefined;
	const root = {
		IsVisible: () => true,
		Close: vi.fn(),
	} as unknown as NativeDialogFrame;
	const child = { IsVisible: () => true, Close: vi.fn() };
	const closeRoot = vi.fn();
	Object.assign(s.search.FilterButton, {
		GetMenuDescription: () => ({
			AddMenuAcquiredCallback: (callback: typeof acquired) => {
				acquired = callback;
			},
			AddMenuReleasedCallback: (callback: typeof released) => {
				released = callback;
			},
		}),
		IsMenuOpen: () => true,
		menu: root,
		CloseMenu: closeRoot,
	});
	s.client.mount(s.host, false);
	s.objectHooks.get(s.search.FilterButton)?.();
	acquired?.(root);
	acquired?.(child as unknown as NativeDialogFrame);
	s.client.navigation();
	expect(s.controls.menu).toHaveBeenLastCalledWith("premade-menu", child);
	expect(s.client.back()).toBe(true);
	expect(child.Close).toHaveBeenCalledOnce();
	released?.(child as unknown as NativeDialogFrame);
	s.client.back();
	expect(closeRoot).toHaveBeenCalledOnce();
});

it("traps an activity-picker overlay and navigates every activity before accepting", () => {
	const s = setup();
	const cancel = { ...s.search.BackButton };
	const picker = {
		...s.search.FilterButton,
		Dialog: {
			EntryBox: s.search.SearchBox,
			ScrollBox: {},
			SelectButton: s.search.SignUpButton,
			CancelButton: cancel,
		},
	};
	Object.assign(s.creation, { ActivityFinder: picker });
	s.client.mount(s.host, false);
	s.root.activePanel = s.creation;
	s.client.navigation();
	expect(s.controls.list).toHaveBeenCalledWith(
		"premade-activity",
		picker.Dialog.ScrollBox,
		expect.any(Function),
	);
	s.client.back();
	expect(cancel.Click).toHaveBeenCalledOnce();
});

it("leaves Blizzard's protected title generation in charge after stock validation runs", () => {
	const s = setup();
	s.client.mount(s.host, false);
	// Simulate the stock function running before its secure post-hook. Restricted
	// activities regenerate their title themselves and disallow free text.
	s.creation.Name.GetText.mockReturnValue("Native activity title");
	s.matches.mockReturnValue(false);
	s.title(10, 20, 0, 0);
	s.hooks.get("LFGListEntryCreation_SetTitleFromActivityInfo")?.(s.creation);
	expect(s.title).toHaveBeenCalledTimes(1);
});

it("exposes every applicant as a logical row with native invite/decline actions", () => {
	const s = setup();
	s.client.mount(s.host, false);
	Object.assign(s.root.ApplicationViewer, {
		ScrollBox: {},
		RemoveEntryButton: s.search.BackButton,
		EditButton: s.search.SignUpButton,
	});
	s.root.activePanel = s.root.ApplicationViewer;
	s.client.navigation();
	expect(s.controls.list).toHaveBeenCalledWith(
		"premade-applicant",
		expect.anything(),
		expect.any(Function),
		expect.any(Function),
		expect.any(Function),
	);
});
