import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { type AnimatedAtlas, Frame } from "./frame";
import type { IUIComponent } from "./types";

export interface ListRow {
	readonly id: string;
	readonly label: string;
	readonly heading?: boolean;
	readonly icon?: number;
	readonly spell?: number;
	readonly secondary?: { label: string; activate(): void };
	readonly detail?: string;
	readonly height?: number;
	readonly trailingLabel?: string;
	readonly trailingOnFirstLine?: boolean;
	readonly tooltip?: string;
	readonly selected?: boolean;
	readonly animatedIcon?: AnimatedAtlas;
	readonly checked?: boolean;
	readonly enabled?: boolean;
	readonly fontSize?: number;
	readonly wrapLabel?: boolean;
	readonly indent?: number;
	/** Extra space above a full-width heading. */
	readonly marginTop?: number;
	readonly marginBottom?: number;
	readonly background?: readonly [number, number, number] | false;
	readonly backgroundAtlas?: string;
	readonly backgroundTint?: readonly [number, number, number];
	readonly progress?: {
		readonly value: number;
		readonly color: readonly [number, number, number];
	};
	readonly activate: () => void;
	readonly context?: () => void;
}
/** Generic reusable scrollable buttons; domain data stays in module panels. */
export class ScrollList {
	private readonly frame: Frame;
	private readonly scroll: Frame;
	private readonly content: Frame;
	private readonly buttons: {
		frame: Frame;
		icon: Frame;
		track: Frame;
		progress: Frame;
		secondary: Frame;
		checkbox?: Frame;
		check?: Frame;
		animation?: Frame;
		animatedFocus?: boolean;
		dimmed: boolean;
		secondaryNav: INavigable;
		nav: INavigable;
		top: number;
		bottom: number;
	}[] = [];
	private rows: readonly ListRow[] = [];
	private mounted = false;
	private dirty = true;
	private cancelRender?: () => void;
	private renderedRows = 0;
	private contentHeight = 1;
	private width?: number;
	private columns?: number;
	constructor(
		private readonly id: string,
		private readonly pool: IFramePoolManager,
		private title: string,
		_onClose: () => void,
		private readonly options: {
			readonly width?: number;
			readonly autoHeight?: boolean;
			readonly padding?: number;
			readonly top?: number;
			readonly bottom?: number;
			readonly secure?: boolean;
			readonly background?: boolean;
			readonly verticallyCentered?: boolean;
			readonly scheduler?: ITaskScheduler;
			readonly onChanged?: (complete: boolean) => void;
			readonly columns?: number;
			readonly gap?: number;
			readonly batchSize?: number;
			readonly edgeProgress?: boolean;
			readonly progressInset?: { horizontal: number; bottom: number };
			readonly contentPadding?: { horizontal: number; vertical: number };
			readonly centerSingleLine?: boolean;
		} = {},
	) {
		this.frame = new Frame(id, pool);
		this.scroll = new Frame(`${id}-scroll`, pool, "ScrollFrame");
		this.content = new Frame(`${id}-content`, pool);
	}
	setColumns(columns: number): void {
		if (columns === (this.columns ?? this.options.columns ?? 1)) return;
		this.columns = Math.max(1, columns);
		this.dirty = true;
		if (this.mounted) this.render();
	}
	setTitle(title: string): void {
		this.title = title;
		if (this.mounted)
			this.frame.setLabel("title", title, "TOPLEFT", 16, -16, 20);
	}
	resetScroll(): void {
		this.scroll.resetScroll();
	}
	setRows(rows: readonly ListRow[]): void {
		const preserve =
			rows.length >= this.rows.length &&
			this.rows.every((row, index) => row === rows.at(index));
		this.rows = rows;
		this.dirty = true;
		if (this.mounted) this.render(preserve ? this.renderedRows : 0);
	}
	setWidth(width: number): void {
		if (this.width === width) return;
		this.width = width;
		this.dirty = true;
		if (this.mounted) this.render();
	}
	mount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("List requires a frame parent");
		this.frame.fill(parent);
		if (this.options.background !== false) this.frame.setWindowBackground();
		this.frame.setLabel("title", this.title, "TOPLEFT", 16, -16, 20);
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
		if (this.options.verticallyCentered)
			this.scroll.onSizeChanged(() => {
				if (!this.mounted) return;
				this.layoutContent();
				this.scroll.clampScroll();
			});
		if (this.dirty) this.render();
		else {
			this.buttons.forEach((button, index) => {
				if (this.rows.at(index)?.animatedIcon) button.animation?.show();
			});
			if (this.options.verticallyCentered) this.layoutContent();
			this.scroll.clampScroll();
		}
	}
	private layoutContent(): void {
		const width =
			(this.width ?? this.options.width ?? 480) -
			2 * (this.options.padding ?? 12);
		if (this.options.verticallyCentered)
			this.content.layoutVerticallyCentered(
				width,
				this.contentHeight,
				this.scroll,
			);
		else this.content.layout(width, this.contentHeight, "TOPLEFT", this.scroll);
	}
	private render(startRow = 0): void {
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.renderedRows = startRow;
		this.options.onChanged?.(false);
		const width =
			(this.width ?? this.options.width ?? 480) -
			2 * (this.options.padding ?? 12);
		const columns = this.columns ?? this.options.columns ?? 1;
		const gap = this.options.gap ?? 4;
		let top = 0;
		let column = 0;
		let lineHeight = 0;
		const positions = this.rows.map((row) => {
			if (row.heading && column > 0) {
				top += lineHeight;
				column = 0;
				lineHeight = 0;
			}
			if (row.heading) top += row.marginTop ?? 0;
			const height = row.height ?? (row.heading ? 28 : row.progress ? 60 : 48);
			const position = {
				top,
				column,
				height,
				width: row.heading ? width : (width - gap * (columns - 1)) / columns,
			};
			lineHeight = Math.max(
				lineHeight,
				height + (row.heading ? 4 : gap) + (row.marginBottom ?? 0),
			);
			column++;
			if (row.heading || column === columns) {
				top += lineHeight;
				column = 0;
				lineHeight = 0;
			}
			return position;
		});
		this.contentHeight = Math.max(1, top + lineHeight);
		this.layoutContent();
		const firstRow = this.rows.at(startRow);
		let offset =
			(positions.at(startRow)?.top ?? this.contentHeight) -
			(firstRow?.heading ? (firstRow.marginTop ?? 0) : 0);
		let cursor = startRow;
		const total = Math.max(this.rows.length, this.buttons.length);
		const step = () => {
			this.cancelRender = undefined;
			const end = Math.min(
				total,
				cursor +
					(this.options.scheduler ? (this.options.batchSize ?? 10) : total),
			);
			const start = cursor;
			this.rows.slice(start, end).forEach((row, batchIndex) => {
				const index = start + batchIndex;
				const position = positions.at(index);
				if (!position) return;
				if (columns > 1) offset = position.top;
				else if (row.heading) offset += row.marginTop ?? 0;
				const rowWidth = position.width;
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
						dimmed: false,
						top: 0,
						bottom: 0,
						frame,
						icon: new Frame(`${this.id}-icon-${index}`, this.pool),
						track: new Frame(`${this.id}-track-${index}`, this.pool),
						progress: new Frame(`${this.id}-progress-${index}`, this.pool),
						secondary,
						secondaryNav: {
							navId: `${row.id}-secondary`,
							navigationScroll: this.scroll,
							onFocus: () => {
								secondary.setFocused(true);
								this.reveal(index);
							},
							onBlur: () => secondary.setFocused(false),
							onInteract: () => {
								if (this.isReady(index))
									this.rows.at(index)?.secondary?.activate();
							},
						},
						nav: {
							navId: row.id,
							navigationScroll: this.scroll,
							onFocus: () => {
								if (this.rows.at(index)?.animatedIcon) {
									this.style(index);
									frame.setBorder([1, 0.82, 0, 1]);
									const control = this.buttons.at(index);
									if (control) control.animatedFocus = true;
								} else frame.setFocused(true);
								this.reveal(index);
							},
							onBlur: () => {
								const control = this.buttons.at(index);
								if (control?.animatedFocus) {
									frame.setBorder([0, 0, 0, 0]);
									control.animatedFocus = false;
								}
								this.style(index);
							},
							onContext: () => {
								if (this.isReady(index)) this.rows.at(index)?.context?.();
							},
							onInteract: () => {
								if (this.isReady(index)) {
									if (this.options.secure) frame.click();
									else this.rows.at(index)?.activate();
								}
							},
						},
					};
					this.buttons.push(button);
				}
				if (button.nav.navId !== row.id)
					button.nav = { ...button.nav, navId: row.id };
				button.frame.setParent(this.content);
				const rowHeight =
					row.height ?? (row.heading ? 28 : row.progress ? 60 : 48);
				if (row.animatedIcon) {
					button.animation ??= new Frame(
						`${this.id}-animation-${index}`,
						this.pool,
					);
					button.animation.setParent(button.frame);
					const size = Math.min(32, rowHeight - 4);
					button.animation.layout(size, size, "RIGHT", button.frame, -8, 0);
					button.animation.setAnimatedAtlas(row.animatedIcon);
					button.animation.show();
				} else {
					button.animation?.hide();
					if (button.animatedFocus) {
						button.frame.setBorder([0, 0, 0, 0]);
						button.animatedFocus = false;
					}
				}
				const iconSize = Math.min(36, rowHeight - 12);
				const horizontalPadding = this.options.contentPadding?.horizontal ?? 8;
				const verticalPadding = this.options.contentPadding?.vertical ?? 6;
				button.icon.setParent(button.frame);
				if (row.icon !== undefined) {
					button.icon.layout(
						iconSize,
						iconSize,
						"TOPLEFT",
						button.frame,
						this.options.contentPadding?.horizontal ?? 6,
						-verticalPadding,
					);
					button.icon.setIcon(row.icon);
					button.icon.show();
				} else button.icon.hide();
				button.secondaryNav.navId = `${row.id}-favourite`;
				if (row.secondary) {
					button.secondary.setParent(button.frame);
					button.secondary.layout(44, 40, "TOPRIGHT", button.frame, -4, -4);
					button.secondary.setButtonBackground();
					button.secondary.setLabel("label", row.secondary.label);
					button.secondary.onClick(() => {
						if (this.isReady(index)) this.rows.at(index)?.secondary?.activate();
					});
					button.secondary.show();
				} else button.secondary.hide();
				const indent = row.indent ?? 0;
				const checkboxLeft =
					row.icon === undefined
						? horizontalPadding
						: iconSize +
							(this.options.contentPadding ? horizontalPadding + 8 : 12);
				const textLeft = checkboxLeft + (row.checked === undefined ? 0 : 28);
				if (row.checked !== undefined) {
					if (!button.checkbox || !button.check) {
						button.checkbox = new Frame(
							`${this.id}-checkbox-${index}`,
							this.pool,
						);
						button.check = new Frame(`${this.id}-check-${index}`, this.pool);
					}
					button.checkbox.setParent(button.frame);
					button.checkbox.layout(
						21,
						20.3,
						"TOPLEFT",
						button.frame,
						checkboxLeft,
						-(rowHeight - 20.3) / 2,
					);
					button.checkbox.setAtlasBackground("checkbox-minimal");
					button.check.fill(button.checkbox);
					button.check.setAtlasBackground("checkmark-minimal");
					button.checkbox.show();
					if (row.checked) button.check.show();
					else button.check.hide();
				} else button.checkbox?.hide();
				const dimmed = row.enabled === false;
				if (dimmed !== button.dimmed)
					button.frame.setOpacity(dimmed ? 0.35 : 1);
				button.dimmed = dimmed;
				const textWidth =
					rowWidth -
					indent -
					textLeft -
					horizontalPadding -
					(row.secondary ? 48 : 0) -
					(row.animatedIcon ? 40 : 0);
				const trailingWidth = row.trailingLabel
					? row.trailingLabel.length * (row.fontSize ?? 14) * 0.65 + 8
					: 0;
				const centeredLabel =
					!row.trailingOnFirstLine &&
					(row.trailingLabel ||
						(this.options.centerSingleLine &&
							!row.heading &&
							!row.detail &&
							!row.progress));
				if (row.progress) {
					const horizontal = this.options.progressInset?.horizontal ?? 0;
					const progressWidth = Math.max(
						0,
						(this.options.edgeProgress ? rowWidth - indent : textWidth) -
							2 * horizontal,
					);
					button.track.setParent(button.frame);
					button.track.layout(
						progressWidth,
						6,
						"BOTTOMLEFT",
						button.frame,
						(this.options.edgeProgress ? 0 : textLeft) + horizontal,
						this.options.progressInset?.bottom ??
							(this.options.edgeProgress ? 0 : 6),
					);
					button.track.setColor(0.025, 0.025, 0.025);
					button.track.show();
					const value = Math.max(0, Math.min(1, row.progress.value));
					if (value > 0) {
						button.progress.setParent(button.track);
						button.progress.layout(
							progressWidth * value,
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
				button.top = offset;
				button.bottom = offset + rowHeight;
				button.frame.layout(
					rowWidth - indent,
					rowHeight,
					"TOPLEFT",
					this.content,
					indent + position.column * (rowWidth + gap),
					-offset,
				);
				offset += rowHeight + (row.heading ? 4 : gap) + (row.marginBottom ?? 0);
				button.frame.setLabel(
					"label",
					row.label,
					centeredLabel ? "LEFT" : "TOPLEFT",
					textLeft,
					centeredLabel ? 0 : -verticalPadding,
					row.fontSize ?? (row.heading ? 18 : 14),
					Math.max(1, textWidth - trailingWidth),
				);
				button.frame.setLabel(
					"trailing",
					row.trailingLabel ?? "",
					row.trailingOnFirstLine ? "TOPRIGHT" : "RIGHT",
					row.secondary ? -56 : -horizontalPadding,
					row.trailingOnFirstLine ? -verticalPadding : 0,
					row.fontSize ?? 14,
					trailingWidth,
				);
				button.frame.setLabel(
					"detail",
					row.detail ?? "",
					"BOTTOMLEFT",
					textLeft,
					row.progress ? 18 : verticalPadding,
					12,
					textWidth,
				);
				button.frame.setLabelWordWrap("detail", columns === 1);
				if (columns > 1) {
					button.frame.setLabelWordWrap("label", row.wrapLabel ?? false);
				}
				if (this.options.autoHeight && columns === 1 && !row.heading) {
					button.frame.setLabelWordWrap("label", true);
					const minimum = rowHeight;
					const height = Math.max(
						minimum,
						button.frame.labelHeight("label") +
							(row.detail ? button.frame.labelHeight("detail") + 14 : 16),
					);
					const extra = height - minimum;
					button.bottom += extra;
					offset += extra;
					this.contentHeight += extra;
					button.frame.layout(
						width - indent,
						height,
						"TOPLEFT",
						this.content,
						indent,
						-button.top,
					);
				}
				button.frame.setTooltip(row.tooltip ?? row.label);
				if (this.options.secure) button.frame.setSpell(row.spell);
				else
					button.frame.onClick((mouseButton) => {
						if (this.isReady(index) && mouseButton === "LeftButton")
							this.rows.at(index)?.activate();
					});
				this.style(index);
				button.frame.show();
			});
			for (
				let index = Math.max(start, this.rows.length);
				index < end;
				index++
			) {
				this.buttons.at(index)?.animation?.hide();
				this.buttons.at(index)?.frame.hide();
			}
			this.renderedRows = Math.min(end, this.rows.length);
			cursor = end;
			if (cursor < total && this.options.scheduler)
				this.cancelRender = this.options.scheduler.nextFrame(step);
			else {
				if (this.options.autoHeight) this.layoutContent();
				this.scroll.clampScroll();
				this.dirty = false;
			}
			this.options.onChanged?.(!this.dirty);
		};
		if (this.options.scheduler)
			this.cancelRender = this.options.scheduler.nextFrame(step);
		else step();
	}
	private style(index: number): void {
		const row = this.rows.at(index);
		const frame = this.buttons.at(index)?.frame;
		frame?.setFocused(false);
		if (
			row?.heading ||
			row?.checked !== undefined ||
			row?.background === false
		) {
			frame?.setColor(0, 0, 0, 0);
			return;
		}
		if (row?.backgroundAtlas) {
			if (row.backgroundTint)
				frame?.setAtlasBackground(row.backgroundAtlas, row.backgroundTint);
			else frame?.setAtlasBackground(row.backgroundAtlas);
		} else if (row?.background) frame?.setColor(...row.background);
		else frame?.setButtonBackground(row?.selected ?? false);
	}
	private reveal(index: number): void {
		const button = this.buttons.at(index);
		if (button && this.mounted)
			this.scroll.revealVerticalRange(
				button.top,
				button.bottom,
				this.contentHeight,
			);
	}
	revealRow(id: string): void {
		const index = this.rows.findIndex((row) => row.id === id);
		if (index >= 0 && index < this.renderedRows) this.reveal(index);
	}
	private isReady(index: number): boolean {
		return (
			this.mounted &&
			index < this.renderedRows &&
			!this.rows.at(index)?.heading &&
			this.rows.at(index)?.enabled !== false
		);
	}
	unmount(): void {
		for (const button of this.buttons) button.animation?.hide();
		this.mounted = false;
		this.cancelRender?.();
		this.cancelRender = undefined;
		if (this.options.verticallyCentered) this.scroll.onSizeChanged();
		this.frame.hide();
	}
	getNavGrid(): INavigable[][] {
		if (!this.mounted) return [];
		const columns = this.columns ?? this.options.columns ?? 1;
		if (this.mounted && columns > 1) {
			const grid: INavigable[][] = [];
			let line: INavigable[] = [];
			let column = 0;
			for (let index = 0; index < this.renderedRows; index++) {
				const row = this.rows.at(index);
				if (row?.heading) {
					if (line.length > 0) grid.push(line);
					line = [];
					column = 0;
					continue;
				}
				const button = this.buttons.at(index);
				if (button && row?.enabled !== false) {
					button.nav.navColumn = column;
					line.push(button.nav);
				}
				column++;
				if (column === columns) {
					if (line.length > 0) grid.push(line);
					line = [];
					column = 0;
				}
			}
			if (line.length > 0) grid.push(line);
			return grid;
		}
		for (const button of this.buttons.slice(0, this.renderedRows)) {
			button.nav.navColumn = 0;
			button.secondaryNav.navColumn = 1;
		}
		return this.mounted
			? this.buttons
					.slice(0, this.renderedRows)
					.flatMap((button, index) =>
						this.rows.at(index)?.heading ||
						this.rows.at(index)?.enabled === false
							? []
							: [
									this.rows.at(index)?.secondary
										? [button.nav, button.secondaryNav]
										: [button.nav],
								],
					)
			: [];
	}
	destroy(): void {
		this.unmount();
		for (const button of this.buttons) {
			button.animation?.destroy();
			button.check?.destroy();
			button.checkbox?.destroy();
			button.progress.destroy();
			button.track.destroy();
			button.secondary.destroy();
			button.icon.destroy();
			button.frame.destroy();
		}
		this.buttons.length = 0;
		this.scroll.destroy();
		this.content.destroy();
		this.frame.destroy();
	}
}
