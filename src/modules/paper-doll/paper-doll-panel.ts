import type {
	CharacterStat,
	EquipmentSlot,
	ICharacterActions,
} from "../../clients/character-client";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

const qualityColors: readonly (readonly [number, number, number])[] = [
	[0.62, 0.62, 0.62],
	[1, 1, 1],
	[0.12, 1, 0],
	[0, 0.44, 0.87],
	[0.64, 0.21, 0.93],
	[1, 0.5, 0],
	[0.9, 0.8, 0.5],
	[0, 0.8, 1],
	[0, 0.8, 1],
];

export class PaperDollPanel implements IPanel {
	readonly id = "paper-doll";
	readonly title = "Character";
	readonly icon = 135906;
	private mounted = false;
	private equipment: readonly EquipmentSlot[] = [];
	private stats: readonly CharacterStat[] = [];
	private readonly slots: { border: Frame; button: Frame; nav: INavigable }[] =
		[];
	private readonly statRows: Frame[] = [];
	private readonly preview: Frame;
	private readonly closeButton: Frame;
	private readonly content: Frame;
	constructor(
		private readonly frame: Frame,
		private readonly pool: IFramePoolManager,
		private readonly actions: ICharacterActions,
	) {
		this.preview = new Frame("character-model", pool, "PlayerModel");
		this.closeButton = new Frame("character-close", pool, "Button");
		this.content = new Frame("character-content", pool);
	}
	setEquipment(equipment: readonly EquipmentSlot[]): void {
		this.equipment = equipment;
		if (this.mounted) this.renderEquipment();
	}
	setStats(stats: readonly CharacterStat[]): void {
		this.stats = stats;
		if (this.mounted) this.renderStats();
	}
	refreshPreview(): void {
		if (this.mounted) this.preview.setModelUnit("player");
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Paper Doll requires a frame parent");
		this.frame.fill(parent);
		this.frame.setBlackBackground();
		this.frame.show();
		this.content.setParent(this.frame);
		this.content.show();
		this.frame.onSizeChanged(() => {
			if (this.mounted) this.layoutContent();
		});
		this.closeButton.setParent(this.frame);
		this.closeButton.layout(28, 24, "TOPRIGHT", this.frame, -12, -8);
		this.closeButton.setLabel("close", "X");
		this.closeButton.onClick(() => {
			if (this.mounted) this.actions.close();
		});
		this.closeButton.show();
		this.preview.setParent(this.content);
		this.preview.layout(332, 364, "TOPLEFT", this.content, 84, 0);
		this.preview.show();
		this.mounted = true;
		this.refreshPreview();
		this.renderEquipment();
		this.renderStats();
	}
	private renderEquipment(): void {
		this.equipment.forEach((slot, index) => {
			let cell = this.slots.at(index);
			if (!cell) {
				const border = new Frame(`equipment-border-${index}`, this.pool);
				const button = new Frame(`equipment-${index}`, this.pool, "Button");
				cell = {
					border,
					button,
					nav: {
						navId: `equipment-${index}`,
						onFocus: () => border.setColor(1, 0.82, 0),
						onBlur: () => {
							const current = this.equipment.at(index);
							border.setColor(
								...(qualityColors.at(current?.quality ?? 1) ??
									([1, 1, 1] as const)),
							);
						},
						onInteract: () => {
							const current = this.equipment.at(index);
							if (this.mounted && current) this.actions.pickup(current);
						},
					},
				};
				this.slots.push(cell);
			}
			const x = index < 8 ? 16 : index < 16 ? 438 : index === 16 ? 202 : 254;
			const y = index < 16 ? (index % 8) * 46 : 374;
			cell.border.setParent(this.content);
			cell.border.layout(44, 44, "TOPLEFT", this.content, x, -y);
			cell.border.setColor(
				...(qualityColors.at(slot.quality) ?? ([1, 1, 1] as const)),
			);
			cell.button.setParent(cell.border);
			cell.button.layout(40, 40, "CENTER", cell.border);
			cell.button.setIcon(slot.icon);
			cell.button.setTooltip(slot.name, slot.hyperlink);
			cell.button.setLabel(
				"level",
				slot.itemLevel === undefined ? "" : `${Math.floor(slot.itemLevel)}`,
				"BOTTOMRIGHT",
				-1,
				1,
				11,
			);
			cell.button.onClick((button) => {
				if (!this.mounted) return;
				if (button === "LeftButton") this.actions.pickup(slot);
				else if (button === "RightButton") this.actions.use(slot);
			});
			cell.button.onDragStart(() => {
				if (this.mounted) this.actions.pickup(slot);
			});
			cell.border.show();
			cell.button.show();
		});
		for (let i = this.equipment.length; i < this.slots.length; i++) {
			this.slots.at(i)?.border.hide();
			this.slots.at(i)?.button.hide();
		}
		this.layoutContent();
	}
	private renderStats(): void {
		this.stats.forEach((stat, index) => {
			let row = this.statRows.at(index);
			if (!row) {
				row = new Frame(`character-stat-${index}`, this.pool);
				this.statRows.push(row);
			}
			row.setParent(this.content);
			row.layout(
				226,
				26,
				"TOPLEFT",
				this.content,
				16 + (index % 2) * 242,
				-436 - Math.floor(index / 2) * 28,
			);
			row.setLabel("label", stat.label, "LEFT", 0, 0, 13);
			row.setLabel("value", stat.value, "RIGHT", 0, 0, 13);
			row.show();
		});
		for (let i = this.stats.length; i < this.statRows.length; i++)
			this.statRows.at(i)?.hide();
		this.layoutContent();
	}
	private layoutContent(): void {
		const height =
			this.stats.length > 0
				? 436 + (Math.ceil(this.stats.length / 2) - 1) * 28 + 26
				: this.equipment.length > 16
					? 418
					: 364;
		this.content.layoutVerticallyCentered(500, height, this.frame);
	}
	onUnmount(): void {
		this.mounted = false;
		this.frame.hide();
	}
	getNavGrid(): INavigable[][] {
		const rows: INavigable[][] = [];
		for (let i = 0; i < 8; i++) {
			const left = this.slots.at(i)?.nav;
			const right = this.slots.at(i + 8)?.nav;
			if (left && right) rows.push([left, right]);
		}
		const mainHand = this.slots.at(16)?.nav;
		const offHand = this.slots.at(17)?.nav;
		if (mainHand && offHand) rows.push([mainHand, offHand]);
		return rows;
	}
	destroy(): void {
		this.onUnmount();
		for (const cell of this.slots) {
			cell.button.destroy();
			cell.border.destroy();
		}
		for (const row of this.statRows) row.destroy();
		this.slots.length = 0;
		this.statRows.length = 0;
		this.preview.destroy();
		this.closeButton.destroy();
		this.content.destroy();
		this.frame.destroy();
	}
}
