import { afterEach, expect, it, vi } from "vitest";
import { Frame } from "../../ui/components/frame";
import { FramePoolManager } from "../../ui/frame-pool-manager";
import { PaperDollPanel } from "./paper-doll-panel";

afterEach(() => vi.unstubAllGlobals());

it("fits equipment around a character model with stats below, reuses controls and routes slot actions", () => {
	const natives: ReturnType<typeof createNative>[] = [];
	let panelHeight = 800;
	function createNative() {
		const handlers = new Map<
			string,
			(frame: unknown, button: string) => void
		>();
		const texts: string[] = [];
		return {
			handlers,
			texts,
			Show: vi.fn(),
			Hide: vi.fn(),
			SetParent: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetSize: vi.fn(),
			GetHeight: () => panelHeight,
			SetScript: (
				name: string,
				handler?: (frame: unknown, button: string) => void,
			) => {
				if (handler) handlers.set(name, handler);
				else handlers.delete(name);
			},
			RegisterForClicks: vi.fn(),
			RegisterForDrag: vi.fn(),
			EnableMouseWheel: vi.fn(),
			SetScrollChild: vi.fn(),
			GetVerticalScroll: () => 0,
			GetVerticalScrollRange: () => 0,
			SetVerticalScroll: vi.fn(),
			SetUnit: vi.fn(),
			SetPortraitZoom: vi.fn(),
			SetCamDistanceScale: vi.fn(),
			SetFacing: vi.fn(),
			ClearModel: vi.fn(),
			CreateTexture: () => ({
				SetAllPoints: vi.fn(),
				SetTexture: vi.fn(),
				SetColorTexture: vi.fn(),
			}),
			CreateFontString: () => ({
				SetText: (text: string) => texts.push(text),
				SetPoint: vi.fn(),
				ClearAllPoints: vi.fn(),
				SetFont: vi.fn(),
				SetJustifyH: vi.fn(),
				SetWidth: vi.fn(),
			}),
		};
	}
	const factory = {
		createFrame: vi.fn(() => {
			const native = createNative();
			natives.push(native);
			return native;
		}),
	};
	const pool = new FramePoolManager(factory);
	const actions = { pickup: vi.fn(), use: vi.fn(), close: vi.fn() };
	const panel = new PaperDollPanel(
		new Frame("paper-doll", pool),
		pool,
		actions,
	);
	const equipment = Array.from({ length: 18 }, (_, index) => ({
		slotId: index + 1,
		name: `Slot ${index}`,
		icon: 123,
		quality: 4,
		itemId: 42,
		hyperlink: "item:42",
		itemLevel: 150,
	}));
	panel.setEquipment(equipment);
	panel.setStats([{ label: "Haste", value: "25%" }]);
	panel.onMount(new Frame("parent", pool));
	const model = natives.find((native) => native.SetUnit.mock.calls.length > 0);
	if (!model) throw new Error("Missing character model");
	expect(model.SetSize).toHaveBeenCalledWith(332, 364);
	expect(model.SetUnit).toHaveBeenCalledWith("player");
	const row = natives.find((native) => native.texts.includes("Haste"));
	if (!row) throw new Error("Missing stats row");
	expect(row.SetPoint.mock.calls.at(-1)?.at(4)).toBe(-436);
	const content = natives.find((native) =>
		native.SetSize.mock.calls.some(
			([width, height]) => width === 500 && height === 462,
		),
	);
	expect(content?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		expect.anything(),
		"TOPLEFT",
		0,
		-169,
	);
	panel.setStats(
		Array.from({ length: 6 }, () => ({ label: "Stat", value: "1" })),
	);
	expect(content?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		expect.anything(),
		"TOPLEFT",
		0,
		-141,
	);
	panelHeight = 1000;
	natives
		.find((native) => native.handlers.has("OnSizeChanged"))
		?.handlers.get("OnSizeChanged")?.(undefined, "");
	expect(content?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		expect.anything(),
		"TOPLEFT",
		0,
		-241,
	);
	const equipmentButtons = natives.filter((native) =>
		native.handlers.has("OnDragStart"),
	);
	expect(equipmentButtons).toHaveLength(18);
	const tooltip = {
		SetOwner: vi.fn(),
		SetHyperlink: vi.fn(),
		SetText: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
	};
	vi.stubGlobal("GameTooltip", tooltip);
	equipmentButtons.at(0)?.handlers.get("OnEnter")?.(undefined, "");
	expect(tooltip.SetHyperlink).toHaveBeenCalledWith("item:42");
	equipmentButtons.at(0)?.handlers.get("OnLeave")?.(undefined, "");
	expect(tooltip.Hide).toHaveBeenCalledOnce();
	equipmentButtons.at(0)?.handlers.get("OnClick")?.(undefined, "RightButton");
	equipmentButtons.at(1)?.handlers.get("OnClick")?.(undefined, "LeftButton");
	expect(actions.use).toHaveBeenCalledWith(equipment.at(0));
	expect(actions.pickup).toHaveBeenCalledWith(equipment.at(1));
	expect(panel.getNavGrid()).toHaveLength(9);
	panel.getNavGrid().at(-1)?.at(0)?.onInteract();
	expect(actions.pickup).toHaveBeenLastCalledWith(equipment.at(16));
	const count = factory.createFrame.mock.calls.length;
	panel.onUnmount();
	equipmentButtons.at(0)?.handlers.get("OnClick")?.(undefined, "RightButton");
	expect(actions.use).toHaveBeenCalledOnce();
	panel.onMount(new Frame("parent-again", pool));
	expect(factory.createFrame).toHaveBeenCalledTimes(count + 1);
	panel.destroy();
	expect(model.ClearModel).toHaveBeenCalledOnce();
	expect(equipmentButtons.every((native) => native.handlers.size === 0)).toBe(
		true,
	);
});
