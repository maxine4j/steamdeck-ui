import type { Currency, ICurrencyClient } from "../../clients/currency-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";
import type { CurrencyOptions } from "./currency-options";

export class CurrencyPanel implements IPanel {
	readonly id = "currency";
	readonly title = "Currency";
	readonly icon = 133784;
	private readonly list: ScrollList;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	private active = false;
	private dirty = true;
	private generation = 0;
	private cancelLoad?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: ICurrencyClient,
		private readonly options: Pick<
			CurrencyOptions,
			"open" | "close" | "transferResult"
		>,
		close: () => void,
		scheduler: ITaskScheduler,
	) {
		this.update = new DeferredRefresh(scheduler, () => this.load());
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 20,
			scheduler,
			onChanged: () => this.navigationChanged?.(),
		});
	}
	refresh(): void {
		this.dirty = true;
		this.generation++;
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.update.invalidate();
	}
	closeOptions(): void {
		this.options.close();
	}
	transferResult(success: boolean): void {
		this.options.transferResult(success);
	}
	private load(): void {
		const generation = ++this.generation;
		this.list.setRows([
			{
				id: "currency-loading",
				label: "Loading currencies…",
				heading: true,
				activate: () => {},
			},
		]);
		this.cancelLoad = this.client.load((currencies) => {
			if (!this.active || generation !== this.generation) return;
			this.cancelLoad = undefined;
			this.dirty = false;
			this.render(currencies);
		});
	}
	private render(currencies: readonly Currency[]): void {
		this.list.setRows(
			currencies.map((currency) => ({
				id: currency.header
					? `currency-category-${currency.index}`
					: `currency-${currency.id}`,
				label: currency.header
					? `${currency.expanded ? "−" : "+"} ${currency.name}`
					: currency.name,
				icon: currency.icon,
				indent: currency.depth * 16,
				fontSize: currency.header ? (currency.depth === 0 ? 18 : 16) : 14,
				background: currency.header ? ([0.12, 0.18, 0.25] as const) : undefined,
				marginBottom: currency.header ? 6 : 2,
				selected: currency.watched,
				detail: currency.header
					? ""
					: `${currency.quantity}${currency.maximum > 0 ? ` / ${currency.maximum}` : ""}${currency.watched ? " • Watched" : ""}${currency.accountWide ? " • Account-wide" : ""}${currency.unused ? " • Inactive" : ""} • Y: Options`,
				tooltip: currency.description,
				activate: () => {
					if (currency.header) {
						this.client.toggleHeader(currency);
						this.refresh();
					} else this.options.open(currency);
				},
				context: currency.header
					? undefined
					: () => this.options.open(currency),
			})),
		);
	}
	onMount(parent: IUIComponent): void {
		this.active = true;
		this.list.mount(parent);
		if (this.dirty) this.update.invalidate();
		this.update.setActive(true);
	}
	onUnmount(): void {
		this.active = false;
		this.generation++;
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.closeOptions();
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
		this.onUnmount();
		this.list.destroy();
	}
}
