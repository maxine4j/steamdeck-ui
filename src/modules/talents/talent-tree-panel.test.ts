import { expect, it, vi } from "vitest";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { TalentTreePanel } from "./talent-tree-panel";

const { hosts } = vi.hoisted(() => ({
	hosts: [] as {
		id: string;
		inset: ReturnType<typeof vi.fn>;
		show: ReturnType<typeof vi.fn>;
		hide: ReturnType<typeof vi.fn>;
		destroy: ReturnType<typeof vi.fn>;
		onSizeChanged: ReturnType<typeof vi.fn>;
	}[],
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		setParent = vi.fn();
		layout = vi.fn();
		setWindowBackground = vi.fn();
		setLabel = vi.fn();
		setFocusBorder = vi.fn();
		setCloseButtonBackground = vi.fn();
		onClick = vi.fn();
		inset = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		onSizeChanged = vi.fn();
		constructor(readonly id: string) {
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
		presentation: vi.fn(() => ({ width: 800, height: 480 })),
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
	const host = hosts.find((frame) => frame.id === "talent-tree-host");
	const window = hosts.find(
		(frame) => frame.id === "talent-tree-window",
	) as unknown as {
		layout: ReturnType<typeof vi.fn>;
		setWindowBackground: ReturnType<typeof vi.fn>;
		setFocusBorder: ReturnType<typeof vi.fn>;
		setLabel: ReturnType<typeof vi.fn>;
	};
	panel.setNavigationChanged(changed);
	panel.refresh();
	expect(pending).toHaveLength(0);
	const parent = {
		onSizeChanged: vi.fn(),
		getSize: () => ({ width: 1000, height: 600 }),
	};
	panel.onMount(parent as unknown as IUIComponent);
	expect(client.mount).toHaveBeenCalledWith(host);
	expect(window?.setWindowBackground).toHaveBeenCalledOnce();
	expect(window?.setLabel).toHaveBeenCalledWith(
		"window-title",
		"Talents",
		"TOP",
		0,
		-6,
		12,
	);
	expect(client.presentation).toHaveBeenCalledWith({ width: 984, height: 560 });
	expect(window?.layout).toHaveBeenCalledWith(816, 520, "CENTER", parent);
	expect(host?.inset).toHaveBeenCalledWith(window, 8, 32, 8, 8);
	panel.onActiveChanged(true);
	expect(window?.setFocusBorder).toHaveBeenLastCalledWith(true);
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
	panel.onMount(parent as unknown as IUIComponent);
	expect(client.mount).toHaveBeenLastCalledWith(host);
	panel.destroy();
	expect(host?.destroy).toHaveBeenCalledOnce();
});
