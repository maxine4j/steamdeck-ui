import { expect, it, vi } from "vitest";
import type { InventoryItem } from "../../clients/inventory-client";
import { Frame } from "../../ui/components/frame";
import { FramePoolManager } from "../../ui/frame-pool-manager";
import { BagsPanel } from "./bags-panel";

it("renders outlines, counts, gear levels, toggles grouping and reuses controls", () => {
	const labels: { text: string }[] = [];
	const colors = vi.fn();
	let click: (() => void) | undefined;
	const handlers: Map<string, (frame: unknown, button: string) => void>[] = [];
	const factory = {
		createFrame: vi.fn(() => {
			const scripts = new Map<
				string,
				(frame: unknown, button: string) => void
			>();
			handlers.push(scripts);
			return {
				Show: vi.fn(),
				Hide: vi.fn(),
				SetParent: vi.fn(),
				ClearAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetSize: vi.fn(),
				CreateTexture: () => ({
					SetAllPoints: vi.fn(),
					SetTexture: vi.fn(),
					SetColorTexture: colors,
				}),
				CreateFontString: () => {
					const label = {
						text: "",
						SetText(text: string) {
							this.text = text;
						},
						ClearAllPoints: vi.fn(),
						SetPoint: vi.fn(),
						SetFont: vi.fn(),
						SetJustifyH: vi.fn(),
						SetWidth: vi.fn(),
					};
					labels.push(label);
					return label;
				},
				SetScript: (
					script: string,
					handler?: (frame: unknown, button: string) => void,
				) => {
					if (handler) scripts.set(script, handler);
					else scripts.delete(script);
					if (script === "OnClick" && !click && handler)
						click = () => handler(undefined, "LeftButton");
				},
				RegisterForClicks: vi.fn(),
				RegisterForDrag: vi.fn(),
				EnableMouseWheel: vi.fn(),
				SetScrollChild: vi.fn(),
				GetVerticalScroll: () => 0,
				GetVerticalScrollRange: () => 100,
				SetVerticalScroll: vi.fn(),
			};
		}),
	};
	const pool = new FramePoolManager(factory);
	const parent = new Frame("parent", pool);
	const actions = { useItem: vi.fn(), pickupItem: vi.fn() };
	const panel = new BagsPanel(
		"bags",
		"Bags",
		new Frame("panel", pool),
		pool,
		actions,
	);
	const cloth: InventoryItem = {
		bagId: 0,
		slotId: 1,
		itemId: 42,
		iconFileId: 123,
		count: 200,
		quality: 2,
		category: "Reagents",
		expansionId: 10,
		stackable: true,
	};
	const gear: InventoryItem = {
		...cloth,
		slotId: 4,
		itemId: 43,
		category: "Equipment",
		count: 1,
		quality: 4,
		itemLevel: 150,
		stackable: false,
	};
	panel.setItems([
		cloth,
		{ ...cloth, slotId: 2 },
		{ ...cloth, slotId: 3, count: 53 },
		gear,
	]);
	panel.setMoney(123456789);
	panel.onMount(parent);
	const itemScripts = handlers.filter((scripts) => scripts.has("OnDragStart"));
	const reagentScripts = itemScripts.at(1);
	reagentScripts?.get("OnClick")?.(undefined, "LeftButton");
	expect(actions.useItem).not.toHaveBeenCalled();
	reagentScripts?.get("OnClick")?.(undefined, "RightButton");
	reagentScripts?.get("OnDragStart")?.(undefined, "LeftButton");
	expect(actions.useItem).toHaveBeenCalledExactlyOnceWith(cloth);
	expect(actions.pickupItem).toHaveBeenCalledExactlyOnceWith(cloth);
	const texts = () => labels.map((label) => label.text).filter(Boolean);
	expect(texts()).toEqual(
		expect.arrayContaining([
			"Group: Category",
			"Equipment",
			"Reagents",
			"453",
			"150",
		]),
	);
	expect(texts()).not.toContain("1");
	expect(
		texts().some((text) =>
			text.includes("12,345|TInterface\\MoneyFrame\\UI-GoldIcon"),
		),
	).toBe(true);
	expect(colors).toHaveBeenCalledWith(0.12, 1, 0, 1);
	expect(colors).toHaveBeenCalledWith(0.64, 0.21, 0.93, 1);
	const count = factory.createFrame.mock.calls.length;
	click?.();
	expect(texts()).toContain("Group: Expansion");
	expect(texts()).toContain("The War Within");
	expect(factory.createFrame).toHaveBeenCalledTimes(count);
	panel.onUnmount();
	panel.onMount(parent);
	expect(factory.createFrame).toHaveBeenCalledTimes(count);
	panel.setItems([{ ...cloth, count: 1 }]);
	itemScripts.at(0)?.get("OnClick")?.(undefined, "RightButton");
	expect(actions.useItem).toHaveBeenLastCalledWith({ ...cloth, count: 1 });
	expect(texts()).not.toContain("453");
	panel.destroy();
	expect(
		itemScripts.every(
			(scripts) => !scripts.has("OnClick") && !scripts.has("OnDragStart"),
		),
	).toBe(true);
	expect(labels.every((label) => label.text === "")).toBe(true);
});
