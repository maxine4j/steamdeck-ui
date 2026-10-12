import type { IReputationClient } from "../../clients/reputation-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

type Color = readonly [number, number, number];
const expansionColors = new Map<string, Color>([
	["Classic", [0.24, 0.18, 0.06]],
	["World of Warcraft", [0.24, 0.18, 0.06]],
	["The Burning Crusade", [0.08, 0.23, 0.12]],
	["Burning Crusade", [0.08, 0.23, 0.12]],
	["Wrath of the Lich King", [0.06, 0.18, 0.28]],
	["Cataclysm", [0.28, 0.1, 0.04]],
	["Mists of Pandaria", [0.04, 0.23, 0.18]],
	["Warlords of Draenor", [0.25, 0.12, 0.07]],
	["Legion", [0.12, 0.22, 0.06]],
	["Battle for Azeroth", [0.2, 0.16, 0.08]],
	["Shadowlands", [0.18, 0.12, 0.25]],
	["Dragonflight", [0.08, 0.22, 0.23]],
	["The War Within", [0.27, 0.17, 0.05]],
	["Midnight", [0.17, 0.08, 0.28]],
]);

export class ReputationPanel implements IPanel {
	readonly id = "reputation";
	readonly title = "Reputation";
	readonly icon = 236683;
	private readonly list: ScrollList;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IReputationClient,
		close: () => void,
		scheduler: ITaskScheduler,
	) {
		this.update = new DeferredRefresh(scheduler, () => this.render());
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 20,
			scheduler,
			onChanged: () => this.navigationChanged?.(),
		});
	}
	refresh(): void {
		this.update.invalidate();
	}
	private render(): void {
		this.list.setRows(
			this.client.getReputations().map((reputation) => ({
				id: `reputation-${reputation.index}`,
				label: `${reputation.header ? (reputation.collapsed ? "+ " : "− ") : ""}${reputation.name}`,
				fontSize: reputation.header ? (reputation.child ? 16 : 18) : 14,
				indent: reputation.header
					? reputation.child
						? 16
						: 0
					: reputation.child
						? 32
						: 16,
				detail: reputation.hasReputation
					? `${reputation.standing} ${reputation.progress}${reputation.watched ? " • Watched" : ""}`
					: "",
				tooltip: reputation.description,
				selected: reputation.watched,
				background:
					reputation.header && !reputation.child
						? expansionColors.get(reputation.name)
						: undefined,
				progress: !reputation.hasReputation
					? undefined
					: {
							value:
								reputation.maximum > 0
									? reputation.maxed &&
										!reputation.standing.startsWith("Paragon")
										? 1
										: reputation.current / reputation.maximum
									: reputation.maxed
										? 1
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
			})),
		);
	}
	onMount(parent: IUIComponent): void {
		this.list.mount(parent);
		this.update.setActive(true);
	}
	onUnmount(): void {
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
		this.update.setActive(false);
		this.list.destroy();
	}
}
