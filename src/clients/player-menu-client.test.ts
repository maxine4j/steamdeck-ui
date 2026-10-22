import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { PlayerMenuClient } from "./player-menu-client";

afterEach(() => vi.unstubAllGlobals());

function setup(vehicle = false) {
	const game = { IsVisible: vi.fn(() => false) };
	const menu = { IsVisible: () => true, Close: vi.fn() };
	const submenu = { IsVisible: () => true, Close: vi.fn() };
	let modified: (owner: unknown, root: typeof description) => void;
	let acquired: (frame: unknown) => void;
	let released: (frame: unknown) => void;
	const description = {
		AddMenuAcquiredCallback: vi.fn((callback) => {
			acquired = callback;
		}),
		AddMenuReleasedCallback: vi.fn((callback) => {
			released = callback;
		}),
		CreateButton: vi.fn(() => ({ AddInitializer: vi.fn() })),
	};
	const exit = vi.fn();
	const canExit = vi.fn(() => vehicle);
	vi.stubGlobal("_G", {
		GameMenuFrame: game,
		UnitPopup_OpenMenu: vi.fn(() => {
			modified(undefined, description);
			acquired(menu);
		}),
		CanExitVehicle: canExit,
		VehicleExit: exit,
		VEHICLE_LEAVE: "Leave vehicle",
		SET_FOCUS: "Set focus",
		MenuUtil: { GetElementText: (description: string) => description },
		Menu: {
			ModifyMenu: vi.fn((_tag, callback) => {
				modified = callback;
			}),
		},
	});
	const observers = new Map<unknown, () => void>();
	const node = (id: string) => ({
		navId: id,
		onFocus() {},
		onBlur() {},
		onInteract() {},
	});
	const controls = {
		watch: vi.fn((frame, callback) => observers.set(frame, callback)),
		grid: vi.fn((id: string) => [[node(id)]]),
		bindSecureAction: vi.fn(),
		clearSecureAction: vi.fn(),
		release: vi.fn(),
	};
	const focus = {},
		vehicleAction = {};
	const host = {
		place: vi.fn(),
		release: vi.fn(),
		prepareAction: vi.fn(),
		destroy: vi.fn(() => true),
		getAction: vi.fn((id: string) =>
			id === "player-focus" ? focus : vehicleAction,
		),
	};
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("NATIVE_DIALOGS_CHANGED", changed);
	const client = new PlayerMenuClient(events, controls, host);
	client.initialize();
	return {
		client,
		host,
		controls,
		game,
		menu,
		submenu,
		description,
		exit,
		canExit,
		changed,
		events,
		focus,
		vehicleAction,
		initializeElement: (frame: unknown, description: string) => {
			const context = (
				_G as unknown as { UnitPopup_OpenMenu: ReturnType<typeof vi.fn> }
			).UnitPopup_OpenMenu.mock.calls
				.at(0)
				?.at(1);
			context.menuElementPreInitializer(frame, description);
		},
		show: () => observers.get(game)?.(),
		acquire: () => acquired(submenu),
		release: () => released(submenu),
		grid: [[node("game")]],
	};
}

it("opens Blizzard's complete SELF menu left of Escape and joins both navigation columns", () => {
	const s = setup();
	s.game.IsVisible.mockReturnValue(true);
	s.show();
	expect(
		(_G as unknown as { UnitPopup_OpenMenu: unknown }).UnitPopup_OpenMenu,
	).toHaveBeenCalledWith("SELF", expect.objectContaining({ unit: "player" }));
	const focusButton = {};
	s.initializeElement(focusButton, "Set focus");
	s.initializeElement(focusButton, "Loot specialization");
	expect(s.controls.clearSecureAction).toHaveBeenLastCalledWith(focusButton);
	expect(s.controls.bindSecureAction).toHaveBeenCalledWith(
		focusButton,
		s.focus,
	);
	expect(s.host.place).toHaveBeenCalledWith(s.menu, s.game);
	expect(
		s.client
			.decorateGameMenu(s.grid)
			.at(0)
			?.map((node) => [node.navId, node.navColumn]),
	).toEqual([
		["player-menu:0", 0],
		["game", 1],
	]);
	s.acquire();
	expect(
		s.client
			.decorateGameMenu(s.grid)
			.at(0)
			?.map((node) => node.navColumn),
	).toEqual([0, 1, 2]);
	expect(s.client.cancelGameMenu()).toBe(true);
	expect(s.submenu.Close).toHaveBeenCalledOnce();
	s.release();
	expect(s.client.decorateGameMenu(s.grid).at(0)).toHaveLength(2);
});

it("adds contextual vehicle exit through Blizzard's menu and rechecks eligibility before activation", () => {
	const s = setup(true);
	s.game.IsVisible.mockReturnValue(true);
	s.show();
	expect(s.description.CreateButton).toHaveBeenCalledWith(
		"Leave vehicle",
		expect.any(Function),
	);
	s.description.CreateButton.mock.calls.at(0)?.at(1)();
	expect(s.exit).toHaveBeenCalledOnce();
	s.canExit.mockReturnValue(false);
	s.description.CreateButton.mock.calls.at(0)?.at(1)();
	expect(s.exit).toHaveBeenCalledOnce();
});

it("omits vehicle exit when unavailable and closes owned menus when Escape hides or the module shuts down", () => {
	const s = setup();
	s.game.IsVisible.mockReturnValue(true);
	s.show();
	expect(s.description.CreateButton).not.toHaveBeenCalled();
	s.game.IsVisible.mockReturnValue(false);
	s.show();
	expect(s.menu.Close).toHaveBeenCalledOnce();
	s.client.shutdown();
	expect(s.controls.release).toHaveBeenCalledOnce();
	expect(s.host.release).toHaveBeenCalled();
	expect(s.client.getDialogs()).toEqual([]);
	expect(s.client.decorateGameMenu(s.grid)).toEqual(s.grid);
});

it("defers protected cleanup until combat ends when shutdown happens in combat", () => {
	const s = setup();
	s.host.destroy.mockReturnValue(false);
	s.client.shutdown();
	expect(s.host.destroy).toHaveBeenCalledOnce();
	s.host.destroy.mockReturnValue(true);
	s.events.emit("COMBAT_ENDED");
	expect(s.host.destroy).toHaveBeenCalledTimes(2);
	s.events.emit("COMBAT_ENDED");
	expect(s.host.destroy).toHaveBeenCalledTimes(2);
});
