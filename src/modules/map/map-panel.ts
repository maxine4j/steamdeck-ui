import {
	type IMapClient,
	MAP_QUEST_PANE_WIDTH,
	type MapDetailsNavigation,
	type MapQuest,
	type MapQuestNavigation,
} from "../../clients/map-client";
import { controllerIcon } from "../../ui/components/controller-icon";
import { Frame } from "../../ui/components/frame";
import type { IModal, ModalOption } from "../../ui/components/modal";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type {
	INavigable,
	NavGrid,
	NavigationChanged,
} from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

export class MapPanel implements IPanel {
	readonly id = "map";
	readonly title = "Map & Quests";
	private readonly frame: Frame;
	private readonly mapSide: Frame;
	private readonly pane: Frame;
	private focus?: string;
	private focusFallbacks: string[] = [];
	private restoringQuestFocus = false;
	private section: "map" | "quests" = "quests";
	private rows: MapQuestNavigation[] = [];
	private quests: MapQuest[] = [];
	private details?: number;
	private detailsFocus?: string;
	private detailsRows: MapDetailsNavigation[][] = [];
	private mounted = false;
	private active = false;
	private parent?: Frame;
	private fitted?: { width: number; height: number };
	private navigationChanged?: NavigationChanged;
	private readonly cursorNode: INavigable = {
		navId: "map-cursor",
		onFocus: () => this.client.setCursorActive(true),
		onBlur: () => this.client.setCursorActive(false),
		onMove: (direction, pressed) => this.client.moveCursor(direction, pressed),
		onInteract: () => {},
		onAlternate: () => this.client.clickMap("LeftButton"),
		onContext: () => this.client.clickMap("RightButton"),
	};
	constructor(
		pool: IFramePoolManager,
		private readonly client: IMapClient,
		private readonly modal: IModal,
		private readonly close: () => void,
	) {
		this.frame = new Frame("map-frame", pool);
		this.mapSide = new Frame("map-side", pool);
		this.pane = new Frame("map-quests", pool);
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Map requires a frame parent");
		this.parent = parent;
		this.frame.setParent(parent);
		this.frame.setWindowBackground();
		this.frame.show();
		this.mapSide.setParent(this.frame);
		this.mapSide.show();
		this.pane.setParent(this.frame);
		this.layout();
		parent.onSizeChanged(() => {
			this.layout();
			this.client.resize();
		});
		this.pane.show();
		this.mounted = true;
		this.client.mount(this.frame, this.pane);
		this.refresh();
	}
	private layout(): boolean {
		if (!this.parent) return false;
		const available = this.parent.getSize();
		const presentation = this.client.presentation(available);
		setWindowTitle(this.frame, presentation.title);
		const size = { width: available.width, height: presentation.height };
		if (
			size.width === this.fitted?.width &&
			size.height === this.fitted?.height
		)
			return false;
		this.fitted = size;
		this.frame.layout(size.width, size.height, "CENTER", this.parent);
		this.mapSide.layout(
			Math.max(1, size.width - MAP_QUEST_PANE_WIDTH),
			size.height,
			"TOPLEFT",
			this.frame,
		);
		this.pane.layout(MAP_QUEST_PANE_WIDTH, size.height, "TOPRIGHT", this.frame);
		return true;
	}
	onActiveChanged(active: boolean): void {
		this.active = active;
		this.updateOutline();
	}
	private updateOutline(): void {
		this.mapSide.setFocusBorder(
			this.mounted && this.active && this.section === "map",
		);
		this.pane.setFocusBorder(
			this.mounted && this.active && this.section === "quests",
		);
	}
	onUnmount(): void {
		this.mounted = false;
		this.onActiveChanged(false);
		this.section = "quests";
		this.focus = undefined;
		this.focusFallbacks = [];
		this.client.setCursorActive(false);
		this.modal.close();
		this.client.unmount();
		this.details = undefined;
		this.detailsRows = [];
		this.detailsFocus = undefined;
		this.rows = [];
		this.parent?.onSizeChanged();
		this.parent = undefined;
		this.fitted = undefined;
		this.frame.hide();
	}
	onContainerClosed(): void {
		this.client.close();
	}
	refresh(): void {
		if (!this.mounted) return;
		if (this.layout()) this.client.resize();
		this.quests = this.client.read();
		if (
			this.details !== undefined &&
			!this.quests.some((quest) => quest.id === this.details)
		) {
			this.client.hideDetails();
			this.details = undefined;
		}
		this.render();
	}
	private render(): void {
		this.updateOutline();
		if (this.details !== undefined) {
			this.detailsRows = this.client.detailsNavigation();
			this.pane.setLabel(
				"hint",
				this.section === "map"
					? `Map · ${controllerIcon("D-pad")} Move  ${controllerIcon("X")} Select / Pin  ${controllerIcon("Y")} Zoom out  ${controllerIcon("LT")}/${controllerIcon("RT")} Quests`
					: `Quests · ${controllerIcon("X")} Select  ${controllerIcon("B")} Back  ${controllerIcon("LT")}/${controllerIcon("RT")} Map`,
				"BOTTOMLEFT",
				12,
				14,
				13,
				MAP_QUEST_PANE_WIDTH - 24,
			);
			const nodes = this.detailsRows.flat().map(({ node }) => node);
			const focus = nodes.some((node) => node.navId === this.detailsFocus)
				? this.detailsFocus
				: nodes.at(0)?.navId;
			this.navigationChanged?.(this.section === "map" ? "map-cursor" : focus);
			return;
		}
		this.rows = this.client.navigation();
		this.pane.setLabel(
			"hint",
			this.section === "map"
				? `Map · ${controllerIcon("D-pad")} Move  ${controllerIcon("X")} Select / Pin  ${controllerIcon("Y")} Zoom out  ${controllerIcon("LT")}/${controllerIcon("RT")} Quests`
				: `Quests · ${controllerIcon("X")} Details  ${controllerIcon("Y")} Options  ${controllerIcon("LT")}/${controllerIcon("RT")} Map`,
			"BOTTOMLEFT",
			12,
			14,
			13,
			MAP_QUEST_PANE_WIDTH - 24,
		);
		const focusId =
			[this.focus, ...this.focusFallbacks].find((id) =>
				this.rows.some((row) => row.node.navId === id),
			) ?? this.rows.at(0)?.node.navId;
		// A transient fallback must not replace the user's intended list target.
		this.restoringQuestFocus = true;
		try {
			this.navigationChanged?.(this.section === "map" ? "map-cursor" : focusId);
		} finally {
			this.restoringQuestFocus = false;
		}
	}
	private rememberQuestFocus(id: string): void {
		this.focus = id;
		const index = this.rows.findIndex((row) => row.node.navId === id);
		if (index >= 0)
			this.focusFallbacks = this.rows
				.slice(0, index)
				.reverse()
				.map((row) => row.node.navId);
	}
	onContainerSwitch(direction: "left" | "right"): void {
		this.section = direction === "left" ? "map" : "quests";
		this.render();
	}
	showDetails(id?: number): void {
		if (!this.mounted) return;
		if (id !== undefined) {
			const quest = this.quests.find((quest) => quest.id === id);
			if (!quest) return;
			this.rememberQuestFocus(`map-quest-${id}`);
			this.section = "quests";
		}
		if (this.details !== id) this.detailsFocus = undefined;
		this.details = id;
		this.render();
	}
	onBack(): void {
		if (this.details === undefined) {
			this.close();
			return;
		}
		this.client.hideDetails();
		this.details = undefined;
		this.render();
	}
	getNavGrid(): NavGrid {
		if (this.section === "map") return [[this.cursorNode]];
		if (this.details !== undefined)
			return this.detailsRows.map((row) =>
				row.map(
					({ node, action }) =>
						({
							...node,
							onFocus: (refresh) => {
								this.detailsFocus = node.navId;
								node.onFocus(refresh);
							},
							onInteract:
								action === "back"
									? () => this.onBack()
									: action === "abandon"
										? () => {
												if (this.details !== undefined)
													this.confirmAbandon(this.details);
											}
										: () => node.onInteract(),
						}) satisfies INavigable,
				),
			);
		return this.rows.map(({ node, questID }) => [
			{
				...node,
				onFocus: (refresh) => {
					if (!this.restoringQuestFocus) this.rememberQuestFocus(node.navId);
					node.onFocus(refresh);
				},
				onInteract: () => {
					if (questID !== undefined) {
						this.client.showDetails(questID);
						this.showDetails(questID);
					} else {
						node.onInteract();
						// Header changes rebuild native pools asynchronously. The module's
						// completed native layout refresh restores focus after that rebuild.
					}
				},
				onContext:
					questID !== undefined ? () => this.options(questID) : undefined,
			} satisfies INavigable,
		]);
	}
	private options(id: number): void {
		const quest = this.client.read().find((quest) => quest.id === id);
		if (!quest) return;
		const options: ModalOption[] = [
			{
				id: "details",
				label: "View details",
				select: () => {
					this.client.showDetails(id);
					this.showDetails(id);
				},
			},
			{
				id: "track",
				label: quest.tracked ? "Untrack quest" : "Track quest",
				select: () => {
					this.client.track(id);
				},
			},
			{
				id: "super-track",
				label: quest.superTracked
					? "Stop navigating to quest"
					: "Navigate to quest",
				select: () => {
					this.client.superTrack(id);
				},
			},
			{
				id: "focus",
				label: "Focus on map",
				select: () => this.client.focus(id),
			},
		];
		if (quest.canShare)
			options.push({
				id: "share",
				label: "Share quest",
				select: () => this.client.share(id),
			});
		if (quest.canAbandon)
			options.push({
				id: "abandon",
				label: "Abandon quest…",
				select: () => this.confirmAbandon(id),
			});
		this.modal.open(quest.title, options);
	}
	private confirmAbandon(id: number): void {
		const quest = this.client.read().find((quest) => quest.id === id);
		if (!quest?.canAbandon) return;
		this.modal.open(
			"Abandon quest?",
			[
				{
					id: "confirm",
					label: "Abandon quest",
					select: () => this.client.abandon(id),
				},
				{ id: "cancel", label: "Keep quest", select: () => {} },
			],
			{
				text: `${quest.title}\n\nQuest progress will be lost and associated quest items will be removed.`,
			},
		);
	}
	setNavigationChanged(callback?: NavigationChanged): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.onUnmount();
		for (const frame of [this.pane, this.mapSide, this.frame]) frame.destroy();
	}
}
