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
	private edit(option: ControllerOption, direction: -1 | 1): void {
		const index = option.choices.findIndex(
			(choice) => choice.value === option.value,
		);
		const next = option.choices.at(
			(index + direction + option.choices.length) % option.choices.length,
		);
		if (next) this.client.set(option.id, next.value);
		this.refresh();
	}
	private refresh(): void {
		const rows: ListRow[] = [
			{
				id: "options-help",
				label: "Player and camera preferences",
				detail:
					"Select a setting to advance its value; Previous goes backward. Changes apply immediately and are saved for your next login.",
				heading: true,
				wrapDetail: true,
				height: 84,
				activate: () => {},
			},
		];
		let category = "";
		for (const option of this.client.getOptions()) {
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
				height: 152,
				fontSize: 17,
				wrapLabel: true,
				wrapDetail: true,
				background: [0.075, 0.075, 0.075],
				enabled: option.supported,
				activate: () => this.edit(option, 1),
				secondary: {
					label: "Previous",
					width: 110,
					height: 32,
					background: [0.12, 0.12, 0.12],
					enabled: option.supported,
					activate: () => this.edit(option, -1),
				},
			});
		}
		rows.push({
			id: "options-reset",
			label: "Reset controller defaults",
			detail:
				"Reset movement and sensitivity. Other camera settings return to their values before this login; saved overrides are removed.",
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
		this.viewport.onSizeChanged();
		this.list.unmount();
		this.viewport.hide();
	}
	getNavGrid() {
		return this.list.getNavGrid();
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
