import { expect, it, vi } from "vitest";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { DebugErrorsPanel } from "./debug-errors-panel";

vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		fill() {}
		inset() {}
		layout() {}
		setParent() {}
		setWindowBackground() {}
		setLabel() {}
		setLabelWordWrap() {}
		setScrollContent() {}
		show() {}
		hide() {}
		destroy() {}
		clampScroll() {}
		getVisibleVerticalRange() {
			return { top: 0, bottom: 100 };
		}
		scrollBy() {}
		setFocused() {}
		setNavigationFocus() {}
		setColor() {}
		setOpacity() {}
		setButtonBackground() {}
		setTooltip() {}
		hideTooltip() {}
		onClick() {}
		navigationNode(navId: string, onInteract: () => void) {
			return { navId, onInteract, onFocus() {}, onBlur() {} };
		}
		onSizeChanged() {}
		blurInput() {}
		revealVerticalRange() {}
	},
}));

it("spreads a full error history across frames, exposes navigation as rows become ready and cancels rendering when hidden", () => {
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
		delay: vi.fn(),
	};
	const pool = {} as IFramePoolManager;
	const panel = new DebugErrorsPanel(
		pool,
		{
			clearAll: vi.fn(),
			loadErrors: () => ({
				errors: Array.from({ length: 100 }, (_, id) => ({
					id,
					timestamp: 100,
					message: `Error ${id}`,
					stack: "trace",
				})),
				isNew: () => true,
			}),
		},
		vi.fn(),
		scheduler,
	);
	const changed = vi.fn();
	panel.setNavigationChanged(changed);
	panel.onMount(new Frame("parent", pool));
	expect(panel.getNavGrid()).toHaveLength(1);
	changed.mockClear();
	pending.shift()?.();
	expect(panel.getNavGrid()).toHaveLength(10);
	expect(changed).toHaveBeenCalled();
	panel.onUnmount();
	const notifications = changed.mock.calls.length;
	while (pending.length) pending.shift()?.();
	expect(panel.getNavGrid()).toHaveLength(0);
	expect(changed).toHaveBeenCalledTimes(notifications);
});
