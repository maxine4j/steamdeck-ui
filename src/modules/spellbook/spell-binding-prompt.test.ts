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
	const preview = {
		width: 448,
		height: 422.4,
		show: vi.fn(),
		hide: vi.fn(),
		destroy: vi.fn(),
	};
	const prompt = new SpellBindingPrompt(
		{} as IFramePoolManager,
		navigation,
		events,
		controller,
		client,
		scheduler,
		preview,
	);
	prompt.open({ id: 42, name: "Heal", icon: 1, passive: false, bookIndex: 1 });
	expect(preview.show).toHaveBeenCalledWith(
		expect.objectContaining({ id: "spell-binding-window" }),
		-60,
	);
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		488,
		preview.height + 220,
		"CENTER",
		expect.objectContaining({ id: "spell-binding-backdrop" }),
		0,
		0,
	);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"cancel",
		"Start / Escape to cancel",
		"BOTTOM",
		0,
		20,
		12,
	);
	capture?.("PAD2");
	expect(client.bind).toHaveBeenCalledWith(42, "PAD2");
	expect(navigation.popModal).not.toHaveBeenCalled();
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
		"TOP",
		0,
		-118,
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
	const calls = client.bind.mock.calls.length;
	capture?.("PADFORWARD");
	finish?.();
	expect(client.bind).toHaveBeenCalledTimes(calls);
	expect(preview.hide).toHaveBeenCalled();
	prompt.open({ id: 42, name: "Heal", icon: 1, passive: false, bookIndex: 1 });
	vi.mocked(Frame.prototype.onClose).mock.lastCall?.at(0)?.();
	expect(controller.setBindingCapture).toHaveBeenLastCalledWith();
	prompt.open({ id: 42, name: "Heal", icon: 1, passive: false, bookIndex: 1 });
	events.emit("COMBAT_STARTED");
	expect(controller.setBindingCapture).toHaveBeenLastCalledWith();
	prompt.destroy();
});
