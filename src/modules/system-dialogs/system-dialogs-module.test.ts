import { expect, it, vi } from "vitest";
import type { NativeDialog } from "../../clients/native-dialogs-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import { SystemDialogsModule } from "./system-dialogs-module";

function dialog(id: string): NativeDialog {
	return {
		id,
		cancel: vi.fn(),
		grid: [
			[
				{
					navId: `${id}-accept`,
					onFocus: vi.fn(),
					onBlur: vi.fn(),
					onInteract: vi.fn(),
				},
				{
					navId: `${id}-decline`,
					onFocus: vi.fn(),
					onBlur: vi.fn(),
					onInteract: vi.fn(),
				},
			],
		],
	};
}

it("uses a preferred action on each opening while preserving selection on refresh and popup dismissal", () => {
	const events = createTestEventBus();
	const nav = new NavigationManager(events);
	const menu = { ...dialog("menu"), defaultFocusId: "menu-decline" };
	const popup = { ...dialog("popup"), defaultFocusId: "popup-decline" };
	let dialogs: NativeDialog[] = [menu];
	const module = new SystemDialogsModule(
		{ initialize: vi.fn(), shutdown: vi.fn(), getDialogs: () => dialogs },
		events,
		nav,
	);
	module.initialize();
	expect(nav.focusedId).toBe("menu-decline");
	events.emit("NAV_LEFT");
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("menu-accept");
	dialogs = [menu, popup];
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("popup-decline");
	dialogs = [menu];
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("menu-accept");
	dialogs = [];
	events.emit("NATIVE_DIALOGS_CHANGED");
	dialogs = [menu];
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("menu-decline");
	module.shutdown();
});

it("traps popup input, restores menu focus, and restores the prior addon modal on shutdown", () => {
	const events = createTestEventBus();
	const nav = new NavigationManager(events);
	const addon = dialog("addon"),
		menu = dialog("menu"),
		invite = dialog("invite");
	nav.pushModal(addon.id, addon.grid, addon.cancel);
	let dialogs: NativeDialog[] = [menu];
	const client = {
		initialize: vi.fn(),
		shutdown: vi.fn(),
		getDialogs: () => dialogs,
	};
	const module = new SystemDialogsModule(client, events, nav);
	module.initialize();
	expect(client.initialize).toHaveBeenCalledOnce();
	expect(nav.focusedId).toBe("menu-accept");
	events.emit("NAV_RIGHT");
	dialogs = [menu, invite];
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("invite-accept");
	events.emit("NAV_INTERACT");
	expect(invite.grid.at(0)?.at(0)?.onInteract).toHaveBeenCalledOnce();
	events.emit("NAV_CANCEL");
	expect(invite.cancel).toHaveBeenCalledOnce();
	dialogs = [menu];
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("menu-decline");
	module.shutdown();
	expect(nav.focusedId).toBe("addon-accept");
	expect(client.shutdown).toHaveBeenCalledOnce();
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("addon-accept");
});

it("keeps popup priority when the menu opens underneath and refreshes changing buttons", () => {
	const events = createTestEventBus();
	const nav = new NavigationManager(events);
	const invite = dialog("invite"),
		menu = dialog("menu");
	let dialogs: NativeDialog[] = [invite];
	const module = new SystemDialogsModule(
		{ initialize: vi.fn(), shutdown: vi.fn(), getDialogs: () => dialogs },
		events,
		nav,
	);
	module.initialize();
	dialogs = [menu, invite];
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("invite-accept");
	invite.grid.at(0)?.shift();
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("invite-decline");
	dialogs = [invite];
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(nav.focusedId).toBe("invite-decline");
	module.shutdown();
	expect(nav.focusedId).toBeUndefined();
});
