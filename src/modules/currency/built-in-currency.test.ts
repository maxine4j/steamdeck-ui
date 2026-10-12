import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { BuiltInCurrency } from "./built-in-currency";

afterEach(() => vi.unstubAllGlobals());
it("suppresses currency and preserves character tab transitions, then disables hooks on restore", () => {
	const frame = { IsShown: () => true, activeSubframe: "TokenFrame" };
	vi.stubGlobal("CharacterFrame", frame);
	const hooks: (() => void)[] = [];
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) =>
		hooks.push(args.at(-1) as () => void),
	);
	const suppression = { suppress: vi.fn(), restore: vi.fn() };
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("CURRENCY_VISIBILITY_CHANGED", changed);
	const native = new BuiltInCurrency(suppression, events);
	native.disable();
	expect(native.isOpen()).toBe(true);
	expect(suppression.suppress).toHaveBeenCalledWith([frame]);
	frame.activeSubframe = "ReputationFrame";
	for (const hook of hooks) hook();
	expect(native.isOpen()).toBe(false);
	expect(suppression.restore).not.toHaveBeenCalled();
	native.restore();
	const count = changed.mock.calls.length;
	for (const hook of hooks) hook();
	expect(changed).toHaveBeenCalledTimes(count);
	expect(suppression.restore).toHaveBeenCalledOnce();
});
