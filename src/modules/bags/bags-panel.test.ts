import { expect, it, vi } from "vitest";
import type { InventoryItem } from "../../clients/inventory-client";
import { Frame } from "../../ui/components/frame";
import { FramePoolManager } from "../../ui/frame-pool-manager";
import { BagsPanel } from "./bags-panel";

it("renders outlines, counts, gear levels, toggles grouping and reuses controls", () => {
	const labels: { text: string }[] = [];
	const colors = vi.fn();
	let click: (() => void) | undefined;
	const factory = {
		createFrame: vi.fn(() => ({
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
			SetScript: (script: string, handler?: () => void) => {
				if (script === "OnClick") click = handler;
			},
			EnableMouseWheel: vi.fn(),
			SetScrollChild: vi.fn(),
			GetVerticalScroll: () => 0,
			GetVerticalScrollRange: () => 100,
			SetVerticalScroll: vi.fn(),
		})),
	};
	const pool = new FramePoolManager(factory);
	const parent = new Frame("parent", pool);
	const panel = new BagsPanel("bags", "Bags", new Frame("panel", pool), pool);
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
	expect(texts()).not.toContain("453");
	panel.destroy();
	expect(labels.every((label) => label.text === "")).toBe(true);
});
