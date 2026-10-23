import type {
	ControllerOption,
	IControllerOptionsClient,
} from "../../clients/controller-options-client";
import { Frame } from "../../ui/components/frame";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";
export class ControllerOptionsPanel implements IPanel {
	readonly id = "controller-options";
	readonly title = "SteamDeck UI options";
	readonly icon = 136243;
	private readonly list: ScrollList;
	private readonly viewport: Frame;
	private changed?: () => void;
	private editing?: string;
	private readonly choiceScope = {
		cancel: () => {
			this.editing = undefined;
			this.refresh();
		},
	};
	constructor(
		pool: IFramePoolManager,
		private readonly client: Pick<
			IControllerOptionsClient,
			"getOptions" | "set" | "reset"
		>,
		private readonly close: () => void,
	) {
		this.viewport = new Frame("controller-options-viewport", pool);
		this.list = new ScrollList(
			"controller-options-list",
			pool,
			this.title,
			close,
			{
				padding: 24,
				columns: 2,
				gap: 16,
				preserveScrollOnRefresh: true,
				onChanged: (complete) => {
					if (complete) this.changed?.();
				},
			},
		);
	}
	private showChoices(option: ControllerOption): void {
		this.list.updateRows([
			{
				id: "choices-heading",
				label: option.label,
				detail: option.description,
				heading: true,
				wrapDetail: true,
				height: 84,
				activate: () => {},
			},
			...option.choices.map(
				(choice): ListRow => ({
					id: `choice-${option.id}-${choice.value}`,
					label: choice.label,
					checked: choice.value === option.value,
					height: 56,
					fontSize: 17,
					wrapLabel: true,
					activate: () => {
						this.client.set(option.id, choice.value);
						this.choiceScope.cancel();
					},
				}),
			),
			{
				id: "choices-back",
				label: "Back",
				height: 56,
				fullWidth: true,
				activate: this.choiceScope.cancel,
			},
		]);
	}
	private refresh(): void {
		const options = this.client.getOptions();
		const editing = options.find((option) => option.id === this.editing);
		if (editing) {
			this.showChoices(editing);
			return;
		}
		const rows: ListRow[] = [
			{
				id: "options-help",
				label: "Player and camera preferences",
				detail:
					"Select a setting, then choose a value. Changes apply immediately and are saved for your next login.",
				heading: true,
				wrapDetail: true,
				height: 84,
				activate: () => {},
			},
		];
		let category = "";
		for (const option of options) {
			if (category !== option.category) {
				category = option.category;
				rows.push({
					id: `category-${category}`,
					label: category,
					heading: true,
					height: 42,
					activate: () => {},
				});
			}
			const label =
				option.choices.find((choice) => choice.value === option.value)?.label ??
				`Current: ${option.value}`;
			rows.push({
				id: `option-${option.id}`,
				label: `${option.label}: ${option.supported ? label : "Unavailable"}`,
				detail: option.supported
					? option.description
					: "Unavailable in this version of World of Warcraft.",
				height: 120,
				fontSize: 17,
				wrapLabel: true,
				wrapDetail: true,
				background: [0.075, 0.075, 0.075],
				enabled: option.supported,
				activate: () => {
					if (!option.supported) return;
					this.editing = option.id;
					this.list.resetScroll();
					this.refresh();
				},
			});
		}
		rows.push({
			id: "options-reset",
			label: "Reset controller defaults",
			detail:
				"Reset movement, camera turning and sensitivity to the controller defaults.",
			height: 80,
			fullWidth: true,
			wrapDetail: true,
			background: [0.075, 0.075, 0.075],
			activate: () => {
				this.client.reset();
				this.refresh();
			},
		});
		rows.push({
			id: "options-close",
			label: "Done",
			detail: "Preferences are already saved.",
			height: 56,
			fullWidth: true,
			background: [0.12, 0.12, 0.12],
			activate: this.close,
		});
		this.list.updateRows(rows);
	}
	onMount(parent: IUIComponent): void {
		this.viewport.fill(parent as Frame);
		const resize = () => this.list.setWidth(this.viewport.getSize().width);
		this.viewport.onSizeChanged(resize);
		resize();
		this.list.mount(this.viewport);
		this.refresh();
		this.viewport.show();
	}
	onUnmount(): void {
		this.editing = undefined;
		this.viewport.onSizeChanged();
		this.list.unmount();
		this.viewport.hide();
	}
	getNavGrid() {
		const grid = this.list.getNavGrid();
		for (const row of grid)
			for (const node of row)
				node.navigationScope = this.editing ? this.choiceScope : undefined;
		return grid;
	}
	setNavigationChanged(changed?: () => void): void {
		this.changed = changed;
	}
	destroy(): void {
		this.onUnmount();
		this.list.destroy();
		this.viewport.destroy();
	}
}
