export interface Reputation {
	readonly index: number;
	readonly id: number;
	readonly name: string;
	readonly description: string;
	readonly header: boolean;
	readonly hasReputation: boolean;
	readonly child: boolean;
	readonly collapsed: boolean;
	readonly watched: boolean;
	readonly standing: string;
	readonly progress: string;
	readonly reaction: number;
	readonly current: number;
	readonly maximum: number;
	readonly maxed: boolean;
	readonly seasonal?: boolean;
	readonly locked?: boolean;
}
export interface IReputationClient {
	getReputations(): Reputation[];
	activate(reputation: Reputation): void;
}
// Generated declarations flatten these documented table returns to numbers.
type NativeFaction = Omit<FactionData, "factionId"> & { factionID: number };
const factionAt = (index: number) =>
	(
		C_Reputation.GetFactionDataByIndex as unknown as (
			this: void,
			index: number,
		) => NativeFaction | undefined
	)(index);
type NativeMajorFaction = Pick<
	MajorFactionData,
	| "name"
	| "description"
	| "isUnlocked"
	| "renownLevel"
	| "maxLevel"
	| "renownReputationEarned"
	| "renownLevelThreshold"
>;
const majorFaction = (id: number) =>
	(
		C_MajorFactions.GetMajorFactionData as unknown as (
			this: void,
			id: number,
		) => NativeMajorFaction | undefined
	)(id);
const watchedFaction = () =>
	(
		C_Reputation.GetWatchedFactionData as unknown as (
			this: void,
		) => NativeFaction | undefined
	)();
const standings = [
	"Hated",
	"Hostile",
	"Unfriendly",
	"Neutral",
	"Friendly",
	"Honored",
	"Revered",
	"Exalted",
];
export class ReputationClient implements IReputationClient {
	getReputations(): Reputation[] {
		const journeys = this.getJourneys();
		const rows: Reputation[] = [];
		// Expanding a header reveals more rows, so the count must stay live.
		for (let index = 1; index <= C_Reputation.GetNumFactions(); index++) {
			let data = factionAt(index);
			if (!data) continue;
			if (data.isHeader && data.isCollapsed) {
				C_Reputation.ExpandFactionHeader(index);
				data = factionAt(index);
				if (!data) continue;
			}
			const hasReputation = !data.isHeader || data.isHeaderWithRep === true;
			let standing = standings.at(data.reaction - 1) ?? "";
			let current = data.currentStanding - data.currentReactionThreshold;
			let maximum = data.nextReactionThreshold - data.currentReactionThreshold;
			let maxed = data.reaction === 8;
			let reaction = data.reaction;
			if (hasReputation) {
				const friendship = (
					C_GossipInfo.GetFriendshipReputation as unknown as (
						this: void,
						id: number,
					) =>
						| {
								friendshipFactionID: number;
								standing: number;
								reaction: string;
								reactionThreshold: number;
								nextThreshold?: number;
						  }
						| undefined
				)(data.factionID);
				if (friendship && friendship.friendshipFactionID > 0) {
					maxed = !friendship.nextThreshold;
					reaction = 5;
					standing = friendship.reaction;
					current = friendship.standing - friendship.reactionThreshold;
					maximum =
						(friendship.nextThreshold ?? friendship.reactionThreshold) -
						friendship.reactionThreshold;
				} else if (C_Reputation.IsMajorFaction(data.factionID)) {
					const major = majorFaction(data.factionID);
					if (major) {
						maxed = C_MajorFactions.HasMaximumRenown(data.factionID);
						reaction = 5;
						standing = `Renown ${major.renownLevel}`;
						current = major.renownReputationEarned;
						maximum = major.renownLevelThreshold;
					}
				}
				if (C_Reputation.IsFactionParagonForCurrentPlayer(data.factionID)) {
					maxed = true;
					const [value, threshold, , pending] =
						C_Reputation.GetFactionParagonInfo(data.factionID);
					standing = pending ? "Paragon — Reward available" : "Paragon";
					current = threshold > 0 ? value % threshold : 0;
					maximum = threshold;
				}
			}
			rows.push({
				index,
				id: data.factionID,
				name: data.name,
				description: data.description ?? "",
				header: data.isHeader,
				hasReputation,
				child: data.isChild === true,
				collapsed: data.isCollapsed,
				watched: data.isWatched,
				standing: hasReputation ? standing : "",
				progress:
					hasReputation && maximum > 0
						? `${Math.max(0, current)} / ${maximum}`
						: "",
				reaction,
				current: hasReputation ? Math.max(0, current) : 0,
				maximum: hasReputation ? Math.max(0, maximum) : 0,
				maxed: hasReputation && maxed,
			});
		}
		return [
			...journeys,
			...rows.filter(
				(row) => !journeys.some((journey) => journey.id === row.id),
			),
		];
	}
	private getJourneys(): Reputation[] {
		const ids = (
			C_MajorFactions.GetMajorFactionIDs as unknown as (
				this: void,
				expansion: number,
			) => number[]
		)(GetExpansionLevel());
		const rows: Reputation[] = [];
		const watched = ids.length > 0 ? watchedFaction()?.factionID : undefined;
		for (const id of ids) {
			if (
				!C_MajorFactions.ShouldDisplayMajorFactionAsJourney(id) ||
				C_MajorFactions.IsMajorFactionHiddenFromExpansionPage(id)
			)
				continue;
			const data = majorFaction(id);
			if (!data) continue;
			const locked = !data.isUnlocked;
			const maxed = !locked && C_MajorFactions.HasMaximumRenown(id);
			let current = locked ? 0 : data.renownReputationEarned;
			let maximum = locked ? 0 : data.renownLevelThreshold;
			let standing = locked
				? "Locked"
				: `Level ${data.renownLevel} / ${data.maxLevel}`;
			if (!locked && C_Reputation.IsFactionParagonForCurrentPlayer(id)) {
				const [value, threshold, , pending] =
					C_Reputation.GetFactionParagonInfo(id);
				current = threshold > 0 ? value % threshold : 0;
				maximum = threshold;
				standing = pending ? "Paragon — Reward available" : "Paragon";
			}
			rows.push({
				index: -id,
				id,
				name: data.name,
				description: data.description,
				header: false,
				hasReputation: true,
				child: false,
				collapsed: false,
				watched: watched === id,
				standing,
				progress: maximum > 0 ? `${current} / ${maximum}` : "",
				reaction: 5,
				current,
				maximum,
				maxed,
				seasonal: true,
				locked,
			});
		}
		return rows;
	}
	activate(reputation: Reputation): void {
		if (reputation.seasonal) {
			if (majorFaction(reputation.id)?.isUnlocked)
				C_Reputation.SetWatchedFactionByID(
					watchedFaction()?.factionID === reputation.id ? 0 : reputation.id,
				);
			return;
		}
		const current = factionAt(reputation.index);
		if (
			!current ||
			current.factionID !== reputation.id ||
			current.name !== reputation.name
		)
			return;
		if (!current.isHeader || current.isHeaderWithRep)
			C_Reputation.SetWatchedFactionByID(
				current.isWatched ? 0 : current.factionID,
			);
	}
}
