import type { IMapClient, MapQuest } from "../../clients/map-client";
import { Frame } from "../../ui/components/frame";
import type { IModal, ModalOption } from "../../ui/components/modal";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable, NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

type QuestTab = "campaign" | "other";
export class MapPanel implements IPanel {
	readonly id = "map";
	readonly title = "Map & Quests";
	private readonly frame: Frame;
	private readonly pane: Frame;
	private readonly listHost: Frame;
	private readonly list: ScrollList;
	private readonly tabs: Frame[];
	private readonly reading: Frame[];
	private tab: QuestTab = "campaign";
	private readonly focus = new Map<QuestTab, string>();
	private quests: MapQuest[] = [];
	private details?: number;
	private mounted = false;
	private navigationChanged?: (focusId?: string) => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IMapClient,
		private readonly modal: IModal,
		private readonly close: () => void,
	) {
		this.frame = new Frame("map-frame", pool);
		this.pane = new Frame("map-quests", pool);
		this.listHost = new Frame("map-list-host", pool);
		this.tabs = [
			new Frame("map-campaign-tab", pool, "Button"),
			new Frame("map-other-tab", pool, "Button"),
		];
		this.reading = [
			new Frame("map-details-down", pool, "Button"),
			new Frame("map-details-up", pool, "Button"),
		];
		this.list = new ScrollList(
			"map-quest-list",
			pool,
			"Campaign quests",
			close,
			{
				width: 396,
				background: false,
				onChanged: () => this.navigationChanged?.(this.focus.get(this.tab)),
			},
		);
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Map requires a frame parent");
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		this.frame.show();
		this.pane.setParent(this.frame);
		this.layout();
		this.frame.onSizeChanged(() => this.layout());
		this.pane.setWindowBackground();
		this.pane.show();
		this.listHost.inset(this.pane, 0, 48, 0, 40);
		this.listHost.show();
		this.tabs.forEach((tab, index) => {
			tab.setParent(this.pane);
			tab.layout(194, 36, "TOPLEFT", this.pane, 12 + index * 202, -8);
			tab.setLabel(
				"label",
				index === 0 ? "LB · Campaign" : "Other quests · RB",
			);
			tab.onClick((mouse) => {
				if (mouse === "LeftButton" && this.details === undefined)
					this.selectTab(index === 0 ? "campaign" : "other");
			});
			tab.show();
		});
		this.reading.forEach((button, index) => {
			button.setParent(this.pane);
			button.layout(194, 32, "BOTTOMLEFT", this.pane, 12 + index * 202, 8);
			button.setButtonBackground();
			button.setLabel(
				"label",
				index === 0 ? "A · Scroll down" : "A · Scroll up",
			);
			button.onClick((mouse) => {
				if (mouse === "LeftButton")
					this.client.scrollDetails(index === 0 ? 1 : -1);
			});
		});
		this.mounted = true;
		this.client.mount(this.frame, this.pane);
		this.refresh();
	}
	private layout(): void {
		this.pane.layout(420, this.frame.getSize().height, "TOPRIGHT", this.frame);
	}
	onUnmount(): void {
		this.mounted = false;
		this.modal.close();
		this.client.unmount();
		this.details = undefined;
		this.list.unmount();
		this.frame.onSizeChanged();
		this.frame.hide();
	}
	onContainerClosed(): void {
		this.client.close();
	}
	refresh(): void {
		if (!this.mounted) return;
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
	private selectTab(tab: QuestTab): void {
		this.tab = tab;
		this.render();
	}
	private render(): void {
		this.tabs.forEach((tab, index) => {
			tab.setButtonBackground((index === 0) === (this.tab === "campaign"));
		});
		if (this.details !== undefined) {
			this.list.unmount();
			for (const button of this.reading) button.show();
			this.pane.setLabel("hint", "", "BOTTOMLEFT");
			this.navigationChanged?.("map-details-down");
			return;
		}
		for (const button of this.reading) button.hide();
		const rows: ListRow[] = [];
		let zone = "";
		const quests = this.quests.filter(
			(quest) => quest.campaign === (this.tab === "campaign"),
		);
		for (const quest of quests) {
			if (quest.zone !== zone) {
				zone = quest.zone;
				rows.push({
					id: `map-zone-${quest.id}`,
					label: zone,
					heading: true,
					activate: () => {},
				});
			}
			rows.push({
				id: `map-quest-${quest.id}`,
				label: quest.title,
				detail: quest.objectives.join("\n"),
				trailingLabel: quest.tracked ? "Tracked" : undefined,
				height: Math.max(64, 36 + quest.objectives.length * 20),
				activate: () => {
					this.showDetails(quest.id);
					this.client.showDetails(quest.id);
				},
				context: () => this.options(quest.id),
			});
		}
		if (quests.length === 0)
			rows.push({
				id: "map-empty",
				label:
					this.tab === "campaign" ? "No campaign quests" : "No other quests",
				heading: true,
				activate: () => {},
			});
		this.list.setTitle(
			this.tab === "campaign" ? "Campaign quests" : "Other quests",
		);
		this.list.setRows(rows);
		this.list.mount(this.listHost);
		this.pane.setLabel(
			"hint",
			"A: Details  X: Focus  Y: Options  B: Close",
			"BOTTOMLEFT",
			12,
			14,
			13,
			396,
		);
		const remembered = this.focus.get(this.tab);
		const focusId = quests.some(
			(quest) => `map-quest-${quest.id}` === remembered,
		)
			? remembered
			: quests.at(0)
				? `map-quest-${quests.at(0)?.id}`
				: undefined;
		this.navigationChanged?.(focusId);
	}
	showDetails(id?: number): void {
		if (!this.mounted) return;
		if (id !== undefined) {
			const quest = this.quests.find((quest) => quest.id === id);
			if (!quest) return;
			this.tab = quest.campaign ? "campaign" : "other";
			this.focus.set(this.tab, `map-quest-${id}`);
		}
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
	onPanelCycle(_direction: -1 | 1): void {
		if (this.details === undefined)
			this.selectTab(this.tab === "campaign" ? "other" : "campaign");
	}
	getNavGrid(): NavGrid {
		if (this.details !== undefined)
			return this.reading.map((button, index) => [
				button.navigationNode(
					index === 0 ? "map-details-down" : "map-details-up",
					() => this.client.scrollDetails(index === 0 ? 1 : -1),
				),
			]);
		return this.list.getNavGrid().map((row) =>
			row.map(
				(node): INavigable => ({
					...node,
					onFocus: () => {
						this.focus.set(this.tab, node.navId);
						node.onFocus();
					},
					onAlternate: () => {
						const quest = this.quests.find(
							(quest) => `map-quest-${quest.id}` === node.navId,
						);
						if (quest) this.client.focus(quest.id);
					},
				}),
			),
		);
	}
	private options(id: number): void {
		const quest = this.client.read().find((quest) => quest.id === id);
		if (!quest) return;
		const options: ModalOption[] = [
			{
				id: "details",
				label: "View details",
				select: () => {
					this.showDetails(id);
					this.client.showDetails(id);
				},
			},
			{
				id: "track",
				label: quest.tracked ? "Untrack quest" : "Track quest",
				select: () => {
					this.client.track(id);
					this.refresh();
				},
			},
			{
				id: "super-track",
				label: quest.superTracked
					? "Stop navigating to quest"
					: "Navigate to quest",
				select: () => {
					this.client.superTrack(id);
					this.refresh();
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
				select: () =>
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
					),
			});
		this.modal.open(quest.title, options);
	}
	setNavigationChanged(callback?: (focusId?: string) => void): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.onUnmount();
		this.list.destroy();
		for (const frame of [
			...this.tabs,
			...this.reading,
			this.listHost,
			this.pane,
			this.frame,
		])
			frame.destroy();
	}
}
