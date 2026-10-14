import type { IActionBarClient } from "../../clients/action-bar-client";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { crossBarControls, crossBarPlaceholders } from "./cross-bar";

export interface ICrossBarPreview {
	readonly height: number;
	show(parent: Frame, y: number): void;
	hide(): void;
	destroy(): void;
}
export class CrossBarPreview implements ICrossBarPreview {
	readonly height = 264;
	private readonly host: Frame;
	private readonly content: Frame;
	private readonly rows: Frame[] = [];
	private readonly cells = new Map<string, Frame>();
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: Pick<IActionBarClient, "readPreview">,
	) {
		this.host = new Frame("cross-bar-preview-host", pool);
		this.content = new Frame("cross-bar-preview-content", pool);
	}
	show(parent: Frame, y: number): void {
		this.host.setParent(parent);
		this.host.setModalLayer();
		this.host.layout(280, this.height, "CENTER", parent, 0, y);
		this.content.setParent(this.host);
		this.content.setModalLayer();
		this.content.setScale(0.5);
		this.content.layout(560, this.height * 2, "CENTER", this.host);
		const modifiers = ["none", "shift", "ctrl", "ctrl-shift"] as const;
		modifiers.forEach((modifier, index) => {
			let row = this.rows.at(index);
			if (!row) {
				row = new Frame(`cross-bar-preview-row-${index}`, this.pool);
				this.rows.push(row);
			}
			row.setParent(this.content);
			row.setModalLayer();
			row.layout(560, 132, "TOP", this.content, 0, -index * 132);
			row.setLabel(
				"modifier",
				["No modifier", "LT", "LB", "LT+LB"].at(index) ?? "",
				"TOP",
				0,
				0,
				18,
			);
			for (const control of crossBarControls) {
				const frame = this.cell(index, control.key, row, control.x, control.y);
				const visual = this.client.readPreview(
					control.slot,
					modifier,
					control.utility ?? control.defaultCommand,
				);
				frame.setAtlasBackground("UI-HUD-ActionBar-IconFrame-Background");
				if (visual.icon !== undefined) frame.setIcon(visual.icon);
				frame.setIconOutline();
				frame.setLabel("button", control.label, "TOPLEFT", 4, -4);
				frame.show();
			}
			for (const control of crossBarPlaceholders) {
				const frame = this.cell(index, control.key, row, control.x, control.y);
				frame.setColor(0.12, 0.18, 0.25, 0.9);
				frame.setIcon(control.icon, false);
				if (control.label !== "") {
					frame.setIconOutline();
					frame.setLabel("button", control.label, "TOPLEFT", 4, -4);
				}
				frame.show();
			}
			row.show();
		});
		this.content.show();
		this.host.show();
	}
	private cell(
		index: number,
		key: string,
		parent: Frame,
		x: number,
		y: number,
	): Frame {
		const id = `cross-bar-preview-${index}-${key}`;
		let frame = this.cells.get(id);
		if (!frame) {
			frame = new Frame(id, this.pool);
			this.cells.set(id, frame);
		}
		frame.setParent(parent);
		frame.setModalLayer();
		frame.layout(48, 48, "CENTER", parent, x, y - 81);
		return frame;
	}
	hide(): void {
		this.host.hide();
	}
	destroy(): void {
		this.hide();
		for (const frame of this.cells.values()) frame.destroy();
		for (const row of this.rows) row.destroy();
		this.cells.clear();
		this.rows.length = 0;
		this.content.destroy();
		this.host.destroy();
	}
}
