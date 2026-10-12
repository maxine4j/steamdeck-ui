import type { IActionBarClient } from "../../clients/action-bar-client";
import {
	SecureSlotButton,
	type SlotReader,
} from "../../ui/components/secure-slot-button";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";

const controls = [
	{ key: "PADDUP", label: "↑", x: -110, y: 160 },
	{ key: "PADDRIGHT", label: "→", x: -58, y: 108 },
	{ key: "PADDDOWN", label: "↓", x: -110, y: 56 },
	{ key: "PADDLEFT", label: "←", x: -162, y: 108 },
	{ key: "PAD4", label: "|cffffe74fY|r", x: 110, y: 160 },
	{ key: "PAD2", label: "|cffff4451B|r", x: 162, y: 108 },
	{ key: "PAD1", label: "|cff52c14eA|r", x: 110, y: 56 },
	{ key: "PAD3", label: "|cff00a2ffX|r", x: 58, y: 108 },
];
export class CrossBar {
	private readonly buttons: SecureSlotButton[] = [];
	private readonly read: SlotReader = (slot) => this.client.read(slot);
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IActionBarClient,
	) {}
	initialize(): void {
		if (this.buttons.length > 0) return;
		this.client.bind(
			controls.map((control, index) => {
				const button = new SecureSlotButton(this.pool);
				this.buttons.push(button);
				button.configure(
					control.label,
					control.x,
					control.y,
					index + 1,
					this.client.getSlotDriver(index + 1),
					this.read,
				);
				return { key: control.key, target: button.getBindingTarget() };
			}),
		);
	}
	refresh(): void {
		for (const button of this.buttons) button.refresh(this.read);
	}
	destroy(): void {
		for (const button of this.buttons) button.destroy();
		this.buttons.length = 0;
	}
}
