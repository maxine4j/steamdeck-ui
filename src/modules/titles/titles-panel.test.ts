import { expect, it, vi } from "vitest";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { TitlesPanel } from "./titles-panel";

const { construct } = vi.hoisted(() => ({ construct: vi.fn() }));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		mount = vi.fn();
		unmount = vi.fn();
		setRows = vi.fn();
		constructor(...args: unknown[]) {
			construct(...args);
		}
	},
}));

it("gives the titles list 30px padding", () => {
	const pool = {} as IFramePoolManager;
	const close = vi.fn();
	const scheduler = { nextFrame: vi.fn(() => vi.fn()) };
	new TitlesPanel(
		pool,
		{ getTitles: () => [], select: vi.fn() },
		close,
		scheduler,
	);
	expect(construct).toHaveBeenCalledWith("titles", pool, "Titles", close, {
		padding: 30,
		scheduler,
		onChanged: expect.any(Function),
	});
});

it("loads on first mount, reuses on reopen and defers hidden changes", () => {
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return vi.fn();
		},
	};
	const client = { getTitles: vi.fn(() => []), select: vi.fn() };
	const panel = new TitlesPanel(
		{} as IFramePoolManager,
		client,
		vi.fn(),
		scheduler,
	);
	panel.refresh();
	expect(client.getTitles).not.toHaveBeenCalled();
	panel.onMount({} as IUIComponent);
	panel.refresh();
	panel.refresh();
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(client.getTitles).toHaveBeenCalledOnce();
	panel.onUnmount();
	panel.onMount({} as IUIComponent);
	expect(pending).toHaveLength(0);
	panel.onUnmount();
	panel.refresh();
	panel.onMount({} as IUIComponent);
	pending.shift()?.();
	expect(client.getTitles).toHaveBeenCalledTimes(2);
});
