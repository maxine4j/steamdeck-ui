import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { controllerIcon } from "./controller-icon";
import { Frame } from "./frame";

/** Measured, wrapped prose with an explicit controller reading control. */
export class ScrollText {
	private readonly scroll: Frame;
	private readonly content: Frame;
	private readonly position: Frame;
	private width = 1;
	private height = 1;
	private mounted = false;
	readonly node: INavigable;
	constructor(
		id: string,
		pool: IFramePoolManager,
		private readonly options: {
			readonly showPosition?: boolean;
			readonly textColor?: readonly [number, number, number];
		} = {},
	) {
		this.scroll = new Frame(`${id}-scroll`, pool, "ScrollFrame");
		this.content = new Frame(`${id}-content`, pool);
		this.position = new Frame(`${id}-position`, pool);
		this.node = {
			navId: id,
			mouseTarget: this.scroll,
			navColumn: 0,
			onFocus: (refresh) => {
				if (refresh) this.scroll.setFocused(true, false, true);
				else this.scroll.setFocused(true);
			},
			onBlur: () => this.scroll.setFocused(false),
			onInteract: () => this.move(1),
			onContext: () => this.move(-1),
		};
	}
	mount(parent: Frame, width: number, height: number): void {
		this.width = width;
		this.height = height;
		this.mounted = true;
		this.scroll.setParent(parent);
		this.scroll.layout(width, this.viewportHeight(), "TOPLEFT", parent);
		this.content.setParent(this.scroll);
		this.scroll.setScrollContent(this.content);
		this.position.setParent(parent);
		this.position.layout(width, 24, "BOTTOMLEFT", parent);
		this.scroll.show();
		this.content.show();
		if (this.options.showPosition !== false) this.position.show();
	}
	setText(text: string, reset: boolean): void {
		this.content.setLabel("text", text, "TOPLEFT", 8, -8, 18, this.width - 24);
		this.content.setLabelWordWrap("text", true);
		if (this.options.textColor)
			this.content.setLabelStyle("text", this.options.textColor);
		this.content.layout(
			this.width - 8,
			Math.max(this.viewportHeight(), this.content.labelHeight("text") + 24),
			"TOPLEFT",
			this.scroll,
		);
		if (reset) this.scroll.resetScroll();
		this.scroll.clampScroll();
		this.move(0);
	}
	getTextHeight(): number {
		return this.content.labelHeight("text") + 24;
	}
	private viewportHeight(): number {
		return this.height - (this.options.showPosition === false ? 0 : 28);
	}
	private move(direction: number): void {
		if (!this.mounted) return;
		const { offset, range } = this.scroll.scrollBy(
			direction * Math.max(80, this.height - 100),
		);
		if (this.options.showPosition === false) return;
		this.position.setLabel(
			"position",
			`${range > 0 ? Math.round((offset / range) * 100) : 100}% read · ${controllerIcon("A")} Down · ${controllerIcon("Y")} Up`,
			"CENTER",
			0,
			0,
			13,
			this.width,
		);
	}
	unmount(): void {
		this.mounted = false;
		this.scroll.hide();
		this.position.hide();
	}
	destroy(): void {
		this.unmount();
		this.content.destroy();
		this.scroll.destroy();
		this.position.destroy();
	}
}
