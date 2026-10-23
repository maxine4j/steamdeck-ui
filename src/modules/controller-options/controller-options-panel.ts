import type { IControllerOptionsClient } from "../../clients/controller-options-client";
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
	private refresh(): void {
		const options = this.client.getOptions();
		const rows: ListRow[] = [
			{
				id: "options-help",
				label: "Player and camera preferences",
				detail:
					"Choose movement with radio buttons. Drag sensitivity sliders or use D-pad left/right. Changes are saved immediately.",
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
			if (option.id === "yawSpeed" || option.id === "pitchSpeed") {
				rows.push({
					id: `option-${option.id}`,
					fullWidth: true,
					label: `${option.label}: ${option.supported ? `${option.value}×` : "Unavailable"}`,
					height: 84,
					fontSize: 17,
					tooltip: option.description,
					enabled: option.supported,
					background: [0.075, 0.075, 0.075],
					slider: {
						minimum: Number(option.choices.at(0)?.value ?? "0.5"),
						maximum: Number(option.choices.at(-1)?.value ?? "4"),
						step: 0.25,
						value: Number(option.value),
						change: (value) => {
							if (!option.supported) return;
							this.client.set(option.id, `${value}`);
							this.refresh();
						},
					},
					activate: () => {},
				});
				continue;
			}
			rows.push({
				id: `option-${option.id}`,
				label: option.label,
				detail: option.supported
					? option.description
					: "Unavailable in this version of World of Warcraft.",
				heading: true,
				height: 70,
				wrapDetail: true,
				activate: () => {},
			});
			for (const choice of option.choices)
				rows.push({
					id: `choice-${option.id}-${choice.value}`,
					label: choice.label,
					radio: true,
					checked: choice.value === option.value,
					enabled: option.supported,
					height: 44,
					fontSize: 16,
					wrapLabel: true,
					activate: () => {
						if (!option.supported) return;
						this.client.set(option.id, choice.value);
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
