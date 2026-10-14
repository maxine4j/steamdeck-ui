import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { Frame } from "./frame";

/** Pooled icon toggle with a separate checkbox and controller focus. */
export class IconCheckbox implements INavigable {
	private readonly button: Frame;
	private readonly artwork: Frame;
	private readonly box: Frame;
	private readonly check: Frame;
	private readonly nav: INavigable;
	private mounted = false;
	private enabled = true;
	constructor(
		readonly navId: string,
		pool: IFramePoolManager,
		private readonly label: string,
		private readonly icon: string,
		private readonly activate: () => void,
	) {
		this.button = new Frame(navId, pool, "Button");
		this.artwork = new Frame(`${navId}-icon`, pool);
		this.box = new Frame(`${navId}-box`, pool);
		this.check = new Frame(`${navId}-check`, pool);
		this.nav = this.button.navigationNode(navId, () => this.onInteract());
	}
	mount(parent: Frame, x: number, top: number, showLabel = true): void {
		this.button.setParent(parent);
		this.button.layout(96, showLabel ? 100 : 96, "TOPLEFT", parent, x, -top);
		this.artwork.setParent(this.button);
		this.artwork.layout(
			48,
			48,
			showLabel ? "TOP" : "CENTER",
			this.button,
			0,
			showLabel ? -8 : 0,
		);
		this.artwork.setAtlasBackground(this.icon);
		if (showLabel)
			this.button.setLabel("label", this.label, "BOTTOM", 0, 0, 12, 96);
		this.button.setTooltip(this.label);
		this.box.setParent(this.artwork);
		this.box.layout(21, 20.3, "BOTTOMLEFT", this.artwork, -5, -4);
		this.box.setAtlasBackground("checkbox-minimal");
		this.check.fill(this.box);
		this.check.setAtlasBackground("checkmark-minimal");
		this.button.onClick((button) => {
			if (button === "LeftButton") this.onInteract();
		});
		this.mounted = true;
		this.box.show();
		this.artwork.show();
		this.button.show();
	}
	setChecked(checked: boolean, enabled = true): void {
		this.enabled = enabled;
		this.button.setOpacity(enabled ? 1 : 0.35);
		if (checked) this.check.show();
		else this.check.hide();
	}
	onFocus(refresh?: boolean): void {
		this.nav.onFocus(refresh);
	}
	onBlur(): void {
		this.nav.onBlur();
	}
	onInteract(): void {
		if (this.mounted && this.enabled) this.activate();
	}
	unmount(): void {
		this.mounted = false;
		this.button.hide();
	}
	destroy(): void {
		this.unmount();
		this.check.destroy();
		this.box.destroy();
		this.artwork.destroy();
		this.button.destroy();
	}
}
