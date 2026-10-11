import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { ReputationPanel } from "./reputation-panel";

const { setRows, construct } = vi.hoisted(() => ({
	setRows: vi.fn(),
	construct: vi.fn(),
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		setRows = setRows;
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
					index,
					id: index,
					description: "",
					collapsed: false,
					watched: false,
					standing: "",
					progress: "",
				})),
		},
		close,
	);
	panel.refresh();
	expect(construct).toHaveBeenCalledWith(
		"reputation",
		pool,
		"Reputation",
		close,
		{ padding: 20 },
	);
	expect(setRows.mock.lastCall?.at(0)).toMatchObject([
		{ label: "− Expansion", fontSize: 18, indent: 0 },
		{ label: "− Alliance", fontSize: 16, indent: 16 },
		{ label: "Faction", fontSize: 14, indent: 32 },
	]);
});
