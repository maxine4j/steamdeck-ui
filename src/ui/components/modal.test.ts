import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IFramePoolManager } from "../frame-pool-manager";
import { NavigationManager } from "../navigation/navigation-manager";
import { Frame } from "./frame";
import { Modal } from "./modal";

afterEach(() => vi.restoreAllMocks());

it("moves the active gold border to the modal and restores panel focus on close", () => {
	for (const method of [
		"modalBackdrop",
		"setColor",
		"onClose",
		"setParent",
		"setModalLayer",
		"setBorder",
		"setFocused",
		"layout",
		"setLabel",
		"onClick",
		"show",
		"hide",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	const borders = vi
		.spyOn(Frame.prototype, "setFocusBorder")
		.mockImplementation(() => {});
	const events = createTestEventBus();
	const navigation = new NavigationManager(events);
	const panelActive = vi.fn();
	navigation.registerGrid("bags", [], { onActiveChanged: panelActive });
	navigation.setActiveGrid("bags");
	const modal = new Modal(
		"item-actions",
		{} as IFramePoolManager,
		navigation,
		events,
	);
	const selected = vi.fn();
	modal.open("Item actions", [{ id: "use", label: "Use", select: selected }]);
	modal.open(
		"Marks • 125 / 500",
		[{ id: "watch", label: "Watch", select: selected }],
		undefined,
		"left",
	);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"title",
		"Marks • 125 / 500",
		"TOPLEFT",
		20,
		-20,
		18,
		328,
	);
	expect(panelActive).toHaveBeenLastCalledWith(false);
	expect(borders).toHaveBeenLastCalledWith(true);
	expect(borders.mock.contexts.at(-1)?.id).toBe("item-actions-window");
	navigation.interact();
	expect(borders).toHaveBeenLastCalledWith(false);
	expect(panelActive).toHaveBeenLastCalledWith(true);
	expect(selected).toHaveBeenCalledOnce();
	modal.open("Item actions", [{ id: "use", label: "Use", select: selected }]);
	expect(borders).toHaveBeenLastCalledWith(true);
	events.emit("COMBAT_STARTED");
	expect(borders).toHaveBeenLastCalledWith(false);
	expect(panelActive).toHaveBeenLastCalledWith(true);
});
