export interface IObjectiveTrackerClient {
	selectNext(): void;
	toggle(): void;
}

interface TrackerBlock {
	readonly id: number;
	readonly cached?: boolean;
	readonly nextBlock?: TrackerBlock;
}
interface TrackerModule {
	readonly firstBlock?: TrackerBlock;
}
declare const ObjectiveTrackerFrame:
	| { readonly modules: readonly TrackerModule[]; ToggleCollapsed(): void }
	| undefined;
declare const QuestObjectiveTracker: TrackerModule | undefined;
declare const CampaignQuestObjectiveTracker: TrackerModule | undefined;
declare const WorldQuestObjectiveTracker: TrackerModule | undefined;
declare const BonusObjectiveTracker: TrackerModule | undefined;

/** Retail's displayed block chain preserves tracker order, including campaign quests. */
export class ObjectiveTrackerClient implements IObjectiveTrackerClient {
	selectNext(): void {
		if (typeof ObjectiveTrackerFrame === "undefined") return;
		const ids: number[] = [];
		for (const module of ObjectiveTrackerFrame.modules) {
			if (
				module !== QuestObjectiveTracker &&
				module !== CampaignQuestObjectiveTracker &&
				module !== WorldQuestObjectiveTracker &&
				module !== BonusObjectiveTracker
			)
				continue;
			let block = module.firstBlock;
			while (block) {
				// Blizzard can keep turned-in/untracked quest blocks briefly for animations.
				// Bonus tracker scenario steps use negative IDs, not quest IDs.
				if (block.id > 0 && !block.cached && !ids.includes(block.id))
					ids.push(block.id);
				block = block.nextBlock;
			}
		}
		if (ids.length === 0) return;
		const current = C_SuperTrack.GetSuperTrackedQuestID();
		const next = ids.at((ids.indexOf(current ?? 0) + 1) % ids.length);
		if (next !== undefined) C_SuperTrack.SetSuperTrackedQuestID(next);
	}
	toggle(): void {
		if (typeof ObjectiveTrackerFrame !== "undefined")
			ObjectiveTrackerFrame.ToggleCollapsed();
	}
}
