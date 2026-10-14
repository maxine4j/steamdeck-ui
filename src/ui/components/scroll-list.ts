import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import {
	type AnimatedAtlas,
	Frame,
	type IconRing,
	type TextureRegion,
} from "./frame";
import type { TooltipContent } from "./tooltip-content";
import type { IUIComponent } from "./types";
import { setWindowTitle } from "./window-title";

export interface ListRow {
	readonly id: string;
	readonly label: string;
	readonly heading?: boolean;
	/** Occupy a whole line within a multi-column list. */
	readonly fullWidth?: boolean;
	readonly icon?: number | string;
	readonly iconSize?: number;
	readonly iconRing?: IconRing;
	/** Shared artwork container for consecutive rows in a section. */
	readonly group?: {
		readonly id: string;
		readonly texture: number | string;
		readonly cover?: TextureRegion;
	};
	readonly spell?: number;
	readonly secondary?: {
		label: string;
		width?: number;
		height?: number;
		enabled?: boolean;
		/** Use this button as the row's sole mouse and controller action. */
		onlyAction?: boolean;
		tooltip?: string;
		activate(): void;
	};
	readonly detail?: string;
	readonly hoverDetail?: string;
	readonly height?: number;
	readonly trailingLabel?: string;
	readonly trailingOnFirstLine?: boolean;
	readonly trailingOnSecondLine?: boolean;
	readonly tooltip?: string;
	readonly tooltipContent?: TooltipContent;
	readonly selected?: boolean;
	readonly animatedIcon?: AnimatedAtlas;
	readonly animatedIconOnDetail?: boolean;
	readonly checked?: boolean;
	readonly checkAtlas?: string;
	readonly enabled?: boolean;
	readonly fontSize?: number;
	readonly wrapLabel?: boolean;
	readonly indent?: number;
	/** Extra space above a full-width heading. */
	readonly marginTop?: number;
	readonly marginBottom?: number;
	readonly background?: readonly [number, number, number] | false;
	readonly backgroundAtlas?: string;
	readonly backgroundTexture?: {
		readonly file: number | string;
		readonly coords: readonly [number, number, number, number];
	};
	readonly backgroundSlice?: number;
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
		iconRing?: boolean;
		track: Frame;
		progress: Frame;
		secondary: Frame;
		checkbox?: Frame;
		check?: Frame;
		animation?: Frame;
		animatedFocus?: boolean;
		focused?: boolean;
		hovered?: boolean;
		detailLayout?: { point: string; x: number; y: number; width: number };
		dimmed: boolean;
		tooltipContent?: TooltipContent;
		secondaryNav: INavigable;
		nav: INavigable;
		top: number;
		bottom: number;
	}[] = [];
	private rows: readonly ListRow[] = [];
	private readonly groups: Frame[] = [];
	private mounted = false;
	private dirty = true;
	private cancelRender?: () => void;
	private pendingUpdate = false;
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
			readonly viewportRight?: number;
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
			readonly progressTextures?: { fill: string; track: string };
			readonly contentPadding?: { horizontal: number; vertical: number };
			readonly centerSingleLine?: boolean;
			readonly buttonWidth?: number;
			readonly centerText?: boolean;
			readonly centerLabelsVertically?: boolean;
			readonly centerContent?: boolean;
			readonly textColor?: readonly [number, number, number];
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
	/** Measured row content, independent of the visible scrolling viewport. */
	getContentHeight(): number {
		return this.contentHeight;
	}
	setTitle(title: string): void {
		this.title = title;
		if (this.mounted) setWindowTitle(this.frame, title);
	}
	resetScroll(): void {
		this.scroll.resetScroll();
	}
	scrollBy(delta: number): void {
		this.scroll.scrollBy(delta);
	}
	setRows(rows: readonly ListRow[]): void {
		this.pendingUpdate = false;
		const preserve =
			rows.length >= this.rows.length &&
			this.rows.every((row, index) => row === rows.at(index));
		this.rows = rows;
		this.dirty = true;
		if (this.mounted) this.render(preserve ? this.renderedRows : 0);
	}
	/** Update existing controls without withdrawing their navigation readiness. */
	updateRows(rows: readonly ListRow[]): void {
		const samePrefixLayout = this.rows
			.slice(0, Math.min(rows.length, this.rows.length))
			.every((row, index) => {
				const next = rows.at(index);
				return (
					next?.id === row.id &&
					next.heading === row.heading &&
					next.fullWidth === row.fullWidth &&
					next.height === row.height &&
					(next.progress !== undefined) === (row.progress !== undefined) &&
					next.indent === row.indent &&
					next.enabled === row.enabled &&
					next.secondary?.enabled === row.secondary?.enabled &&
					(next.secondary !== undefined) === (row.secondary !== undefined) &&
					next.secondary?.onlyAction === row.secondary?.onlyAction
				);
			});
		if (!samePrefixLayout) {
			this.setRows(rows);
			return;
		}
		this.rows = rows;
		this.dirty = true;
		if (!this.mounted) return;
		if (this.cancelRender) this.pendingUpdate = true;
		else this.render(0, true);
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
		setWindowTitle(this.frame, this.title);
		const padding = this.options.padding;
		this.scroll.inset(
			this.frame,
			padding ?? 12,
			this.options.top ?? (padding === undefined ? 52 : 40 + padding),
			this.options.viewportRight ?? padding ?? 12,
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
		else
			this.content.layout(
				width,
				this.contentHeight,
				this.options.centerContent ? "TOP" : "TOPLEFT",
				this.scroll,
			);
	}
	private render(startRow = 0, retainReady = false): void {
		this.cancelRender?.();
		this.cancelRender = undefined;
		const readyRows = retainReady
			? Math.min(this.renderedRows, this.rows.length)
			: startRow;
		this.renderedRows = readyRows;
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
			const fullWidth = row.heading || row.fullWidth;
			if (fullWidth && column > 0) {
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
				width: fullWidth ? width : (width - gap * (columns - 1)) / columns,
			};
			lineHeight = Math.max(
				lineHeight,
				height + (row.heading ? 4 : gap) + (row.marginBottom ?? 0),
			);
			column++;
			if (fullWidth || column === columns) {
				top += lineHeight;
				column = 0;
				lineHeight = 0;
			}
			return position;
		});
		this.contentHeight = Math.max(1, top + lineHeight);
		this.layoutContent();
		const groupLayouts = new Map<
			string,
			{
				top: number;
				bottom: number;
				texture: number | string;
				cover?: TextureRegion;
			}
		>();
		this.rows.forEach((row, index) => {
			const position = positions.at(index);
			if (!row.group || !position) return;
			const existing = groupLayouts.get(row.group.id);
			if (existing) existing.bottom = position.top + position.height;
			else
				groupLayouts.set(row.group.id, {
					top: position.top,
					bottom: position.top + position.height,
					texture: row.group.texture,
					cover: row.group.cover,
				});
		});
		const groupFrames = new Map<string, Frame>();
		let groupIndex = 0;
		for (const [id, layout] of groupLayouts) {
			let frame = this.groups.at(groupIndex);
			if (!frame) {
				frame = new Frame(`${this.id}-group-${groupIndex}`, this.pool);
				this.groups.push(frame);
			}
			frame.setParent(this.content);
			frame.layout(
				width,
				layout.bottom - layout.top,
				"TOPLEFT",
				this.content,
				0,
				-layout.top,
			);
			if (layout.cover)
				frame.setCoverTextureBackground(layout.texture, layout.cover);
			else frame.setTextureBackground(layout.texture, [0, 1, 0, 1]);
			frame.setBorder([0.45, 0.4, 0.3, 1], 1);
			frame.show();
			groupFrames.set(id, frame);
			groupIndex++;
		}
		for (const frame of this.groups.slice(groupIndex)) frame.hide();
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
				const rowWidth = row.heading
					? position.width
					: Math.min(
							position.width,
							this.options.buttonWidth ?? position.width,
						);
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
							onFocus: (refresh) => {
								if (refresh) secondary.setFocused(true, false, true);
								else secondary.setFocused(true);
								if (!refresh) this.reveal(index);
								const tooltip = this.rows.at(index)?.secondary?.tooltip;
								if (tooltip !== undefined && tooltip !== "")
									secondary.showTooltip({ text: tooltip });
							},
							onBlur: () => {
								secondary.setFocused(false);
								secondary.hideTooltip();
							},
							onInteract: () => {
								if (
									this.isReady(index) &&
									this.rows.at(index)?.secondary?.enabled !== false
								)
									this.rows.at(index)?.secondary?.activate();
							},
						},
						nav: {
							navId: row.id,
							navigationScroll: this.scroll,
							onFocus: (refresh) => {
								const focused = this.buttons.at(index);
								if (focused) focused.focused = true;
								if (this.rows.at(index)?.animatedIcon) {
									this.style(index);
									frame.setBorder([1, 0.82, 0, 1]);
									const control = this.buttons.at(index);
									if (control) control.animatedFocus = true;
								}
								if (refresh) frame.setFocused(true, false, true);
								else frame.setFocused(true);
								if (!refresh) this.reveal(index);
								const tooltip = this.rows.at(index)?.tooltipContent;
								if (tooltip !== undefined) frame.showTooltip(tooltip);
								this.updateDetail(index);
							},
							onBlur: () => {
								const control = this.buttons.at(index);
								if (control) control.focused = false;
								if (control?.animatedFocus) {
									frame.setBorder([0, 0, 0, 0]);
									control.animatedFocus = false;
								}
								this.style(index);
								this.updateDetail(index);
								if (this.rows.at(index)?.tooltipContent !== undefined)
									frame.hideTooltip();
							},
							onContext: () => {
								if (this.isReady(index)) this.rows.at(index)?.context?.();
							},
							onInteract: () => {
								if (
									this.isReady(index) &&
									!this.rows.at(index)?.secondary?.onlyAction
								) {
									if (this.options.secure) frame.click();
									else this.rows.at(index)?.activate();
								}
							},
						},
					};
					this.buttons.push(button);
				}
				if (button.nav.navId !== row.id) {
					button.focused = false;
					button.hovered = false;
					button.nav = { ...button.nav, navId: row.id };
				}
				if (
					button.tooltipContent !== undefined &&
					button.tooltipContent !== row.tooltipContent
				)
					button.frame.hideTooltip();
				button.tooltipContent = row.tooltipContent;
				button.frame.setParent(
					row.group
						? (groupFrames.get(row.group.id) ?? this.content)
						: this.content,
				);
				const rowHeight =
					row.height ?? (row.heading ? 28 : row.progress ? 60 : 48);
				const horizontalPadding = this.options.contentPadding?.horizontal ?? 8;
				const verticalPadding = this.options.contentPadding?.vertical ?? 6;
				const actionOnly = row.secondary?.onlyAction === true;
				const secondarySpace = row.secondary
					? (row.secondary.width ?? 44) + (actionOnly ? horizontalPadding : 4)
					: 0;
				if (row.animatedIcon) {
					button.animation ??= new Frame(
						`${this.id}-animation-${index}`,
						this.pool,
					);
					button.animation.setParent(button.frame);
					const size = Math.min(
						row.animatedIconOnDetail ? 20 : 32,
						rowHeight - 4,
					);
					button.animation.layout(
						size,
						size,
						row.animatedIconOnDetail ? "BOTTOMRIGHT" : "RIGHT",
						button.frame,
						-8 - (actionOnly ? secondarySpace : 0),
						row.animatedIconOnDetail
							? (this.options.contentPadding?.vertical ?? 6) - 2
							: 0,
					);
					button.animation.setAnimatedAtlas(row.animatedIcon);
					button.animation.show();
				} else {
					button.animation?.hide();
					if (button.animatedFocus) {
						button.frame.setBorder([0, 0, 0, 0]);
						button.animatedFocus = false;
					}
				}
				const iconSize = Math.min(row.iconSize ?? 36, rowHeight - 12);
				button.icon.setParent(button.frame);
				if (row.icon !== undefined) {
					button.icon.layout(
						iconSize,
						iconSize,
						this.options.centerLabelsVertically ? "LEFT" : "TOPLEFT",
						button.frame,
						this.options.contentPadding?.horizontal ?? 6,
						this.options.centerLabelsVertically ? 0 : -verticalPadding,
					);
					button.icon.setIcon(row.icon);
					button.icon.show();
				} else button.icon.hide();
				if (row.iconRing || button.iconRing) {
					button.icon.setIconRing(row.iconRing);
					button.iconRing = row.iconRing !== undefined;
				}
				button.secondaryNav.navId = actionOnly ? row.id : `${row.id}-favourite`;
				if (row.secondary) {
					button.secondary.setParent(button.frame);
					button.secondary.layout(
						row.secondary.width ?? 44,
						row.secondary.height ?? 40,
						actionOnly ? "RIGHT" : "TOPRIGHT",
						button.frame,
						actionOnly ? -horizontalPadding : -4,
						actionOnly ? 0 : -4,
					);
					button.secondary.setButtonBackground();
					button.secondary.setOpacity(
						row.secondary.enabled === false ? 0.35 : 1,
					);
					button.secondary.setLabel("label", row.secondary.label);
					if (
						row.secondary.onlyAction &&
						(row.secondary.tooltip === undefined ||
							row.secondary.tooltip === "")
					)
						button.secondary.clearTooltip();
					else
						button.secondary.setTooltip(
							row.secondary.tooltip ?? row.secondary.label,
						);
					button.secondary.onClick((mouse) => {
						if (
							this.isReady(index) &&
							this.rows.at(index)?.secondary?.enabled !== false &&
							(!this.rows.at(index)?.secondary?.onlyAction ||
								mouse === "LeftButton")
						)
							this.rows.at(index)?.secondary?.activate();
					});
					button.secondary.show();
				} else {
					button.secondary.setFocused(false);
					button.secondary.hideTooltip();
					button.secondary.hide();
				}
				const indent = row.indent ?? 0;
				const checkboxLeft =
					row.icon === undefined
						? horizontalPadding
						: iconSize +
							Math.max(0, ((row.iconRing?.size ?? iconSize) - iconSize) / 2) +
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
					button.check.setAtlasBackground(
						row.checkAtlas ?? "checkmark-minimal",
					);
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
					secondarySpace -
					(row.animatedIcon && !row.animatedIconOnDetail ? 40 : 0);
				const trailingWidth = row.trailingLabel
					? row.trailingLabel.length * (row.fontSize ?? 14) * 0.65 + 8
					: 0;
				const centeredLabel =
					!row.trailingOnFirstLine &&
					!row.trailingOnSecondLine &&
					(row.trailingLabel ||
						(this.options.centerSingleLine &&
							!row.heading &&
							!row.detail &&
							!row.progress));
				const centerText = this.options.centerText && !row.heading;
				const twoLines =
					row.detail !== undefined || row.hoverDetail !== undefined;
				const verticallyCentered =
					this.options.centerLabelsVertically && !row.heading;
				const stackedLabels =
					(row.detail !== undefined && row.detail !== "") ||
					row.hoverDetail !== undefined;
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
					if (this.options.progressTextures)
						button.track.setAtlasBackground(
							this.options.progressTextures.track,
						);
					else button.track.setColor(0.025, 0.025, 0.025);
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
						if (this.options.progressTextures)
							button.progress.setAtlasBackground(
								this.options.progressTextures.fill,
								row.progress.color,
							);
						else button.progress.setColor(...row.progress.color);
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
					indent +
						position.column * (position.width + gap) +
						(position.width - rowWidth) / 2,
					-offset,
				);
				offset += rowHeight + (row.heading ? 4 : gap) + (row.marginBottom ?? 0);
				button.frame.setLabel(
					"label",
					row.label,
					verticallyCentered
						? "LEFT"
						: centerText
							? twoLines
								? "TOP"
								: "CENTER"
							: centeredLabel
								? "LEFT"
								: "TOPLEFT",
					centerText
						? secondarySpace > 0
							? -secondarySpace / 2
							: 0
						: textLeft,
					verticallyCentered
						? stackedLabels
							? 8
							: 0
						: centerText
							? twoLines
								? -verticalPadding
								: 0
							: centeredLabel
								? 0
								: -verticalPadding,
					row.fontSize ?? (row.heading ? 18 : 14),
					Math.max(
						1,
						textWidth - (row.trailingOnSecondLine ? 0 : trailingWidth),
					),
				);
				button.frame.setLabel(
					"trailing",
					row.trailingLabel ?? "",
					row.trailingOnFirstLine || row.trailingOnSecondLine
						? "TOPRIGHT"
						: "RIGHT",
					row.secondary ? -56 : -horizontalPadding,
					row.trailingOnSecondLine
						? -verticalPadding - (row.fontSize ?? 14) - 8
						: row.trailingOnFirstLine
							? -verticalPadding
							: 0,
					row.fontSize ?? 14,
					trailingWidth,
				);
				button.detailLayout = {
					point: verticallyCentered
						? "LEFT"
						: centerText
							? "BOTTOM"
							: "BOTTOMLEFT",
					x: centerText
						? -secondarySpace / 2 + (row.animatedIconOnDetail ? -14 : 0)
						: textLeft,
					y: verticallyCentered
						? -((row.fontSize ?? 14) + 4) / 2
						: row.progress
							? 18
							: verticalPadding,
					width: textWidth - (row.animatedIconOnDetail ? 28 : 0),
				};
				this.updateDetail(index);
				button.frame.setLabelWordWrap("detail", columns === 1);
				if (this.options.textColor) {
					button.frame.setLabelStyle("label", this.options.textColor);
					button.frame.setLabelStyle("detail", this.options.textColor);
				}
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
				button.frame.setTooltip(
					row.tooltip ?? row.label,
					undefined,
					true,
					row.hoverDetail === undefined
						? undefined
						: (hovered) => {
								if (!this.mounted) return;
								const control = this.buttons.at(index);
								if (control) control.hovered = hovered;
								this.updateDetail(index);
							},
				);
				if (row.tooltipContent !== undefined)
					button.frame.setHoverTooltip(
						() => this.rows.at(index)?.tooltipContent,
					);
				if (this.options.secure) button.frame.setSpell(row.spell);
				else
					button.frame.onClick((mouseButton) => {
						if (
							this.isReady(index) &&
							mouseButton === "LeftButton" &&
							!this.rows.at(index)?.secondary?.onlyAction
						)
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
			this.renderedRows = Math.max(readyRows, Math.min(end, this.rows.length));
			cursor = end;
			if (cursor < total && this.options.scheduler)
				this.cancelRender = this.options.scheduler.nextFrame(step);
			else {
				if (this.options.autoHeight) this.layoutContent();
				this.scroll.clampScroll();
				this.dirty = false;
			}
			this.options.onChanged?.(!this.dirty);
			if (!this.dirty && this.pendingUpdate) {
				this.pendingUpdate = false;
				this.render(0, true);
			}
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
			(row?.checked !== undefined &&
				!row.backgroundAtlas &&
				!row.backgroundTexture) ||
			row?.background === false
		) {
			frame?.setColor(0, 0, 0, 0);
			return;
		}
		if (row?.backgroundTexture) {
			frame?.setTextureBackground(
				row.backgroundTexture.file,
				row.backgroundTexture.coords,
			);
		} else if (row?.backgroundAtlas) {
			if (row.backgroundSlice !== undefined)
				frame?.setAtlasBackground(
					row.backgroundAtlas,
					row.backgroundTint,
					row.backgroundSlice,
				);
			else if (row.backgroundTint)
				frame?.setAtlasBackground(row.backgroundAtlas, row.backgroundTint);
			else frame?.setAtlasBackground(row.backgroundAtlas);
		} else if (row?.background) frame?.setColor(...row.background);
		else frame?.setButtonBackground(row?.selected ?? false);
	}
	private updateDetail(index: number): void {
		const row = this.rows.at(index);
		const button = this.buttons.at(index);
		const layout = button?.detailLayout;
		if (!row || !button || !layout) return;
		const detail =
			(this.isReady(index) && (button.focused || button.hovered)
				? row.hoverDetail
				: undefined) ??
			row.detail ??
			"";
		button.frame.setLabel(
			"detail",
			detail,
			layout.point,
			layout.x,
			layout.y,
			12,
			layout.width,
		);
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
		for (const [index, button] of this.buttons.entries()) {
			button.secondary.hideTooltip();
			button.focused = false;
			button.hovered = false;
			this.updateDetail(index);
			button.animation?.hide();
			if (this.rows.at(index)?.tooltipContent !== undefined)
				button.frame.hideTooltip();
		}
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
				if (row?.fullWidth && column > 0) {
					if (line.length > 0) grid.push(line);
					line = [];
					column = 0;
				}
				const button = this.buttons.at(index);
				if (
					button &&
					row?.enabled !== false &&
					!(row?.secondary?.onlyAction && row.secondary.enabled === false)
				) {
					const nav = row?.secondary?.onlyAction
						? button.secondaryNav
						: button.nav;
					nav.navColumn = column;
					line.push(nav);
				}
				column++;
				if (row?.fullWidth || column === columns) {
					if (line.length > 0) grid.push(line);
					line = [];
					column = 0;
				}
			}
			if (line.length > 0) grid.push(line);
			return grid;
		}
		for (const [index, button] of this.buttons
			.slice(0, this.renderedRows)
			.entries()) {
			button.nav.navColumn = 0;
			button.secondaryNav.navColumn = this.rows.at(index)?.secondary?.onlyAction
				? 0
				: 1;
		}
		return this.mounted
			? this.buttons
					.slice(0, this.renderedRows)
					.flatMap((button, index) =>
						this.rows.at(index)?.heading ||
						this.rows.at(index)?.enabled === false ||
						(this.rows.at(index)?.secondary?.onlyAction &&
							this.rows.at(index)?.secondary?.enabled === false)
							? []
							: [
									this.rows.at(index)?.secondary?.onlyAction
										? [button.secondaryNav]
										: this.rows.at(index)?.secondary
											? this.rows.at(index)?.secondary?.enabled === false
												? [button.nav]
												: [button.nav, button.secondaryNav]
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
		for (const group of this.groups) group.destroy();
		this.groups.length = 0;
		this.scroll.destroy();
		this.content.destroy();
		this.frame.destroy();
	}
}
