import type { IEventBus } from "../events/types";
import type { Frame } from "../ui/components/frame";
import type {
	CursorSurface,
	NativeCursor,
} from "../ui/components/native-cursor";
import type { LayoutFrame, NativeLayout } from "../ui/components/native-layout";
import type {
	NativeNavigation,
	NativeNavigationFrame,
	NativeNavigationScroll,
} from "../ui/components/native-navigation";
import type { INavigable, NavDirection } from "../ui/navigation/types";

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
	disable(): void;
	restore(): void;
	isOpen(): boolean;
	close(): void;
	mount(parent: Frame, questPane: Frame): void;
	resize(): void;
	unmount(): void;
	read(): MapQuest[];
	navigation(): MapQuestNavigation[];
	moveCursor(direction: NavDirection): void;
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
interface NativeQuestScroll extends LayoutFrame, NativeNavigationScroll {
	titleFramePool: NativeQuestPool;
	headerFramePool: NativeQuestPool;
	campaignHeaderFramePool: NativeQuestPool;
	campaignHeaderMinimalFramePool: NativeQuestPool;
	covenantCallingsHeaderFramePool: NativeQuestPool;
}
interface MapPin extends CursorSurface {
	IsShown(): boolean;
	questID?: number;
	OnClick?(button: string): void;
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
}
export interface NativeWorldMap extends LayoutFrame {
	HandleUserActionToggleSelf(): void;
	TitleCanvasSpacerFrame: LayoutFrame;
	ScrollContainer: MapScroll;
	EnumeratePinsByTemplate(template: string): LuaIterable<MapPin>;
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
	private enabled = false;
	private originalToggleSelf?: NativeWorldMap["HandleUserActionToggleSelf"];
	private toggleSelf?: NativeWorldMap["HandleUserActionToggleSelf"];
	private hooked = false;
	private parent?: Frame;
	private questPane?: Frame;
	private details = false;
	private cursorActive = false;
	constructor(
		private readonly events: IEventBus,
		private readonly layout: Pick<NativeLayout, "bind" | "release" | "scroll">,
		private readonly controls: Pick<NativeNavigation, "navigation" | "release">,
		private readonly cursor: Pick<
			NativeCursor,
			"show" | "hide" | "move" | "position" | "contains" | "release"
		>,
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
		hooksecurefunc(WorldMapFrame, "OnMapChanged", () => this.resize());
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
		this.resize();
		this.applyQuestLayout();
		QuestLogQuests_Update();
	}
	resize(): void {
		const parent = this.parent;
		if (!parent || !this.enabled) return;
		const map = WorldMapFrame;
		const available = parent.getSize();
		const layer = (
			C_Map.GetMapArtLayers as unknown as (
				this: void,
				id: number,
			) => { layerWidth: number; layerHeight: number }[] | undefined
		)(map.GetMapID())?.at(0);
		const aspect =
			layer && layer.layerWidth > 0 && layer.layerHeight > 0
				? layer.layerWidth / layer.layerHeight
				: 1.5;
		const width = Math.min(
			Math.max(1, available.width - 420),
			Math.max(1, available.height - 48) * aspect,
		);
		const height = width / aspect;
		this.layout.bind(map, {
			parent,
			// Quest children extend beyond the fitted map root's render-buffer bounds.
			frameBuffer: false,
			// Limit the native background as well as the scroll viewport to the fitted map.
			insets: [
				0,
				0,
				Math.max(0, available.width - width),
				Math.max(0, available.height - height - 48),
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
				["BOTTOMRIGHT", "TOPRIGHT", 0, -48],
			],
		});
		this.layout.bind(map.ScrollContainer, {
			parent: map,
			anchors: [["TOPLEFT", "TOPLEFT", 0, -48]],
			size: [width, height],
			clip: true,
		});
		this.layout.bind(map.NavBar, {
			parent: map.TitleCanvasSpacerFrame,
			insets: [8, 8, 8, 8],
		});
		for (const frame of [
			map.BorderFrame,
			map.BlackoutFrame,
			map.SidePanelToggle,
		])
			if (frame) this.layout.bind(frame, { visible: false });
		map.OnFrameSizeChanged();
		if (this.cursorActive) this.cursor.show(map.ScrollContainer);
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
			insets: [8, 8, 8, 48],
			// L/M toggles inspect this root's logical shown state.
			visible: true,
			alpha: 1,
			mouse: true,
			strata: "DIALOG",
		});
		this.layout.bind(quests.ContentsAnchor, { parent: quests });
		this.layout.bind(quests.QuestsFrame, {
			parent: quests.ContentsAnchor,
			insets: [0, 0, 22, 0],
			visible: true,
		});
		this.layout.bind(quests.DetailsFrame, {
			parent: quests.QuestsFrame,
			visible: this.details,
		});
		this.layout.bind(quests.QuestsFrame.ScrollFrame, {
			parent: quests.QuestsFrame,
			insets: [0, 29, 0, 0],
			visible: !this.details,
			clip: true,
		});
		for (const frame of [
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
		this.cursorActive = false;
		this.cursor.release();
		this.parent = undefined;
		this.questPane = undefined;
		this.details = false;
		this.layout.release();
		this.controls.release();
	}
	setCursorActive(active: boolean): void {
		this.cursorActive = active && this.enabled && this.parent !== undefined;
		if (this.cursorActive) this.cursor.show(WorldMapFrame.ScrollContainer);
		else this.cursor.hide();
	}
	moveCursor(direction: NavDirection): void {
		if (this.cursorActive) this.cursor.move(direction);
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
		for (const template of [
			"QuestPinTemplate",
			"WorldQuestPinTemplate",
			"BonusObjectivePinTemplate",
		]) {
			for (const pin of map.EnumeratePinsByTemplate(template)) {
				if (
					pin.IsShown() &&
					pin.questID &&
					pin.OnClick &&
					this.cursor.contains(scroll, pin)
				) {
					pin.OnClick("LeftButton");
					return;
				}
			}
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
		return rows.map((row) => ({
			questID: row.questID,
			node: this.controls.navigation(
				row,
				scroll,
				row.questID
					? `map-quest-${row.questID}`
					: `map-header-${row.questLogIndex}`,
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
		}));
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
