export interface Reputation {
	readonly index: number;
	readonly id: number;
	readonly name: string;
	readonly description: string;
	readonly header: boolean;
	readonly collapsed: boolean;
	readonly watched: boolean;
	readonly standing: string;
	readonly progress: string;
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
		const rows: Reputation[] = [];
		for (let index = 1; index <= C_Reputation.GetNumFactions(); index++) {
			const data = factionAt(index);
			if (!data) continue;
			let standing = standings.at(data.reaction - 1) ?? "";
			let current = data.currentStanding - data.currentReactionThreshold;
			let maximum = data.nextReactionThreshold - data.currentReactionThreshold;
			if (!data.isHeader || data.isHeaderWithRep) {
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
					standing = friendship.reaction;
					current = friendship.standing - friendship.reactionThreshold;
					maximum =
						(friendship.nextThreshold ?? friendship.reactionThreshold) -
						friendship.reactionThreshold;
				} else if (C_Reputation.IsMajorFaction(data.factionID)) {
					const major = (
						C_MajorFactions.GetMajorFactionData as unknown as (
							this: void,
							id: number,
						) =>
							| {
									renownLevel: number;
									renownReputationEarned: number;
									renownLevelThreshold: number;
							  }
							| undefined
					)(data.factionID);
					if (major) {
						standing = `Renown ${major.renownLevel}`;
						current = major.renownReputationEarned;
						maximum = major.renownLevelThreshold;
					}
				}
				if (C_Reputation.IsFactionParagonForCurrentPlayer(data.factionID)) {
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
				collapsed: data.isCollapsed,
				watched: data.isWatched,
				standing: data.isHeader && !data.isHeaderWithRep ? "" : standing,
				progress: maximum > 0 ? `${Math.max(0, current)} / ${maximum}` : "",
			});
		}
		return rows;
	}
	activate(reputation: Reputation): void {
		const current = factionAt(reputation.index);
		if (
			!current ||
			current.factionID !== reputation.id ||
			current.name !== reputation.name
		)
			return;
		if (current.isHeader) {
			if (current.isCollapsed)
				C_Reputation.ExpandFactionHeader(reputation.index);
			else C_Reputation.CollapseFactionHeader(reputation.index);
		} else
			C_Reputation.SetWatchedFactionByID(
				current.isWatched ? 0 : current.factionID,
			);
	}
}
