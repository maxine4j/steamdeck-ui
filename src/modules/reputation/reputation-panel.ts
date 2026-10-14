import type {
	IReputationClient,
	Reputation,
} from "../../clients/reputation-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";
import type { IReputationActionMenu } from "./reputation-action-menu";

type Color = readonly [number, number, number];

export class ReputationPanel implements IPanel {
	readonly id = "reputation";
	readonly title = "Reputation";
	readonly icon = 236683;
	private readonly list: ScrollList;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	private mounted = false;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IReputationClient,
		close: () => void,
		scheduler: ITaskScheduler,
		private readonly menu: IReputationActionMenu,
	) {
		this.update = new DeferredRefresh(scheduler, () => this.render());
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 20,
			columns: 2,
			gap: 12,
			edgeProgress: true,
			progressInset: { horizontal: 10, bottom: 7 },
			progressTextures: {
				fill: "ui-journeys-progressbar-fill",
				track: "ui-journeys-progressbar-BG",
			},
			scheduler,
			onChanged: () => this.navigationChanged?.(),
		});
	}
	refresh(): void {
		this.update.invalidate();
	}
	private render(): void {
		const rows: ListRow[] = [];
		const reputations = this.client.getReputations();
		const seasonal = reputations.filter((reputation) => reputation.seasonal);
		if (seasonal.length > 0) {
			rows.push({
				id: "reputation-seasonal",
				label: "Seasonal",
				heading: true,
				fontSize: 20,
				height: 28,
				marginTop: 8,
				marginBottom: 8,
				activate: () => {},
			});
			rows.push(...seasonal.map((reputation) => this.tile(reputation)));
		}
		let standard: Reputation[] = [];
		let groups: { parent: Reputation; children: Reputation[] }[] = [];
		let group: { parent: Reputation; children: Reputation[] } | undefined;
		const flush = () => {
			rows.push(...standard.map((reputation) => this.tile(reputation)));
			for (const section of groups) {
				if (!section.children.length) continue;
				rows.push(this.heading(section.parent, true));
				rows.push(
					...section.children.map((reputation) => this.tile(reputation, 12)),
				);
			}
			standard = [];
			groups = [];
			group = undefined;
		};
		for (const reputation of reputations) {
			if (reputation.seasonal) continue;
			if (reputation.header && !reputation.child && !reputation.hasReputation) {
				flush();
				rows.push(this.heading(reputation, false));
			} else if (reputation.header) {
				if (reputation.hasReputation) standard.push(reputation);
				group = { parent: reputation, children: [] };
				groups.push(group);
			} else if (reputation.hasReputation) {
				if (reputation.child && group) group.children.push(reputation);
				else {
					group = undefined;
					standard.push(reputation);
				}
			}
		}
		flush();
		this.list.setRows(rows);
	}
	private heading(reputation: Reputation, child: boolean): ListRow {
		return {
			id: `reputation-heading-${reputation.index}`,
			label: reputation.name,
			heading: true,
			fontSize: child ? 16 : 20,
			indent: child ? 12 : 0,
			height: child ? 24 : 28,
			marginTop: child ? 0 : 8,
			marginBottom: 8,
			activate: () => {},
		};
	}
	private tile(reputation: Reputation, indent = 0): ListRow {
		const capped =
			reputation.maxed && !reputation.standing.startsWith("Paragon");
		const backgroundTint = capped
			? reputation.seasonal || reputation.standing.startsWith("Renown")
				? ([0.15, 0.45, 0.95] as const)
				: ([0.15, 0.7, 0.25] as const)
			: reputation.reaction < 4
				? ([0.8, 0.15, 0.15] as const)
				: reputation.reaction === 4
					? ([0.85, 0.65, 0.15] as const)
					: undefined;
		return {
			id: `reputation-${reputation.index}`,
			label: reputation.name,
			height: 60,
			backgroundAtlas: "ui-journeys-renown-button",
			backgroundTint,
			indent,
			detail: `${reputation.standing}${!capped && reputation.progress ? ` ${reputation.progress}` : ""}${reputation.watched ? " • Watched" : ""}`,
			tooltip: reputation.description,
			selected: reputation.watched,
			enabled: !reputation.locked,
			progress: {
				value: capped
					? 1
					: reputation.maximum > 0
						? reputation.current / reputation.maximum
						: 0,
				color: (reputation.maxed
					? [0.15, 0.45, 0.95]
					: reputation.reaction < 4
						? [0.8, 0.15, 0.15]
						: reputation.reaction === 4
							? [0.85, 0.65, 0.15]
							: [0.15, 0.7, 0.25]) as Color,
			},
			activate: () => {
				this.client.activate(reputation);
				this.refresh();
			},
			context: () => {
				if (this.mounted && !reputation.locked) this.menu.open(reputation);
			},
		};
	}
	onMount(parent: IUIComponent): void {
		this.mounted = true;
		this.list.mount(parent);
		this.update.setActive(true);
	}
	onUnmount(): void {
		this.mounted = false;
		this.menu.close();
		this.update.setActive(false);
		this.list.unmount();
	}
	getNavGrid() {
		return this.list.getNavGrid();
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.mounted = false;
		this.menu.close();
		this.update.setActive(false);
		this.list.destroy();
	}
}
