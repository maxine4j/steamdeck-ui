import type { WowFontString, WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { type BorderColor, setBorder } from "./border";
import { FocusArrival } from "./focus-arrival";
import type { GamePadRepeatOptions } from "./gamepad-input";
import { IconFocus } from "./icon-focus";
import type { NativeDropdownButton } from "./native-menu";
import { drawScrollIndicator } from "./scroll-indicator";
import { ScrollPan } from "./scroll-pan";
import {
	type ClickBinding,
	SecureClickBindings,
} from "./secure-click-bindings";
import { applySideTabSkin } from "./side-tab-skin";
import { applyButtonSkin, applyIconOutline, applyWindowSkin } from "./skin";
import {
	setTooltipContent,
	type TooltipContent,
	type TooltipDataFrame,
} from "./tooltip-content";
import type { IUIComponent } from "./types";

declare function SearchBoxTemplate_OnTextChanged(
	this: void,
	frame: WowFrame,
): void;

type ItemTooltipFrame = WowFrame &
	TooltipDataFrame & {
		SetOwner(owner: WowFrame, anchor: string): void;
		SetHyperlink(link: string): void;
		ClearLines(): void;
		SetScale(scale: number): void;
		IsEmbedded: boolean;
		NineSlice: { SetAlpha(alpha: number): void };
		TopOverlay: { SetAlpha(alpha: number): void };
		BottomOverlay: { SetAlpha(alpha: number): void };
	};

export interface AnimatedAtlas {
	readonly atlas: string;
	readonly rows: number;
	readonly columns: number;
	readonly frames: number;
	readonly duration: number;
}
export interface IconRing {
	readonly atlas: string;
	readonly size: number;
	readonly maskAtlas: string;
}
interface FlipbookAnimation {
	SetDuration(seconds: number): void;
	SetOrder(order: number): void;
	SetFlipBookRows(rows: number): void;
	SetFlipBookColumns(columns: number): void;
	SetFlipBookFrames(frames: number): void;
}
interface AtlasAnimationGroup {
	CreateAnimation(type: "FlipBook"): FlipbookAnimation;
	SetLooping(mode: "REPEAT"): void;
	Play(): void;
	Stop(): void;
	IsPlaying(): boolean;
}

type SlicedTexture = WowTexture & {
	SetTextureSliceMargins(
		left: number,
		top: number,
		right: number,
		bottom: number,
	): void;
	SetTextureSliceMode(mode: number): void;
	ClearTextureSlice(): void;
};

export class Frame implements IUIComponent {
	private focusArrival?: FocusArrival;
	private atlasSliced = false;
	private simpleTooltipHovered = false;
	private iconFocus?: IconFocus;
	private animation?: AtlasAnimationGroup;
	private flipbook?: FlipbookAnimation;
	private animatedAtlas?: AnimatedAtlas;
	private native?: WowFrame;
	private scrollIndicator?: WowTexture;
	private scrollPan?: ScrollPan;
	private lastRevealTop?: number;
	private revealingUp = false;
	private parent?: Frame;
	private cancelledSecureType?: string;
	private cancelledSecureClick = false;
	private sizeChanged?: (this: void) => void;
	private clickBindings?: SecureClickBindings;
	private hoverTooltipConfigured = false;
	private hoverTooltip?: Frame;
	private docked = false;
	private mouseShield = false;
	private closeName?: string;
	private gamePadInputConfigured = false;
	private readonly heldGamePadButtons = new Map<string, number>();
	private opacityChanged = false;
	private texture?: WowTexture;
	private textureTinted = false;
	private buttonSkinned = false;
	private iconRing = false;
	private focusBorder?: WowFrame & { SetFrameLevel(level: number): void };
	private readonly labels = new Map<string, WowFontString>();
	private readonly labelState = new Map<
		string,
		{
			text: string;
			point: string;
			x: number;
			y: number;
			size: number;
			width: number;
		}
	>();
	constructor(
		public readonly id: string,
		private readonly pool: IFramePoolManager,
		private readonly frameType:
			| "FilterDropdown"
			| "GameTooltip"
			| "Frame"
			| "Button"
			| "SecureButton"
			| "Cooldown"
			| "EditBox"
			| "SearchBox"
			| "ScrollFrame"
			| "PlayerModel" = "Frame",
	) {}
	/** Native menu access is restricted to the generic dropdown component. */
	getDropdownButton(): NativeDropdownButton {
		return this.acquire() as NativeDropdownButton;
	}
	private acquire(): WowFrame {
		if (!this.native) {
			this.native = this.pool.acquire(this.frameType);
			this.texture = this.pool.getBackground(this.native);
		}
		return this.native;
	}
	layout(
		width: number,
		height: number,
		point = "CENTER",
		parent?: Frame,
		x = 0,
		y = 0,
	): void {
		const native = this.acquire();
		native.ClearAllPoints();
		native.SetSize(width, height);
		native.SetPoint(point, parent?.acquire(), point, x, y);
	}
	layoutVerticallyCentered(width: number, height: number, parent: Frame): void {
		const native = parent.acquire() as WowFrame & { GetHeight(): number };
		const offset = Math.max(0, (native.GetHeight() - height) / 2);
		this.layout(width, height, "TOPLEFT", parent, 0, -offset);
	}
	onSizeChanged(callback?: (this: void) => void): void {
		this.sizeChanged = callback;
		const native = this.acquire() as WowFrame & {
			SetScript(script: "OnSizeChanged", handler?: (this: void) => void): void;
		};
		native.SetScript(
			"OnSizeChanged",
			this.scrollIndicator
				? () => {
						this.updateScrollIndicator();
						callback?.();
					}
				: callback,
		);
	}
	/** Use the standard Escape-close registry; OnHide also keeps owner state in sync. */
	onClose(callback: (this: void) => void): void {
		const native = this.acquire() as WowFrame & {
			SetScript(script: "OnHide", handler?: (this: void) => void): void;
		};
		if (!this.closeName) {
			this.closeName = `SteamDeckUIClose-${this.id}`;
			(_G as unknown as Record<string, WowFrame | undefined>)[this.closeName] =
				native;
			UISpecialFrames.push(this.closeName);
		}
		native.SetScript("OnHide", callback);
	}
	dock(
		position: "left" | "right" | "fullscreen",
		width: number,
		inset = 0,
	): void {
		const native = this.acquire();
		native.SetFrameStrata("DIALOG");
		this.docked = true;
		native.ClearAllPoints();
		native.SetSize(position === "fullscreen" ? 0 : width, 0);
		const edge = position === "right" ? "RIGHT" : "LEFT";
		native.SetPoint(
			`TOP${edge}`,
			undefined,
			`TOP${edge}`,
			inset,
			inset !== 0 ? -inset : 0,
		);
		native.SetPoint(
			position === "fullscreen" ? "BOTTOMRIGHT" : `BOTTOM${edge}`,
			undefined,
			position === "fullscreen" ? "BOTTOMRIGHT" : `BOTTOM${edge}`,
			position === "fullscreen" && inset !== 0 ? -inset : inset,
			inset,
		);
	}
	/** Screen-sized mouse shield, above the docked containers. */
	modalBackdrop(): void {
		this.dock("fullscreen", 0);
		const native = this.acquire() as WowFrame & {
			EnableMouse(enabled: boolean): void;
		};
		this.setModalLayer();
		native.EnableMouse(true);
		this.mouseShield = true;
	}
	setModalLayer(): void {
		this.acquire().SetFrameStrata("FULLSCREEN_DIALOG");
		this.docked = true;
	}
	fill(parent: Frame): void {
		this.setParent(parent);
		const native = this.acquire();
		native.ClearAllPoints();
		native.SetPoint("TOPLEFT", parent.acquire(), "TOPLEFT", 0, 0);
		native.SetPoint("BOTTOMRIGHT", parent.acquire(), "BOTTOMRIGHT", 0, 0);
	}
	getFrameLevel(): number {
		return (
			this.acquire() as WowFrame & { GetFrameLevel(): number }
		).GetFrameLevel();
	}
	/** Generic existing-frame hosting; domain code never receives our native frame. */
	anchorExisting(
		native: WowFrame,
		insets: readonly [number, number, number, number],
		reparent = false,
		anchors?: readonly (readonly [string, string, number, number])[],
	): void {
		const parent = this.acquire();
		if (reparent) native.SetParent(parent);
		const [left, top, right, bottom] = insets;
		native.ClearAllPoints();
		if (anchors) {
			for (const [point, relativePoint, x, y] of anchors)
				native.SetPoint(point, parent, relativePoint, x, y);
			return;
		}
		native.SetPoint("TOPLEFT", parent, "TOPLEFT", left, top !== 0 ? -top : 0);
		native.SetPoint(
			"BOTTOMRIGHT",
			parent,
			"BOTTOMRIGHT",
			right !== 0 ? -right : 0,
			bottom,
		);
	}
	inset(
		parent: Frame,
		left: number,
		top: number,
		right: number,
		bottom: number,
	): void {
		this.setParent(parent);
		const native = this.acquire();
		native.ClearAllPoints();
		native.SetPoint("TOPLEFT", parent.acquire(), "TOPLEFT", left, -top);
		native.SetPoint(
			"BOTTOMRIGHT",
			parent.acquire(),
			"BOTTOMRIGHT",
			-right,
			bottom,
		);
	}
	setScrollContent(content: Frame): void {
		const native = this.acquire();
		native.SetScrollChild(content.acquire());
		this.scrollIndicator = this.pool.getDecoration(native, "scroll-indicator");
		const scroll = native as WowFrame & {
			SetScript(
				script: "OnVerticalScroll" | "OnScrollRangeChanged",
				handler?: (this: void) => void,
			): void;
		};
		scroll.SetScript("OnVerticalScroll", () => this.updateScrollIndicator());
		scroll.SetScript("OnScrollRangeChanged", () =>
			this.updateScrollIndicator(),
		);
		this.onSizeChanged(this.sizeChanged);
		this.updateScrollIndicator();
		const viewport = native as WowFrame & {
			GetEffectiveScale(): number;
			IsMouseOver(): boolean;
			EnableMouse(enabled: boolean): void;
			SetPropagateMouseClicks(propagate: boolean): void;
			SetScript(
				script: "OnUpdate" | "OnHide" | "OnMouseDown" | "OnMouseUp",
				handler?: (this: void, frame: WowFrame, elapsed: number) => void,
			): void;
		};
		viewport.EnableMouse(true);
		viewport.SetPropagateMouseClicks(false);
		this.mouseShield = true;
		this.scrollPan = new ScrollPan(
			() => {
				const down = (
					IsMouseButtonDown as unknown as (
						this: void,
						button: string,
					) => boolean
				)("LeftButton");
				if (!down) return { down, y: 0, over: false, scale: 1 };
				const [, y] = (
					GetCursorPosition as (this: void) => LuaMultiReturn<[number, number]>
				)();
				let focus = (
					GetMouseFoci as unknown as (this: void) => WowFrame[]
				)().at(0);
				while (focus && focus !== native)
					focus = (
						focus as WowFrame & { GetParent(): WowFrame | undefined }
					).GetParent();
				return {
					down,
					y,
					over: focus === native && viewport.IsMouseOver(),
					scale: down ? viewport.GetEffectiveScale() : 1,
				};
			},
			() => ({
				offset: native.GetVerticalScroll(),
				range: native.GetVerticalScrollRange(),
			}),
			(offset) => native.SetVerticalScroll(offset),
		);
		viewport.SetScript("OnUpdate", (_frame, elapsed) =>
			this.scrollPan?.update(elapsed),
		);
		viewport.SetScript("OnHide", () => this.scrollPan?.reset());
		// Mouse-enabled frames need press/release scripts to consume world clicks.
		viewport.SetScript("OnMouseDown", () => this.scrollPan?.update(0));
		viewport.SetScript("OnMouseUp", () => this.scrollPan?.update(0));
		native.EnableMouseWheel(true);
		native.SetScript("OnMouseWheel", (_frame, delta) => {
			native.SetVerticalScroll(
				Math.max(
					0,
					Math.min(
						native.GetVerticalScrollRange(),
						native.GetVerticalScroll() - delta * 46,
					),
				),
			);
		});
	}
	private updateScrollIndicator(): void {
		if (!this.native || !this.scrollIndicator) return;
		drawScrollIndicator(
			this.scrollIndicator,
			this.native as WowFrame & { GetHeight(): number },
		);
	}
	resetScroll(): void {
		this.lastRevealTop = undefined;
		this.revealingUp = false;
		this.native?.SetVerticalScroll(0);
	}
	scrollToEdge(direction: "up" | "down"): void {
		const native = this.acquire();
		native.SetVerticalScroll(
			direction === "up" ? 0 : native.GetVerticalScrollRange(),
		);
	}
	scrollBy(delta: number): { offset: number; range: number } {
		const native = this.acquire();
		const range = native.GetVerticalScrollRange();
		const offset = Math.max(
			0,
			Math.min(range, native.GetVerticalScroll() + delta),
		);
		native.SetVerticalScroll(offset);
		return { offset, range };
	}
	clampScroll(): void {
		const native = this.acquire();
		native.SetVerticalScroll(
			Math.max(
				0,
				Math.min(native.GetVerticalScrollRange(), native.GetVerticalScroll()),
			),
		);
	}
	revealVerticalRange(
		top: number,
		bottom: number,
		contentHeight: number,
	): void {
		const native = this.acquire() as WowFrame & { GetHeight(): number };
		const height = native.GetHeight();
		const offset = Math.max(0, (height - contentHeight) / 2);
		const scroll = native.GetVerticalScroll();
		if (this.lastRevealTop !== undefined && top !== this.lastRevealTop)
			this.revealingUp = top < this.lastRevealTop;
		this.lastRevealTop = top;
		// Start within the fourth-last row, keeping three upcoming rows visible.
		// The half-row buffer crosses that threshold before reaching its bottom.
		const lookahead = Math.max(
			0,
			Math.min(3.5 * (bottom - top), height - (bottom - top)),
		);
		const revealTop = top + offset - (this.revealingUp ? lookahead : 0);
		const revealBottom = bottom + offset + (this.revealingUp ? 0 : lookahead);
		const target =
			revealTop < scroll
				? revealTop
				: revealBottom > scroll + height
					? revealBottom - height
					: scroll;
		native.SetVerticalScroll(
			Math.max(0, Math.min(native.GetVerticalScrollRange(), target)),
		);
	}
	setFocused(focused: boolean, animatedIcon = false, refresh = false): void {
		if (animatedIcon) {
			if (focused && !this.iconFocus)
				this.iconFocus = new IconFocus(this.pool, this.acquire());
			this.iconFocus?.setFocused(focused, refresh);
			return;
		}
		if (focused) {
			if (!this.focusArrival) {
				const native = this.acquire();
				this.focusArrival = new FocusArrival(this.pool, native, (outset) =>
					setBorder(
						this.pool,
						native,
						[1, 0.82, 0, 1],
						2,
						"navigation-focus",
						outset,
					),
				);
			}
			this.focusArrival.focus(refresh);
			return;
		}
		this.focusArrival?.stop();
		setBorder(
			this.pool,
			this.acquire(),
			[1, 0.82, 0, focused ? 1 : 0],
			2,
			"navigation-focus",
		);
	}
	setFocusBorder(focused: boolean): void {
		if (!focused && !this.focusBorder) return;
		const native = this.acquire() as WowFrame & { GetFrameLevel(): number };
		if (!this.focusBorder) {
			this.focusBorder = this.pool.acquire("Frame") as WowFrame & {
				SetFrameLevel(level: number): void;
			};
			this.focusBorder.SetParent(native);
			this.focusBorder.SetPoint("TOPLEFT", native, "TOPLEFT", 0, 0);
			this.focusBorder.SetPoint("BOTTOMRIGHT", native, "BOTTOMRIGHT", 0, 0);
		}
		// Above panel content, which fills the container with an opaque background.
		this.focusBorder.SetFrameLevel(native.GetFrameLevel() + 10);
		for (const [width, alpha] of [
			[8, 0.12],
			[5, 0.25],
			[2, 1],
		] as const)
			setBorder(
				this.pool,
				this.focusBorder,
				[1, 0.82, 0, focused ? alpha : 0],
				width,
				`navigation-border-${width}`,
			);
		if (focused) this.focusBorder.Show();
		else this.focusBorder.Hide();
	}
	navigationNode(
		navId: string,
		interact: () => void,
		focus?: () => void,
		animatedIcon = false,
	): INavigable {
		return {
			navId,
			onFocus: (refresh) => {
				if (refresh) this.setFocused(true, animatedIcon, true);
				else if (animatedIcon) this.setFocused(true, true);
				else this.setFocused(true);
				if (!refresh) focus?.();
			},
			onBlur: () => {
				if (animatedIcon) this.setFocused(false, true);
				else this.setFocused(false);
			},
			onInteract: () => interact(),
		};
	}
	setGamePadInput(
		callback?: (button: string) => boolean,
		onButtonUp?: (button: string) => void,
		repeat?: GamePadRepeatOptions,
	): void {
		if (!callback && !this.native) return;
		this.heldGamePadButtons.clear();
		const native = this.acquire() as WowFrame & {
			EnableGamePadButton(enabled: boolean): void;
			SetPropagateKeyboardInput(propagate: boolean): void;
			SetFrameLevel(level: number): void;
			SetScript(
				script: "OnGamePadButtonDown" | "OnGamePadButtonUp",
				handler?: (this: void, frame: WowFrame, button: string) => void,
			): void;
			SetScript(
				script: "OnUpdate",
				handler?: (this: void, frame: WowFrame, elapsed: number) => void,
			): void;
		};
		this.gamePadInputConfigured = true;
		native.EnableGamePadButton(callback !== undefined);
		native.SetScript(
			"OnGamePadButtonDown",
			callback
				? (_frame, button) => {
						if (this.heldGamePadButtons.has(button)) {
							native.SetPropagateKeyboardInput(false);
							return;
						}
						const consumed = callback(button);
						if (consumed && repeat?.buttons.includes(button))
							this.heldGamePadButtons.set(button, repeat.delaySeconds);
						if (!InCombatLockdown())
							native.SetPropagateKeyboardInput(!consumed);
					}
				: undefined,
		);
		native.SetScript(
			"OnGamePadButtonUp",
			callback && (onButtonUp || repeat)
				? (_frame, button) => {
						this.heldGamePadButtons.delete(button);
						onButtonUp?.(button);
					}
				: undefined,
		);
		native.SetScript(
			"OnUpdate",
			callback && repeat
				? (_frame, elapsed) => {
						for (const [button, remaining] of this.heldGamePadButtons) {
							const next = remaining - elapsed;
							if (next > 0.000001) {
								this.heldGamePadButtons.set(button, next);
								continue;
							}
							if (!callback(button)) {
								this.heldGamePadButtons.delete(button);
								continue;
							}
							this.heldGamePadButtons.set(button, repeat.intervalSeconds);
						}
					}
				: undefined,
		);
		if (callback) {
			native.SetFrameStrata("DIALOG");
			native.SetFrameLevel(100);
			this.docked = true;
			native.SetPropagateKeyboardInput(true);
			this.show();
		} else this.hide();
	}
	setIcon(iconFileId: number | string, crop = true): void {
		this.clearAtlasSlices();
		this.clearTextureTint();
		this.acquire();
		this.texture?.SetTexture(iconFileId);
		if (crop) this.texture?.SetTexCoord(0.07, 0.93, 0.07, 0.93);
		else this.texture?.SetTexCoord(0, 1, 0, 1);
	}
	setIconSize(width: number, height: number, x = 0, y = 0): void {
		const native = this.acquire();
		this.texture?.ClearAllPoints();
		this.texture?.SetWidth(width);
		this.texture?.SetHeight(height);
		this.texture?.SetPoint("CENTER", native, "CENTER", x, y);
	}
	setIconRing(style?: IconRing): void {
		if (!style && !this.iconRing) return;
		const native = this.acquire();
		const ring = this.pool.getDecoration(native, "icon-ring");
		this.pool.setBackgroundMask(native, style?.maskAtlas);
		this.iconRing = style !== undefined;
		if (!style) {
			ring.SetTexture(undefined);
			return;
		}
		ring.ClearAllPoints();
		ring.SetPoint("CENTER", native, "CENTER", 0, 0);
		ring.SetWidth(style.size);
		ring.SetHeight(style.size);
		ring.SetAtlas(style.atlas, false);
	}
	setIconOutline(): void {
		applyIconOutline(this.pool, this.acquire());
	}
	setAtlasIcon(
		atlas: string,
		width: number,
		height: number,
		x = 0,
		y = 0,
	): void {
		const atlasClient = C_Texture as unknown as {
			GetAtlasInfo(
				this: void,
				atlas: string,
			): { width: number; height: number };
		};
		const info = atlasClient.GetAtlasInfo(atlas);
		const scale = Math.min(width / info.width, height / info.height);
		this.setAtlasBackground(atlas);
		this.setIconSize(info.width * scale, info.height * scale, x, y);
	}
	setPortraitIcon(unit: string, width: number, height: number, x = 0): void {
		this.acquire();
		this.clearAtlasSlices();
		this.clearTextureTint();
		const size = Math.min(width, height);
		this.setIconSize(size, size, x);
		const setPortrait = SetPortraitTexture as unknown as (
			this: void,
			texture: WowTexture,
			unit: string,
		) => void;
		if (this.texture) {
			setPortrait(this.texture, unit);
			this.texture.SetTexCoord(0, 1, 0, 1);
		}
	}
	setModelUnit(unit: string): void {
		if (this.frameType !== "PlayerModel")
			throw new Error("Model requires a PlayerModel frame");
		const model = this.acquire() as WowFrame & {
			SetUnit(unit: string): void;
			SetPortraitZoom(zoom: number): void;
			SetCamDistanceScale(scale: number): void;
			SetFacing(facing: number): void;
		};
		model.SetUnit(unit);
		model.SetPortraitZoom(0);
		model.SetCamDistanceScale(1);
		model.SetFacing(0);
	}
	setBorder(color: BorderColor, width = 2): void {
		setBorder(this.pool, this.acquire(), color, width);
	}
	setColor(red: number, green: number, blue: number, alpha = 1): void {
		this.clearAtlasSlices();
		this.clearTextureTint();
		this.acquire();
		if (this.buttonSkinned && this.native) {
			this.texture?.SetHorizTile(false);
			for (const key of ["button-left", "button-right"])
				this.pool.getDecoration(this.native, key).SetColorTexture(0, 0, 0, 0);
			this.texture?.ClearAllPoints();
			this.texture?.SetAllPoints();
			this.buttonSkinned = false;
		}
		this.texture?.SetColorTexture(red, green, blue, alpha);
	}
	setOpacity(alpha: number): void {
		(this.acquire() as WowFrame & { SetAlpha(alpha: number): void }).SetAlpha(
			alpha,
		);
		this.opacityChanged = alpha !== 1;
	}
	setTooltip(
		text: string,
		hyperlink?: string,
		compareItems = true,
		onHover?: (hovered: boolean) => void,
	): void {
		const native = this.acquire();
		type HoverTooltip = typeof GameTooltip & {
			suppressAutomaticCompareItem: boolean;
		};
		native.SetScript("OnEnter", () => {
			this.simpleTooltipHovered = true;
			onHover?.(true);
			const tooltip = GameTooltip as HoverTooltip;
			tooltip.SetOwner(native, "ANCHOR_RIGHT");
			tooltip.suppressAutomaticCompareItem = !compareItems;
			if (hyperlink) tooltip.SetHyperlink(hyperlink);
			else tooltip.SetText(text);
			tooltip.Show();
		});
		native.SetScript("OnLeave", () => {
			this.simpleTooltipHovered = false;
			onHover?.(false);
			const tooltip = GameTooltip as HoverTooltip;
			tooltip.Hide();
			tooltip.suppressAutomaticCompareItem = false;
		});
	}
	clearTooltip(): void {
		if (this.simpleTooltipHovered) GameTooltip.Hide();
		this.simpleTooltipHovered = false;
		this.native?.SetScript("OnEnter", undefined);
		this.native?.SetScript("OnLeave", undefined);
		this.hideTooltip();
	}
	getSize(): { width: number; height: number } {
		const native = this.acquire() as WowFrame & {
			GetWidth(): number;
			GetHeight(): number;
		};
		return { width: native.GetWidth(), height: native.GetHeight() };
	}
	/** Render the complete native tooltip without borrowing the global hover tooltip. */
	showItemTooltip(
		parent: Frame,
		item: TooltipContent,
		maxWidth: number,
		maxHeight: number,
	): { width: number; height: number } {
		if (this.frameType !== "GameTooltip")
			throw new Error("Item details require a tooltip frame");
		const native = this.acquire() as ItemTooltipFrame;
		// Use Blizzard's embedded styling and keep artwork transparent across data refreshes.
		native.IsEmbedded = true;
		native.NineSlice.SetAlpha(0);
		native.TopOverlay.SetAlpha(0);
		native.BottomOverlay.SetAlpha(0);
		native.SetScale(1);
		this.setParent(parent);
		this.setModalLayer();
		// Reparenting under a hidden modal can clear ownership through OnHide.
		native.SetOwner(parent.acquire(), "ANCHOR_NONE");
		native.ClearLines();
		setTooltipContent(native, item);
		native.Show();
		const size = this.getSize();
		const scale = Math.min(
			1,
			maxWidth / Math.max(1, size.width),
			maxHeight / Math.max(1, size.height),
		);
		native.SetScale(scale);
		native.ClearAllPoints();
		native.SetPoint(
			"TOPLEFT",
			parent.acquire(),
			"TOPLEFT",
			20 / scale,
			-20 / scale,
		);
		return { width: size.width * scale, height: size.height * scale };
	}
	setLabel(
		key: string,
		text: string,
		point = "CENTER",
		x = 0,
		y = 0,
		size = 14,
		width = 0,
	): void {
		const native = this.acquire();
		let label = this.labels.get(key);
		if (!label) {
			label = native.CreateFontString(undefined, "OVERLAY", "GameFontNormal");
			this.labels.set(key, label);
		}
		const previous = this.labelState.get(key);
		if (
			!previous ||
			previous.point !== point ||
			previous.x !== x ||
			previous.y !== y ||
			previous.size !== size ||
			previous.width !== width
		) {
			label.ClearAllPoints();
			label.SetPoint(point, native, point, x, y);
			label.SetFont("Fonts\\FRIZQT__.TTF", size, "OUTLINE");
			label.SetJustifyH(
				point.includes("LEFT")
					? "LEFT"
					: point.includes("RIGHT")
						? "RIGHT"
						: "CENTER",
			);
			label.SetWidth(width);
		}
		if (!previous || previous.text !== text) label.SetText(text);
		this.labelState.set(key, { text, point, x, y, size, width });
	}
	setLabelWordWrap(key: string, wrap: boolean): void {
		this.labels.get(key)?.SetWordWrap(wrap);
	}
	setLabelStyle(key: string, color: readonly [number, number, number]): void {
		const label = this.labels.get(key) as
			| (WowFontString & {
					SetTextColor(r: number, g: number, b: number): void;
			  })
			| undefined;
		const state = this.labelState.get(key);
		if (!label || !state) return;
		label.SetTextColor(...color);
		label.SetFont("Fonts\\FRIZQT__.TTF", state.size, "");
	}
	labelHeight(key: string): number {
		const label = this.labels.get(key) as
			| (WowFontString & { GetStringHeight(): number })
			| undefined;
		return label?.GetStringHeight() ?? 0;
	}
	onClick(callback: (this: void, button: string) => void): void {
		if (this.frameType !== "Button")
			throw new Error("Click handlers require a button");
		const native = this.acquire();
		native.RegisterForClicks("LeftButtonUp", "RightButtonUp");
		native.SetScript("OnClick", (_frame, button) => {
			if (button !== "LeftButton" || !this.findScrollPan()?.suppressClick())
				callback(button);
		});
	}
	private findScrollPan(): ScrollPan | undefined {
		return this.scrollPan ?? this.parent?.findScrollPan();
	}
	private configurePanAction(): void {
		if (!this.findScrollPan()) return;
		const native = this.acquire() as WowFrame & {
			GetAttribute(name: string): string | undefined;
			SetAttribute(name: string, value?: string | boolean): void;
			SetScript(
				script: "PreClick",
				handler?: (this: void, frame: WowFrame, button: string) => void,
			): void;
		};
		native.SetAttribute("useOnKeyDown", false);
		native.SetScript("PreClick", (_frame, button) => {
			this.cancelledSecureClick =
				button === "LeftButton" &&
				(this.findScrollPan()?.suppressClick() ?? false);
			if (this.cancelledSecureClick && !InCombatLockdown()) {
				this.cancelledSecureType = native.GetAttribute("type");
				native.SetAttribute("type", undefined);
			}
		});
		this.onPostClick();
	}
	setSpell(spell?: number): void {
		if (this.frameType !== "SecureButton")
			throw new Error("Spell requires a secure button");
		if (InCombatLockdown()) return;
		const native = this.acquire() as WowFrame & {
			SetAttribute(name: string, value?: string | number): void;
		};
		if (this.findScrollPan()) native.RegisterForClicks("AnyUp");
		else native.RegisterForClicks("AnyUp", "AnyDown");
		native.SetAttribute("type", spell ? "spell" : undefined);
		native.SetAttribute("spell", spell);
		if (spell) this.configurePanAction();
	}
	setToy(toy?: number): void {
		if (this.frameType !== "SecureButton")
			throw new Error("Toy requires a secure button");
		if (InCombatLockdown()) return;
		const native = this.acquire() as WowFrame & {
			SetAttribute(name: string, value?: string | number | boolean): void;
		};
		// Activate on hardware release, independently of the action-bar CVar.
		native.RegisterForClicks("AnyUp");
		native.SetAttribute("useOnKeyDown", toy ? false : undefined);
		native.SetAttribute("type", toy ? "toy" : undefined);
		native.SetAttribute("toy", toy);
		if (toy) this.configurePanAction();
	}
	/** Observe a secure action without replacing the template's OnClick handler. */
	onPostClick(callback?: (this: void, button: string) => void): void {
		if (this.frameType !== "SecureButton")
			throw new Error("Post-click handlers require a secure button");
		const native = this.acquire() as WowFrame & {
			SetAttribute(name: string, value?: string): void;
			SetScript(
				script: "PostClick",
				handler?: (this: void, frame: WowFrame, button: string) => void,
			): void;
		};
		native.SetScript(
			"PostClick",
			callback || this.findScrollPan()
				? (_frame, button) => {
						if (this.cancelledSecureType && !InCombatLockdown())
							native.SetAttribute("type", this.cancelledSecureType);
						this.cancelledSecureType = undefined;
						if (!this.cancelledSecureClick) callback?.(button);
						this.cancelledSecureClick = false;
					}
				: undefined,
		);
	}
	click(): void {
		(this.acquire() as WowFrame & { Click(): void }).Click();
	}
	secureClickName(): string {
		if (this.frameType !== "SecureButton")
			throw new Error("Binding requires a secure button");
		return (this.acquire() as WowFrame & { GetName(): string }).GetName();
	}
	setClickBindings(bindings: readonly ClickBinding[]): void {
		if (!this.clickBindings && bindings.length === 0) return;
		this.clickBindings ??= new SecureClickBindings(this.pool);
		this.clickBindings.set(bindings);
	}
	/** Place an overlay outside this component without exposing native frames. */
	anchorTooltip(tooltip: WowFrame): void {
		const native = tooltip as WowFrame & {
			SetOwner(owner: WowFrame, anchor: string): void;
		};
		native.SetOwner(this.acquire(), "ANCHOR_NONE");
		this.positionTooltip(native);
	}
	positionTooltip(tooltip: WowFrame): void {
		tooltip.ClearAllPoints();
		tooltip.SetPoint("TOPLEFT", this.acquire(), "TOPRIGHT", 0, 0);
	}
	setHoverTooltip(content: () => TooltipContent | undefined): void {
		const native = this.acquire() as WowFrame & {
			SetScript(
				script: "OnEnter" | "OnLeave" | "OnHide",
				callback?: (this: void) => void,
			): void;
		};
		const hide = () => this.hideTooltip();
		native.SetScript("OnEnter", () => {
			const item = content();
			if (item === undefined) {
				hide();
				return;
			}
			this.showTooltip(item);
		});
		native.SetScript("OnLeave", hide);
		native.SetScript("OnHide", hide);
		this.hoverTooltipConfigured = true;
	}
	showTooltip(content: TooltipContent): void {
		this.hoverTooltip ??= new Frame(
			`${this.id}-hover-tooltip`,
			this.pool,
			"GameTooltip",
		);
		const tooltip = this.hoverTooltip.acquire() as ItemTooltipFrame;
		tooltip.SetFrameStrata("TOOLTIP");
		const anchor =
			typeof content === "object" && "text" in content
				? content.anchor
				: undefined;
		if (anchor) anchor.anchorTooltip(tooltip);
		else tooltip.SetOwner(this.acquire(), "ANCHOR_RIGHT");
		tooltip.ClearLines();
		setTooltipContent(tooltip, content);
		tooltip.Show();
	}
	hideTooltip(): void {
		this.hoverTooltip?.hide();
	}
	setCooldown(start: number, duration: number): void {
		if (this.frameType !== "Cooldown")
			throw new Error("Cooldown requires a cooldown frame");
		const native = this.acquire() as WowFrame & {
			SetCooldown(start: number, duration: number): void;
			SetHideCountdownNumbers(hide: boolean): void;
			SetDrawEdge(draw: boolean): void;
		};
		native.SetHideCountdownNumbers(false);
		native.SetDrawEdge(false);
		native.SetCooldown(start, duration);
	}
	configureInput(change?: (this: void, text: string) => void): void {
		if (this.frameType !== "EditBox" && this.frameType !== "SearchBox")
			throw new Error("Input requires an edit box");
		const native = this.acquire() as WowFrame & {
			SetAutoFocus(value: boolean): void;
			SetFontObject(name: string): void;
			SetTextInsets(
				left: number,
				right: number,
				top: number,
				bottom: number,
			): void;
			GetText(): string;
			SetText(text: string): void;
			SetFocus(): void;
			ClearFocus(): void;
			SetScript(script: string, handler?: (this: void) => void): void;
		};
		native.SetAutoFocus(false);
		if (this.frameType !== "SearchBox") {
			native.SetFontObject("GameFontHighlight");
			native.SetTextInsets(8, 8, 0, 0);
		}
		native.SetScript(
			"OnTextChanged",
			this.frameType === "SearchBox"
				? () => {
						SearchBoxTemplate_OnTextChanged(native);
						change?.(native.GetText());
					}
				: change
					? () => change(native.GetText())
					: undefined,
		);
		native.SetScript("OnEscapePressed", () => native.ClearFocus());
		native.SetScript("OnEnterPressed", () => native.ClearFocus());
	}
	focusInput(): void {
		(this.acquire() as WowFrame & { SetFocus(): void }).SetFocus();
	}
	blurInput(): void {
		(
			this.native as (WowFrame & { ClearFocus(): void }) | undefined
		)?.ClearFocus();
	}
	clearInput(): void {
		const input = this.acquire() as WowFrame & {
			SetText(value: string): void;
			ClearFocus(): void;
		};
		input.ClearFocus();
		input.SetText("");
	}
	onDragStart(callback: (this: void) => void): void {
		if (this.frameType !== "Button")
			throw new Error("Drag handlers require a button");
		const native = this.acquire();
		native.RegisterForDrag("LeftButton");
		native.SetScript("OnDragStart", () => {
			if (!this.findScrollPan()) callback();
		});
	}
	onReceiveDrag(callback: (this: void) => void): void {
		const native = this.acquire() as WowFrame & {
			SetScript(script: "OnReceiveDrag", handler?: (this: void) => void): void;
		};
		native.SetScript("OnReceiveDrag", callback);
	}
	setWindowBackground(): void {
		this.clearAtlasSlices();
		applyWindowSkin(this.pool, this.acquire());
	}
	private clearTextureTint(): void {
		if (!this.textureTinted) return;
		(
			this.texture as WowTexture & {
				SetVertexColor(red: number, green: number, blue: number): void;
			}
		).SetVertexColor(1, 1, 1);
		this.textureTinted = false;
	}
	setAtlasBackground(
		atlas: string,
		tint?: readonly [number, number, number],
		slice?: number,
	): void {
		this.setColor(0, 0, 0, 0);
		this.texture?.ClearAllPoints();
		this.texture?.SetAllPoints();
		this.texture?.SetTexCoord(0, 1, 0, 1);
		this.texture?.SetAtlas(atlas, false);
		if (slice !== undefined && this.texture) {
			const texture = this.texture as SlicedTexture;
			texture.SetTextureSliceMargins(slice, slice, slice, slice);
			texture.SetTextureSliceMode(1); // Enum.UITextureSliceMode.Tiled preserves the artwork's scale.
			this.atlasSliced = true;
		}
		if (tint) {
			const [red, green, blue] = tint;
			(
				this.texture as WowTexture & {
					SetVertexColor(red: number, green: number, blue: number): void;
				}
			).SetVertexColor(red, green, blue);
			this.textureTinted = true;
		}
	}
	setTextureBackground(
		file: number | string,
		coords: readonly [number, number, number, number],
	): void {
		this.setColor(0, 0, 0, 0);
		this.setIcon(file, false);
		this.texture?.ClearAllPoints();
		this.texture?.SetAllPoints();
		this.texture?.SetTexCoord(...coords);
	}
	setSideTabBackground(
		selected: boolean,
		mirrored = false,
		hovered = false,
	): void {
		this.clearAtlasSlices();
		this.clearTextureTint();
		applySideTabSkin(this.pool, this.acquire(), selected, mirrored, hovered);
	}
	setButtonBackground(selected = false): void {
		this.clearAtlasSlices();
		applyButtonSkin(this.pool, this.acquire(), selected);
		this.buttonSkinned = true;
	}
	setInsetBackground(): void {
		this.clearAtlasSlices();
		this.acquire();
		this.texture?.SetAtlas("character-panel-background", false);
		this.setBorder([0.45, 0.4, 0.3, 1], 1);
	}
	setCloseButtonBackground(): void {
		this.clearAtlasSlices();
		this.acquire();
		this.texture?.SetAtlas("RedButton-Exit", false);
	}
	private clearAtlasSlices(): void {
		if (!this.atlasSliced || !this.texture) return;
		(this.texture as SlicedTexture).ClearTextureSlice();
		this.atlasSliced = false;
	}
	setAnimatedAtlas(atlas: AnimatedAtlas): void {
		this.acquire();
		const texture = this.texture as WowTexture & {
			SetAtlas(atlas: string): void;
			CreateAnimationGroup(): AtlasAnimationGroup;
		};
		if (!this.animation) {
			this.animation = texture.CreateAnimationGroup();
			this.animation.SetLooping("REPEAT");
			this.flipbook = this.animation.CreateAnimation("FlipBook");
			this.flipbook.SetOrder(1);
		}
		if (this.animatedAtlas === atlas) return;
		this.animation.Stop();
		texture.SetAtlas(atlas.atlas);
		this.flipbook?.SetDuration(atlas.duration);
		this.flipbook?.SetFlipBookRows(atlas.rows);
		this.flipbook?.SetFlipBookColumns(atlas.columns);
		this.flipbook?.SetFlipBookFrames(atlas.frames);
		this.animatedAtlas = atlas;
	}
	show(): void {
		this.acquire().Show();
		if (this.animation && !this.animation.IsPlaying()) this.animation.Play();
	}
	hide(): void {
		if (this.focusArrival) this.setFocused(false);
		this.iconFocus?.setFocused(false);
		this.scrollPan?.reset();
		this.animation?.Stop();
		this.native?.Hide();
	}
	setParent(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Frame requires a frame component parent");
		this.acquire().SetParent(parent.acquire());
		this.parent = parent;
	}
	destroy(): void {
		this.clearAtlasSlices();
		this.focusArrival?.destroy();
		this.focusArrival = undefined;
		this.iconFocus?.destroy();
		this.iconFocus = undefined;
		this.lastRevealTop = undefined;
		this.revealingUp = false;
		this.parent = undefined;
		this.scrollPan = undefined;
		this.animation?.Stop();
		this.animation = undefined;
		this.flipbook = undefined;
		this.animatedAtlas = undefined;
		if (this.buttonSkinned) this.texture?.SetHorizTile(false);
		this.buttonSkinned = false;
		this.iconRing = false;
		this.atlasSliced = false;
		this.hoverTooltip?.destroy();
		this.hoverTooltip = undefined;
		this.clickBindings?.destroy();
		this.clickBindings = undefined;
		if (!this.native) return;
		if (this.hoverTooltipConfigured) {
			for (const script of ["OnEnter", "OnLeave", "OnHide"])
				(
					this.native as WowFrame & {
						SetScript(script: string, callback?: (this: void) => void): void;
					}
				).SetScript(script, undefined);
			this.hoverTooltipConfigured = false;
		}
		if (this.opacityChanged) {
			this.setOpacity(1);
		}
		if (this.focusBorder) {
			this.focusBorder.SetFrameLevel(0);
			this.pool.release("Frame", this.focusBorder);
			this.focusBorder = undefined;
		}
		if (this.frameType === "GameTooltip") {
			const tooltip = this.native as ItemTooltipFrame;
			tooltip.ClearLines();
			tooltip.SetScale(1);
			tooltip.SetFrameStrata("PARENT");
			tooltip.IsEmbedded = false;
			tooltip.NineSlice.SetAlpha(1);
			tooltip.TopOverlay.SetAlpha(1);
			tooltip.BottomOverlay.SetAlpha(1);
		}
		if (this.mouseShield) {
			(
				this.native as WowFrame & { EnableMouse(enabled: boolean): void }
			).EnableMouse(false);
			this.mouseShield = false;
		}
		if (this.gamePadInputConfigured) {
			this.setGamePadInput();
			(
				this.native as WowFrame & { SetFrameLevel(level: number): void }
			).SetFrameLevel(0);
			this.gamePadInputConfigured = false;
		}
		if (this.closeName) {
			(
				this.native as WowFrame & {
					SetScript(script: "OnHide", handler?: (this: void) => void): void;
				}
			).SetScript("OnHide", undefined);
			const index = UISpecialFrames.indexOf(this.closeName);
			if (index >= 0) UISpecialFrames.splice(index, 1);
			(_G as unknown as Record<string, WowFrame | undefined>)[this.closeName] =
				undefined;
			this.closeName = undefined;
		}
		if (this.frameType === "EditBox" || this.frameType === "SearchBox") {
			this.configureInput();
			const input = this.native as WowFrame & {
				SetText(text: string): void;
				ClearFocus(): void;
				SetScript(script: string, handler?: (this: void) => void): void;
			};
			input.SetText("");
			input.ClearFocus();
			input.SetScript("OnEscapePressed", undefined);
			input.SetScript("OnEnterPressed", undefined);
		}
		if (this.frameType === "SecureButton") {
			(
				this.native as WowFrame & {
					SetScript(script: "PreClick", handler?: (this: void) => void): void;
				}
			).SetScript("PreClick", undefined);
			this.setSpell();
			this.setToy();
			this.onPostClick();
		}
		if (this.frameType === "Cooldown")
			(this.native as WowFrame & { Clear(): void }).Clear();
		this.onSizeChanged();
		if (this.frameType === "PlayerModel")
			(this.native as WowFrame & { ClearModel(): void }).ClearModel();
		this.clearTextureTint();
		this.texture?.SetColorTexture(0, 0, 0, 0);
		for (const label of this.labels.values()) label.SetText("");
		this.labels.clear();
		this.labelState.clear();
		if (this.frameType !== "FilterDropdown") {
			this.native.SetScript("OnEnter", undefined);
			this.native.SetScript("OnLeave", undefined);
		}
		if (this.frameType === "Button") {
			(
				this.native as WowFrame & {
					SetScript(
						script: "OnReceiveDrag",
						handler?: (this: void) => void,
					): void;
				}
			).SetScript("OnReceiveDrag", undefined);
			this.native.SetScript("OnClick", undefined);
			this.native.SetScript("OnDragStart", undefined);
			this.native.RegisterForClicks("LeftButtonUp");
			this.native.RegisterForDrag();
		}
		if (this.frameType === "ScrollFrame") {
			const pointer = this.native as WowFrame & {
				SetScript(
					script: "OnMouseDown" | "OnMouseUp",
					handler?: (this: void) => void,
				): void;
			};
			pointer.SetScript("OnMouseDown", undefined);
			pointer.SetScript("OnMouseUp", undefined);
			(
				this.native as WowFrame & {
					SetScript(script: "OnHide", handler?: (this: void) => void): void;
				}
			).SetScript("OnHide", undefined);
			(
				this.native as WowFrame & {
					SetScript(script: "OnUpdate", handler?: (this: void) => void): void;
				}
			).SetScript("OnUpdate", undefined);
			const scroll = this.native as WowFrame & {
				SetScript(
					script: "OnVerticalScroll" | "OnScrollRangeChanged",
					handler?: (this: void) => void,
				): void;
			};
			scroll.SetScript("OnVerticalScroll", undefined);
			scroll.SetScript("OnScrollRangeChanged", undefined);
			this.scrollIndicator = undefined;
			this.onSizeChanged();
			this.native.SetScript("OnMouseWheel", undefined);
			this.native.EnableMouseWheel(false);
			this.native.SetVerticalScroll(0);
			this.native.SetScrollChild(undefined);
		}
		if (this.docked) {
			this.native.SetFrameStrata("PARENT");
			this.docked = false;
		}
		this.pool.release(this.frameType, this.native);
		this.native = undefined;
		this.texture = undefined;
	}
}
