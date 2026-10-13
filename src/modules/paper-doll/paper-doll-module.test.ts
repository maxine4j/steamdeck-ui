import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { PaperDollModule } from "./paper-doll-module";

it("refreshes equipment and stats, mirrors native visibility on the left and restores on shutdown", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const character = {
		getIdentity: vi.fn(() => ({
			name: "Mings",
			level: 80,
			race: "Night Elf",
			className: "Druid",
		})),
		isOpen: vi.fn(() => false),
		getEquipment: vi.fn(() => []),
		getStats: vi.fn(() => []),
		close: vi.fn(),
	};
	const view = {
		setIdentity: vi.fn(),
		setEquipment: vi.fn(),
		setStats: vi.fn(),
		refreshPreview: vi.fn(),
		refreshTitles: vi.fn(),
		showTitles: vi.fn(),
	};
	const builtIn = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: () => character.isOpen(),
	};
	const nativeTitles = { disable: vi.fn(), restore: vi.fn() };
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			let cancelled = false;
			pending.push(() => {
				if (!cancelled) callback();
			});
			return () => {
				cancelled = true;
			};
		},
	};
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	const module = new PaperDollModule(
		ui,
		events,
		character,
		view,
		builtIn,
		scheduler,
		nativeTitles,
	);
	module.disableBuiltIn();
	module.initialize();
	expect(builtIn.disable).toHaveBeenCalledOnce();
	expect(nativeTitles.disable).toHaveBeenCalledOnce();
	events.emit("TITLES_OPEN");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith("paper-doll", "left");
	expect(view.showTitles).toHaveBeenCalledOnce();
	ui.openPanel.mockClear();
	events.emit("TITLES_CHANGED");
	expect(view.refreshTitles).toHaveBeenCalledOnce();
	character.isOpen.mockReturnValue(true);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith("paper-doll", "left");
	expect(view.setIdentity).toHaveBeenCalledWith(
		character.getIdentity.mock.results.at(0)?.value,
	);
	events.emit("CHARACTER_IDENTITY_CHANGED");
	events.emit("CHARACTER_IDENTITY_CHANGED");
	expect(character.getIdentity).toHaveBeenCalledOnce();
	flush();
	expect(character.getIdentity).toHaveBeenCalledTimes(2);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledOnce();
	events.emit("PLAYER_EQUIPMENT_CHANGED");
	events.emit("PLAYER_EQUIPMENT_CHANGED");
	expect(character.getEquipment).toHaveBeenCalledOnce();
	flush();
	expect(character.getEquipment).toHaveBeenCalledTimes(2);
	expect(view.refreshPreview).toHaveBeenCalledTimes(2);
	events.emit("CHARACTER_STATS_CHANGED");
	flush();
	expect(character.getStats).toHaveBeenCalledTimes(3);
	character.isOpen.mockReturnValue(false);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	events.emit("CHARACTER_IDENTITY_CHANGED");
	flush();
	expect(character.getIdentity).toHaveBeenCalledTimes(2);
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith("left", "paper-doll");
	character.isOpen.mockReturnValue(true);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	expect(character.getIdentity).toHaveBeenCalledTimes(3);
	expect(character.getEquipment).toHaveBeenCalledTimes(2);
	expect(character.getStats).toHaveBeenCalledTimes(3);
	character.isOpen.mockReturnValue(false);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	events.emit("PLAYER_EQUIPMENT_CHANGED");
	events.emit("PLAYER_EQUIPMENT_CHANGED");
	expect(character.getEquipment).toHaveBeenCalledTimes(2);
	character.isOpen.mockReturnValue(true);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	expect(character.getEquipment).toHaveBeenCalledTimes(3);
	module.shutdown();
	events.emit("PLAYER_EQUIPMENT_CHANGED");
	expect(character.getEquipment).toHaveBeenCalledTimes(3);
	expect(builtIn.restore).toHaveBeenCalledOnce();
	expect(nativeTitles.restore).toHaveBeenCalledOnce();
	events.emit("TITLES_CHANGED");
	events.emit("TITLES_OPEN");
	expect(view.refreshTitles).toHaveBeenCalledOnce();
	expect(view.showTitles).toHaveBeenCalledOnce();
});
