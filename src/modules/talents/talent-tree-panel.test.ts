import { expect, it, vi } from "vitest";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { TalentTreePanel } from "./talent-tree-panel";

const { hosts } = vi.hoisted(() => ({
	hosts: [] as {
		inset: ReturnType<typeof vi.fn>;
		show: ReturnType<typeof vi.fn>;
		hide: ReturnType<typeof vi.fn>;
		destroy: ReturnType<typeof vi.fn>;
		onSizeChanged: ReturnType<typeof vi.fn>;
	}[],
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		inset = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		onSizeChanged = vi.fn();
		constructor() {
			hosts.push(this);
		}
	},
}));

it("mounts the fullscreen tree, defers refreshed navigation, dismisses choices with B, and reuses its host", () => {
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return vi.fn();
		},
	};
	const client = {
		mount: vi.fn(),
		unmount: vi.fn(),
		resize: vi.fn(),
		navigation: vi.fn(() => []),
		dismissChoices: vi.fn(() => true),
	};
	const close = vi.fn();
	const changed = vi.fn();
	const panel = new TalentTreePanel(
		{} as IFramePoolManager,
		client,
		scheduler,
		close,
	);
	const host = hosts.at(-1);
	panel.setNavigationChanged(changed);
	panel.refresh();
	expect(pending).toHaveLength(0);
	panel.onMount({ onSizeChanged: vi.fn() } as unknown as IUIComponent);
	expect(client.mount).toHaveBeenCalledWith(host);
	panel.refresh();
	panel.refresh();
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(changed).toHaveBeenCalledOnce();
	panel.getNavGrid();
	expect(client.navigation).toHaveBeenCalledOnce();
	panel.onBack();
	expect(close).not.toHaveBeenCalled();
	client.dismissChoices.mockReturnValue(false);
	panel.onBack();
	expect(close).toHaveBeenCalledOnce();
	panel.onUnmount();
	expect(client.unmount).toHaveBeenCalledOnce();
	expect(host?.hide).toHaveBeenCalledOnce();
	panel.onMount({ onSizeChanged: vi.fn() } as unknown as IUIComponent);
	expect(client.mount).toHaveBeenLastCalledWith(host);
	panel.destroy();
	expect(host?.destroy).toHaveBeenCalledOnce();
});
