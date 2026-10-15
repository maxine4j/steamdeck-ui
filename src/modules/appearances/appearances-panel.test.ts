import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Appearance } from "../../clients/appearances-client";
import { Frame } from "../../ui/components/frame";
import { FramePoolManager } from "../../ui/frame-pool-manager";
import { AppearancesPanel } from "./appearances-panel";

beforeEach(() => {
	for (const method of [
		"fill",
		"setParent",
		"setWindowBackground",
		"setLabel",
		"setLabelWordWrap",
		"show",
		"hide",
		"layout",
		"inset",
		"setIcon",
		"setOpacity",
		"setColor",
		"setButtonBackground",
		"setTooltip",
		"onClick",
		"onSizeChanged",
		"setScrollContent",
		"clampScroll",
		"revealVerticalRange",
		"setFocused",
		"setModelUnit",
		"tryOnModel",
		"undressModel",
		"destroy",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function setup() {
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
	let loaded: (rows: Appearance[], complete: boolean) => void = () => {};
	let update: (rows: readonly Appearance[], complete: boolean) => void =
		() => {};
	const detach = vi.fn();
	const client = {
		getSlots: () => [
			{ id: 1, name: "Head", icon: 1, column: 0, row: 0 },
			{ id: 10, name: "Hands", icon: 2, column: 1, row: 0 },
			{ id: 17, name: "Off Hand", icon: 3, column: 1, row: 7 },
		],
		load: vi.fn(
			(
				_slot: number,
				done: typeof loaded,
				_progress?: unknown,
				changed?: typeof update,
			) => {
				loaded = done;
				if (changed) update = changed;
				return detach;
			},
		),
		refresh: vi.fn(),
		refreshItem: vi.fn(),
		stop: vi.fn(),
	};
	const pool = new FramePoolManager({
		createFrame: vi.fn(() => {
			throw Error("Unexpected native access");
		}),
	});
	const close = vi.fn();
	const panel = new AppearancesPanel(pool, client, scheduler, close);
	const parent = new Frame("parent", pool);
	const flush = () => {
		let count = 0;
		while (pending.length) {
			if (++count > 1000) throw Error("Render never completed");
			pending.shift()?.();
		}
	};
	return {
		panel,
		client,
		parent,
		close,
		detach,
		pending,
		flush,
		loaded: (rows: Appearance[], complete = true) => loaded(rows, complete),
		update: (rows: readonly Appearance[], complete = true) =>
			update(rows, complete),
	};
}
const appearance = (id: number, expansionId = 7): Appearance => ({
	id,
	sourceId: id + 1000,
	itemId: id + 2000,
	category: 1,
	name: `Item ${id}`,
	icon: id,
	collected: true,
	expansionId,
});

it("lands on conventional slots without loading and opens a slot through left click or controller X", () => {
	const { panel, client, parent } = setup();
	panel.onMount(parent);
	expect(client.load).not.toHaveBeenCalled();
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual([
		"appearances-clear",
		"appearances-current",
		"appearance-slot-1",
		"appearance-slot-10",
		"appearance-slot-17",
	]);
	const slot = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "appearance-slot-1");
	slot?.onAlternate?.();
	expect(client.load).toHaveBeenCalledOnce();
	expect(client.load.mock.lastCall?.at(0)).toBe(1);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId.startsWith("appearance-slot-")),
	).toBe(false);
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		332,
		364 * 0.7,
		"TOP",
		expect.any(Frame),
		0,
		-80,
	);
	panel.onBack();
	const click = vi
		.mocked(Frame.prototype.onClick)
		.mock.calls.find(
			(_call, index) =>
				vi.mocked(Frame.prototype.onClick).mock.instances.at(index)?.id ===
				"appearance-slot-10",
		)
		?.at(0);
	click?.("RightButton");
	expect(client.load).toHaveBeenCalledOnce();
	click?.("LeftButton");
	expect(client.load.mock.lastCall?.at(0)).toBe(10);
});

it("groups the item grid by expansion, retains try-ons across blur and back, and exposes clear/current in both views", () => {
	const { panel, parent, loaded, flush } = setup();
	panel.onMount(parent);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "appearance-slot-1")
		?.onAlternate?.();
	loaded([appearance(1, 0), appearance(2, 10), appearance(3, 10)]);
	flush();
	const items = panel
		.getNavGrid()
		.flat()
		.filter((node) => node.navId.startsWith("appearance-item-"));
	expect(items.map((node) => node.navId)).toEqual([
		"appearance-item-1-2",
		"appearance-item-1-3",
		"appearance-item-1-1",
	]);
	items.at(0)?.onFocus();
	expect(Frame.prototype.tryOnModel).toHaveBeenCalledWith(1002, undefined);
	items.at(0)?.onBlur();
	panel.onBack();
	expect(Frame.prototype.setModelUnit).toHaveBeenCalledTimes(1);
	expect(Frame.prototype.undressModel).not.toHaveBeenCalled();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "appearances-clear")
		?.onInteract();
	expect(Frame.prototype.undressModel).toHaveBeenCalledOnce();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "appearances-current")
		?.onInteract();
	expect(Frame.prototype.setModelUnit).toHaveBeenCalledTimes(2);
});

it("batches frame work, keeps stable cells on updates and reopening, and disables callbacks after back", () => {
	const { panel, parent, loaded, update, pending, flush, detach } = setup();
	panel.onMount(parent);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "appearance-slot-1")
		?.onAlternate?.();
	const rows = Array.from({ length: 35 }, (_, index) => appearance(index));
	loaded(rows);
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => node.navId.startsWith("appearance-item-")).length,
	).toBeLessThan(35);
	expect(pending.length).toBeGreaterThan(0);
	flush();
	const items = panel
		.getNavGrid()
		.flat()
		.filter((node) => node.navId.startsWith("appearance-item-"));
	vi.mocked(Frame.prototype.setIcon).mockClear();
	update([{ ...appearance(0), name: "Changed" }]);
	flush();
	expect(Frame.prototype.setIcon).toHaveBeenCalledTimes(1);
	panel.onBack();
	expect(detach).toHaveBeenCalledOnce();
	vi.mocked(Frame.prototype.tryOnModel).mockClear();
	items.at(1)?.onFocus();
	expect(Frame.prototype.tryOnModel).not.toHaveBeenCalled();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "appearance-slot-1")
		?.onAlternate?.();
	loaded([{ ...appearance(0), name: "Changed" }, ...rows.slice(1)]);
	flush();
	expect(Frame.prototype.setIcon).toHaveBeenCalledTimes(1);
	panel.onUnmount();
	expect(detach).toHaveBeenCalledTimes(2);
});
