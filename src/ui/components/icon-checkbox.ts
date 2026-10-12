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
		this.button.layout(96, showLabel ? 100 : 54, "TOPLEFT", parent, x, -top);
		this.artwork.setParent(this.button);
		this.artwork.layout(32, 32, "TOP", this.button, 0, -10);
		this.artwork.setLabel("icon", this.icon, "CENTER", 0, 0, 12);
		if (showLabel)
			this.button.setLabel("label", this.label, "BOTTOM", 0, 0, 12, 96);
		this.button.setTooltip(this.label);
		this.box.setParent(this.artwork);
		this.box.layout(14, 14, "BOTTOMRIGHT", this.artwork, 2, -2);
		this.box.setColor(0.03, 0.03, 0.03);
		this.box.setBorder([0.7, 0.65, 0.5, 1]);
		this.check.fill(this.box);
		this.check.setLabel(
			"check",
			"|TInterface\\Buttons\\UI-CheckBox-Check:18:18|t",
		);
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
		this.button.setButtonBackground();
		this.button.setOpacity(enabled ? 1 : 0.35);
		if (checked) this.check.show();
		else this.check.hide();
	}
	onFocus(): void {
		this.nav.onFocus();
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
