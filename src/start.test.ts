import { afterEach, expect, it, vi } from "vitest";
import type { Toy } from "./clients/toys-client";
import { createTestEventBus } from "./events/test-event-bus";
import { startSteamDeckUI } from "./start";
import type { WowFrame, WowTexture } from "./types";
import type { FrameType } from "./ui/frame-pool-manager";

afterEach(() => vi.unstubAllGlobals());

it("docks full-height side containers and refreshes a grouped, pooled one-bag grid", () => {
	vi.stubGlobal("_G", {});
	vi.stubGlobal("UISpecialFrames", []);
	const frames: WowFrame[] = [];
	const textures: WowTexture[] = [];
	const labels: string[][] = [];
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
	const factory = {
		createFrame: (type: FrameType) => {
			const texts: string[] = [];
			labels.push(texts);
			const texture = {
				ClearAllPoints: vi.fn(),
				SetAllPoints: vi.fn(),
				SetColorTexture: vi.fn(),
				SetTexture: vi.fn(),
				SetTexCoord: vi.fn(),
				SetPoint: vi.fn(),
				SetHeight: vi.fn(),
				SetWidth: vi.fn(),
			};
			let shown = false;
			const frame = {
				CreateFontString: () => ({
					SetText: vi.fn((text: string) => {
						texts.push(text);
					}),
					SetPoint: vi.fn(),
					ClearAllPoints: vi.fn(),
					SetFont: vi.fn(),
					SetJustifyH: vi.fn(),
					SetWidth: vi.fn(),
					SetWordWrap: vi.fn(),
				}),
				SetScript: vi.fn(),
				SetAutoFocus: vi.fn(),
				SetFontObject: vi.fn(),
				SetTextInsets: vi.fn(),
				ClearFocus: vi.fn(),
				SetText: vi.fn(),
				SetAttribute: vi.fn(),
				Click: vi.fn(),
				SetCooldown: vi.fn(),
				SetHideCountdownNumbers: vi.fn(),
				SetDrawEdge: vi.fn(),
				Clear: vi.fn(),
				RegisterForClicks: vi.fn(),
				RegisterForDrag: vi.fn(),
				EnableMouseWheel: vi.fn(),
				EnableMouse: vi.fn(),
				SetScrollChild: vi.fn(),
				GetVerticalScroll: () => 0,
				GetVerticalScrollRange: () => 0,
				SetVerticalScroll: vi.fn(),
				Show: vi.fn(() => {
					shown = true;
				}),
				Hide: vi.fn(() => {
					shown = false;
				}),
				IsShown: () => shown,
				RefreshData: vi.fn(),
				SetParent: vi.fn(),
				SetFrameStrata: vi.fn(),
				SetFrameLevel: vi.fn(),
				GetFrameLevel: () => 0,
				ClearAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetSize: vi.fn(),
				GetHeight: () => (type === "GameTooltip" ? 440 : 600),
				GetWidth: () => (type === "GameTooltip" ? 320 : 1280),
				SetOwner: vi.fn(),
				SetHyperlink: vi.fn(),
				ClearLines: vi.fn(),
				SetScale: vi.fn(),
				SetAlpha: vi.fn(),
				NineSlice: { SetAlpha: vi.fn() },
				TopOverlay: { SetAlpha: vi.fn() },
				BottomOverlay: { SetAlpha: vi.fn() },
				SetUnit: vi.fn(),
				SetPortraitZoom: vi.fn(),
				SetCamDistanceScale: vi.fn(),
				SetFacing: vi.fn(),
				ClearModel: vi.fn(),
				CreateTexture: () => texture,
			};
			frames.push(frame);
			textures.push(texture);
			return frame;
		},
	};
	const events = createTestEventBus();
	const nativeParent = { GetWidth: () => 1920, GetHeight: () => 1080 };
	vi.stubGlobal("UIParent", nativeParent);
	const compare = vi.fn();
	vi.stubGlobal("GameTooltip_ShowCompareItem", compare);
	const builtIns = Array.from({ length: 7 }, () => ({
		GetParent: () => nativeParent,
		SetParent: vi.fn(),
	}));
	[
		"ContainerFrameCombinedBags",
		"ContainerFrame1",
		"ContainerFrame2",
		"ContainerFrame3",
		"ContainerFrame4",
		"ContainerFrame5",
		"ContainerFrame6",
	].forEach((name, index) => {
		vi.stubGlobal(name, builtIns.at(index));
	});
	const characterHooks: (() => void)[] = [];
	vi.stubGlobal(
		"hooksecurefunc",
		vi.fn((...args: unknown[]) =>
			characterHooks.push(args.at(-1) as () => void),
		),
	);
	vi.stubGlobal("HideUIPanel", vi.fn());
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	vi.stubGlobal("PlayerSpellsFrame", undefined);
	vi.stubGlobal("PVEFrame", { IsShown: () => false, HookScript: vi.fn() });
	vi.stubGlobal("LFDParentFrame", {
		IsShown: () => false,
		HookScript: vi.fn(),
	});
	vi.stubGlobal("MountJournal", { IsShown: () => false, HookScript: vi.fn() });
	vi.stubGlobal("ToyBox", { IsShown: () => false, HookScript: vi.fn() });
	vi.stubGlobal("CollectionsJournal", {
		IsShown: () => false,
		HookScript: vi.fn(),
	});
	vi.stubGlobal("ToggleCharacter", vi.fn());
	let characterShown = false;
	vi.stubGlobal("CharacterFrame", {
		GetParent: () => nativeParent,
		SetParent: vi.fn(),
		IsShown: () => characterShown,
		activeSubframe: "PaperDollFrame",
	});
	const character = {
		getIdentity: vi.fn(() => ({
			name: "Mings",
			level: 80,
			race: "Night Elf",
			className: "Druid",
		})),
		open: vi.fn(),
		toggle: vi.fn(),
		isOpen: vi.fn(() => false),
		getEquipment: vi.fn(() => []),
		getStats: vi.fn(() => []),
		pickup: vi.fn(),
		use: vi.fn(),
		close: vi.fn(),
	};
	const inventory = {
		useItem: vi.fn(),
		pickupItem: vi.fn(),
		destroyItem: vi.fn(),
		getMoney: vi.fn(() => 12345),
		isOpen: vi.fn(() => false),
		getItems: vi.fn(() => [
			{
				bagId: 0,
				slotId: 2,
				itemId: 42,
				iconFileId: 123,
				count: 1,
				quality: 3,
				category: "Equipment" as const,
				stackable: false,
				hyperlink: "item:42:bonus:123",
			},
		]),
	};
	const reputation = {
		getReputations: vi.fn(() => [
			{
				index: 1,
				id: 42,
				name: "Faction",
				description: "Description",
				header: false,
				collapsed: false,
				watched: false,
				standing: "Friendly",
				progress: "10 / 100",
			},
		]),
		activate: vi.fn(),
	};
	const titles = {
		getTitles: vi.fn(() => [{ id: -1, name: "None", selected: true }]),
		select: vi.fn(),
	};
	const controller = {
		disableBuiltIn: vi.fn(),
		initialize: vi.fn(),
		setActive: vi.fn(),
		shutdown: vi.fn(),
	};
	const toys = {
		isInCombat: () => false,
		load: vi.fn((callback: (toys: Toy[]) => void) =>
			scheduler.nextFrame(() =>
				callback([
					{
						id: 9001,
						name: "Train",
						icon: 9002,
						collected: true,
						favourite: true,
						expansionId: 0,
					},
				]),
			),
		),
		toggleFavourite: vi.fn(),
		canUse: () => true,
		getCooldown: () => ({ start: 0, duration: 0 }),
	};
	const app = startSteamDeckUI(
		factory,
		events,
		inventory,
		character,
		reputation,
		titles,
		{
			load: vi.fn(() => vi.fn()),
			getMounts: () => [],
			summon: vi.fn(),
			pickupRandom: vi.fn(),
			getCount: () => ({ collected: 0, total: 0 }),
			search: vi.fn(),
			getFilters: () => [],
			toggleFilter: vi.fn(),
			toggleFavourite: vi.fn(),
			getEquipment: () => ({ icon: 134400, label: "Empty" }),
			applyEquipment: vi.fn(),
			getUtilitySpells: () => ({ favourite: 150544, flight: 1 }),
		},
		{
			canModify: () => false,
			syncBuiltInVisibility: vi.fn(),
			disableBuiltIn: vi.fn(),
			restore: vi.fn(),
			read: vi.fn(),
			bind: vi.fn(),
			getSlotDriver: vi.fn(),
		},
		controller,
		scheduler,
		{
			read: () => ({
				specs: [],
				loadouts: [],
				starterAvailable: false,
				starterSelected: false,
			}),
			selectSpec: vi.fn(),
			selectLoadout: vi.fn(),
			selectStarter: vi.fn(),
		},
		{
			getDungeons: () => [],
			getSelected: () => undefined,
			getRoles: () => ({ tank: false, healer: false, damage: true }),
			getAvailableRoles: () => ({
				leader: true,
				tank: false,
				healer: false,
				damage: true,
			}),
			getDungeonLists: () => [],
			getDungeonChoices: () => [],
			selectList: vi.fn(),
			toggleDungeon: vi.fn(),
			toggleRole: vi.fn(),
			isQueued: () => false,
			select: vi.fn(),
			join: vi.fn(),
			leave: vi.fn(),
		},
		{
			getCurrencies: () => [],
			load: (callback) => {
				callback([]);
				return vi.fn();
			},
			toggleHeader: vi.fn(),
			setWatched: () => true,
			setUnused: vi.fn(),
			requestSources: vi.fn(),
			sourcesReady: () => true,
			getSources: () => [],
			transferCost: () => undefined,
			transfer: () => false,
		},
		{
			read: vi.fn(),
			refresh: vi.fn(),
			select: vi.fn(),
			accept: vi.fn(),
			advance: vi.fn(),
			claim: vi.fn(),
			prompt: vi.fn(),
			confirm: vi.fn(),
			cancelPrompt: vi.fn(),
			close: vi.fn(),
			end: vi.fn(),
			isInCombat: () => false,
			isDialogueInteraction: () => true,
		},
		{ begin: vi.fn(), end: vi.fn() },
		{
			setOpen: vi.fn(),
			getItems: () => [
				{
					index: 1,
					name: "Potion",
					icon: 1,
					price: 100,
					count: 1,
					available: -1,
					purchasable: true,
					costs: [],
				},
			],
			getBuyback: () => [],
			getActions: () => ({
				repairCost: 0,
				repair: false,
				guildRepair: false,
				sellJunk: false,
			}),
			buy: vi.fn(),
			buyback: vi.fn(),
			repair: vi.fn(),
			sellJunk: vi.fn(),
			ensureBagsOpen: () => inventory.isOpen.mockReturnValue(true),
			close: vi.fn(),
		},
		toys,
	);
	expect(frames).toHaveLength(3);
	expect(frames.at(0)?.SetSize).toHaveBeenCalledWith(500, 0);
	expect(frames.at(0)?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		undefined,
		"TOPLEFT",
		0,
		0,
	);
	expect(frames.at(0)?.SetPoint).toHaveBeenCalledWith(
		"BOTTOMLEFT",
		undefined,
		"BOTTOMLEFT",
		0,
		0,
	);
	expect(frames.at(1)?.SetPoint).toHaveBeenCalledWith(
		"TOPRIGHT",
		undefined,
		"TOPRIGHT",
		0,
		0,
	);
	expect(frames.at(1)?.SetPoint).toHaveBeenCalledWith(
		"BOTTOMRIGHT",
		undefined,
		"BOTTOMRIGHT",
		0,
		0,
	);
	events.emit("PLAYER_LOGIN");
	expect(controller.disableBuiltIn).toHaveBeenCalledOnce();
	expect(controller.initialize).toHaveBeenCalledOnce();
	expect(inventory.getItems).not.toHaveBeenCalled();
	expect(frames).toHaveLength(4);
	for (const frame of builtIns)
		expect(frame.SetParent).toHaveBeenCalledWith(frames.at(3));
	inventory.isOpen.mockReturnValue(true);
	events.emit("BAG_VISIBILITY_CHANGED");
	flush();
	const mountsTabIndex = textures.findIndex((texture) =>
		vi.mocked(texture.SetTexture).mock.calls.some(([icon]) => icon === 132261),
	);
	expect(mountsTabIndex).toBeGreaterThanOrEqual(0);
	const mountsTabBorder = frames.at(mountsTabIndex - 1);
	expect(mountsTabBorder?.SetParent).toHaveBeenLastCalledWith(frames.at(1));
	const toysTabIndex = textures.findIndex((texture) =>
		vi.mocked(texture.SetTexture).mock.calls.some(([icon]) => icon === 454046),
	);
	expect(toysTabIndex).toBeGreaterThanOrEqual(0);
	expect(frames.at(toysTabIndex - 1)?.SetParent).toHaveBeenLastCalledWith(
		frames.at(1),
	);
	app.ui.openPanel("toys", "right");
	flush();
	expect(app.ui.getContainer("right").activePanelId).toBe("toys");
	expect(toys.load).toHaveBeenCalledOnce();
	expect(app.navigation.focusedId).toBe("toy-favourite-9001");
	const toyButton = frames.find((frame) =>
		vi
			.mocked(frame.SetAttribute)
			.mock.calls.some(([key, value]) => key === "toy" && value === 9001),
	);
	expect(toyButton?.SetAttribute).toHaveBeenCalledWith("type", "toy");
	events.emit("NAV_ALTERNATE");
	expect(
		(toyButton as WowFrame & { Click(): void }).Click,
	).toHaveBeenCalledOnce();
	events.emit("NAV_CONTEXT");
	expect(app.navigation.focusedId).toBe("toy-actions-use");
	expect(
		frames.some((frame) =>
			vi
				.mocked(
					(frame as WowFrame & { SetHyperlink(link: string): void })
						.SetHyperlink,
				)
				.mock.calls.some(([link]) => link === "item:9001"),
		),
	).toBe(true);
	events.emit("NAV_DOWN");
	events.emit("NAV_INTERACT");
	expect(toys.toggleFavourite).toHaveBeenCalledExactlyOnceWith(9001);
	flush();
	app.ui.openPanel("bags", "right");
	flush();
	compare.mockClear();
	const bagIconIndex = textures.findIndex((texture) =>
		vi.mocked(texture.SetTexture).mock.calls.some(([icon]) => icon === 123),
	);
	const bagIcon = frames.at(bagIconIndex);
	expect(bagIcon?.SetPoint).toHaveBeenCalledWith(
		"CENTER",
		frames.at(bagIconIndex - 1),
		"CENTER",
		0,
		0,
	);
	expect(app.navigation.focusedId).toBe("bags-group-toggle");
	app.navigation.moveDown();
	expect(app.navigation.focusedId).toContain("bags-item-42");
	expect(compare).toHaveBeenCalledOnce();
	const focusedTooltip = compare.mock.lastCall?.at(0) as WowFrame;
	expect(focusedTooltip.SetFrameStrata).toHaveBeenCalledWith("TOOLTIP");
	const count = frames.length;
	events.emit("BAG_UPDATE_DELAYED");
	flush();
	expect(app.navigation.focusedId).toContain("bags-item-42");
	expect(inventory.getItems).toHaveBeenCalledTimes(2);
	expect(frames).toHaveLength(count);
	events.emit("NAV_INTERACT");
	expect(inventory.useItem).not.toHaveBeenCalled();
	events.emit("NAV_ALTERNATE");
	expect(inventory.useItem).toHaveBeenCalledOnce();
	events.emit("NAV_CONTEXT");
	expect(app.navigation.focusedId).toBe("item-actions-use");
	expect(focusedTooltip.Hide).toHaveBeenCalled();
	const detailTooltip = frames.find(
		(frame) =>
			frame !== focusedTooltip &&
			"SetHyperlink" in frame &&
			vi
				.mocked(
					(frame as WowFrame & { SetHyperlink: ReturnType<typeof vi.fn> })
						.SetHyperlink,
				)
				.mock.calls.some(([link]) => link === "item:42:bonus:123"),
	);
	expect(detailTooltip).toBeDefined();
	expect(
		(detailTooltip as WowFrame & { SetHyperlink: ReturnType<typeof vi.fn> })
			.SetHyperlink,
	).toHaveBeenLastCalledWith("item:42:bonus:123");
	const detailWindow = frames.find((frame) =>
		vi
			.mocked(frame.SetSize)
			.mock.calls.some(([width, height]) => width === 660 && height === 480),
	);
	expect(detailWindow).toBeDefined();
	events.emit("NAV_ALTERNATE");
	expect(inventory.useItem).toHaveBeenCalledOnce();
	const overlay = frames.find((frame) =>
		vi
			.mocked(frame.SetFrameStrata)
			.mock.calls.some(([strata]) => strata === "FULLSCREEN_DIALOG"),
	);
	expect(overlay?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		undefined,
		"TOPLEFT",
		0,
		0,
	);
	expect(detailWindow?.SetPoint).toHaveBeenCalledWith(
		"CENTER",
		overlay,
		"CENTER",
		0,
		0,
	);
	const tooltipHides = detailTooltip
		? vi.mocked(detailTooltip.Hide).mock.calls.length
		: 0;
	events.emit("NAV_CANCEL");
	expect(detailTooltip?.Hide).toHaveBeenCalledTimes(tooltipHides + 1);
	expect(app.navigation.focusedId).toContain("bags-item-42");
	const modalCount = frames.length;
	events.emit("NAV_CONTEXT");
	events.emit("NAV_DOWN");
	events.emit("NAV_INTERACT");
	expect(app.navigation.focusedId).toBe("item-actions-cancel");
	expect(inventory.destroyItem).not.toHaveBeenCalled();
	events.emit("NAV_DOWN");
	events.emit("NAV_INTERACT");
	expect(inventory.destroyItem).toHaveBeenCalledOnce();
	expect(app.navigation.focusedId).toContain("bags-item-42");
	events.emit("NAV_CONTEXT");
	events.emit("NAV_INTERACT");
	events.emit("NAV_CONTEXT");
	events.emit("COMBAT_STARTED");
	expect(inventory.useItem).toHaveBeenCalledTimes(2);
	expect(app.navigation.focusedId).toContain("bags-item-42");
	expect(frames).toHaveLength(modalCount);
	const rightFrame = frames.at(1);
	if (!rightFrame) throw new Error("Missing right container");
	const rightHides = vi.mocked(rightFrame.Hide).mock.calls.length;
	character.isOpen.mockReturnValue(true);
	characterShown = true;
	for (const hook of characterHooks) hook();
	expect(character.getEquipment).toHaveBeenCalledOnce();
	expect(
		textures.filter((texture) =>
			vi
				.mocked(texture.SetTexture)
				.mock.calls.some(([icon]) => icon === 132261),
		),
	).toHaveLength(1);
	expect(frames.at(0)?.Show).toHaveBeenCalled();
	expect(frames.at(1)?.Hide).toHaveBeenCalledTimes(rightHides);
	const clickTab = (icon: number) => {
		const index = textures.findIndex((texture) =>
			vi
				.mocked(texture.SetTexture)
				.mock.calls.some((call) => call.at(0) === icon),
		);
		const native = frames.at(index);
		if (!native) throw new Error("Missing tab frame");
		const handler = vi
			.mocked(native.SetScript)
			.mock.calls.find((call) => call.at(0) === "OnClick")
			?.at(1) as ((frame: unknown, button: string) => void) | undefined;
		if (!handler) throw new Error("Missing tab button");
		handler(native, "LeftButton");
		flush();
	};
	clickTab(236683);
	expect(reputation.getReputations).toHaveBeenCalledOnce();
	const clickRow = (text: string) => {
		const native = frames.at(
			labels.findLastIndex((texts) => texts.includes(text)),
		);
		if (!native) throw new Error("Missing list row");
		const handler = vi
			.mocked(native.SetScript)
			.mock.calls.find((call) => call.at(0) === "OnClick")
			?.at(1) as ((frame: unknown, button: string) => void) | undefined;
		if (!handler) throw new Error("Missing list row action");
		return () => {
			handler(native, "LeftButton");
			flush();
		};
	};
	const clickFaction = clickRow("Faction");
	clickFaction();
	expect(reputation.activate).toHaveBeenCalledWith(
		reputation.getReputations().at(0),
	);
	clickTab(133759);
	expect(titles.getTitles).toHaveBeenCalledOnce();
	clickFaction();
	expect(reputation.activate).toHaveBeenCalledOnce();
	clickRow("None")();
	expect(titles.select).toHaveBeenCalledExactlyOnceWith(-1);
	const withTabs = frames.length;
	clickTab(236683);
	clickTab(133759);
	clickTab(133127);
	expect(frames).toHaveLength(withTabs);
	character.isOpen.mockReturnValue(false);
	characterShown = false;
	for (const hook of characterHooks) hook();
	expect(frames.at(0)?.Hide).toHaveBeenCalled();
	expect(frames.at(1)?.Hide).toHaveBeenCalledTimes(rightHides);
	const withPaperDoll = frames.length;
	events.emit("NAV_CONTEXT");
	expect(app.navigation.focusedId).toBe("item-actions-use");
	app.ui.closePanel("right");
	expect(app.navigation.focusedId).toBeUndefined();
	app.ui.openPanel("bags", "right");
	flush();
	expect(frames).toHaveLength(withPaperDoll);
	events.emit("NAV_CONTEXT");
	expect(app.navigation.focusedId).toBe("item-actions-use");
	inventory.getItems.mockReturnValue([]);
	events.emit("BAG_UPDATE_DELAYED");
	flush();
	expect(bagIcon?.Hide).toHaveBeenCalled();
	expect(app.navigation.focusedId).not.toContain("bags-item-");
	clickTab(132261);
	expect(app.ui.getContainer("right").activePanelId).toBe("mounts");
	expect(app.ui.getContainer("left").activePanelId).toBeUndefined();
	clickRow("X")();
	expect(HideUIPanel).toHaveBeenCalledWith(CollectionsJournal);
	expect(app.ui.getContainer("right").activePanelId).toBeUndefined();
	vi.stubGlobal("PVEFrame_ShowFrame", vi.fn());
	app.ui.openPanel("bags", "right");
	flush();
	clickTab(237538);
	expect(PVEFrame_ShowFrame).toHaveBeenCalledWith(
		"GroupFinderFrame",
		LFDParentFrame,
	);
	expect(app.ui.getContainer("right").activePanelId).toBe("dungeon-finder");
	expect(labels.flat()).toContain("No random dungeons available");
	const finderFrames = frames.length;
	app.ui.closePanel("right", "dungeon-finder");
	app.ui.openPanel("dungeon-finder", "right");
	flush();
	expect(frames).toHaveLength(finderFrames);
	app.ui.closePanel("right");
	app.ui.openPanel("paper-doll", "left");
	events.emit("MERCHANT_SHOW");
	expect(app.ui.getContainer("left").activePanelId).toBeUndefined();
	expect(app.ui.getContainer("left", "merchant").activePanelId).toBe("vendor");
	expect(app.ui.getContainer("right").activePanelId).toBe("bags");
	expect(app.navigation.focusedId).toBe("vendor-item-1");
	app.ui.closePanel("left");
	expect(app.navigation.focusedId).toBe("vendor-item-1");
	events.emit("NAV_CONTAINER_RIGHT");
	expect(app.navigation.focusedId).not.toContain("vendor");
	events.emit("NAV_CONTAINER_LEFT");
	expect(app.navigation.focusedId).toBe("vendor-item-1");
	events.emit("NAV_PANEL_NEXT");
	expect(app.ui.getContainer("left", "merchant").activePanelId).toBe("buyback");
	events.emit("NAV_PANEL_NEXT");
	expect(app.ui.getContainer("left", "merchant").activePanelId).toBe("vendor");
	app.ui.openPanel("paper-doll", "left");
	expect(app.ui.getContainer("left", "merchant").activePanelId).toBeUndefined();
	expect(app.ui.getContainer("left").activePanelId).toBe("paper-doll");
	events.emit("MERCHANT_SHOW");
	events.emit("MERCHANT_CLOSED");
	expect(app.ui.getContainer("left", "merchant").activePanelId).toBeUndefined();
	events.emit("NAV_CONTAINER_LEFT");
	expect(app.navigation.focusedId).not.toContain("vendor");
	app.stop();
	expect(controller.shutdown).toHaveBeenCalledOnce();
	events.emit("BAG_UPDATE_DELAYED");
	expect(inventory.getItems).toHaveBeenCalledTimes(3);
	for (const frame of builtIns)
		expect(frame.SetParent).toHaveBeenLastCalledWith(nativeParent);
});
