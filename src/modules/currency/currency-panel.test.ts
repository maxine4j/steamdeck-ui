import { expect, it, vi } from "vitest";
import type { Currency, ICurrencyClient } from "../../clients/currency-client";
import { createTestEventBus } from "../../events/test-event-bus";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import { CurrencyPanel } from "./currency-panel";

const config = {
	getCurrencyFavourites: () => [],
	setCurrencyFavourite: vi.fn(),
};

const { setRows, listOptions } = vi.hoisted(() => ({
	setRows: vi.fn(),
	listOptions: {
		onChanged: undefined as ((complete: boolean) => void) | undefined,
	},
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		constructor(
			_id: string,
			_pool: unknown,
			_title: string,
			_close: unknown,
			options: { onChanged?: (complete: boolean) => void },
		) {
			listOptions.onChanged = options.onChanged;
		}
		setRows = setRows;
		mount = vi.fn();
		unmount = vi.fn();
		destroy = vi.fn();
	},
}));
it("keeps existing currency rows during header reloads and publishes navigation only after rendering completes", () => {
	setRows.mockClear();
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return vi.fn();
		},
	};
	const callbacks: ((rows: Currency[]) => void)[] = [];
	const client = {
		load: vi.fn((callback: (rows: Currency[]) => void) => {
			callbacks.push(callback);
			return vi.fn();
		}),
		toggleHeader: vi.fn(),
	} as unknown as ICurrencyClient;
	const panel = new CurrencyPanel(
		{} as IFramePoolManager,
		client,
		{ open: vi.fn(), close: vi.fn(), transferResult: vi.fn() },
		vi.fn(),
		scheduler,
		config,
	);
	const navigationChanged = vi.fn();
	panel.setNavigationChanged(navigationChanged);
	panel.onMount({} as IUIComponent);
	pending.shift()?.();
	const header = {
		index: 15,
		name: "Dungeon",
		header: true,
		depth: 1,
		expanded: false,
	} as Currency;
	callbacks.at(0)?.([header]);
	listOptions.onChanged?.(true);
	navigationChanged.mockClear();
	for (const expanded of [true, false]) {
		const rendered = setRows.mock.lastCall?.at(0) as ListRow[];
		const publications = setRows.mock.calls.length;
		rendered.at(0)?.activate();
		pending.shift()?.();
		expect(setRows).toHaveBeenCalledTimes(publications);
		callbacks.at(-1)?.([{ ...header, expanded }]);
		listOptions.onChanged?.(false);
		expect(navigationChanged).not.toHaveBeenCalled();
		listOptions.onChanged?.(true);
		expect(navigationChanged).toHaveBeenCalledOnce();
		const updated = setRows.mock.lastCall?.at(0) as ListRow[];
		expect(updated.at(0)?.id).toBe(rendered.at(0)?.id);
		navigationChanged.mockClear();
	}
});
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
		config,
	);
	panel.refresh();
	expect(client.getCurrencies).not.toHaveBeenCalled();
	panel.onMount({} as IUIComponent);
	while (pending.length) pending.shift()?.();
	const rendered = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(rendered).toMatchObject([
		{
			label: "− Expansion",
			indent: 0,
			fontSize: 18,
			background: [0.08, 0.08, 0.08],
		},
		{
			label: "+ Dungeon",
			indent: 16,
			fontSize: 16,
			background: [0.08, 0.08, 0.08],
		},
		{
			id: "currency-42",
			label: "Marks",
			indent: 32,
			icon: 123,
			background: false,
			height: 32,
			trailingLabel: "25 / 100",
			detail: "",
		},
	]);
	expect(rendered.at(0)?.checked).toBeUndefined();
	expect(rendered.at(2)?.checked).toBeUndefined();
	rendered.at(2)?.context?.();
	expect(options.open).toHaveBeenCalledWith(rows.at(2));
	panel.onUnmount();
	expect(options.close).toHaveBeenCalled();
	panel.onMount({} as IUIComponent);
	while (pending.length) pending.shift()?.();
	expect(client.getCurrencies).not.toHaveBeenCalled();
	expect(client.load).toHaveBeenCalledOnce();
});

it("duplicates favourites above categories, including currencies hidden by collapsed headers, and removes unfavourited duplicates", () => {
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return vi.fn();
		},
	};
	const currency = {
		id: 42,
		index: 2,
		name: "Marks",
		depth: 1,
		quantity: 25,
		maximum: 100,
	} as Currency;
	const hidden = { ...currency, id: 9, name: "Hidden marks" };
	const options = { open: vi.fn(), close: vi.fn(), transferResult: vi.fn() };
	let favourites = [42, 9, 99];
	const client = {
		load: (callback: (rows: Currency[]) => void) => {
			callback([
				{ index: 1, name: "Expansion", header: true, depth: 0 } as Currency,
				currency,
			]);
			return vi.fn();
		},
		getCurrency: vi.fn((id: number) => (id === 9 ? hidden : undefined)),
	} as unknown as ICurrencyClient;
	const panel = new CurrencyPanel(
		{} as IFramePoolManager,
		client,
		options,
		vi.fn(),
		scheduler,
		{
			getCurrencyFavourites: () => favourites,
			setCurrencyFavourite: vi.fn(),
		},
	);
	panel.onMount({} as IUIComponent);
	while (pending.length) pending.shift()?.();
	const rendered = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(rendered.map((row) => row.id)).toEqual([
		"currency-favourites",
		"currency-favourite-42",
		"currency-favourite-9",
		"currency-category-Expansion",
		"currency-42",
	]);
	expect(rendered.at(1)).toMatchObject({
		label: "Marks",
		indent: 0,
		trailingLabel: "25 / 100",
		background: false,
	});
	expect(rendered.at(1)?.checked).toBeUndefined();
	rendered.at(1)?.context?.();
	expect(options.open).toHaveBeenCalledWith(currency);
	rendered.at(2)?.activate();
	expect(options.open).toHaveBeenLastCalledWith(hidden);
	favourites = [];
	panel.refresh();
	while (pending.length) pending.shift()?.();
	const updated = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(updated.map((row) => row.id)).toEqual([
		"currency-category-Expansion",
		"currency-42",
	]);
});

it("keeps category identities when preceding categories change list indices", () => {
	const pending: (() => void)[] = [];
	let rows = [
		{ index: 1, name: "Expansion", header: true, depth: 0 },
		{ index: 15, name: "Dungeon", header: true, depth: 1 },
	] as Currency[];
	const panel = new CurrencyPanel(
		{} as IFramePoolManager,
		{
			load: (callback: (rows: Currency[]) => void) => {
				callback(rows);
				return vi.fn();
			},
		} as unknown as ICurrencyClient,
		{ open: vi.fn(), close: vi.fn(), transferResult: vi.fn() },
		vi.fn(),
		{
			nextFrame: (callback) => {
				pending.push(callback);
				return vi.fn();
			},
		},
		config,
	);
	panel.onMount({} as IUIComponent);
	while (pending.length) pending.shift()?.();
	const rendered = setRows.mock.lastCall?.at(0) as ListRow[];
	const before = rendered.map((row) => row.id);
	rows = rows.map((row) => ({ ...row, index: row.index === 15 ? 2 : 1 }));
	panel.refresh();
	while (pending.length) pending.shift()?.();
	const updated = setRows.mock.lastCall?.at(0) as ListRow[];
	expect(updated.map((row) => row.id)).toEqual(before);
	const nav = new NavigationManager(createTestEventBus());
	const grid = () => {
		const current = setRows.mock.lastCall?.at(0) as ListRow[];
		return current.map((row) => [
			{
				navId: row.id,
				onFocus: vi.fn(),
				onBlur: vi.fn(),
				onInteract: row.activate,
			},
		]);
	};
	panel.setNavigationChanged(() => nav.refreshGrid(panel.id));
	nav.registerGrid(panel.id, grid);
	nav.setActiveGrid(panel.id);
	nav.moveDown();
	for (const index of [15, 2]) {
		rows = rows.map((row) => ({ ...row, index: row.depth === 1 ? index : 1 }));
		panel.refresh();
		while (pending.length) pending.shift()?.();
		listOptions.onChanged?.(true);
		expect(nav.focusedId).toBe(before.at(1));
	}
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
		config,
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
