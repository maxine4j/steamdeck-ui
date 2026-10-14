import { afterEach, expect, it, vi } from "vitest";
import type { InventoryItem } from "../../clients/inventory-client";
import { Frame } from "../../ui/components/frame";
import { FramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationGrid } from "../../ui/navigation/navigation-grid";
import { BagsPanel } from "./bags-panel";

afterEach(() => vi.restoreAllMocks());

it.each(["category", "expansion"] as const)(
	"hides surplus headers when switching away from %s grouping and reuses them on return",
	(mode) => {
		for (const method of [
			"fill",
			"setWindowBackground",
			"setButtonBackground",
			"setInsetBackground",
			"setCloseButtonBackground",
			"setParent",
			"layout",
			"layoutVerticallyCentered",
			"setColor",
			"onClick",
			"inset",
			"onSizeChanged",
			"setScrollContent",
			"clampScroll",
			"setIcon",
			"onDragStart",
			"setItem",
			"onPostClick",
			"setHoverTooltip",
			"setCooldown",
		] as const) {
			vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
		}
		const visible = new Set<Frame>();
		const titles = new Map<Frame, string>();
		vi.spyOn(Frame.prototype, "show").mockImplementation(function () {
			visible.add(this);
		});
		vi.spyOn(Frame.prototype, "hide").mockImplementation(function () {
			visible.delete(this);
		});
		vi.spyOn(Frame.prototype, "setLabel").mockImplementation(
			function (key, text) {
				if (key === "title") titles.set(this, text);
			},
		);
		const pool = new FramePoolManager({
			createFrame: () => {
				throw new Error("Native frame access should be mocked");
			},
		});
		const pending: (() => void)[] = [];
		const panel = new BagsPanel(
			"bags",
			"Bags",
			new Frame("panel", pool),
			pool,
			{ useItem: vi.fn(), pickupItem: vi.fn(), destroyItem: vi.fn() },
			{ open: vi.fn(), close: vi.fn() },
			{
				nextFrame: (callback) => {
					pending.push(callback);
					return () => {};
				},
			},
		);
		const flush = () => {
			while (pending.length) pending.shift()?.();
		};
		const item: InventoryItem = {
			bagId: 0,
			slotId: 1,
			itemId: 1,
			iconFileId: 1,
			count: 1,
			quality: 1,
			category: "Equipment",
			expansionId: 0,
			stackable: false,
		};
		panel.setItems([
			item,
			{
				...item,
				slotId: 2,
				itemId: 2,
				category: mode === "category" ? "Reagents" : "Equipment",
				expansionId: mode === "expansion" ? 1 : 0,
			},
			{
				...item,
				slotId: 3,
				itemId: 3,
				category: mode === "category" ? "Recipes" : "Equipment",
				expansionId: mode === "expansion" ? 2 : 0,
			},
		]);
		const visibilityChanged = vi.fn();
		panel.setVisibilityChanged(visibilityChanged);
		panel.onMount(new Frame("parent", pool));
		expect(vi.mocked(Frame.prototype.layout)).toHaveBeenCalledWith(
			180,
			30,
			"TOPRIGHT",
			expect.any(Frame),
			-16,
			-24,
		);
		expect(visibilityChanged).toHaveBeenLastCalledWith(true);
		flush();
		const toggle = () => {
			panel.getNavGrid().at(0)?.at(0)?.onInteract();
			flush();
		};
		if (mode === "expansion") toggle();
		const grid = panel.getNavGrid();
		// Spread exposes holes that JS forEach skips but Lua forEach visits.
		expect([...grid].every((row) => Array.isArray(row))).toBe(true);
		expect(grid.at(2)).toEqual([]);
		const graph = new NavigationGrid(grid);
		const firstItem = grid.at(1)?.at(0);
		const lastItem = grid.at(3)?.at(0);
		expect(firstItem).toBeDefined();
		expect(lastItem).toBeDefined();
		expect(graph.neighbor(firstItem?.navId ?? "", "down")).toBe(lastItem);
		const headers = [...visible].filter((frame) => titles.has(frame));
		expect(headers).toHaveLength(3);
		toggle();
		expect(headers.filter((frame) => visible.has(frame))).toEqual([
			headers.at(0),
		]);
		const firstHeader = headers.at(0);
		expect(firstHeader && titles.get(firstHeader)).toBe(
			mode === "category" ? "Classic" : "Equipment",
		);
		toggle();
		expect(headers.every((frame) => visible.has(frame))).toBe(true);
		expect(titles.size).toBe(3);
		panel.setItems([]);
		flush();
		expect(headers.some((frame) => visible.has(frame))).toBe(false);
		expect(
			[...visible].some((frame) => frame.id.startsWith("bags-icon-")),
		).toBe(false);
	},
);

it("renders outlines, counts, gear levels, toggles grouping and reuses controls", () => {
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("C_Texture", {
		GetAtlasInfo: () => ({ width: 32, height: 128 }),
	});
	const layout = vi.spyOn(Frame.prototype, "layout");
	const focus = vi
		.spyOn(Frame.prototype, "setFocused")
		.mockImplementation(() => {});
	const labels: { text: string }[] = [];
	const colors = vi.fn();
	let viewportHeight = 600;
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
				GetHeight: () => viewportHeight,
				CreateTexture: () => ({
					SetAllPoints: vi.fn(),
					SetTexture: vi.fn(),
					SetTexCoord: vi.fn(),
					SetHorizTile: vi.fn(),
					SetAtlas: vi.fn(),
					ClearAllPoints: vi.fn(),
					SetPoint: vi.fn(),
					SetWidth: vi.fn(),
					SetHeight: vi.fn(),
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
				SetAttribute: vi.fn(),
				SetCooldown: vi.fn(),
				Clear: vi.fn(),
				SetHideCountdownNumbers: vi.fn(),
				SetDrawEdge: vi.fn(),
				SetOwner: vi.fn(),
				SetFrameStrata: vi.fn(),
				SetScale: vi.fn(),
				NineSlice: { SetAlpha: vi.fn() },
				TopOverlay: { SetAlpha: vi.fn() },
				BottomOverlay: { SetAlpha: vi.fn() },
				ClearLines: vi.fn(),
				SetHyperlink: vi.fn(),
				RegisterForDrag: vi.fn(),
				EnableMouseWheel: vi.fn(),
				EnableMouse: vi.fn(),
				SetPropagateMouseClicks: vi.fn(),
				SetScrollChild: vi.fn(),
				GetVerticalScroll: () => 0,
				GetVerticalScrollRange: () => 100,
				SetVerticalScroll: vi.fn(),
			};
		}),
	};
	const pool = new FramePoolManager(factory);
	const parent = new Frame("parent", pool);
	let bankType: number | undefined;
	let auctionOpen = false;
	const actions = {
		hasItemUseTarget: () => auctionOpen,
		getCooldown: vi.fn(() => ({ start: 100, duration: 14400 })),
		getDepositBankType: () => bankType,
		useItem: vi.fn(),
		pickupItem: vi.fn(),
		destroyItem: vi.fn(),
	};
	const menu = { open: vi.fn(), close: vi.fn() };
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
	const panel = new BagsPanel(
		"bags",
		"Bags",
		new Frame("panel", pool),
		pool,
		actions,
		menu,
		scheduler,
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
	expect(panel.getNavGrid()).toEqual([]);
	flush();
	expect(actions.getCooldown).toHaveBeenCalledWith(cloth);
	const cooldownFrames = () =>
		factory.createFrame.mock.results
			.map(({ value }) => value)
			.filter((native) => vi.mocked(native.SetCooldown).mock.calls.length > 0);
	expect(cooldownFrames()).toHaveLength(2);
	expect(cooldownFrames().at(1)?.SetCooldown).toHaveBeenLastCalledWith(
		100,
		14400,
	);
	const created = factory.createFrame.mock.calls.length;
	actions.getCooldown.mockReturnValue({ start: 0, duration: 0 });
	panel.refreshCooldowns();
	expect(cooldownFrames().at(1)?.SetCooldown).toHaveBeenLastCalledWith(0, 0);
	expect(factory.createFrame).toHaveBeenCalledTimes(created);
	const itemScripts = handlers.filter((scripts) => scripts.has("OnDragStart"));
	const reagentScripts = itemScripts.at(1);
	reagentScripts?.get("OnEnter")?.(undefined, "");
	const hover = factory.createFrame.mock.results.find(
		({ value }) => vi.mocked(value.SetOwner).mock.calls.length > 0,
	)?.value;
	const reagentIcon = factory.createFrame.mock.results.find(({ value }) =>
		vi
			.mocked(value.SetAttribute)
			.mock.calls.some(([key, value]) => key === "item2" && value === "0 1"),
	)?.value;
	expect(hover).toBeDefined();
	expect(hover?.SetOwner).toHaveBeenLastCalledWith(reagentIcon, "ANCHOR_RIGHT");
	expect(hover?.SetHyperlink).toHaveBeenLastCalledWith("item:42");
	reagentScripts?.get("OnLeave")?.(undefined, "");
	expect(hover?.Hide).toHaveBeenCalled();
	reagentScripts?.get("PostClick")?.(undefined, "LeftButton");
	expect(actions.useItem).not.toHaveBeenCalled();
	reagentScripts?.get("PostClick")?.(undefined, "RightButton");
	reagentScripts?.get("OnDragStart")?.(undefined, "LeftButton");
	expect(actions.useItem).not.toHaveBeenCalled();
	expect(reagentScripts?.has("OnClick")).toBe(false);
	expect(
		factory.createFrame.mock.results.some(({ value }) =>
			vi
				.mocked(value.SetAttribute)
				.mock.calls.some(([key, value]) => key === "item2" && value === "0 1"),
		),
	).toBe(true);
	expect(actions.pickupItem).not.toHaveBeenCalled();
	const texts = () => labels.map((label) => label.text).filter(Boolean);
	expect(
		texts().some((text) => text.includes("xbox_r_x.blp:18:18|t Use / Equip")),
	).toBe(true);
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
	flush();
	expect(texts()).toContain("Group: Expansion");
	expect(texts()).toContain("The War Within");
	expect(factory.createFrame).toHaveBeenCalledTimes(count);
	const grid = panel.getNavGrid();
	expect(grid.at(0)?.at(0)?.navId).toBe("bags-group-toggle");
	expect(grid.flat().filter(Boolean)).toHaveLength(3);
	const reagent = grid.flat().find((node) => node?.navId.includes("item-42"));
	expect(reagent?.tooltipItem?.()).toBe(42);
	reagent?.onFocus();
	expect(focus).toHaveBeenLastCalledWith(true, true);
	const edge = vi
		.spyOn(Frame.prototype, "scrollToEdge")
		.mockImplementation(() => {});
	reagent?.navigationScroll?.scrollToEdge("down");
	expect(edge).toHaveBeenLastCalledWith("down");
	reagent?.onInteract();
	expect(actions.useItem).not.toHaveBeenCalled();
	reagent?.onAlternate?.();
	expect(actions.useItem).not.toHaveBeenCalled();
	expect(reagent?.secureActions?.()).toEqual({
		alternate: expect.objectContaining({ id: "bags-icon-0" }),
		alternateButton: "RightButton",
	});
	reagent?.onContext?.();
	expect(menu.open).toHaveBeenCalledExactlyOnceWith(cloth);
	reagent?.onBlur();
	expect(focus).toHaveBeenLastCalledWith(false, true);
	const focusCalls = focus.mock.calls.length;
	panel.onUnmount();
	actions.getCooldown.mockClear();
	panel.refreshCooldowns();
	expect(actions.getCooldown).not.toHaveBeenCalled();
	expect(focus.mock.calls.length).toBeGreaterThan(focusCalls);
	expect(focus).toHaveBeenLastCalledWith(false, true);
	expect(panel.getNavGrid()).toEqual([]);
	reagent?.onInteract();
	reagent?.onAlternate?.();
	expect(actions.useItem).not.toHaveBeenCalled();
	expect(reagent?.secureActions?.().alternate).toBeUndefined();
	reagent?.onContext?.();
	expect(menu.open).toHaveBeenCalledOnce();
	panel.onMount(parent);
	flush();
	expect(factory.createFrame).toHaveBeenCalledTimes(count);
	layout.mockClear();
	panel.onUnmount();
	panel.onMount(parent);
	flush();
	expect(
		layout.mock.contexts.some((frame) => frame.id.startsWith("bags-border-")),
	).toBe(false);
	panel.setItems([{ ...cloth, count: 1 }]);
	const firstIcon = factory.createFrame.mock.results.find(({ value }) =>
		vi.mocked(value.SetAttribute).mock.calls.some(([key]) => key === "item2"),
	)?.value;
	expect(firstIcon?.SetAttribute).toHaveBeenLastCalledWith("item2", undefined);
	flush();
	itemScripts.at(0)?.get("PostClick")?.(undefined, "RightButton");
	expect(actions.useItem).not.toHaveBeenCalled();
	expect(reagent?.secureActions?.().alternate).toBeUndefined();
	expect(texts()).not.toContain("453");
	bankType = 2;
	panel.setItems([{ ...cloth, count: 1 }]);
	flush();
	expect(firstIcon?.SetAttribute).toHaveBeenLastCalledWith("item2", undefined);
	const bankingNode = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId.includes("item-42"));
	expect(bankingNode?.secureActions?.().alternate).toBeUndefined();
	bankingNode?.onAlternate?.();
	expect(actions.useItem).toHaveBeenCalledExactlyOnceWith({
		...cloth,
		count: 1,
	});
	itemScripts.at(0)?.get("PostClick")?.(undefined, "RightButton");
	expect(actions.useItem).toHaveBeenLastCalledWith({ ...cloth, count: 1 });
	bankType = undefined;
	auctionOpen = true;
	panel.refreshInteractions();
	expect(firstIcon?.SetAttribute).toHaveBeenLastCalledWith("item2", undefined);
	const auctionNode = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId.includes("item-42"));
	expect(auctionNode?.secureActions?.().alternate).toBeUndefined();
	actions.useItem.mockClear();
	auctionNode?.onAlternate?.();
	expect(actions.useItem).toHaveBeenCalledExactlyOnceWith({
		...cloth,
		count: 1,
	});
	itemScripts.at(0)?.get("PostClick")?.(undefined, "RightButton");
	expect(actions.useItem).toHaveBeenCalledTimes(2);
	auctionOpen = false;
	panel.refreshInteractions();
	click?.();
	flush();
	layout.mockClear();
	panel.setItems([
		...Array.from({ length: 40 }, (_, index) => ({
			...gear,
			itemId: 100 + index,
		})),
		cloth,
		{ ...cloth, itemId: 200, category: "Consumables" },
	]);
	flush();
	const positions = (id: string) =>
		layout.mock.calls.filter(
			(_, index) => layout.mock.contexts.at(index)?.id === id,
		);
	expect(positions("bags-header-0")).toEqual([
		[226, 24, "TOPLEFT", expect.any(Frame), 0, -0],
	]);
	expect(positions("bags-header-1")).toEqual([
		[226, 24, "TOPLEFT", expect.any(Frame), 234, -0],
	]);
	expect(positions("bags-border-4")).toEqual([
		[42, 42, "TOPLEFT", expect.any(Frame), 184, -28],
	]);
	expect(positions("bags-border-5")).toEqual([
		[42, 42, "TOPLEFT", expect.any(Frame), 0, -74],
	]);
	expect(positions("bags-border-6")).toEqual([
		[42, 42, "TOPLEFT", expect.any(Frame), 46, -74],
	]);
	const groupedGrid = panel.getNavGrid();
	expect(groupedGrid.at(1)?.at(4)?.navId).toContain("item-104");
	expect(groupedGrid.at(2)?.at(0)?.navId).toContain("item-105");
	expect(groupedGrid.at(2)?.at(5)).toBeUndefined();
	expect(
		groupedGrid.flat().find((node) => node.navId.includes("item-200"))
			?.navColumn,
	).toBe(5);
	expect(positions("bags-header-2")).toEqual([
		[226, 24, "TOPLEFT", expect.any(Frame), 234, -92],
	]);
	expect(positions("bags-border-41")).toEqual([
		[42, 42, "TOPLEFT", expect.any(Frame), 234, -120],
	]);
	expect(positions("bags-content")).toEqual([
		[460, 410, "TOPLEFT", expect.any(Frame), 0, -95],
	]);
	viewportHeight = 100;
	layout.mockClear();
	handlers
		.find((scripts) => scripts.has("OnSizeChanged"))
		?.get("OnSizeChanged")?.(undefined, "");
	expect(positions("bags-border-0")).toEqual([]);
	expect(positions("bags-content").at(-1)).toEqual([
		460,
		410,
		"TOPLEFT",
		expect.any(Frame),
		0,
		-0,
	]);
	viewportHeight = 600;
	panel.setItems([cloth]);
	flush();
	expect(positions("bags-content").at(-1)).toEqual([
		460,
		88,
		"TOPLEFT",
		expect.any(Frame),
		0,
		-256,
	]);
	const beforeBatch = factory.createFrame.mock.calls.length;
	panel.setItems(
		Array.from({ length: 40 }, (_, index) => ({
			...gear,
			itemId: 300 + index,
			slotId: index + 1,
		})),
	);
	pending.shift()?.();
	expect(
		factory.createFrame.mock.calls.length - beforeBatch,
	).toBeLessThanOrEqual(20);
	expect(pending).toHaveLength(1);
	const partial = factory.createFrame.mock.calls.length;
	panel.onUnmount();
	flush();
	expect(factory.createFrame).toHaveBeenCalledTimes(partial);
	panel.onMount(parent);
	flush();
	expect(panel.getNavGrid().flat().filter(Boolean)).toHaveLength(41);
	panel.destroy();
	expect(
		itemScripts.every(
			(scripts) => !scripts.has("OnClick") && !scripts.has("OnDragStart"),
		),
	).toBe(true);
	expect(labels.every((label) => label.text === "")).toBe(true);
	layout.mockRestore();
	focus.mockRestore();
});
