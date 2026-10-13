import { afterEach, expect, it, vi } from "vitest";
import { Frame } from "../../ui/components/frame";
import { FramePoolManager } from "../../ui/frame-pool-manager";
import { PaperDollPanel } from "./paper-doll-panel";

afterEach(() => vi.unstubAllGlobals());

it("fits equipment around a character model with stats below, reuses controls and routes slot actions", () => {
	const closeSkin = vi.spyOn(Frame.prototype, "setCloseButtonBackground");
	const natives: ReturnType<typeof createNative>[] = [];
	let panelHeight = 800;
	function createNative() {
		const handlers = new Map<
			string,
			(frame: unknown, button: string) => void
		>();
		const texts: string[] = [];
		const labels: {
			SetText: ReturnType<typeof vi.fn>;
			SetPoint: ReturnType<typeof vi.fn>;
			SetWidth: ReturnType<typeof vi.fn>;
			SetWordWrap: ReturnType<typeof vi.fn>;
			SetJustifyH: ReturnType<typeof vi.fn>;
		}[] = [];
		return {
			handlers,
			texts,
			labels,
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
				SetTexCoord: vi.fn(),
				SetAtlas: vi.fn(),
				ClearAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetWidth: vi.fn(),
				SetHeight: vi.fn(),
				SetColorTexture: vi.fn(),
			}),
			CreateFontString: () => {
				const label = {
					SetText: vi.fn((text: string) => texts.push(text)),
					SetPoint: vi.fn(),
					ClearAllPoints: vi.fn(),
					SetFont: vi.fn(),
					SetJustifyH: vi.fn(),
					SetWidth: vi.fn(),
					SetWordWrap: vi.fn(),
				};
				labels.push(label);
				return label;
			},
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
	const menu = { open: vi.fn(), close: vi.fn() };
	const panel = new PaperDollPanel(
		new Frame("paper-doll", pool),
		pool,
		actions,
		menu,
	);
	const equipment = Array.from({ length: 18 }, (_, index) => ({
		slotId: index + 1,
		name: index === 0 ? "Head" : `Slot ${index}`,
		itemName:
			index === 0 || index === 16
				? "An Extremely Long Equipment Item Name"
				: `Equipped item ${index}`,
		icon: 123,
		quality: 4,
		itemId: 42,
		hyperlink: "item:42",
		itemLevel: 150,
		upgradeTrack: {
			name: index === 0 ? "Champion" : index === 17 ? "Myth" : "Hero",
			rank: index === 8 ? 6 : 5,
			maxRank: 6,
		},
	}));
	panel.setEquipment(equipment);
	panel.setStats([{ label: "Haste", value: "25%" }]);
	panel.onMount(new Frame("parent", pool));
	const focus = vi
		.spyOn(Frame.prototype, "setFocused")
		.mockImplementation(() => {});
	panel.getNavGrid().at(0)?.at(0)?.onFocus();
	expect(focus).toHaveBeenLastCalledWith(true);
	panel.getNavGrid().at(0)?.at(0)?.onBlur();
	expect(focus).toHaveBeenLastCalledWith(false);
	focus.mockRestore();
	expect(closeSkin).not.toHaveBeenCalled();
	panel.getNavGrid().at(0)?.at(0)?.onContext?.();
	expect(menu.open).toHaveBeenLastCalledWith(equipment.at(0));
	expect(panel.getNavGrid().at(0)?.at(0)?.tooltipItem?.()).toEqual({
		item: "item:42",
	});
	const navigationChanged = vi.fn();
	panel.setNavigationChanged(navigationChanged);
	panel.setEquipment(
		equipment.map((slot, index) =>
			index === 0 ? { ...slot, hyperlink: "item:43:bonus" } : slot,
		),
	);
	expect(navigationChanged).toHaveBeenCalledOnce();
	expect(panel.getNavGrid().at(0)?.at(0)?.tooltipItem?.()).toEqual({
		item: "item:43:bonus",
	});
	panel.setEquipment(equipment);
	const details = natives.filter((native) =>
		native.texts.some((text) => text.includes(" · |cffffffff150|r")),
	);
	expect(details).toHaveLength(18);
	expect(details.at(0)?.texts).toContain("Head · |cffffffff150|r");
	expect(details.at(0)?.texts).toContain("An Extremely Long E...");
	expect(details.at(1)?.texts).toContain("Equipped item 1");
	expect(details.at(1)?.texts).toContain("Slot 1 · |cffffffff150|r");
	expect(details.at(16)?.texts).toContain("An Extremely Long Equipment Ite...");
	expect(details.at(0)?.texts).toContain(
		"|cff0070ddChampion |cffffff005|cff0070dd/6|r",
	);
	expect(details.at(1)?.texts).toContain(
		"|cffa335eeHero |cffffff005|cffa335ee/6|r",
	);
	expect(details.at(8)?.texts).toContain("|cffa335eeHero 6/6|r");
	expect(details.at(17)?.texts).toContain(
		"|cffff8000Myth |cffffff005|cffff8000/6|r",
	);
	expect(details.at(0)?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		expect.anything(),
		"TOPLEFT",
		68,
		-0,
	);
	expect(details.at(8)?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		expect.anything(),
		"TOPLEFT",
		282,
		-0,
	);
	expect(details.at(0)?.labels.at(0)?.SetPoint.mock.calls.at(-1)?.at(0)).toBe(
		"TOPLEFT",
	);
	expect(details.at(8)?.labels.at(0)?.SetPoint.mock.calls.at(-1)?.at(0)).toBe(
		"TOPRIGHT",
	);
	expect(details.at(16)?.SetPoint.mock.calls.at(-1)?.at(4)).toBe(-424);
	expect(
		details.every((detail) =>
			detail.labels.every(
				(label) => label.SetWordWrap.mock.lastCall?.at(0) === false,
			),
		),
	).toBe(true);
	const model = natives.find((native) => native.SetUnit.mock.calls.length > 0);
	if (!model) throw new Error("Missing character model");
	expect(model.SetSize).toHaveBeenCalledWith(332, 364);
	expect(model.SetUnit).toHaveBeenCalledWith("player");
	const row = natives.find((native) => native.texts.includes("Haste"));
	if (!row) throw new Error("Missing stats row");
	expect(row.SetPoint.mock.calls.at(-1)?.at(4)).toBe(-488);
	const content = natives.find((native) =>
		native.SetSize.mock.calls.some(
			([width, height]) => width === 500 && height === 514,
		),
	);
	expect(content?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		expect.anything(),
		"TOPLEFT",
		0,
		-143,
	);
	panel.setStats(
		Array.from({ length: 6 }, () => ({ label: "Stat", value: "1" })),
	);
	expect(content?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		expect.anything(),
		"TOPLEFT",
		0,
		-115,
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
		-215,
	);
	const equipmentButtons = natives.filter((native) =>
		native.handlers.has("OnDragStart"),
	);
	panel.setIdentity({
		name: "Mings",
		guild: "Deck Crew",
		level: 80,
		race: "Night Elf",
		className: "Druid",
		specialization: "Feral",
	});
	expect(content?.texts).toContain("Mings");
	expect(content?.texts).toContain("|cff40ff40<Deck Crew>|r");
	expect(content?.texts).toContain("Level 80 · Night Elf · Feral Druid");
	expect(content?.labels.at(0)?.SetPoint.mock.lastCall?.at(4)).toBe(-8);
	expect(content?.labels.at(1)?.SetPoint.mock.lastCall?.at(4)).toBe(-36);
	expect(content?.labels.at(2)?.SetPoint.mock.lastCall?.at(4)).toBe(-58);
	expect(content?.SetSize).toHaveBeenLastCalledWith(500, 650);
	expect(content?.SetPoint.mock.lastCall?.at(4)).toBe(-175);
	expect(
		content?.labels.every(
			(label) => label.SetJustifyH.mock.lastCall?.at(0) === "CENTER",
		),
	).toBe(true);
	const body = natives.find(
		(native) => native === model.SetParent.mock.lastCall?.at(0),
	);
	expect(body?.SetPoint.mock.lastCall?.at(4)).toBe(-80);
	const framesBeforeIdentityUpdate = factory.createFrame.mock.calls.length;
	panel.setIdentity({
		name: "Mings",
		level: 80,
		race: "Night Elf",
		className: "Druid",
	});
	expect(content?.texts).toContain("Level 80 · Night Elf · Druid");
	expect(content?.labels.at(0)?.SetPoint.mock.lastCall?.at(4)).toBe(-8);
	expect(content?.labels.at(2)?.SetPoint.mock.lastCall?.at(4)).toBe(-36);
	expect(content?.labels.at(1)?.SetText).toHaveBeenLastCalledWith("");
	expect(content?.SetSize).toHaveBeenLastCalledWith(500, 628);
	expect(content?.SetPoint.mock.lastCall?.at(4)).toBe(-186);
	expect(body?.SetPoint.mock.lastCall?.at(4)).toBe(-58);
	expect(factory.createFrame).toHaveBeenCalledTimes(framesBeforeIdentityUpdate);
	expect(equipmentButtons).toHaveLength(18);
	const tooltip = {
		suppressAutomaticCompareItem: false,
		SetOwner: vi.fn(),
		SetHyperlink: vi.fn(),
		SetText: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
	};
	vi.stubGlobal("GameTooltip", tooltip);
	equipmentButtons.at(0)?.handlers.get("OnEnter")?.(undefined, "");
	expect(tooltip.SetHyperlink).toHaveBeenCalledWith("item:42");
	expect(tooltip.suppressAutomaticCompareItem).toBe(true);
	equipmentButtons.at(0)?.handlers.get("OnLeave")?.(undefined, "");
	expect(tooltip.Hide).toHaveBeenCalledOnce();
	expect(tooltip.suppressAutomaticCompareItem).toBe(false);
	equipmentButtons.at(0)?.handlers.get("OnClick")?.(undefined, "RightButton");
	equipmentButtons.at(1)?.handlers.get("OnClick")?.(undefined, "LeftButton");
	expect(actions.use).toHaveBeenCalledWith(equipment.at(0));
	expect(actions.pickup).toHaveBeenCalledWith(equipment.at(1));
	expect(panel.getNavGrid()).toHaveLength(9);
	panel.getNavGrid().at(-1)?.at(0)?.onInteract();
	expect(actions.pickup).toHaveBeenLastCalledWith(equipment.at(16));
	const count = factory.createFrame.mock.calls.length;
	const layouts = vi.spyOn(Frame.prototype, "layout");
	panel.onUnmount();
	expect(menu.close).toHaveBeenCalled();
	menu.open.mockClear();
	panel.getNavGrid().at(0)?.at(0)?.onContext?.();
	expect(menu.open).not.toHaveBeenCalled();
	equipmentButtons.at(0)?.handlers.get("OnClick")?.(undefined, "RightButton");
	expect(actions.use).toHaveBeenCalledOnce();
	panel.onMount(new Frame("parent-again", pool));
	expect(
		layouts.mock.contexts.some((frame) => frame.id.startsWith("equipment-")),
	).toBe(false);
	layouts.mockRestore();
	expect(factory.createFrame).toHaveBeenCalledTimes(count + 1);
	panel.setEquipment(
		equipment.map((slot) => ({
			...slot,
			itemName: undefined,
			itemLevel: undefined,
		})),
	);
	expect(details.at(0)?.labels.at(0)?.SetText).toHaveBeenLastCalledWith("Head");
	expect(details.at(0)?.labels.at(2)?.SetText).toHaveBeenLastCalledWith(
		"Item 42",
	);
	panel.setEquipment(
		equipment.map((slot) => ({
			...slot,
			itemId: undefined,
			itemLevel: undefined,
			upgradeTrack: undefined,
		})),
	);
	expect(details.at(0)?.labels.at(0)?.SetText).toHaveBeenLastCalledWith("Head");
	expect(details.at(0)?.labels.at(1)?.SetText).toHaveBeenLastCalledWith("");
	expect(details.at(0)?.labels.at(2)?.SetText).toHaveBeenLastCalledWith("");
	panel.destroy();
	expect(model.ClearModel).toHaveBeenCalledOnce();
	expect(equipmentButtons.every((native) => native.handlers.size === 0)).toBe(
		true,
	);
});
