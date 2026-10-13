import type { IEventBus } from "../events/types";
import type { Frame } from "../ui/components/frame";
import type {
	CursorSurface,
	CursorTarget,
	NativeCursor,
} from "../ui/components/native-cursor";
import type { LayoutFrame, NativeLayout } from "../ui/components/native-layout";
import type {
	NativeNavigation,
	NativeNavigationFrame,
	NativeNavigationScroll,
} from "../ui/components/native-navigation";
import type {
	IndicatorScroll,
	NativeScrollIndicator,
} from "../ui/components/scroll-indicator";
import type { INavigable, NavDirection } from "../ui/navigation/types";

// QuestScrollFrame.Contents is 304px wide; the minimal indicator overlays it.
export const MAP_QUEST_PANE_WIDTH = 304 + 16;
const CONTENT_TOP = 20;
const BREADCRUMB_HEIGHT = 32;

export interface MapQuestNavigation {
	readonly questID?: number;
	readonly node: INavigable;
}

export interface MapQuest {
	readonly id: number;
	readonly title: string;
	readonly campaign: boolean;
	readonly zone: string;
	readonly objectives: string[];
	readonly tracked: boolean;
	readonly superTracked: boolean;
	readonly canAbandon: boolean;
	readonly canShare: boolean;
}
export interface IMapClient {
	presentation(available: { width: number; height: number }): {
		title: string;
		height: number;
	};
	disable(): void;
	restore(): void;
	isOpen(): boolean;
	close(): void;
	mount(parent: Frame, questPane: Frame): void;
	resize(): void;
	unmount(): void;
	read(): MapQuest[];
	navigation(): MapQuestNavigation[];
	moveCursor(direction: NavDirection, pressed: boolean): void;
	setCursorActive(active: boolean): void;
	clickMap(button: "LeftButton" | "RightButton"): void;
	focus(id: number): void;
	showDetails(id: number): void;
	hideDetails(): void;
	scrollDetails(direction: -1 | 1): void;
	track(id: number): void;
	superTrack(id: number): void;
	abandon(id: number): void;
	share(id: number): void;
}
interface QuestLogInfo {
	questID: number;
	title: string;
	isHeader: boolean;
	isHidden: boolean;
	isTask: boolean;
	isCollapsed: boolean;
	headerSortKey?: number;
}
interface NativeQuestRow extends NativeNavigationFrame {
	IsShown(): boolean;
	layoutIndex: number;
	questID?: number;
	questLogIndex?: number;
}
interface NativeQuestPool {
	EnumerateActive(): LuaIterable<NativeQuestRow>;
}
interface NativeQuestScroll
	extends LayoutFrame,
		NativeNavigationScroll,
		IndicatorScroll {
	ScrollBar: LayoutFrame;
	SearchBox: LayoutFrame & { Clear(): void };
	SettingsDropdown: LayoutFrame;
	titleFramePool: NativeQuestPool;
	headerFramePool: NativeQuestPool;
	campaignHeaderFramePool: NativeQuestPool;
	campaignHeaderMinimalFramePool: NativeQuestPool;
	covenantCallingsHeaderFramePool: NativeQuestPool;
}
interface MapPin extends CursorTarget {
	readonly pinTemplate?: string;
	IsShown(): boolean;
	IsMouseMotionEnabled(): boolean;
	IsMouseClickEnabled(): boolean;
	GetAlpha(): number;
	questID?: number;
	OnClick?(button: string): void;
	OnMouseDown?(button: string): void;
	OnMouseUp?(button: string, upInside: boolean): void;
	GetMouseOverUnits?(): LuaMultiReturn<string[]>;
	GetMemberCountAndUnitTokenPrefix?(): LuaMultiReturn<[number, string]>;
	IsMouseOverUnitExcluded?(unit: string): boolean;
	dataProvider?: { GetUnitPinSizesTable?(): Readonly<Record<string, number>> };
	UpdateMouseOverTooltip?(
		x: number,
		y: number,
	): LuaMultiReturn<[number | undefined, number]>;
}
interface MapScroll extends LayoutFrame, CursorSurface {
	NormalizeUIPosition(x: number, y: number): LuaMultiReturn<[number, number]>;
	ShouldNavigateOnClick(): boolean;
	ShouldNavigateIgnoreZoneMapPositionData(): boolean;
	ShouldZoomInOnClick(): boolean;
	ZoomOut(): void;
	GetCanvasScale(): number;
	DenormalizeHorizontalSize(size: number): number;
	DenormalizeVerticalSize(size: number): number;
}
interface MapProvider {
	Label?: LayoutFrame;
	GetOffsetY?(): number;
}
export interface NativeWorldMap extends LayoutFrame {
	readonly dataProviders: unknown;
	HandleUserActionToggleSelf(): void;
	TitleCanvasSpacerFrame: LayoutFrame;
	ScrollContainer: MapScroll;
	EnumeratePinsByTemplate(template: string): LuaIterable<MapPin>;
	ExecuteOnAllPins(callback: (this: void, pin: MapPin) => void): void;
	GetNormalizedCursorPosition(): LuaMultiReturn<[number, number]>;
	IsCanvasMouseFocus(): boolean;
	IsCanvasMouseFocusOrPinFocus(): boolean;
	NavigateToParentMap(): void;
	NavBar: LayoutFrame;
	BorderFrame: LayoutFrame;
	BlackoutFrame: LayoutFrame;
	SidePanelToggle?: LayoutFrame;
	HookScript(script: string, callback: (this: void) => void): void;
	OnFrameSizeChanged(): void;
	GetMapID(): number;
	SetMapID(id: number): void;
	SetFocusedQuestID(id: number): void;
}
export interface NativeQuestMap extends LayoutFrame {
	ContentsAnchor: LayoutFrame;
	QuestsFrame: LayoutFrame & { ScrollFrame: NativeQuestScroll };
	DetailsFrame: LayoutFrame & {
		questID?: number;
		ScrollFrame: {
			ScrollBar: { ScrollStepInDirection(direction: number): void };
		};
	};
	QuestsTab: LayoutFrame;
	EventsTab: LayoutFrame;
	MapLegendTab: LayoutFrame;
	EventsFrame: LayoutFrame;
	MapLegend: LayoutFrame;
	QuestSessionManagement: LayoutFrame;
}
declare global {
	const MAP_AND_QUEST_LOG: string;
	const UiMapPoint: {
		CreateFromCoordinates(
			this: void,
			mapID: number,
			x: number,
			y: number,
		): {
			uiMapID: number;
			position: { GetXY(): LuaMultiReturn<[number, number]> };
		};
	};
	function secureexecuterange(
		this: void,
		providers: unknown,
		callback: (this: void, provider: MapProvider) => void,
	): void;
	function ShowUIPanel(this: void, frame: NativeWorldMap): void;
	function ExpandQuestHeader(this: void, index: number): void;
	function CollapseQuestHeader(this: void, index: number): void;
	function QuestLogQuests_Update(this: void): void;
	function IsInGroup(this: void): boolean;
	const EventRegistry: {
		TriggerEvent(this: unknown, name: string, id: number): void;
	};
	function hooksecurefunc(
		this: void,
		name: "QuestMapFrame_ShowQuestDetails",
		callback: (this: void, id: number) => void,
	): void;
	const WorldMapFrame: NativeWorldMap;
	const QuestMapFrame: NativeQuestMap;
	function QuestMapFrame_ShowQuestDetails(this: void, id: number): void;
	function QuestMapFrame_ReturnFromQuestDetails(this: void): void;
	function QuestMapFrame_CloseQuestDetails(this: void): void;
	function QuestMapQuestOptions_TrackQuest(this: void, id: number): void;
	function QuestMapQuestOptions_ShareQuest(this: void, id: number): void;
	function GetQuestUiMapID(this: void, id: number): number;
	function QuestUtils_IsQuestWatched(this: void, id: number): boolean;
}
export class MapClient implements IMapClient {
	presentation(available: { width: number; height: number }): {
		title: string;
		height: number;
	} {
		return {
			title: MAP_AND_QUEST_LOG,
			height:
				this.mapDimensions(available).height + CONTENT_TOP + BREADCRUMB_HEIGHT,
		};
	}
	private enabled = false;
	private originalToggleSelf?: NativeWorldMap["HandleUserActionToggleSelf"];
	private toggleSelf?: NativeWorldMap["HandleUserActionToggleSelf"];
	private hooked = false;
	private parent?: Frame;
	private questPane?: Frame;
	private details = false;
	private cursorActive = false;
	private hoveredPin?: MapPin;
	private readonly unitQueries = new Map<
		MapPin,
		NonNullable<MapPin["GetMouseOverUnits"]>
	>();
	private readonly unitHits = new Map<MapPin, string[]>();
	private mouseQueries?: {
		position: NativeWorldMap["GetNormalizedCursorPosition"];
		focus: NativeWorldMap["IsCanvasMouseFocus"];
		pinFocus: NativeWorldMap["IsCanvasMouseFocusOrPinFocus"];
	};
	constructor(
		private readonly events: IEventBus,
		private readonly layout: Pick<NativeLayout, "bind" | "release" | "scroll">,
		private readonly controls: Pick<NativeNavigation, "navigation" | "release">,
		private readonly cursor: Pick<
			NativeCursor,
			| "show"
			| "hide"
			| "move"
			| "position"
			| "contains"
			| "release"
			| "trackMouseOver"
			| "hover"
		>,
		private readonly indicator: Pick<NativeScrollIndicator, "bind" | "release">,
	) {}
	private readonly visibility = () => {
		if (this.enabled) this.events.emit("MAP_VISIBILITY_CHANGED");
	};
	disable(): void {
		if (this.enabled) return;
		this.enabled = true;
		this.originalToggleSelf = WorldMapFrame.HandleUserActionToggleSelf;
		const client = this;
		// The combined pane has one open state; native M otherwise toggles flyout/maximize states.
		this.toggleSelf = function (this: NativeWorldMap): void {
			if (this.IsShown()) HideUIPanel(this);
			else {
				ShowUIPanel(this);
				// Native panel positioning raises the map after our OnShow mount finishes.
				client.applyQuestLayout();
			}
		};
		WorldMapFrame.HandleUserActionToggleSelf = this.toggleSelf;
		if (this.hooked) return;
		this.hooked = true;
		WorldMapFrame.HookScript("OnShow", this.visibility);
		WorldMapFrame.HookScript("OnHide", this.visibility);
		hooksecurefunc(WorldMapFrame, "OnMapChanged", () => {
			this.resize();
			if (this.enabled && this.parent) this.events.emit("QUEST_LOG_UPDATE");
		});
		hooksecurefunc("QuestLogQuests_Update", () => {
			if (this.enabled && this.parent) this.events.emit("QUEST_LOG_UPDATE");
		});
		// ShowUIPanel continues positioning after OnShow; generic frame leases enforce those writes.
		hooksecurefunc("QuestMapFrame_ShowQuestDetails", (id: number) => {
			if (!this.enabled || !this.parent) return;
			this.details = true;
			this.applyQuestLayout();
			this.events.emit("MAP_DETAILS_CHANGED", { id });
		});
		hooksecurefunc("QuestMapFrame_CloseQuestDetails", () => {
			if (!this.enabled || !this.parent || !this.details) return;
			this.details = false;
			this.applyQuestLayout();
			this.events.emit("MAP_DETAILS_CHANGED", {});
		});
	}
	restore(): void {
		this.enabled = false;
		this.unmount();
		if (
			this.originalToggleSelf &&
			WorldMapFrame.HandleUserActionToggleSelf === this.toggleSelf
		)
			WorldMapFrame.HandleUserActionToggleSelf = this.originalToggleSelf;
		this.originalToggleSelf = undefined;
		this.toggleSelf = undefined;
	}
	isOpen(): boolean {
		return this.enabled && WorldMapFrame.IsShown();
	}
	close(): void {
		HideUIPanel(WorldMapFrame);
	}
	mount(parent: Frame, questPane: Frame): void {
		this.parent = parent;
		this.questPane = questPane;
		// The controller list omits the native search row; do not retain its filter.
		QuestMapFrame.QuestsFrame.ScrollFrame.SearchBox.Clear();
		this.resize();
		this.applyQuestLayout();
		QuestLogQuests_Update();
	}
	private mapDimensions(available: { width: number; height: number }): {
		width: number;
		height: number;
	} {
		const layer = (
			C_Map.GetMapArtLayers as unknown as (
				this: void,
				id: number,
			) => { layerWidth: number; layerHeight: number }[] | undefined
		)(WorldMapFrame.GetMapID())?.at(0);
		const aspect =
			layer && layer.layerWidth > 0 && layer.layerHeight > 0
				? layer.layerWidth / layer.layerHeight
				: 1.5;
		const width = Math.min(
			Math.max(1, available.width - MAP_QUEST_PANE_WIDTH),
			Math.max(1, available.height - CONTENT_TOP - BREADCRUMB_HEIGHT) * aspect,
		);
		return { width, height: width / aspect };
	}
	resize(): void {
		const parent = this.parent;
		if (!parent || !this.enabled) return;
		const map = WorldMapFrame;
		const available = parent.getSize();
		const { width, height } = this.mapDimensions(available);
		this.layout.bind(map, {
			parent,
			// Quest children extend beyond the fitted map root's render-buffer bounds.
			frameBuffer: false,
			// Limit the native background as well as the scroll viewport to the fitted map.
			insets: [
				0,
				CONTENT_TOP,
				Math.max(0, available.width - width),
				Math.max(
					0,
					available.height - height - CONTENT_TOP - BREADCRUMB_HEIGHT,
				),
			],
			reparent: true,
			scale: 1,
			strata: "DIALOG",
			alpha: 1,
		});
		this.layout.bind(map.TitleCanvasSpacerFrame, {
			parent: map,
			anchors: [
				["TOPLEFT", "TOPLEFT", 0, 0],
				["BOTTOMRIGHT", "TOPRIGHT", 0, -BREADCRUMB_HEIGHT],
			],
		});
		this.layout.bind(map.ScrollContainer, {
			parent: map,
			anchors: [["TOPLEFT", "TOPLEFT", 0, -BREADCRUMB_HEIGHT]],
			size: [width, height],
			clip: true,
		});
		this.layout.bind(map.NavBar, {
			parent: map.TitleCanvasSpacerFrame,
			insets: [8, 4, 8, 4],
		});
		for (const frame of [
			map.BorderFrame,
			map.BlackoutFrame,
			map.SidePanelToggle,
		])
			if (frame) this.layout.bind(frame, { visible: false });
		map.OnFrameSizeChanged();
		secureexecuterange(map.dataProviders, (provider) => {
			if (provider.Label && provider.GetOffsetY)
				this.layout.bind(provider.Label, {
					parent: map.ScrollContainer,
					strata: "DIALOG",
					levelOffset: 101,
					anchors: [["TOP", "TOP", 0, provider.GetOffsetY()]],
				});
		});
		if (this.cursorActive) {
			this.cursor.show(map.ScrollContainer, this.updateHover);
			this.updateHover();
		}
	}
	private applyQuestLayout(): void {
		if (!this.questPane) return;
		const quests = QuestMapFrame;
		// Keep QuestMapFrame parented to the map: its scripts call the owner's map methods.
		this.layout.bind(quests, {
			parent: this.questPane,
			raised: true,
			// Anchoring alone retains the map's old level beneath our opaque pane.
			levelOffset: 1,
			insets: [8, CONTENT_TOP, 8, 48],
			// L/M toggles inspect this root's logical shown state.
			visible: true,
			alpha: 1,
			mouse: true,
			strata: "DIALOG",
		});
		this.layout.bind(quests.ContentsAnchor, { parent: quests });
		this.layout.bind(quests.QuestsFrame, {
			parent: quests.ContentsAnchor,
			insets: [0, 0, 0, 0],
			visible: true,
		});
		this.layout.bind(quests.DetailsFrame, {
			parent: quests.QuestsFrame,
			insets: [0, 0, 0, 0],
			visible: this.details,
		});
		this.layout.bind(quests.QuestsFrame.ScrollFrame, {
			parent: quests.QuestsFrame,
			insets: [0, 0, 0, 0],
			visible: !this.details,
			clip: true,
		});
		this.layout.bind(quests.QuestsFrame.ScrollFrame.ScrollBar, {
			visible: false,
		});
		this.indicator.bind(quests.QuestsFrame.ScrollFrame);
		for (const frame of [
			quests.QuestsFrame.ScrollFrame.SearchBox,
			quests.QuestsFrame.ScrollFrame.SettingsDropdown,
			quests.QuestsTab,
			quests.EventsTab,
			quests.MapLegendTab,
			quests.EventsFrame,
			quests.MapLegend,
			quests.QuestSessionManagement,
		])
			this.layout.bind(frame, { visible: false });
	}
	unmount(): void {
		this.setCursorActive(false);
		this.cursor.release();
		this.parent = undefined;
		this.questPane = undefined;
		this.details = false;
		this.indicator.release();
		this.layout.release();
		this.controls.release();
	}
	setCursorActive(active: boolean): void {
		this.cursorActive = active && this.enabled && this.parent !== undefined;
		const map = WorldMapFrame;
		if (this.cursorActive) {
			if (!this.mouseQueries) {
				this.mouseQueries = {
					position: map.GetNormalizedCursorPosition,
					focus: map.IsCanvasMouseFocus,
					pinFocus: map.IsCanvasMouseFocusOrPinFocus,
				};
				// Native hover providers ask the map for coordinates and focus each frame.
				map.GetNormalizedCursorPosition = () =>
					map.ScrollContainer.NormalizeUIPosition(
						...this.cursor.position(map.ScrollContainer),
					);
				map.IsCanvasMouseFocus = () => this.hoveredPin === undefined;
				map.IsCanvasMouseFocusOrPinFocus = () => true;
			}
			this.cursor.show(map.ScrollContainer, this.updateHover);
			this.updateHover();
		} else {
			this.cursor.hide();
			for (const [pin, query] of this.unitQueries)
				pin.GetMouseOverUnits = query;
			this.unitQueries.clear();
			this.unitHits.clear();
			this.hoveredPin = undefined;
			if (this.mouseQueries) {
				map.GetNormalizedCursorPosition = this.mouseQueries.position;
				map.IsCanvasMouseFocus = this.mouseQueries.focus;
				map.IsCanvasMouseFocusOrPinFocus = this.mouseQueries.pinFocus;
				this.mouseQueries = undefined;
			}
		}
	}
	private readonly updateHover = () => {
		if (!this.cursorActive) return;
		this.unitHits.clear();
		this.hoveredPin = this.findPin(false);
		this.cursor.hover(this.hoveredPin);
	};
	private findPin(click: boolean): MapPin | undefined {
		const map = WorldMapFrame;
		let target: MapPin | undefined;
		map.ExecuteOnAllPins((pin) => {
			this.cursor.trackMouseOver(map.ScrollContainer, pin);
			if (
				pin.GetMouseOverUnits &&
				pin.GetMemberCountAndUnitTokenPrefix &&
				pin.dataProvider?.GetUnitPinSizesTable &&
				!this.unitQueries.has(pin)
			) {
				this.unitQueries.set(pin, pin.GetMouseOverUnits);
				pin.GetMouseOverUnits = () => this.unitsUnderCursor(pin);
			}
			if (
				pin.IsShown() &&
				(click ? pin.IsMouseClickEnabled() : pin.IsMouseMotionEnabled()) &&
				pin.GetAlpha() > 0 &&
				this.cursor.contains(map.ScrollContainer, pin) &&
				(!target || pin.GetFrameLevel() > target.GetFrameLevel())
			)
				target = pin;
		});
		return target;
	}
	private unitsUnderCursor(pin: MapPin): LuaMultiReturn<string[]> {
		const cached = this.unitHits.get(pin);
		if (cached) return unpack(cached);
		const units: string[] = [];
		this.unitHits.set(pin, units);
		if (
			!pin.IsShown() ||
			!pin.GetMemberCountAndUnitTokenPrefix ||
			!pin.dataProvider?.GetUnitPinSizesTable
		)
			return unpack(units);
		const map = WorldMapFrame,
			scroll = map.ScrollContainer;
		const [x, y] = map.GetNormalizedCursorPosition();
		const [count, prefix] = pin.GetMemberCountAndUnitTokenPrefix();
		const sizes = pin.dataProvider.GetUnitPinSizesTable();
		const exists = UnitExists as unknown as (
			this: void,
			unit: string,
		) => boolean;
		const inSubgroup = UnitInSubgroup as unknown as (
			this: void,
			unit: string,
		) => boolean;
		for (let index = 1; index <= count; index++) {
			const unit = `${prefix}${index}`;
			if (!exists(unit) || pin.IsMouseOverUnitExcluded?.(unit)) continue;
			const size = sizes[inSubgroup(unit) ? "party" : "raid"] ?? 0;
			if (size <= 0) continue;
			const position = (
				C_Map.GetPlayerMapPosition as unknown as (
					this: void,
					id: number,
					unit: string,
				) => { GetXY(): LuaMultiReturn<[number, number]> } | undefined
			)(map.GetMapID(), unit);
			if (!position) continue;
			const [unitX, unitY] = position.GetXY();
			const radius = size / 2 / Math.max(0.001, scroll.GetCanvasScale());
			if (
				Math.abs(x - unitX) * scroll.DenormalizeHorizontalSize(1) <= radius &&
				Math.abs(y - unitY) * scroll.DenormalizeVerticalSize(1) <= radius
			)
				units.push(unit);
		}
		return unpack(units);
	}
	moveCursor(direction: NavDirection, pressed: boolean): void {
		if (this.cursorActive) this.cursor.move(direction, pressed);
	}
	clickMap(button: "LeftButton" | "RightButton"): void {
		if (!this.cursorActive) return;
		const map = WorldMapFrame,
			scroll = map.ScrollContainer;
		if (button === "RightButton") {
			if (
				scroll.ShouldNavigateOnClick() &&
				!scroll.ShouldNavigateIgnoreZoneMapPositionData()
			)
				map.NavigateToParentMap();
			if (scroll.ShouldZoomInOnClick()) scroll.ZoomOut();
			return;
		}
		this.updateHover();
		const pin = this.findPin(true);
		if (pin) {
			pin.OnMouseDown?.("LeftButton");
			pin.OnMouseUp?.("LeftButton", true);
			pin.OnClick?.("LeftButton");
			return;
		}
		const [x, y] = scroll.NormalizeUIPosition(...this.cursor.position(scroll));
		for (const blob of map.EnumeratePinsByTemplate("QuestBlobPinTemplate")) {
			if (!blob.IsShown() || !blob.UpdateMouseOverTooltip) continue;
			const [id] = blob.UpdateMouseOverTooltip(x, y);
			if (id && id > 0) {
				map.SetFocusedQuestID(id);
				return;
			}
		}
		// Tooltip-only markers still occupy this location; do not drop a pin on them.
		if (this.hoveredPin) return;
		if (C_Map.CanSetUserWaypointOnMap(map.GetMapID())) {
			// The generated API declarations flatten UiMapPoint into a number.
			(
				C_Map.SetUserWaypoint as unknown as (
					this: void,
					point: ReturnType<typeof UiMapPoint.CreateFromCoordinates>,
				) => boolean
			)(UiMapPoint.CreateFromCoordinates(map.GetMapID(), x, y));
			return;
		}
		if (!scroll.ShouldNavigateOnClick()) return;
		const zone = (
			C_Map.GetMapInfoAtPosition as unknown as (
				this: void,
				id: number,
				x: number,
				y: number,
				ignore: boolean,
			) => { mapID: number } | undefined
		)(map.GetMapID(), x, y, scroll.ShouldNavigateIgnoreZoneMapPositionData());
		if (zone) map.SetMapID(zone.mapID);
	}
	navigation(): MapQuestNavigation[] {
		if (!this.parent || this.details) return [];
		const scroll = QuestMapFrame.QuestsFrame.ScrollFrame;
		const rows: NativeQuestRow[] = [];
		for (const pool of [
			scroll.titleFramePool,
			scroll.headerFramePool,
			scroll.campaignHeaderFramePool,
			scroll.campaignHeaderMinimalFramePool,
			scroll.covenantCallingsHeaderFramePool,
		]) {
			for (const row of pool.EnumerateActive())
				if (row.IsShown()) rows.push(row);
		}
		rows.sort((a, b) => a.layoutIndex - b.layoutIndex);
		const headerOccurrences = new Map<string, number>();
		return rows.map((row) => {
			const info =
				!row.questID && row.questLogIndex
					? (
							C_QuestLog.GetInfo as unknown as (
								this: void,
								index: number,
							) => QuestLogInfo | undefined
						)(row.questLogIndex)
					: undefined;
			const header = `${info?.headerSortKey ?? info?.title ?? row.questLogIndex}`;
			const occurrence = (headerOccurrences.get(header) ?? 0) + 1;
			if (!row.questID) headerOccurrences.set(header, occurrence);
			return {
				questID: row.questID,
				node: this.controls.navigation(
					row,
					scroll,
					row.questID
						? `map-quest-${row.questID}`
						: `map-header-${header}${occurrence > 1 ? `-${occurrence}` : ""}`,
					() => {
						if (row.questID) this.showDetails(row.questID);
						else if (row.questLogIndex) {
							const info = (
								C_QuestLog.GetInfo as unknown as (
									this: void,
									index: number,
								) => QuestLogInfo | undefined
							)(row.questLogIndex);
							if (info?.isCollapsed) ExpandQuestHeader(row.questLogIndex);
							else CollapseQuestHeader(row.questLogIndex);
						}
					},
				),
			};
		});
	}
	read(): MapQuest[] {
		const [count] = C_QuestLog.GetNumQuestLogEntries();
		const quests: MapQuest[] = [];
		let zone = "";
		for (let index = 1; index <= count; index++) {
			// Generated declarations flatten table returns; correct them at the API seam.
			const info = (
				C_QuestLog.GetInfo as unknown as (
					this: void,
					index: number,
				) => QuestLogInfo | undefined
			)(index);
			if (!info) continue;
			if (info.isHeader) {
				zone = info.title;
				continue;
			}
			if (!info.questID || info.isHidden) continue;
			const objectives =
				(
					C_QuestLog.GetQuestObjectives as unknown as (
						this: void,
						id: number,
					) => { text?: string }[] | undefined
				)(info.questID) ?? [];
			quests.push({
				id: info.questID,
				title: info.title,
				zone,
				campaign: C_CampaignInfo.IsCampaignQuest(info.questID),
				objectives: objectives.map((objective) => objective.text ?? ""),
				tracked: QuestUtils_IsQuestWatched(info.questID),
				superTracked: C_SuperTrack.GetSuperTrackedQuestID() === info.questID,
				canAbandon: C_QuestLog.CanAbandonQuest(info.questID),
				canShare: C_QuestLog.IsPushableQuest(info.questID) && IsInGroup(),
			});
		}
		return quests;
	}
	private exists(id: number): boolean {
		const index = C_QuestLog.GetLogIndexForQuestID(id);
		return typeof index === "number" && index > 0;
	}
	focus(id: number): void {
		if (!this.exists(id)) return;
		const mapID = GetQuestUiMapID(id);
		if (mapID > 0) WorldMapFrame.SetMapID(mapID);
		WorldMapFrame.SetFocusedQuestID(id);
		EventRegistry.TriggerEvent("MapCanvas.PingQuestID", id);
	}
	showDetails(id: number): void {
		if (!this.exists(id)) return;
		this.details = true;
		this.applyQuestLayout();
		QuestMapFrame_ShowQuestDetails(id);
	}
	hideDetails(): void {
		QuestMapFrame_ReturnFromQuestDetails();
		this.details = false;
		this.applyQuestLayout();
	}
	scrollDetails(direction: -1 | 1): void {
		this.layout.scroll(
			QuestMapFrame.DetailsFrame.ScrollFrame.ScrollBar,
			direction,
		);
	}
	track(id: number): void {
		if (this.exists(id)) QuestMapQuestOptions_TrackQuest(id);
	}
	superTrack(id: number): void {
		if (this.exists(id))
			C_SuperTrack.SetSuperTrackedQuestID(
				C_SuperTrack.GetSuperTrackedQuestID() === id ? 0 : id,
			);
	}
	abandon(id: number): void {
		if (!this.exists(id) || !C_QuestLog.CanAbandonQuest(id)) return;
		// Called only after the module's controller-accessible confirmation.
		const selected = C_QuestLog.GetSelectedQuest();
		C_QuestLog.SetSelectedQuest(id);
		C_QuestLog.SetAbandonQuest();
		C_QuestLog.AbandonQuest();
		C_QuestLog.SetSelectedQuest(selected);
	}
	share(id: number): void {
		if (this.exists(id) && C_QuestLog.IsPushableQuest(id) && IsInGroup())
			QuestMapQuestOptions_ShareQuest(id);
	}
}
