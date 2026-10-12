import type { IMountsClient } from "../../clients/mounts-client";
import { Dropdown } from "../../ui/components/dropdown";
import { Frame } from "../../ui/components/frame";
import { ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
export class MountsPanel implements IPanel {
	readonly id = "mounts";
	readonly title = "Mounts";
	readonly icon = 132261;
	private readonly frame: Frame;
	private readonly search: Frame;
	private readonly filters: Dropdown;
	private readonly footer: Frame;
	private readonly equipment: Frame;
	private readonly favourite: Frame;
	private readonly flight: Frame;
	private readonly list: ScrollList;
	private mounted = false;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IMountsClient,
		close: () => void,
	) {
		this.frame = new Frame("mounts-root", pool);
		this.search = new Frame("mounts-search", pool, "EditBox");
		this.filters = new Dropdown("mounts-filters", pool);
		this.footer = new Frame("mounts-footer", pool);
		this.equipment = new Frame("mounts-equipment", pool, "Button");
		this.favourite = new Frame("mounts-random", pool, "Button");
		this.flight = new Frame("mounts-flight", pool, "SecureButton");
		this.list = new ScrollList(this.id, pool, this.title, close, {
			top: 112,
			bottom: 116,
			background: false,
		});
	}
	refresh(): void {
		this.list.setRows(
			this.client.getMounts().map((mount) => ({
				id: `mount-${mount.id}`,
				label: mount.name,
				icon: mount.icon,
				detail: !mount.collected
					? "Not collected"
					: !mount.usable
						? "Unavailable here"
						: "",
				selected: mount.favourite,
				activate: () => {
					if (this.mounted && mount.collected && mount.usable)
						this.client.summon(mount.id);
				},
				secondary: mount.collected
					? {
							label: mount.favourite ? "*" : "+",
							activate: () => {
								this.client.toggleFavourite(mount.id);
								this.refresh();
							},
						}
					: undefined,
			})),
		);
		this.filters.setOptions(
			this.client.getFilters().map((filter) => ({
				id: filter.id,
				label: `${filter.checked ? "[x]" : "[ ]"} ${filter.label}`,
				activate: () => {
					this.client.toggleFilter(filter.id);
					this.refresh();
				},
			})),
		);
		if (!this.mounted) return;
		const count = this.client.getCount();
		this.frame.setLabel(
			"count",
			`${count.collected} / ${count.total}`,
			"TOPLEFT",
			16,
			-44,
			14,
		);
		const equipment = this.client.getEquipment();
		this.equipment.setIcon(equipment.icon);
		this.equipment.setTooltip(equipment.label, equipment.link);
		const spells = this.client.getUtilitySpells();
		this.flight.setSpell(spells.flight);
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Mounts requires a frame parent");
		this.frame.fill(parent);
		this.frame.setBlackBackground();
		this.list.mount(this.frame);
		this.search.setParent(this.frame);
		this.search.layout(320, 32, "TOPLEFT", this.frame, 16, -66);
		this.search.setColor(0.12, 0.12, 0.12);
		this.search.configureInput((text) => {
			if (this.mounted) {
				this.client.search(text);
				this.refresh();
			}
		});
		this.search.setTooltip("Search mounts");
		this.search.show();
		this.footer.setParent(this.frame);
		this.footer.layout(456, 100, "BOTTOMLEFT", this.frame, 12, 12);
		this.footer.setColor(0.12, 0.12, 0.12);
		this.footer.setLabel("equipment", "Equipment", "TOPLEFT", 12, -8, 12);
		this.footer.setLabel("random", "Favourite mount", "TOPLEFT", 100, -8, 12);
		this.footer.setLabel(
			"flight",
			"Switch flight style",
			"TOPLEFT",
			264,
			-8,
			12,
		);
		[this.equipment, this.favourite, this.flight].forEach((button, index) => {
			button.setParent(this.footer);
			button.layout(
				56,
				56,
				"TOPLEFT",
				this.footer,
				[12, 128, 312].at(index),
				-30,
			);
			button.show();
		});
		this.favourite.setIcon(413588);
		this.favourite.setTooltip("Summon a random favourite mount");
		this.favourite.onClick((button) => {
			if (this.mounted && button === "LeftButton") this.client.summon(0);
		});
		this.favourite.onDragStart(() => {
			if (this.mounted) this.client.pickupRandom();
		});
		this.flight.setIcon(4640497);
		this.flight.setTooltip("Switch flight style");
		const applyEquipment = () => {
			if (this.mounted) {
				this.client.applyEquipment();
				this.refresh();
			}
		};
		this.equipment.onClick(applyEquipment);
		this.equipment.onReceiveDrag(applyEquipment);
		this.footer.show();
		this.filters.mount(this.frame);
		this.frame.show();
		this.mounted = true;
		this.refresh();
	}
	onUnmount(): void {
		this.mounted = false;
		this.filters.hide();
		this.list.unmount();
		this.frame.hide();
	}
	private nav(button: Frame): INavigable {
		return {
			navId: button.id,
			onFocus: () => button.setLabel("focus", ">", "BOTTOM", 0, 0),
			onBlur: () => button.setLabel("focus", ""),
			onInteract: () => {
				if (this.mounted) button.click();
			},
		};
	}
	getNavGrid(): INavigable[][] {
		if (!this.mounted) return [];
		return [
			[
				{
					navId: this.search.id,
					onFocus: () => this.search.setColor(0.3, 0.25, 0),
					onBlur: () => this.search.setColor(0.12, 0.12, 0.12),
					onInteract: () => this.search.focusInput(),
				},
			],
			...this.filters.getNavGrid(),
			...(this.filters.isOpen() ? [] : this.list.getNavGrid()),
			[
				this.nav(this.equipment),
				this.nav(this.favourite),
				this.nav(this.flight),
			],
		];
	}
	destroy(): void {
		this.onUnmount();
		this.list.destroy();
		this.filters.destroy();
		for (const frame of [
			this.search,
			this.equipment,
			this.favourite,
			this.flight,
			this.footer,
			this.frame,
		])
			frame.destroy();
	}
}
