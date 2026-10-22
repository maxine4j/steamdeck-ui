import type { IEventBus } from "../events/types";
import type {
	PreyGlobals,
	PreyMapFrame,
	PreyMapPin,
} from "../modules/prey/wow-prey-globals";
import type {
	NativeDialogFrame,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import type { NativeNavigation } from "../ui/components/native-navigation";
import type { NavGrid } from "../ui/navigation/types";
import type {
	INativeDialogsClient,
	NativeDialog,
} from "./native-dialogs-client";
import type { ITaskScheduler } from "./task-scheduler";

/** Adapts the Midnight scouting table without replacing Blizzard's quest flow. */
export class PreyMapClient implements INativeDialogsClient {
	private active = false;
	private cancelPending?: () => void;
	private readonly hooked = new Set<PreyMapFrame>();
	constructor(
		private readonly events: IEventBus,
		private readonly navigation: Pick<NativeNavigation, "navigation">,
		private readonly controls: Pick<
			NativeDialogNavigation,
			"watch" | "grid" | "release"
		>,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
	) {}
	initialize(): void {
		this.active = true;
		this.events.subscribe("DIALOGUE_ADDON_LOADED", this.discover);
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
		if (!this.active) return;
		const { CovenantMissionFrame: host, AdventureMapQuestChoiceDialog: quest } =
			_G as unknown as PreyGlobals;
		if (!host) return;
		this.controls.watch(host, this.changed);
		this.controls.watch(host.MapTab, this.changed);
		if (quest) this.controls.watch(quest, this.changed);
		if (!this.hooked.has(host.MapTab)) {
			this.hooked.add(host.MapTab);
			const hook = hooksecurefunc as unknown as (
				this: void,
				frame: NativeDialogFrame,
				method: string,
				callback: (this: void) => void,
			) => void;
			for (const method of [
				"RefreshAllDataProviders",
				"AcquirePin",
				"RemovePin",
			])
				hook(host.MapTab, method, () => this.changed());
		}
		this.changed();
	};
	getDialogs(): NativeDialog[] {
		const { CovenantMissionFrame: host, AdventureMapQuestChoiceDialog: quest } =
			_G as unknown as PreyGlobals;
		if (!this.active || !host?.IsVisible() || !host.MapTab.IsVisible())
			return [];
		// Texture kits are string keys in Blizzard_CovenantMissionUI; generated
		// declarations currently represent textureKit as a number.
		const adventureMap = C_AdventureMap as unknown as {
			GetAdventureMapTextureKit(this: void): string;
		};
		if (adventureMap.GetAdventureMapTextureKit() !== "midnight") return [];
		const dialogs: NativeDialog[] = [
			{
				id: "native-prey-map",
				grid: this.mapGrid(host.MapTab),
				cancel: () => {
					if (this.active && host.IsVisible())
						host.CloseButton.Click("LeftButton");
				},
			},
		];
		if (quest?.IsVisible())
			dialogs.push({
				id: "native-prey-quest",
				grid: this.controls.grid("prey:quest", quest),
				cancel: () => {
					if (this.active && quest.IsVisible()) quest.DeclineQuest();
				},
			});
		return dialogs;
	}
	private mapGrid(map: PreyMapFrame): NavGrid {
		const pins: { pin: PreyMapPin; kind: string; x: number; y: number }[] = [];
		for (const kind of ["offer", "choice"]) {
			const template =
				kind === "offer"
					? "AdventureMap_QuestOfferPinTemplate"
					: "AdventureMap_QuestChoicePinTemplate";
			for (const pin of map.EnumeratePinsByTemplate(template)) {
				if (!pin.IsVisible()) continue;
				const [x, y] = pin.GetGlobalPosition();
				pins.push({ pin, kind, x, y });
			}
		}
		pins.sort(
			(a, b) => a.y - b.y || a.x - b.x || a.pin.questID - b.pin.questID,
		);
		const rows: (typeof pins)[] = [];
		for (const entry of pins) {
			const row = rows.at(-1);
			if (!row || entry.y - (row.at(0)?.y ?? entry.y) > 0.08)
				rows.push([entry]);
			else row.push(entry);
		}
		return rows.map((row) =>
			row
				.sort((a, b) => a.x - b.x)
				.map(({ pin, kind }) => {
					const questID = pin.questID;
					const available = () =>
						this.active &&
						map.IsVisible() &&
						pin.IsVisible() &&
						pin.questID === questID;
					return this.navigation.navigation(
						pin,
						undefined,
						`prey:${kind}:${questID}`,
						() => {
							if (available()) pin.OnClick("LeftButton");
						},
						{
							enter: () => {
								if (available()) pin.OnMouseEnter();
							},
							leave: () => pin.OnMouseLeave(),
						},
					);
				}),
		);
	}
	shutdown(): void {
		this.active = false;
		this.events.unsubscribe("DIALOGUE_ADDON_LOADED", this.discover);
		this.cancelPending?.();
		this.cancelPending = undefined;
		this.controls.release();
	}
}
