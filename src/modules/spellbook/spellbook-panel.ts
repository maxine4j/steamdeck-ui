import type { ISpellbookClient } from "../../clients/spellbook-client";
import { controllerIcon } from "../../ui/components/controller-icon";
import { Frame } from "../../ui/components/frame";
import { ItemGrid } from "../../ui/components/item-grid";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import type { ISpellBindingPrompt } from "./spell-binding-prompt";
export class SpellbookPanel implements IPanel {
	readonly id = "spellbook";
	readonly title = "Spellbook";
	readonly iconAtlas = "UI-HUD-MicroMenu-SpellbookAbilities-Up";
	private readonly frame: Frame;
	private readonly grid: ItemGrid;
	private mounted = false;
	private changed?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: ISpellbookClient,
		private readonly prompt: ISpellBindingPrompt,
		private readonly close: () => void,
	) {
		this.frame = new Frame("spellbook-frame", pool);
		this.grid = new ItemGrid("spellbook-grid", pool, "No spells available", {
			secureIcons: true,
			focusIcon: true,
			backgroundAtlas: "spellbook-item-backplate",
			backgroundOpacity: 0.12,
			outlineIcons: true,
		});
	}
	onMount(parent: IUIComponent): void {
		this.frame.setParent(parent);
		this.frame.inset(parent as Frame, 0, 0, 0, 0);
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.frame.setLabel(
			"actions",
			`${controllerIcon("X")} Cast   ${controllerIcon("Y")} Bind spell`,
			"BOTTOMLEFT",
			16,
			16,
			12,
		);
		this.mounted = true;
		this.refresh();
		this.grid.mount(this.frame, 56, 42);
		this.frame.show();
	}
	onUnmount(): void {
		this.mounted = false;
		this.prompt.close();
		this.grid.unmount();
		this.frame.hide();
	}
	onContainerClosed(): void {
		this.close();
	}
	getNavGrid(): NavGrid {
		return this.mounted ? this.grid.getNavGrid() : [];
	}
	setNavigationChanged(callback?: () => void): void {
		this.changed = callback;
	}
	refresh(): void {
		if (!this.mounted || !this.client.canModify()) return;
		this.prompt.close();
		this.grid.setGroups(
			this.client.read().map((group) => ({
				id: group.id,
				label: group.name,
				items: group.spells.map((spell) => ({
					id: `spell-${spell.id}`,
					name: spell.name,
					icon: spell.icon,
					detail: spell.passive ? "Passive" : "",
					hyperlink: `spell:${spell.id}`,
					tooltip: { spell: spell.id },
					spell: spell.passive ? undefined : spell.id,
					activate: () => {},
					context: () => {
						if (!spell.passive) this.prompt.open(spell);
					},
				})),
			})),
		);
		this.changed?.();
	}
	destroy(): void {
		this.onUnmount();
		this.grid.destroy();
		this.frame.destroy();
	}
}
