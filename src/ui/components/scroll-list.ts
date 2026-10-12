import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { Frame } from "./frame";
import type { IUIComponent } from "./types";

export interface ListRow {
	readonly id: string;
	readonly label: string;
	readonly icon?: number;
	readonly spell?: number;
	readonly secondary?: { label: string; activate(): void };
	readonly detail?: string;
	readonly tooltip?: string;
	readonly selected?: boolean;
	readonly fontSize?: number;
	readonly indent?: number;
	readonly background?: readonly [number, number, number];
	readonly progress?: {
		readonly value: number;
		readonly color: readonly [number, number, number];
	};
	readonly activate: () => void;
}
/** Generic reusable scrollable buttons; domain data stays in module panels. */
export class ScrollList {
	private readonly frame: Frame;
	private readonly scroll: Frame;
	private readonly content: Frame;
	private readonly close: Frame;
	private readonly buttons: {
		frame: Frame;
		icon: Frame;
		track: Frame;
		progress: Frame;
		secondary: Frame;
		secondaryNav: INavigable;
		nav: INavigable;
	}[] = [];
	private rows: readonly ListRow[] = [];
	private mounted = false;
	constructor(
		private readonly id: string,
		private readonly pool: IFramePoolManager,
		private readonly title: string,
		private readonly onClose: () => void,
		private readonly options: {
			readonly padding?: number;
			readonly top?: number;
			readonly bottom?: number;
			readonly secure?: boolean;
			readonly background?: boolean;
		} = {},
	) {
		this.frame = new Frame(id, pool);
		this.scroll = new Frame(`${id}-scroll`, pool, "ScrollFrame");
		this.content = new Frame(`${id}-content`, pool);
		this.close = new Frame(`${id}-close`, pool, "Button");
	}
	setRows(rows: readonly ListRow[]): void {
		this.rows = rows;
		if (this.mounted) this.render();
	}
	mount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("List requires a frame parent");
		this.frame.fill(parent);
		if (this.options.background !== false) this.frame.setBlackBackground();
		this.frame.setLabel("title", this.title, "TOPLEFT", 16, -16, 20);
		this.close.setParent(this.frame);
		this.close.layout(28, 24, "TOPRIGHT", this.frame, -12, -8);
		this.close.setLabel("close", "X");
		this.close.onClick(() => {
			if (this.mounted) this.onClose();
		});
		this.close.show();
		const padding = this.options.padding;
		this.scroll.inset(
			this.frame,
			padding ?? 12,
			this.options.top ?? (padding === undefined ? 52 : 40 + padding),
			padding ?? 12,
			this.options.bottom ?? padding ?? 16,
		);
		this.content.setParent(this.scroll);
		this.scroll.setScrollContent(this.content);
		this.scroll.show();
		this.content.show();
		this.frame.show();
		this.mounted = true;
		this.render();
	}
	private render(): void {
		const width = 480 - 2 * (this.options.padding ?? 12);
		this.content.layout(
			width,
			Math.max(
				1,
				this.rows.reduce((height, row) => height + (row.progress ? 64 : 52), 0),
			),
			"TOPLEFT",
			this.scroll,
		);
		let offset = 0;
		this.rows.forEach((row, index) => {
			let button = this.buttons.at(index);
			if (!button) {
				const frame = new Frame(
					`${this.id}-row-${index}`,
					this.pool,
					this.options.secure ? "SecureButton" : "Button",
				);
				const secondary = new Frame(
					`${this.id}-secondary-${index}`,
					this.pool,
					"Button",
				);
				button = {
					frame,
					icon: new Frame(`${this.id}-icon-${index}`, this.pool),
					track: new Frame(`${this.id}-track-${index}`, this.pool),
					progress: new Frame(`${this.id}-progress-${index}`, this.pool),
					secondary,
					secondaryNav: {
						navId: `${row.id}-secondary`,
						onFocus: () => secondary.setColor(0.3, 0.25, 0),
						onBlur: () => secondary.setColor(0.12, 0.12, 0.12),
						onInteract: () => {
							if (this.mounted) this.rows.at(index)?.secondary?.activate();
						},
					},
					nav: {
						navId: row.id,
						onFocus: () => frame.setColor(0.3, 0.25, 0),
						onBlur: () => this.style(index),
						onInteract: () => {
							if (this.mounted) {
								if (this.options.secure) frame.click();
								else this.rows.at(index)?.activate();
							}
						},
					},
				};
				this.buttons.push(button);
			}
			button.nav.navId = row.id;
			button.frame.setParent(this.content);
			button.icon.setParent(button.frame);
			if (row.icon !== undefined) {
				button.icon.layout(36, 36, "TOPLEFT", button.frame, 6, -6);
				button.icon.setIcon(row.icon);
				button.icon.show();
			} else button.icon.hide();
			button.secondaryNav.navId = `${row.id}-favourite`;
			if (row.secondary) {
				button.secondary.setParent(button.frame);
				button.secondary.layout(44, 40, "TOPRIGHT", button.frame, -4, -4);
				button.secondary.setColor(0.12, 0.12, 0.12);
				button.secondary.setLabel("label", row.secondary.label);
				button.secondary.onClick(() => {
					if (this.mounted) this.rows.at(index)?.secondary?.activate();
				});
				button.secondary.show();
			} else button.secondary.hide();
			const indent = row.indent ?? 0;
			const textLeft = row.icon === undefined ? 8 : 48;
			const textWidth =
				width - indent - textLeft - 8 - (row.secondary ? 48 : 0);
			if (row.progress) {
				button.track.setParent(button.frame);
				button.track.layout(
					textWidth,
					6,
					"BOTTOMLEFT",
					button.frame,
					textLeft,
					6,
				);
				button.track.setColor(0.025, 0.025, 0.025);
				button.track.show();
				const value = Math.max(0, Math.min(1, row.progress.value));
				if (value > 0) {
					button.progress.setParent(button.track);
					button.progress.layout(
						textWidth * value,
						6,
						"BOTTOMLEFT",
						button.track,
						0,
						0,
					);
					button.progress.setColor(...row.progress.color);
					button.progress.show();
				} else button.progress.hide();
			} else {
				button.progress.hide();
				button.track.hide();
			}
			button.frame.layout(
				width - indent,
				row.progress ? 60 : 48,
				"TOPLEFT",
				this.content,
				indent,
				-offset,
			);
			offset += row.progress ? 64 : 52;
			button.frame.setLabel(
				"label",
				row.label,
				"TOPLEFT",
				row.icon === undefined ? 8 : 48,
				-6,
				row.fontSize ?? 14,
				width -
					indent -
					(row.icon === undefined ? 16 : 56) -
					(row.secondary ? 48 : 0),
			);
			button.frame.setLabel(
				"detail",
				row.detail ?? "",
				"BOTTOMLEFT",
				row.icon === undefined ? 8 : 48,
				row.progress ? 18 : 6,
				12,
				width -
					indent -
					(row.icon === undefined ? 16 : 56) -
					(row.secondary ? 48 : 0),
			);
			button.frame.setTooltip(row.tooltip ?? row.label);
			if (this.options.secure) button.frame.setSpell(row.spell);
			else
				button.frame.onClick((mouseButton) => {
					if (this.mounted && mouseButton === "LeftButton")
						this.rows.at(index)?.activate();
				});
			this.style(index);
			button.frame.show();
		});
		for (let index = this.rows.length; index < this.buttons.length; index++)
			this.buttons.at(index)?.frame.hide();
		this.scroll.clampScroll();
	}
	private style(index: number): void {
		const row = this.rows.at(index);
		const color: readonly [number, number, number] =
			row?.background ??
			(row?.selected ? [0.25, 0.2, 0.05] : [0.08, 0.08, 0.08]);
		this.buttons.at(index)?.frame.setColor(...color);
	}
	unmount(): void {
		this.mounted = false;
		this.frame.hide();
	}
	getNavGrid(): INavigable[][] {
		return this.mounted
			? this.buttons
					.slice(0, this.rows.length)
					.map((button, index) =>
						this.rows.at(index)?.secondary
							? [button.nav, button.secondaryNav]
							: [button.nav],
					)
			: [];
	}
	destroy(): void {
		this.unmount();
		for (const button of this.buttons) {
			button.progress.destroy();
			button.track.destroy();
			button.secondary.destroy();
			button.icon.destroy();
			button.frame.destroy();
		}
		this.buttons.length = 0;
		this.close.destroy();
		this.scroll.destroy();
		this.content.destroy();
		this.frame.destroy();
	}
}
