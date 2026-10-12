import { expect, it, vi } from "vitest";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { ReputationPanel } from "./reputation-panel";

const { setRows, construct } = vi.hoisted(() => ({
	setRows: vi.fn(),
	construct: vi.fn(),
}));
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
const flush = () => {
	while (pending.length) pending.shift()?.();
};
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		setRows = setRows;
		mount = vi.fn();
		unmount = vi.fn();
		constructor(...args: unknown[]) {
			construct(...args);
		}
	},
}));

it("distinguishes section headings, child headings and faction rows with padded content", () => {
	const pool = {} as IFramePoolManager;
	const close = vi.fn();
	const panel = new ReputationPanel(
		pool,
		{
			activate: vi.fn(),
			getReputations: () =>
				[
					{ header: true, child: false, name: "Expansion" },
					{ header: true, child: true, name: "Alliance" },
					{ header: false, child: true, name: "Faction" },
				].map((row, index) => ({
					...row,
					hasReputation: !row.header,
					index,
					id: index,
					description: "",
					collapsed: false,
					watched: false,
					standing: "",
					progress: "",
					reaction: 4,
					current: 0,
					maximum: 0,
					maxed: false,
				})),
		},
		close,
		scheduler,
	);
	panel.refresh();
	panel.onMount({} as IUIComponent);
	flush();
	expect(construct).toHaveBeenCalledWith(
		"reputation",
		pool,
		"Reputation",
		close,
		{ padding: 20, scheduler, onChanged: expect.any(Function) },
	);
	expect(setRows.mock.lastCall?.at(0)).toMatchObject([
		{ label: "− Expansion", fontSize: 18, indent: 0 },
		{ label: "− Alliance", fontSize: 16, indent: 16 },
		{ label: "Faction", fontSize: 14, indent: 32 },
	]);
});

it("colours reputation progress by standing and cap, with themed expansion headers", () => {
	const panel = new ReputationPanel(
		{} as IFramePoolManager,
		{
			activate: vi.fn(),
			getReputations: () =>
				[
					{ name: "Legion", header: true, reaction: 0, maxed: false },
					{ name: "Friendly", header: false, reaction: 5, maxed: false },
					{ name: "Exalted", header: false, reaction: 8, maxed: true },
					{ name: "Hated", header: false, reaction: 1, maxed: false },
					{ name: "Neutral", header: false, reaction: 4, maxed: false },
					{
						name: "Wrath of the Lich King",
						header: true,
						reaction: 0,
						maxed: false,
					},
				].map((row, index) => ({
					...row,
					hasReputation: !row.header,
					index,
					id: index,
					description: "",
					child: false,
					collapsed: false,
					watched: false,
					standing: row.header ? "" : row.name,
					progress: "1500 / 6000",
					current: 1500,
					maximum: 6000,
				})),
		},
		vi.fn(),
		scheduler,
	);
	panel.refresh();
	panel.onMount({} as IUIComponent);
	flush();
	expect(setRows.mock.lastCall?.at(0)).toMatchObject([
		{ background: [0.12, 0.22, 0.06], progress: undefined, detail: "" },
		{ progress: { value: 0.25, color: [0.15, 0.7, 0.25] } },
		{ progress: { value: 1, color: [0.15, 0.45, 0.95] } },
		{ progress: { value: 0.25, color: [0.8, 0.15, 0.15] } },
		{ progress: { value: 0.25, color: [0.85, 0.65, 0.15] } },
		{ background: [0.06, 0.18, 0.28], progress: undefined, detail: "" },
	]);
});

it("keeps progress bars and numbers for headers with their own reputation", () => {
	const panel = new ReputationPanel(
		{} as IFramePoolManager,
		{
			activate: vi.fn(),
			getReputations: () => [
				{
					index: 1,
					id: 1,
					name: "Cartels of Undermine",
					description: "",
					header: true,
					hasReputation: true,
					child: true,
					collapsed: false,
					watched: false,
					standing: "Friendly",
					progress: "1500 / 6000",
					reaction: 5,
					current: 1500,
					maximum: 6000,
					maxed: false,
				},
			],
		},
		vi.fn(),
		scheduler,
	);
	panel.refresh();
	panel.onMount({} as IUIComponent);
	flush();
	expect(setRows.mock.lastCall?.at(0)).toMatchObject([
		{
			label: "− Cartels of Undermine",
			detail: "Friendly 1500 / 6000",
			progress: { value: 0.25, color: [0.15, 0.7, 0.25] },
		},
	]);
});

it("caches reopened data and coalesces changes while hidden", () => {
	const client = { getReputations: vi.fn(() => []), activate: vi.fn() };
	const panel = new ReputationPanel(
		{} as IFramePoolManager,
		client,
		vi.fn(),
		scheduler,
	);
	panel.refresh();
	flush();
	expect(client.getReputations).not.toHaveBeenCalled();
	panel.onMount({} as IUIComponent);
	flush();
	panel.onUnmount();
	panel.onMount({} as IUIComponent);
	flush();
	expect(client.getReputations).toHaveBeenCalledOnce();
	panel.onUnmount();
	panel.refresh();
	panel.refresh();
	panel.onMount({} as IUIComponent);
	flush();
	expect(client.getReputations).toHaveBeenCalledTimes(2);
});
