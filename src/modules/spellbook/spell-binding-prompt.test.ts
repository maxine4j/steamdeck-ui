import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { SpellBindingPrompt } from "./spell-binding-prompt";

afterEach(() => vi.restoreAllMocks());
it("captures a bind without selectable options, keeps invalid binds open, then restores navigation after release", () => {
	for (const method of [
		"modalBackdrop",
		"setColor",
		"onClose",
		"setParent",
		"setModalLayer",
		"setWindowBackground",
		"layout",
		"setLabel",
		"setFocusBorder",
		"show",
		"hide",
		"destroy",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	const events = createTestEventBus();
	const navigation = { pushModal: vi.fn(), popModal: vi.fn() };
	let capture: ((key: string) => void) | undefined;
	const controller = {
		setBindingCapture: vi.fn((callback) => {
			capture = callback;
		}),
	};
	const client = {
		read: () => [],
		canModify: () => true,
		bind: vi.fn(() => "Reserved control"),
	};
	let finish: (() => void) | undefined;
	const scheduler = {
		nextFrame: (callback: () => void) => {
			finish = callback;
			return vi.fn();
		},
		delay: vi.fn(),
	};
	const prompt = new SpellBindingPrompt(
		{} as IFramePoolManager,
		navigation,
		events,
		controller,
		client,
		scheduler,
	);
	prompt.open({ id: 42, name: "Heal", icon: 1, passive: false, bookIndex: 1 });
	expect(navigation.pushModal).toHaveBeenCalledWith(
		"spell-binding",
		[],
		expect.any(Function),
	);
	capture?.("PADDUP");
	expect(client.bind).toHaveBeenCalledWith(42, "PADDUP");
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"status",
		"Reserved control",
		"CENTER",
		0,
		-32,
		12,
		380,
	);
	expect(navigation.popModal).not.toHaveBeenCalled();
	client.bind.mockReturnValue(undefined);
	capture?.("SHIFT-PAD3");
	expect(navigation.popModal).not.toHaveBeenCalled();
	finish?.();
	expect(navigation.popModal).toHaveBeenCalledWith("spell-binding");
	expect(controller.setBindingCapture).toHaveBeenLastCalledWith();
	prompt.open({ id: 42, name: "Heal", icon: 1, passive: false, bookIndex: 1 });
	events.emit("COMBAT_STARTED");
	expect(controller.setBindingCapture).toHaveBeenLastCalledWith();
	prompt.destroy();
});
