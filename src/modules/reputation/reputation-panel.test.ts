import { expect, it, vi } from "vitest";
import type { Reputation } from "../../clients/reputation-client";
import type { ListRow } from "../../ui/components/scroll-list";
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
const faction = (
	name: string,
	index: number,
	overrides: Partial<Reputation> = {},
): Reputation => ({
	name,
	index,
	id: index,
	description: "Description",
	header: false,
	child: true,
	collapsed: false,
	hasReputation: true,
	watched: false,
	standing: "Friendly",
	progress: "1500 / 6000",
	reaction: 5,
	current: 1500,
	maximum: 6000,
	maxed: false,
	...overrides,
});
const render = (reputations: Reputation[]) => {
	const client = {
		getReputations: vi.fn(() => reputations),
		activate: vi.fn(),
	};
	const panel = new ReputationPanel(
		{} as IFramePoolManager,
		client,
		vi.fn(),
		scheduler,
	);
	panel.refresh();
	panel.onMount({} as IUIComponent);
	flush();
	return { panel, client, rows: setRows.mock.lastCall?.at(0) as ListRow[] };
};

it("shows expansion tiles before child sections, with reputation-bearing parents at the top level", () => {
	const { rows, client } = render([
		faction("Midnight", 1, {
			header: true,
			child: false,
			hasReputation: false,
		}),
		faction("Silvermoon Court", 2, { header: true }),
		faction("Magisters", 3),
		faction("Blood Knights", 4),
		faction("Parent B", 5, { header: true }),
		faction("Child B", 6),
		faction("Ordinary", 7, { child: false }),
		faction("Legion", 8, { header: true, child: false, hasReputation: false }),
		faction("Wardens", 9, { child: false }),
	]);
	expect(rows.map((row) => [row.label, row.heading === true])).toEqual([
		["Midnight", true],
		["Silvermoon Court", false],
		["Parent B", false],
		["Ordinary", false],
		["Silvermoon Court", true],
		["Magisters", false],
		["Blood Knights", false],
		["Parent B", true],
		["Child B", false],
		["Legion", true],
		["Wardens", false],
	]);
	expect(rows.at(0)).toMatchObject({ fontSize: 20, marginBottom: 12 });
	expect(rows.at(4)).toMatchObject({
		fontSize: 16,
		indent: 12,
		marginBottom: 8,
	});
	expect(rows.at(1)).toMatchObject({
		detail: "Friendly 1500 / 6000",
		height: 60,
		progress: { value: 0.25, color: [0.15, 0.7, 0.25] },
	});
	expect(construct.mock.lastCall?.at(4)).toMatchObject({
		columns: 2,
		gap: 12,
		edgeProgress: true,
	});
	rows.at(1)?.activate();
	expect(client.activate).toHaveBeenCalledWith(
		expect.objectContaining({ id: 2 }),
	);
});

it("keeps capped tiles full without misleading numbers while retaining paragon progress and standing colours", () => {
	const { rows } = render([
		faction("Renown", 1, {
			maxed: true,
			current: 0,
			maximum: 3000,
			standing: "Renown 30",
			progress: "0 / 3000",
		}),
		faction("Paragon", 2, {
			maxed: true,
			standing: "Paragon",
			current: 2500,
			maximum: 10000,
			progress: "2500 / 10000",
		}),
		faction("Hated", 3, { reaction: 1 }),
		faction("Neutral", 4, { reaction: 4 }),
	]);
	expect(rows).toMatchObject([
		{ detail: "Renown 30", progress: { value: 1, color: [0.15, 0.45, 0.95] } },
		{ detail: "Paragon 2500 / 10000", progress: { value: 0.25 } },
		{ progress: { color: [0.8, 0.15, 0.15] } },
		{ progress: { color: [0.85, 0.65, 0.15] } },
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
