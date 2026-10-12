import type { IActionBarClient } from "../../clients/action-bar-client";
import { SecureRadialMenu } from "../../ui/components/secure-radial-menu";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";

export class AbilityRing {
	private menu?: SecureRadialMenu;
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IActionBarClient,
	) {}
	initialize(): void {
		if (this.menu) return;
		this.menu = new SecureRadialMenu(this.pool, 12);
		this.menu.configure(
			"PADDUP",
			this.client.getRingDriver(),
			(slot) => this.client.read(slot),
			"Right stick to select\nRelease ↑ to use",
		);
		this.client.bind([
			{ key: "PADDUP", target: this.menu.getBindingTarget(), prefixes: [""] },
		]);
	}
	refresh(): void {
		this.menu?.refresh();
	}
	destroy(): void {
		this.menu?.destroy();
		this.menu = undefined;
	}
}
