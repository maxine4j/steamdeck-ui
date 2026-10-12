import { expect, it, vi } from "vitest";
import type { Currency, ICurrencyClient } from "../../clients/currency-client";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { CurrencyPanel } from "./currency-panel";

const { setRows } = vi.hoisted(() => ({ setRows: vi.fn() }));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		setRows = setRows;
		mount = vi.fn();
		unmount = vi.fn();
		destroy = vi.fn();
	},
}));
it("renders category hierarchy and currency icons, routes Y options, and caches hidden data", () => {
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return vi.fn();
		},
	};
	const rows = [
		{ index: 1, name: "Expansion", header: true, depth: 0, expanded: true },
		{ index: 2, name: "Dungeon", header: true, depth: 1, expanded: false },
		{
			index: 3,
			id: 42,
			name: "Marks",
			depth: 2,
			icon: 123,
			quantity: 25,
			maximum: 100,
			watched: true,
		},
	] as Currency[];
	const client = {
		getCurrencies: vi.fn(() => rows),
		load: vi.fn((callback: (rows: Currency[]) => void) =>
			scheduler.nextFrame(() => callback(rows)),
		),
		toggleHeader: vi.fn(),
	} as unknown as ICurrencyClient;
	const options = { open: vi.fn(), close: vi.fn(), transferResult: vi.fn() };
	const panel = new CurrencyPanel(
		{} as IFramePoolManager,
		client,
		options,
		vi.fn(),
		scheduler,
	);
	panel.refresh();
	expect(client.getCurrencies).not.toHaveBeenCalled();
	panel.onMount({} as IUIComponent);
	while (pending.length) pending.shift()?.();
	const rendered = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(rendered).toMatchObject([
		{ label: "− Expansion", indent: 0, fontSize: 18 },
		{ label: "+ Dungeon", indent: 16, fontSize: 16 },
		{
			id: "currency-42",
			label: "Marks",
			indent: 32,
			icon: 123,
			selected: true,
			height: 32,
			trailingLabel: "25 / 100",
			detail: "",
		},
	]);
	rendered.at(2)?.context?.();
	expect(options.open).toHaveBeenCalledWith(rows.at(2));
	panel.onUnmount();
	expect(options.close).toHaveBeenCalled();
	panel.onMount({} as IUIComponent);
	while (pending.length) pending.shift()?.();
	expect(client.getCurrencies).not.toHaveBeenCalled();
	expect(client.load).toHaveBeenCalledOnce();
});

it("coalesces event bursts, cancels partial loads, ignores stale results and defers hidden invalidation", () => {
	setRows.mockClear();
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
	};
	const callbacks: ((rows: Currency[]) => void)[] = [];
	const cancels: ReturnType<typeof vi.fn>[] = [];
	const load = vi.fn((callback: (rows: Currency[]) => void) => {
		callbacks.push(callback);
		const cancel = vi.fn();
		cancels.push(cancel);
		return cancel;
	});
	const panel = new CurrencyPanel(
		{} as IFramePoolManager,
		{ load } as unknown as ICurrencyClient,
		{ open: vi.fn(), close: vi.fn(), transferResult: vi.fn() },
		vi.fn(),
		scheduler,
	);
	const parent = {} as IUIComponent;
	panel.onMount(parent);
	pending.shift()?.();
	expect(load).toHaveBeenCalledOnce();
	panel.onUnmount();
	expect(cancels.at(0)).toHaveBeenCalledOnce();
	const publications = setRows.mock.calls.length;
	callbacks.at(0)?.([]);
	expect(setRows).toHaveBeenCalledTimes(publications);
	panel.onMount(parent);
	pending.shift()?.();
	expect(load).toHaveBeenCalledTimes(2);
	panel.refresh();
	panel.refresh();
	panel.refresh();
	while (pending.length) pending.shift()?.();
	expect(load).toHaveBeenCalledTimes(3);
	expect(cancels.at(1)).toHaveBeenCalledOnce();
	const beforeStale = setRows.mock.calls.length;
	callbacks.at(1)?.([]);
	expect(setRows).toHaveBeenCalledTimes(beforeStale);
	callbacks.at(2)?.([]);
	expect(setRows).toHaveBeenLastCalledWith([]);
	panel.onUnmount();
	panel.onMount(parent);
	while (pending.length) pending.shift()?.();
	expect(load).toHaveBeenCalledTimes(3);
	panel.onUnmount();
	panel.refresh();
	panel.refresh();
	while (pending.length) pending.shift()?.();
	expect(load).toHaveBeenCalledTimes(3);
	panel.onMount(parent);
	pending.shift()?.();
	expect(load).toHaveBeenCalledTimes(4);
	panel.destroy();
	expect(cancels.at(3)).toHaveBeenCalledOnce();
});
