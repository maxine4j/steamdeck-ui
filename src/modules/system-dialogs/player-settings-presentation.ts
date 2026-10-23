import type { WowFrame } from "../../types";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavGrid } from "../../ui/navigation/types";

export interface PlayerSettingsOption {
	readonly id: string;
	readonly label: string;
	readonly kind: "checkbox" | "radio" | "button";
	readonly value?: number;
	readonly checked: boolean;
	readonly enabled: boolean;
	activate(): void;
}
export interface PlayerSettingsSection {
	readonly id: string;
	readonly title: string;
	readonly note?: string;
	readonly options: readonly PlayerSettingsOption[];
}
export interface IPlayerSettingsPresentation {
	render(owner: WowFrame, sections: readonly PlayerSettingsSection[]): void;
	grid(): NavGrid;
	hide(): void;
	destroy(): void;
}

/** Module-owned layout; all native operations stay inside pooled components. */
export class PlayerSettingsPresentation implements IPlayerSettingsPresentation {
	private readonly window: Frame;
	private readonly viewport: Frame;
	private readonly content: Frame;
	private contentHeight = 0;
	private mounted = false;
	private readonly headings = new Set<string>();
	private readonly rows = new Map<
		string,
		{ button: Frame; marker: Frame; check: Frame; option: PlayerSettingsOption }
	>();
	private readonly groups = new Map<string, Frame>();
	private nodes: NavGrid = [];
	constructor(private readonly pool: IFramePoolManager) {
		this.window = new Frame("player-settings", pool);
		this.viewport = new Frame("player-settings:viewport", pool, "ScrollFrame");
		this.content = new Frame("player-settings:content", pool);
	}
	render(owner: WowFrame, sections: readonly PlayerSettingsSection[]): void {
		this.nodes = [];
		for (const row of this.rows.values()) row.button.hide();
		for (const group of this.groups.values()) group.hide();
		this.window.setWindowBackground();
		this.window.setLabel("title", "Player Settings", "TOP", 0, -14, 16);
		this.viewport.setParent(this.window);
		this.content.setParent(this.viewport);
		if (!this.mounted) {
			this.viewport.setScrollContent(this.content);
			this.mounted = true;
		}
		for (const key of this.headings) this.content.setLabel(key, "");
		let top = 0;
		for (const section of sections) {
			this.headings.add(`section:${section.id}`);
			this.headings.add(`note:${section.id}`);
			this.content.setLabel(
				`section:${section.id}`,
				section.title,
				"TOPLEFT",
				2,
				-top,
				12,
				244,
			);
			top += 18;
			if (section.note) {
				this.content.setLabel(
					`note:${section.id}`,
					section.note,
					"TOPLEFT",
					2,
					-top,
					10,
					244,
				);
				top += 14;
			} else this.content.setLabel(`note:${section.id}`, "");
			let group = this.groups.get(section.id);
			if (!group) {
				group = new Frame(`player-settings:${section.id}`, this.pool);
				this.groups.set(section.id, group);
			}
			group.setParent(this.content);
			group.layout(
				248,
				section.options.length * 22 + 4,
				"TOPLEFT",
				this.content,
				0,
				-top + 2,
			);
			if (section.options.some((option) => option.kind === "radio"))
				group.setInsetBackground();
			else {
				group.setColor(0, 0, 0, 0);
				group.setBorder([0, 0, 0, 0]);
			}
			group.show();
			for (const option of section.options) {
				let row = this.rows.get(option.id);
				if (!row) {
					const button = new Frame(
						`player-settings:${option.id}`,
						this.pool,
						"Button",
					);
					row = {
						button,
						marker: new Frame(`${option.id}:marker`, this.pool),
						check: new Frame(`${option.id}:check`, this.pool),
						option,
					};
					this.rows.set(option.id, row);
				}
				row.option = option;
				const { button, marker, check } = row;
				button.setParent(group);
				button.layout(
					244,
					22,
					"TOPLEFT",
					group,
					2,
					-(section.options.indexOf(option) * 22 + 2),
				);
				button.setOpacity(option.enabled ? 1 : 0.4);
				if (option.kind === "button") button.setButtonBackground();
				else button.setColor(0, 0, 0, 0);
				button.setLabel(
					"label",
					option.label,
					"LEFT",
					option.kind === "button" ? 8 : 28,
					0,
					12,
					option.kind === "button" ? 228 : 208,
				);
				const activate = () => {
					if (row.option.enabled) row.option.activate();
				};
				button.onClick((mouseButton) => {
					if (mouseButton === "LeftButton") activate();
				});
				marker.setParent(button);
				marker.layout(16, 16, "LEFT", button, 6, 0);
				check.setParent(marker);
				check.layout(16, 16, "CENTER", marker);
				if (option.kind === "radio") {
					marker.setTextureBackground(
						"Interface\\Buttons\\UI-RadioButton",
						option.checked ? [0.25, 0.5, 0, 1] : [0, 0.25, 0, 1],
					);
					marker.show();
					check.hide();
				} else if (option.kind === "checkbox") {
					marker.setAtlasBackground("checkbox-minimal");
					check.setAtlasBackground("checkmark-minimal");
					marker.show();
					if (option.checked) check.show();
					else check.hide();
				} else {
					marker.hide();
					check.hide();
				}
				button.show();
				const rowTop = top;
				if (option.enabled)
					this.nodes.push([
						{
							...button.navigationNode(
								`player-settings:${option.id}`,
								activate,
								() =>
									this.viewport.revealVerticalRange(
										rowTop,
										rowTop + 22,
										this.contentHeight,
									),
							),
							navigationScroll: this.viewport,
						},
					]);
				top += 22;
			}
			top += 10;
		}
		this.contentHeight = top;
		const height = this.window.placeBeside(owner, 280, top + 46);
		this.viewport.layout(248, height - 46, "TOPLEFT", this.window, 16, -38);
		this.content.layout(248, top, "TOPLEFT", this.viewport);
		this.viewport.clampScroll();
		this.content.show();
		this.viewport.show();
		this.window.show();
	}
	grid(): NavGrid {
		return this.nodes;
	}
	hide(): void {
		this.window.hide();
		this.nodes = [];
	}
	destroy(): void {
		this.hide();
		for (const row of this.rows.values()) {
			row.check.destroy();
			row.marker.destroy();
			row.button.destroy();
		}
		for (const group of this.groups.values()) group.destroy();
		this.rows.clear();
		this.groups.clear();
		this.content.destroy();
		this.viewport.destroy();
		this.window.destroy();
		this.mounted = false;
	}
}
