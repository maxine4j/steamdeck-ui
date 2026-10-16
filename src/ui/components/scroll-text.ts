import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

/** Measured, wrapped prose scrolled through the viewport's mouse input. */
export class ScrollText {
	private readonly scroll: Frame;
	private readonly content: Frame;
	private width = 1;
	private height = 1;
	constructor(
		id: string,
		pool: IFramePoolManager,
		private readonly options: {
			readonly textColor?: readonly [number, number, number];
		} = {},
	) {
		this.scroll = new Frame(`${id}-scroll`, pool, "ScrollFrame");
		this.content = new Frame(`${id}-content`, pool);
	}
	mount(parent: Frame, width: number, height: number): void {
		this.width = width;
		this.height = height;
		this.scroll.setParent(parent);
		this.scroll.layout(width, height, "TOPLEFT", parent);
		this.content.setParent(this.scroll);
		this.scroll.setScrollContent(this.content);
		this.scroll.show();
		this.content.show();
	}
	setText(text: string, reset: boolean): void {
		this.content.setLabel("text", text, "TOPLEFT", 8, -8, 18, this.width - 24);
		this.content.setLabelWordWrap("text", true);
		if (this.options.textColor)
			this.content.setLabelStyle("text", this.options.textColor);
		this.content.layout(
			this.width - 8,
			Math.max(this.height, this.content.labelHeight("text") + 24),
			"TOPLEFT",
			this.scroll,
		);
		if (reset) this.scroll.resetScroll();
		this.scroll.clampScroll();
	}
	getTextHeight(): number {
		return this.content.labelHeight("text") + 24;
	}
	unmount(): void {
		this.scroll.hide();
	}
	destroy(): void {
		this.unmount();
		this.content.destroy();
		this.scroll.destroy();
	}
}
