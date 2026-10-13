import type { IEventBus } from "../events/types";
import type { WowFrame } from "../types";
import type { IFrameSuppression } from "../ui/components/frame-suppression";

declare global {
	const PetJournal: typeof ToyBox;
	const ToyBox: WowFrame & {
		IsShown(): boolean;
		HookScript(
			script: "OnShow" | "OnHide",
			callback: (this: void) => void,
		): void;
	};
}
export type CollectionTab = "mounts" | "toys" | "pets";
export interface ICollectionsClient {
	disable(tab: CollectionTab): void;
	restore(tab: CollectionTab): void;
	isOpen(tab: CollectionTab): boolean;
	close(): void;
}

/** One owner for the shared collections window prevents nested hidden parents. */
export class CollectionsClient implements ICollectionsClient {
	private readonly enabled = new Set<CollectionTab>();
	private hooked = false;
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	isOpen(tab: CollectionTab): boolean {
		return (
			CollectionsJournal.IsShown() &&
			(tab === "mounts"
				? MountJournal.IsShown()
				: tab === "pets"
					? PetJournal.IsShown()
					: ToyBox.IsShown())
		);
	}
	close(): void {
		HideUIPanel(CollectionsJournal);
	}
	private readonly sync = () => {
		if (this.enabled.size === 0) return;
		if ([...this.enabled].some((tab) => this.isOpen(tab)))
			this.frames.suppress([CollectionsJournal]);
		else this.frames.restore();
		if (this.enabled.has("mounts"))
			this.events.emit("MOUNTS_VISIBILITY_CHANGED");
		if (this.enabled.has("toys")) this.events.emit("TOYS_VISIBILITY_CHANGED");
		if (this.enabled.has("pets")) this.events.emit("PETS_VISIBILITY_CHANGED");
	};
	disable(tab: CollectionTab): void {
		if (this.enabled.has(tab)) return;
		(C_AddOns.LoadAddOn as unknown as (this: void, name: string) => void)(
			"Blizzard_Collections",
		);
		if (!this.hooked) {
			for (const frame of [
				CollectionsJournal,
				MountJournal,
				ToyBox,
				PetJournal,
			]) {
				frame.HookScript("OnShow", this.sync);
				frame.HookScript("OnHide", this.sync);
			}
			this.hooked = true;
		}
		this.enabled.add(tab);
		this.sync();
	}
	restore(tab: CollectionTab): void {
		this.enabled.delete(tab);
		if (this.enabled.size === 0) this.frames.restore();
		else this.sync();
	}
}
