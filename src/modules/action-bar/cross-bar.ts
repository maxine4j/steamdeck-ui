import type { IActionBarClient } from "../../clients/action-bar-client";
import { controllerIcon } from "../../ui/components/controller-icon";
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
	{
		key: "PADDUP",
		label: controllerIcon("Up"),
		x: -200,
		y: 106,
		slot: 5,
		utility: "RING",
	},
	{
		key: "PADDRIGHT",
		label: controllerIcon("Right"),
		x: -150,
		y: 81,
		slot: 6,
		utility: "RING",
	},
	{
		key: "PADDDOWN",
		label: controllerIcon("Down"),
		x: -200,
		y: 56,
		slot: 7,
		utility: "MOUNT",
	},
	{
		key: "PADDLEFT",
		label: controllerIcon("Left"),
		x: -250,
		y: 81,
		slot: 8,
		utility: "RING",
	},
	{ key: "PAD4", label: controllerIcon("Y"), x: 200, y: 106, slot: 2 },
	{ key: "PAD2", label: controllerIcon("B"), x: 250, y: 81, slot: 3 },
	{
		key: "PAD1",
		label: controllerIcon("A"),
		x: 200,
		y: 56,
		slot: 4,
		defaultCommand: "JUMP",
	},
	{ key: "PAD3", label: controllerIcon("X"), x: 150, y: 81, slot: 1 },
	{
		key: "PADRTRIGGER",
		label: controllerIcon("RT"),
		x: 100,
		y: 56,
		slot: 156,
		utility: "FIXED",
	},
	{
		key: "PADLSHOULDER",
		label: controllerIcon("LB"),
		x: -100,
		y: 106,
		slot: 155,
		utility: "FIXED",
	},
];
const placeholders = [
	{
		key: "PADLTRIGGER",
		label: "",
		x: -100,
		y: 56,
		icon: "Interface\\AddOns\\SteamDeckUI\\assets\\xbox_s_lt.blp",
	},
	{
		key: "PADRSHOULDER",
		label: controllerIcon("RB"),
		x: 100,
		y: 106,
		icon: "Interface\\AddOns\\SteamDeckUI\\assets\\Target_Wide_Enemy.png",
	},
];
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
		for (const modifier of placeholders) {
			const indicator = new Frame(`cross-bar-${modifier.key}`, this.pool);
			indicator.layout(48, 48, "BOTTOM", undefined, modifier.x, modifier.y);
			indicator.setColor(0.12, 0.18, 0.25, 0.9);
			indicator.setIcon(modifier.icon, false);
			if (modifier.label !== "") indicator.setLabel("modifier", modifier.label);
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
