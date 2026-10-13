import type {
	IMapClient,
	MapQuest,
	MapQuestNavigation,
} from "../../clients/map-client";
import { Frame } from "../../ui/components/frame";
import type { IModal, ModalOption } from "../../ui/components/modal";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable, NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

export class MapPanel implements IPanel {
	readonly id = "map";
	readonly title = "Map & Quests";
	private readonly frame: Frame;
	private readonly pane: Frame;
	private readonly reading: Frame[];
	private focus?: string;
	private rows: MapQuestNavigation[] = [];
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
		this.reading = [
			new Frame("map-details-down", pool, "Button"),
			new Frame("map-details-up", pool, "Button"),
		];
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Map requires a frame parent");
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		this.frame.show();
		this.pane.setParent(this.frame);
		this.layout();
		this.frame.onSizeChanged(() => {
			this.layout();
			this.client.resize();
		});
		this.pane.setWindowBackground();
		this.pane.show();
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
		this.rows = [];
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
	private render(): void {
		if (this.details !== undefined) {
			for (const button of this.reading) button.show();
			this.pane.setLabel("hint", "", "BOTTOMLEFT");
			this.navigationChanged?.("map-details-down");
			return;
		}
		for (const button of this.reading) button.hide();
		this.rows = this.client.navigation();
		this.pane.setLabel(
			"hint",
			"A: Details  X: Focus  Y: Options  B: Close",
			"BOTTOMLEFT",
			12,
			14,
			13,
			396,
		);
		const focusId = this.rows.some((row) => row.node.navId === this.focus)
			? this.focus
			: this.rows.at(0)?.node.navId;
		this.navigationChanged?.(focusId);
	}
	showDetails(id?: number): void {
		if (!this.mounted) return;
		if (id !== undefined) {
			const quest = this.quests.find((quest) => quest.id === id);
			if (!quest) return;
			this.focus = `map-quest-${id}`;
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
	getNavGrid(): NavGrid {
		if (this.details !== undefined)
			return this.reading.map((button, index) => [
				button.navigationNode(
					index === 0 ? "map-details-down" : "map-details-up",
					() => this.client.scrollDetails(index === 0 ? 1 : -1),
				),
			]);
		return this.rows.map(({ node, questID }) => [
			{
				...node,
				onFocus: () => {
					this.focus = node.navId;
					node.onFocus();
				},
				onInteract: () => {
					if (questID !== undefined) {
						this.showDetails(questID);
						this.client.showDetails(questID);
					} else {
						node.onInteract();
						this.refresh();
					}
				},
				onAlternate:
					questID !== undefined ? () => this.client.focus(questID) : undefined,
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
		for (const frame of [...this.reading, this.pane, this.frame])
			frame.destroy();
	}
}
