import { expect, it, vi } from "vitest";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { TransmogPanel } from "./transmog-panel";

const { frames } = vi.hoisted(() => ({
	frames: new Map<string, Record<string, ReturnType<typeof vi.fn>>>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		setParent = vi.fn();
		layout = vi.fn();
		setWindowBackground = vi.fn();
		setLabel = vi.fn();
		setFocusBorder = vi.fn();
		inset = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		constructor(id: string) {
			frames.set(
				id,
				this as unknown as Record<string, ReturnType<typeof vi.fn>>,
			);
		}
	},
}));

it("centers a fitted styled window without a close button, refreshes navigation and reuses frames", () => {
	const pending: (() => void)[] = [];
	const client = {
		presentation: vi.fn(() => ({ width: 950, height: 500 })),
		mount: vi.fn(),
		unmount: vi.fn(),
		resize: vi.fn(),
		navigation: vi.fn(() => []),
		dismissMenus: vi.fn(() => true),
	};
	const close = vi.fn();
	const changed = vi.fn();
	const panel = new TransmogPanel(
		{} as IFramePoolManager,
		client,
		{
			nextFrame: (callback) => {
				pending.push(callback);
				return vi.fn();
			},
		},
		close,
	);
	const parent = {
		getSize: () => ({ width: 1000, height: 600 }),
		onSizeChanged: vi.fn(),
	};
	panel.setNavigationChanged(changed);
	panel.onMount(parent as unknown as IUIComponent);
	const window = frames.get("transmog-window");
	const host = frames.get("transmog-host");
	expect(frames.size).toBe(2);
	expect(window?.setWindowBackground).toHaveBeenCalledOnce();
	expect(client.presentation).toHaveBeenCalledWith({ width: 984, height: 560 });
	expect(window?.layout).toHaveBeenCalledWith(966, 540, "CENTER", parent);
	expect(host?.inset).toHaveBeenCalledWith(window, 8, 32, 8, 8);
	expect(client.mount).toHaveBeenCalledWith(host);
	panel.onActiveChanged(true);
	expect(window?.setFocusBorder).toHaveBeenLastCalledWith(true);
	panel.refresh();
	panel.refresh();
	pending.shift()?.();
	expect(changed).toHaveBeenCalledOnce();
	parent.onSizeChanged.mock.lastCall?.at(0)?.();
	expect(client.resize).toHaveBeenCalledOnce();
	panel.getNavGrid();
	expect(client.navigation).toHaveBeenCalledOnce();
	panel.onBack();
	expect(client.dismissMenus).toHaveBeenCalledOnce();
	expect(close).not.toHaveBeenCalled();
	client.dismissMenus.mockReturnValue(false);
	panel.onBack();
	expect(close).toHaveBeenCalledOnce();
	panel.onUnmount();
	expect(client.unmount).toHaveBeenCalledOnce();
	expect(window?.setFocusBorder).toHaveBeenLastCalledWith(false);
	panel.onMount(parent as unknown as IUIComponent);
	expect(frames.size).toBe(2);
	panel.destroy();
	expect(host?.destroy).toHaveBeenCalledOnce();
});
