import type { BankKind, IBankClient } from "../../clients/bank-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { controllerIcon } from "../../ui/components/controller-icon";
import { Frame } from "../../ui/components/frame";
import type { IModal } from "../../ui/components/modal";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import { formatMoney } from "../../utils/money";
import { BagsPanel } from "../bags/bags-panel";
import type { ItemGrouping } from "../bags/item-grouping";
import { BankOptions } from "./bank-options";

export class BankPanel implements IPanel {
	readonly id: string;
	readonly title: string;
	readonly icon: number;
	private readonly frame: Frame;
	private readonly grid: BagsPanel;
	private readonly footer: Frame;
	private readonly buy: Frame;
	private readonly deposit: Frame;
	private readonly withdraw: Frame;
	private readonly options: BankOptions;
	private mounted = false;
	private footerGrid: NavGrid = [];
	private navigationChanged?: () => void;
	constructor(
		readonly kind: BankKind,
		pool: IFramePoolManager,
		private readonly client: IBankClient,
		modal: IModal,
		scheduler: ITaskScheduler,
		grouping: ItemGrouping,
	) {
		this.id = kind === "standard" ? "bank" : "warband-bank";
		this.title = kind === "standard" ? "Bank" : "Warband Bank";
		this.icon = kind === "standard" ? 133633 : 2032599;
		this.frame = new Frame(`${this.id}-frame`, pool);
		this.footer = new Frame(`${this.id}-footer`, pool);
		this.buy = new Frame(`${this.id}-buy-tab`, pool, "Button");
		this.deposit = new Frame(`${this.id}-deposit`, pool, "Button");
		this.withdraw = new Frame(`${this.id}-withdraw`, pool, "Button");
		this.options = new BankOptions(modal, client);
		this.grid = new BagsPanel(
			this.id,
			this.title,
			this.frame,
			pool,
			client,
			{
				open: (item) =>
					modal.open(
						"Bank item",
						[
							{
								id: "withdraw-item",
								label: "Withdraw stack",
								select: () => client.useItem(item),
							},
							{ id: "cancel", label: "Cancel", select: () => modal.close() },
						],
						item.hyperlink ?? item.itemId,
					),
				close: () => modal.close(),
			},
			scheduler,
			grouping,
			{
				bottomInset: 112,
				showMoney: false,
				itemInteraction: "transfer",
				hint: "",
				emptyText: "This bank is empty or unavailable",
			},
		);
		this.grid.setNavigationChanged(() => this.navigationChanged?.());
	}
	refresh(): void {
		if (!this.mounted) return;
		this.grid.setItems(this.client.getItems(this.kind));
		this.renderFooter();
	}
	onMount(parent: IUIComponent): void {
		this.client.select(this.kind);
		this.mounted = true;
		this.refresh();
		this.grid.onMount(parent);
	}
	private renderFooter(): void {
		const state = this.client.getState(this.kind);
		this.footer.setParent(this.frame);
		this.footer.layout(468, 92, "BOTTOMLEFT", this.frame, 16, 12);
		this.footer.setLabel(
			"tabs",
			`Tabs: ${state.unlockedTabs} / ${state.maxTabs}`,
			"TOPLEFT",
			0,
			-4,
			13,
		);
		this.footer.setLabel(
			"hint",
			`${controllerIcon("X")} Withdraw stack   ${controllerIcon("Y")} Actions`,
			"BOTTOMLEFT",
			0,
			0,
			12,
		);
		this.footer.setLabel(
			"money",
			this.kind === "warband" ? formatMoney(state.money) : "",
			"TOPRIGHT",
			0,
			-40,
			13,
		);
		this.footer.setLabel(
			"status",
			!state.available
				? "Bank unavailable"
				: state.nextTabCost === undefined
					? "All tabs unlocked"
					: !state.canBuyTab
						? `Next: ${formatMoney(state.nextTabCost)}`
						: "",
			"TOPLEFT",
			140,
			-6,
			12,
			172,
		);
		const purchaseRow: NavGrid[number] = [];
		const moneyRow: NavGrid[number] = [];
		const button = (
			control: Frame,
			label: string,
			x: number,
			y: number,
			action: () => void,
			row: NavGrid[number],
			navColumn: number,
			enabled = true,
		) => {
			control.setParent(this.footer);
			control.layout(142, 28, "TOPLEFT", this.footer, x, y);
			control.setButtonBackground();
			control.setLabel("label", enabled ? label : `|cff888888${label}|r`);
			const select = () => {
				if (this.mounted && enabled) action();
			};
			control.onClick((mouse) => {
				if (mouse === "LeftButton") select();
			});
			control.show();
			if (enabled)
				row.push({ ...control.navigationNode(control.id, select), navColumn });
		};
		this.buy.hide();
		this.deposit.hide();
		this.withdraw.hide();
		if (state.nextTabCost !== undefined)
			button(
				this.buy,
				"Buy next tab…",
				326,
				0,
				() => this.options.purchase(this.kind),
				purchaseRow,
				7,
				state.canBuyTab,
			);
		if (this.kind === "warband") {
			if (state.canDeposit && state.characterMoney > 0)
				button(
					this.deposit,
					"Deposit gold…",
					0,
					-36,
					() => this.options.transfer("deposit"),
					moneyRow,
					0,
				);
			if (state.canWithdraw && state.money > 0)
				button(
					this.withdraw,
					"Withdraw gold…",
					152,
					-36,
					() => this.options.transfer("withdraw"),
					moneyRow,
					3,
				);
		}
		this.footerGrid = [purchaseRow, moneyRow].filter((row) => row.length > 0);
		this.footer.show();
		this.navigationChanged?.();
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	onUnmount(): void {
		this.mounted = false;
		this.options.close();
		this.grid.onUnmount();
	}
	onContainerClosed(): void {
		this.client.close();
	}
	getNavGrid(): NavGrid {
		return this.mounted ? [...this.grid.getNavGrid(), ...this.footerGrid] : [];
	}
	destroy(): void {
		this.onUnmount();
		this.buy.destroy();
		this.deposit.destroy();
		this.withdraw.destroy();
		this.footer.destroy();
		this.grid.destroy();
	}
}
