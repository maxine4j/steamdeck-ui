import { expect, it, vi } from "vitest";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { TitlesPanel } from "./titles-panel";

const { construct, setRows } = vi.hoisted(() => ({
	construct: vi.fn(),
	setRows: vi.fn(),
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		mount = vi.fn();
		unmount = vi.fn();
		setRows = setRows;
		updateRows = setRows;
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
		columns: 2,
		gap: 12,
		centerSingleLine: true,
		scheduler,
		onChanged: expect.any(Function),
	});
});

it("uses neutral title tiles, highlights selection and applies a clicked title", () => {
	const pending: (() => void)[] = [];
	const client = {
		getTitles: () => [
			{ id: -1, name: "None", selected: true },
			{ id: 42, name: "Champion", selected: false },
		],
		select: vi.fn(),
	};
	const panel = new TitlesPanel({} as IFramePoolManager, client, vi.fn(), {
		nextFrame: (callback) => {
			pending.push(callback);
			return vi.fn();
		},
	});
	panel.onMount({} as IUIComponent);
	pending.shift()?.();
	const rows = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(rows.at(0)).toMatchObject({
		label: "|TInterface\\RaidFrame\\ReadyCheck-Ready:16:16|t None",
		background: [0.18, 0.28, 0.38],
	});
	expect(rows.at(1)).toMatchObject({ background: [0.1, 0.12, 0.16] });
	expect(rows.at(1)?.label).toBe("Champion");
	expect(rows.every((row) => row.detail === undefined)).toBe(true);
	expect(rows.every((row) => row.backgroundAtlas === undefined)).toBe(true);
	rows.at(1)?.activate();
	expect(client.select).toHaveBeenCalledWith(42);
	expect(pending).toHaveLength(1);
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
