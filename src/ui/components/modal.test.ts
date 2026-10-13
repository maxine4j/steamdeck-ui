import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IFramePoolManager } from "../frame-pool-manager";
import { NavigationManager } from "../navigation/navigation-manager";
import { Frame } from "./frame";
import { Modal } from "./modal";

afterEach(() => vi.restoreAllMocks());

it("activates secure toy options before dismissing and reuses their pooled controls", () => {
	for (const method of [
		"modalBackdrop",
		"setColor",
		"setWindowBackground",
		"setButtonBackground",
		"onClose",
		"setParent",
		"setModalLayer",
		"setFocusBorder",
		"layout",
		"setLabel",
		"onClick",
		"show",
		"hide",
		"setFocused",
		"setToy",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	const posts = new Map<string, () => void>();
	vi.spyOn(Frame.prototype, "onPostClick").mockImplementation(
		function (callback) {
			if (callback) posts.set(this.id, () => callback("LeftButton"));
		},
	);
	const clicks = vi
		.spyOn(Frame.prototype, "click")
		.mockImplementation(function () {
			posts.get(this.id)?.();
		});
	const focused = vi.fn();
	const navigation = new NavigationManager(
		createTestEventBus(),
		undefined,
		focused,
	);
	const modal = new Modal(
		"toys",
		{} as IFramePoolManager,
		navigation,
		createTestEventBus(),
	);
	const selected = vi.fn();
	modal.open("Toy actions", [
		{ id: "use", label: "Use", toy: 42, select: selected },
	]);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"hint",
		expect.stringContaining("xbox_r_a.blp:18:18|t Select"),
		"BOTTOMRIGHT",
		-20,
		16,
		12,
		328,
	);
	expect(Frame.prototype.setToy).toHaveBeenLastCalledWith(42);
	navigation.interact();
	expect(clicks).not.toHaveBeenCalled();
	const action = focused.mock.lastCall?.at(0)?.secureActions?.().interact;
	expect(action?.id).toBe("toys-action-0");
	posts.get(action.id)?.();
	expect(selected).toHaveBeenCalledOnce();
	modal.open("Toy actions", [
		{ id: "use", label: "Use", toy: 43, select: selected },
	]);
	expect(Frame.prototype.setToy).toHaveBeenLastCalledWith(43);
	modal.close();
	navigation.interact();
	expect(selected).toHaveBeenCalledTimes(1);
});

it("moves the active gold border to the modal and restores panel focus on close", () => {
	for (const method of [
		"modalBackdrop",
		"setColor",
		"setWindowBackground",
		"setButtonBackground",
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
