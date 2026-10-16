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
		"window-title",
		"Toy actions",
		"TOP",
		0,
		-6,
		12,
	);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"hint",
		expect.stringContaining("xbox_r_x.blp:18:18|t Select"),
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
	modal.open("Marks • 125 / 500", [
		{ id: "watch", label: "Watch", select: selected },
	]);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"window-title",
		"Marks • 125 / 500",
		"TOP",
		0,
		-6,
		12,
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

it.each([
	["item-actions", "Item actions", 42],
	["equipment-options", "Head options", "item:42"],
	["mount-actions", "Mount actions", { mountSpell: 42 }],
	["toy-actions", "Toy actions", { toy: 42 }],
	[
		"reputation-options",
		"Faction options",
		{ text: "Long faction description" },
	],
	["quest-options", "Quest options", undefined],
	["currency-options", "Marks • 125 / 500", undefined],
	["dungeon-queue-confirmation", "Leave Queue?", undefined],
] as const)(
	"centers %s titles across the whole modal title bar",
	(id, title, item) => {
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
		] as const)
			vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
		vi.spyOn(Frame.prototype, "getSize").mockReturnValue({
			width: 1280,
			height: 800,
		});
		vi.spyOn(Frame.prototype, "showItemTooltip").mockReturnValue({
			width: 400,
			height: 300,
		});
		const navigation = { pushModal: vi.fn(), popModal: vi.fn() };
		const modal = new Modal(
			id,
			{} as IFramePoolManager,
			navigation,
			createTestEventBus(),
		);
		modal.open(
			title,
			[{ id: "cancel", label: "Cancel", select: vi.fn() }],
			item,
		);
		if (typeof item === "object" && "text" in item)
			expect(Frame.prototype.showItemTooltip).toHaveBeenCalledWith(
				expect.any(Frame),
				item,
				400,
				704,
			);
		expect(Frame.prototype.layout).toHaveBeenCalledWith(
			item === undefined ? 360 : 740,
			item === undefined ? 144 : 340,
			"CENTER",
			expect.any(Frame),
		);
		const labels = vi.mocked(Frame.prototype.setLabel);
		const index = labels.mock.calls.findIndex((call) => call.at(1) === title);
		expect(labels.mock.contexts.at(index)?.id).toBe(`${id}-window`);
		expect(labels.mock.calls.at(index)).toEqual([
			"window-title",
			title,
			"TOP",
			0,
			-6,
			12,
		]);
		modal.close();
		modal.open("Confirm action", [
			{ id: "cancel", label: "Cancel", select: vi.fn() },
		]);
		expect(labels).toHaveBeenCalledWith(
			"window-title",
			"Confirm action",
			"TOP",
			0,
			-6,
			12,
		);
	},
);
