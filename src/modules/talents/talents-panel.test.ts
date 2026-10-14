import { expect, it, vi } from "vitest";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { TalentsPanel } from "./talents-panel";

const { rows, listOptions } = vi.hoisted(() => ({
	rows: vi.fn(),
	listOptions: vi.fn(),
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		constructor(...args: unknown[]) {
			listOptions(args.at(4));
		}
		mount = vi.fn();
		unmount = vi.fn();
		destroy = vi.fn();
		setRows = rows;
		getNavGrid = () => [];
	},
}));
it.each([2, 3, 4])(
	"puts loadouts after all %i specs, coalesces refreshes and reuses on reopen",
	(count) => {
		const pending: (() => void)[] = [];
		const client = {
			read: vi.fn(() => ({
				specs: Array.from({ length: count }, (_, i) => ({
					id: i + 1,
					index: i + 1,
					name: `Spec ${i}`,
					selected: i === 0,
					icon: 10,
					role: ["DAMAGER", "TANK", "HEALER"].at(i % 3) ?? "",
				})),
				loadouts: [
					{ id: 40, name: "Raid", selected: true },
					{ id: 41, name: "Solo", selected: false },
				],
				starterAvailable: true,
				starterSelected: false,
				specID: 1,
			})),
			selectSpec: vi.fn(),
			selectLoadout: vi.fn(),
			selectStarter: vi.fn(),
		};
		const openTree = vi.fn();
		const panel = new TalentsPanel(
			{} as IFramePoolManager,
			client,
			vi.fn(),
			{
				nextFrame: (callback) => {
					pending.push(callback);
					return vi.fn();
				},
			},
			undefined,
			openTree,
		);
		panel.refresh();
		expect(listOptions).toHaveBeenLastCalledWith(
			expect.objectContaining({
				contentPadding: { horizontal: 24, vertical: 10 },
				centerLabelsVertically: true,
			}),
		);
		expect(client.read).not.toHaveBeenCalled();
		panel.onMount({} as IUIComponent);
		panel.refresh();
		panel.refresh();
		expect(pending).toHaveLength(1);
		pending.shift()?.();
		const rendered = rows.mock.lastCall?.at(0) as ListRow[];
		expect(rendered.at(0)).toMatchObject({
			label: "Specializations",
			heading: true,
		});
		expect(rendered.at(count + 1)).toMatchObject({
			id: "talents-full",
			label: "Open talent tree",
			fullWidth: true,
		});
		rendered.at(count + 1)?.activate();
		expect(openTree).toHaveBeenCalledOnce();
		expect(rendered.at(count + 2)).toMatchObject({
			label: "Loadouts",
			heading: true,
		});
		const specs = rendered.filter((row) => row.id.startsWith("talents-spec-"));
		expect(specs.every((row) => row.height === 64)).toBe(true);
		expect(
			rendered.find((row) => row.id === "talents-starter")?.detail,
		).toBeUndefined();
		for (const spec of specs) {
			expect(spec).toMatchObject({
				fullWidth: true,
				icon: 10,
				backgroundAtlas: "ui-journeys-renown-button",
				secondary: {
					label: "Switch Spec",
					width: 110,
					height: 32,
					onlyAction: true,
				},
			});
		}
		expect(specs.at(0)?.detail).toBe("Active specialization");
		expect(specs.at(0)).toMatchObject({
			checked: true,
			checkAtlas: "groupfinder-icon-greencheckmark",
			checkPlacement: "secondary",
			secondary: { enabled: false },
		});
		expect(specs.at(0)?.enabled).not.toBe(false);
		specs.at(0)?.secondary?.activate();
		expect(client.selectSpec).not.toHaveBeenCalled();
		expect(specs.at(1)?.secondary).toMatchObject({ enabled: true });
		expect(specs.at(1)?.detail).toBeUndefined();
		specs.at(1)?.secondary?.activate();
		expect(client.selectSpec).toHaveBeenCalledWith(2);
		pending.shift()?.();
		expect(specs.at(count - 1)?.marginBottom).toBe(24);
		expect(specs.map((row) => row.id)).toEqual(
			Array.from({ length: count }, (_, i) => `talents-spec-${i + 1}`),
		);
		const loadout = rendered.find((row) => row.id === "talents-loadout-40");
		expect(loadout).toMatchObject({
			backgroundAtlas: "ui-journeys-renown-button",
		});
		expect(rendered.find((row) => row.id === "talents-starter")).toMatchObject({
			backgroundAtlas: "ui-journeys-renown-button",
		});
		expect(rendered.every((row) => row.backgroundSlice === undefined)).toBe(
			true,
		);
		expect(loadout?.detail).toBe("Active loadout");
		expect(
			rendered.find((row) => row.id === "talents-loadout-41")?.detail,
		).toBeUndefined();
		expect(
			rendered.findIndex((row) => row.id === "talents-loadout-40"),
		).toBeGreaterThanOrEqual(count);
		loadout?.activate();
		expect(client.selectLoadout).toHaveBeenCalledWith(1, 40);
		pending.shift()?.();
		panel.onUnmount();
		panel.onMount({} as IUIComponent);
		expect(pending).toHaveLength(0);
		panel.onUnmount();
		panel.refresh();
		expect(pending).toHaveLength(0);
		panel.onMount({} as IUIComponent);
		pending.shift()?.();
		expect(client.read).toHaveBeenCalledTimes(4);
	},
);

it("cancels an unmounted refresh and releases native visibility when the container closes", () => {
	const pending: (() => void)[] = [];
	const client = {
		read: vi.fn(() => ({
			specs: [],
			loadouts: [],
			starterAvailable: false,
			starterSelected: false,
		})),
		selectSpec: vi.fn(),
		selectLoadout: vi.fn(),
		selectStarter: vi.fn(),
	};
	const hidden = vi.fn();
	const panel = new TalentsPanel(
		{} as IFramePoolManager,
		client,
		vi.fn(),
		{
			nextFrame: (callback) => {
				let cancelled = false;
				pending.push(() => {
					if (!cancelled) callback();
				});
				return () => {
					cancelled = true;
				};
			},
		},
		hidden,
	);
	panel.onMount({} as IUIComponent);
	panel.onUnmount();
	pending.shift()?.();
	expect(client.read).not.toHaveBeenCalled();
	expect(hidden).toHaveBeenCalledOnce();
	panel.onMount({} as IUIComponent);
	pending.shift()?.();
	expect(client.read).toHaveBeenCalledOnce();
});
