import type { IActionBarClient } from "../../clients/action-bar-client";
import { Frame } from "../../ui/components/frame";
import {
	SecureSlotButton,
	type SlotReader,
} from "../../ui/components/secure-slot-button";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";

const controls: readonly {
	key: string;
	label: string;
	x: number;
	y: number;
	slot: number;
	defaultCommand?: "JUMP";
	utility?: "RING" | "MOUNT" | "FIXED";
}[] = [
	// ConsolePort's Crossbar: Minimal uses 50px horizontal / 25px vertical offsets.
	{ key: "PADDUP", label: "↑", x: -200, y: 106, slot: 5, utility: "RING" },
	{ key: "PADDRIGHT", label: "→", x: -150, y: 81, slot: 6, utility: "RING" },
	{ key: "PADDDOWN", label: "↓", x: -200, y: 56, slot: 7, utility: "MOUNT" },
	{ key: "PADDLEFT", label: "←", x: -250, y: 81, slot: 8, utility: "RING" },
	{ key: "PAD4", label: "|cffffe74fY|r", x: 200, y: 106, slot: 2 },
	{ key: "PAD2", label: "|cffff4451B|r", x: 250, y: 81, slot: 3 },
	{
		key: "PAD1",
		label: "|cff52c14eA|r",
		x: 200,
		y: 56,
		slot: 4,
		defaultCommand: "JUMP",
	},
	{ key: "PAD3", label: "|cff00a2ffX|r", x: 150, y: 81, slot: 1 },
	{
		key: "PADRTRIGGER",
		label: "RT",
		x: 100,
		y: 56,
		slot: 156,
		utility: "FIXED",
	},
	{
		key: "PADLSHOULDER",
		label: "LB\nCTRL",
		x: -100,
		y: 106,
		slot: 155,
		utility: "FIXED",
	},
];
const modifiers = [{ key: "PADLTRIGGER", label: "LT\nSHIFT", y: 56 }];
export class CrossBar {
	private readonly buttons: SecureSlotButton[] = [];
	private readonly indicators: Frame[] = [];
	private readonly read: SlotReader = (slot) => this.client.read(slot);
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IActionBarClient,
	) {}
	initialize(): void {
		if (this.buttons.length > 0) return;
		for (const modifier of modifiers) {
			const indicator = new Frame(`cross-bar-${modifier.key}`, this.pool);
			indicator.layout(48, 48, "BOTTOM", undefined, -100, modifier.y);
			indicator.setColor(0.12, 0.18, 0.25, 0.9);
			indicator.setBorder([0.32, 0.6, 0.85, 1]);
			indicator.setLabel("modifier", modifier.label);
			indicator.show();
			this.indicators.push(indicator);
		}
		this.client.bind(
			controls.map((control) => {
				const button = new SecureSlotButton(this.pool);
				this.buttons.push(button);
				button.configure(
					control.label,
					control.x,
					control.y,
					control.utility === "RING"
						? -1
						: control.utility === "MOUNT"
							? -3
							: control.defaultCommand
								? 0
								: control.slot,
					this.client.getSlotDriver(
						control.slot,
						control.utility ?? control.defaultCommand,
					),
					this.read,
				);
				return {
					key: control.key,
					target: button.getBindingTarget(),
					defaultCommand: control.defaultCommand,
					...(control.utility === "RING"
						? { prefixes: ["SHIFT-", "CTRL-", "CTRL-SHIFT-"] as const }
						: {}),
				};
			}),
		);
	}
	refresh(): void {
		for (const button of this.buttons) button.refresh(this.read);
	}
	destroy(): void {
		for (const button of this.buttons) button.destroy();
		this.buttons.length = 0;
		for (const indicator of this.indicators) indicator.destroy();
		this.indicators.length = 0;
	}
}
