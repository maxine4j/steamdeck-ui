import type { IControllerOptionsClient } from "../../clients/controller-options-client";
import { Frame } from "../../ui/components/frame";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
export class ControllerOptionsPanel implements IPanel {
	readonly id = "controller-options";
	readonly title = "SteamDeck UI options";
	readonly icon = 136243;
	private readonly list: ScrollList;
	private readonly viewport: Frame;
	private readonly window: Frame;
	private readonly resetButton: Frame;
	private readonly resetNavigation: INavigable;
	private mounted = false;
	private changed?: () => void;
	private readonly reset = () => {
		this.client.reset();
		this.refresh();
	};
	constructor(
		pool: IFramePoolManager,
		private readonly client: Pick<
			IControllerOptionsClient,
			"getOptions" | "set" | "reset"
		>,
		close: () => void,
	) {
		this.viewport = new Frame("controller-options-viewport", pool);
		this.window = new Frame("controller-options-window", pool);
		this.resetButton = new Frame("controller-options-reset", pool, "Button");
		this.resetNavigation = {
			navId: "options-reset",
			mouseTarget: this.resetButton,
			onFocus: () => this.resetButton.setFocused(true),
			onBlur: () => this.resetButton.setFocused(false),
			onInteract: () => this.reset(),
		};
		this.list = new ScrollList(
			"controller-options-list",
			pool,
			this.title,
			close,
			{
				padding: 24,
				columns: 2,
				gap: 16,
				top: 104,
				titleFontSize: 18,
				background: false,
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
				fontSize: 27,
				detailFontSize: 15,
				wrapDetail: true,
				height: 116,
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
					fontSize: 27,
					detailFontSize: 15,
					height: 48,
					activate: () => {},
				});
			}
			if (option.id === "yawSpeed" || option.id === "pitchSpeed") {
				rows.push({
					id: `option-${option.id}`,
					fullWidth: true,
					label: `${option.label}: ${option.supported ? `${option.value}×` : "Unavailable"}`,
					height: 84,
					fontSize: 21.25,
					tooltip: option.description,
					enabled: option.supported,
					background: false,
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
				fontSize: 27,
				detailFontSize: 15,
				height: 104,
				wrapLabel: true,
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
					height: 64,
					fontSize: 20,
					group: { id: option.id },
					wrapLabel: true,
					activate: () => {
						if (!option.supported) return;
						this.client.set(option.id, choice.value);
						this.refresh();
					},
				});
		}
		this.list.updateRows(rows);
	}
	onMount(parent: IUIComponent): void {
		this.viewport.fill(parent as Frame);
		this.window.setParent(this.viewport);
		this.window.setWindowBackground();
		const resize = () => {
			const size = this.viewport.getSize();
			const width = size.width * 0.66;
			this.window.layout(width, size.height, "CENTER", this.viewport);
			this.list.setWidth(width);
		};
		this.viewport.onSizeChanged(resize);
		resize();
		this.list.mount(this.window);
		this.resetButton.setParent(this.window);
		this.resetButton.setColor(0.5, 0.08, 0.08);
		this.resetButton.setLabel(
			"label",
			"Reset controller defaults",
			"CENTER",
			0,
			0,
			17.5,
		);
		this.resetButton.setTooltip(
			"Reset movement, camera turning and sensitivity to the controller defaults.",
		);
		this.resetButton.onClick((mouse) => {
			if (mouse === "LeftButton") this.reset();
		});
		this.resetButton.layout(280, 44, "TOPRIGHT", this.window, -24, -36);
		this.resetButton.show();
		this.refresh();
		this.window.show();
		this.viewport.show();
		this.mounted = true;
	}
	onUnmount(): void {
		this.viewport.onSizeChanged();
		this.list.unmount();
		this.mounted = false;
		this.resetButton.setFocused(false);
		this.resetButton.hide();
		this.window.setFocusBorder(false);
		this.window.hide();
		this.viewport.hide();
	}
	getNavGrid() {
		return this.mounted
			? [[this.resetNavigation], ...this.list.getNavGrid()]
			: [];
	}
	onActiveChanged(active: boolean): void {
		this.window.setFocusBorder(active);
	}
	setNavigationChanged(changed?: () => void): void {
		this.changed = changed;
	}
	destroy(): void {
		this.onUnmount();
		this.list.destroy();
		this.resetButton.destroy();
		this.window.destroy();
		this.viewport.destroy();
	}
}
