import type { IEventBus } from "../events/types";
import type {
	NativeDialogFrame,
	NativeDialogList,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import type {
	INativeDialogsClient,
	NativeDialog,
} from "./native-dialogs-client";
import type { ITaskScheduler } from "./task-scheduler";

interface LootSlot {
	slotIndex: number;
}
const LOOT_SLOT_NONE = 0;
interface LootFrame extends NativeDialogFrame {
	ScrollBox: NativeDialogList<LootSlot>;
	ClosePanelButton: NativeDialogFrame;
}

/** Leaves Blizzard's autoloot, modified clicks and loot confirmations intact. */
export class LootClient implements INativeDialogsClient {
	private active = false;
	private cancelPending?: () => void;
	constructor(
		private readonly events: IEventBus,
		private readonly controls: Pick<
			NativeDialogNavigation,
			"watch" | "list" | "control" | "click" | "release"
		>,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
	) {}
	initialize(): void {
		this.active = true;
		this.events.subscribe("DIALOGUE_ADDON_LOADED", this.discover);
		this.events.subscribe("LOOT_UPDATED", this.changed);
		this.discover();
	}
	private readonly changed = () => {
		if (!this.active || this.cancelPending) return;
		this.cancelPending = this.scheduler.nextFrame(() => {
			this.cancelPending = undefined;
			if (this.active) this.events.emit("NATIVE_DIALOGS_CHANGED");
		});
	};
	private readonly discover = () => {
		const host = this.host();
		if (!this.active || !host) return;
		this.controls.watch(host, this.changed);
		this.changed();
	};
	private host(): LootFrame | undefined {
		return (_G as unknown as { LootFrame?: LootFrame }).LootFrame;
	}
	getDialogs(): NativeDialog[] {
		const host = this.host();
		if (!this.active || !host?.IsVisible()) return [];
		const scroll = host.ScrollBox;
		// This legacy FrameXML global is absent from API-documentation generation.
		const loot = _G as unknown as {
			GetLootSlotType(this: void, slot: number): number;
		};
		const slots: NativeDialogList<LootSlot> = {
			ForEachElementData: (callback) =>
				scroll.ForEachElementData((data) => {
					if (loot.GetLootSlotType(data.slotIndex) !== LOOT_SLOT_NONE)
						callback(data);
				}),
			ScrollToElementData: (data, alignment, offset, instant) =>
				scroll.ScrollToElementData(data, alignment, offset, instant),
			FindFrame: (data) =>
				(
					scroll.FindFrame(data) as
						| (NativeDialogFrame & { Item?: NativeDialogFrame })
						| undefined
				)?.Item,
		};
		return [
			{
				id: "native-loot",
				grid: [
					...this.controls.list(
						"loot:slot",
						slots,
						(data) => `${data.slotIndex}`,
					),
					[this.controls.control("loot:close", host.ClosePanelButton)],
				],
				cancel: () => {
					if (this.active && host.IsVisible())
						this.controls.click(host.ClosePanelButton);
				},
			},
		];
	}
	shutdown(): void {
		this.active = false;
		this.events.unsubscribe("DIALOGUE_ADDON_LOADED", this.discover);
		this.events.unsubscribe("LOOT_UPDATED", this.changed);
		this.cancelPending?.();
		this.cancelPending = undefined;
		this.controls.release();
	}
}
