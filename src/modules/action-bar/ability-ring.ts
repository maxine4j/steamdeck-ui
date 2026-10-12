import type {
	ActionRingKind,
	IActionBarClient,
} from "../../clients/action-bar-client";
import {
	type RadialDriver,
	SecureRadialMenu,
} from "../../ui/components/secure-radial-menu";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";

export class AbilityRing {
	private readonly menus: {
		kind: ActionRingKind;
		menu: SecureRadialMenu;
		signature: string;
	}[] = [];
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IActionBarClient,
	) {}
	initialize(): void {
		if (this.menus.length > 0) return;
		for (const [kind, key, label] of [
			["abilities", "PADDUP", "↑"],
			["class", "PADDLEFT", "←"],
			["utility", "PADDRIGHT", "→"],
		] as const) {
			const driver = this.client.getRingDriver(kind);
			const menu = new SecureRadialMenu(
				this.pool,
				Math.max(12, driver.slots.length),
			);
			menu.configure(
				key,
				driver,
				(slot) => this.client.readRing(kind, slot),
				`Right stick to select\nRelease ${label} to use`,
				0.2,
			);
			this.client.bind([
				{ key, target: menu.getBindingTarget(), prefixes: [""] },
			]);
			this.menus.push({ kind, menu, signature: this.signature(driver) });
		}
	}
	refreshContents(): void {
		if (!this.client.canModify()) return;
		for (const entry of this.menus) {
			if (entry.kind === "abilities") continue;
			const driver = this.client.getRingDriver(entry.kind);
			const signature = this.signature(driver);
			if (signature === entry.signature) continue;
			entry.menu.setActions(driver);
			entry.signature = signature;
		}
	}
	private signature(driver: RadialDriver): string {
		return `${driver.slots.join(",")}|${driver.actions?.map((action) => `${action.slot}:${action.type}:${action.value}`).join(",") ?? ""}`;
	}
	refresh(): void {
		for (const { menu } of this.menus) menu.refresh();
	}
	destroy(): void {
		for (const { menu } of this.menus) menu.destroy();
		this.menus.length = 0;
	}
}
