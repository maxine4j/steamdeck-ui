import { afterEach, expect, it, vi } from "vitest";
import type { IPetsClient } from "../clients/pets-client";
import type { IToysClient } from "../clients/toys-client";
import { createTestEventBus } from "../events/test-event-bus";
import { Frame } from "../ui/components/frame";
import type {
	NativeDropdownButton,
	NativeMenuRoot,
} from "../ui/components/native-menu";
import type { IFramePoolManager } from "../ui/frame-pool-manager";
import { NavigationManager } from "../ui/navigation/navigation-manager";
import { PetsPanel } from "./pets/pets-panel";
import { ToysPanel } from "./toys/toys-panel";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it.each(["toys", "pets"])(
	"routes %s header and menu navigation, retains checkbox focus and restores collection actions",
	(kind) => {
		for (const method of [
			"fill",
			"setWindowBackground",
			"setButtonBackground",
			"setInsetBackground",
			"setTooltip",
			"setParent",
			"layout",
			"setColor",
			"inset",
			"onSizeChanged",
			"setScrollContent",
			"clampScroll",
			"setIcon",
			"setAtlasBackground",
			"setOpacity",
			"setToy",
			"setHoverTooltip",
			"setCooldown",
			"setLabel",
			"show",
			"hide",
			"setFocused",
			"destroy",
			"revealVerticalRange",
			"scrollToEdge",
			"configureInput",
			"focusInput",
			"blurInput",
			"onClick",
		] as const)
			vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
		vi.stubGlobal("MenuResponse", { Refresh: 2, Close: 3 });
		vi.stubGlobal("MenuInputContext", { None: 1 });
		const callbacks = new Map<string, () => void>();
		let open = false;
		let generate:
			| ((button: NativeDropdownButton, root: NativeMenuRoot) => void)
			| undefined;
		const checkbox = (
			_label: string,
			_selected: () => boolean,
			respond: () => number,
		) => ({
			AddInitializer: vi.fn(),
			HandleOnEnter: vi.fn(),
			HandleOnLeave: vi.fn(),
			Pick: () => {
				if (respond() === 3) native.CloseMenu();
			},
		});
		const root: NativeMenuRoot = {
			SetScrollMode: vi.fn(),
			CreateCheckbox: checkbox,
			CreateRadio: checkbox,
			CreateButton: (label, respond) => checkbox(label, () => false, respond),
		};
		const native = {
			resizeToText: false,
			SetupMenu: (callback: typeof generate) => {
				generate = callback;
				generate?.(native as unknown as NativeDropdownButton, root);
			},
			RegisterCallback: (event: string, callback: () => void) =>
				callbacks.set(event, callback),
			UnregisterCallback: vi.fn(),
			ClearMenuState: vi.fn(),
			IsMenuOpen: () => open,
			SetMenuOpen: (value: boolean) => {
				open = value;
				generate?.(native as unknown as NativeDropdownButton, root);
				callbacks.get(value ? "OnMenuOpen" : "OnMenuClose")?.();
			},
			CloseMenu: () => {
				if (open) {
					open = false;
					callbacks.get("OnMenuClose")?.();
				}
			},
		};
		vi.spyOn(Frame.prototype, "getDropdownButton").mockReturnValue(
			native as unknown as NativeDropdownButton,
		);
		let checked = false;
		const query = {
			search: vi.fn(),
			getFilters: () => [{ id: "collected", label: "Collected", checked }],
			toggleFilter: vi.fn(() => {
				checked = !checked;
			}),
			prefetch: vi.fn(),
			invalidate: vi.fn(),
			stop: vi.fn(),
			isInCombat: () => false,
			canUse: () => true,
			toggleFavourite: vi.fn(),
		};
		const toys: IToysClient = {
			...query,
			load: vi.fn(() => vi.fn()),
			getCooldown: () => ({ start: 0, duration: 0 }),
		};
		const pets: IPetsClient = {
			...query,
			load: vi.fn(() => vi.fn()),
			summon: vi.fn(),
			summonFavourite: vi.fn(),
		};
		const pending: (() => void)[] = [];
		const scheduler = {
			nextFrame: (callback: () => void) => {
				pending.push(callback);
				return () => {};
			},
		};
		const menu = { open: vi.fn(), close: vi.fn() };
		const pool = {} as IFramePoolManager;
		const panel =
			kind === "toys"
				? new ToysPanel(pool, toys, menu, scheduler, vi.fn())
				: new PetsPanel(pool, pets, menu, scheduler, vi.fn());
		panel.onMount(new Frame("parent", pool));
		if (kind === "toys")
			vi.mocked(toys.load).mock.lastCall?.at(0)?.([
				{ id: 1, name: "Toy", icon: 1, collected: true, favourite: false },
			]);
		else
			vi.mocked(pets.load).mock.lastCall?.at(0)?.([
				{
					id: "Pet-1",
					speciesId: 1,
					name: "Pet",
					icon: 1,
					collected: true,
					favourite: false,
				},
			]);
		while (pending.length) pending.shift()?.();
		const nav = new NavigationManager(createTestEventBus());
		nav.registerGrid(kind, () => panel.getNavGrid());
		nav.setActiveGrid(kind);
		panel.setNavigationChanged((focusId) => nav.refreshGrid(kind, focusId));
		expect(nav.focusedId).toBe(`${kind}-search`);
		nav.moveDown();
		expect(nav.focusedId).toBe(`${kind}-filters`);
		nav.interact();
		expect(nav.focusedId).toBe("collected");
		nav.interact();
		expect(query.toggleFilter).toHaveBeenCalledWith("collected");
		expect(checked).toBe(true);
		expect(native.IsMenuOpen()).toBe(true);
		expect(nav.focusedId).toBe("collected");
		expect(
			panel
				.getNavGrid()
				.flat()
				.some(
					(node) => node.navId === (kind === "toys" ? "toy-1" : "pet-Pet-1"),
				),
		).toBe(false);
		native.CloseMenu();
		expect(nav.focusedId).toBe(`${kind}-filters`);
		expect(
			panel
				.getNavGrid()
				.flat()
				.some(
					(node) => node.navId === (kind === "toys" ? "toy-1" : "pet-Pet-1"),
				),
		).toBe(true);
		panel.onUnmount();
		expect(panel.getNavGrid()).toEqual([]);
		nav.destroy();
		panel.destroy();
	},
);
