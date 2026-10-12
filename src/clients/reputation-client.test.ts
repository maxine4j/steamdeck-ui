import { afterEach, expect, it, vi } from "vitest";
import { ReputationClient } from "./reputation-client";

afterEach(() => vi.unstubAllGlobals());
it("omits progress for section headers while retaining reputation-bearing headers and their factions", () => {
	const factions = [
		{ name: "Midnight", isHeader: true, isHeaderWithRep: false },
		{ name: "The War Within", isHeader: true, isHeaderWithRep: false },
		{ name: "Cartels of Undermine", isHeader: true, isHeaderWithRep: true },
		{ name: "Bilgewater Cartel", isHeader: false, isHeaderWithRep: false },
	].map((row, index) => ({
		...row,
		factionID: index,
		reaction: 4,
		currentStanding: 0,
		currentReactionThreshold: 0,
		nextReactionThreshold: 3000,
	}));
	vi.stubGlobal("C_Reputation", {
		GetNumFactions: () => factions.length,
		GetFactionDataByIndex: (index: number) => factions.at(index - 1),
		IsMajorFaction: () => false,
		IsFactionParagonForCurrentPlayer: () => false,
	});
	vi.stubGlobal("C_GossipInfo", { GetFriendshipReputation: () => undefined });
	expect(new ReputationClient().getReputations()).toMatchObject([
		{
			hasReputation: false,
			standing: "",
			progress: "",
			current: 0,
			maximum: 0,
		},
		{
			hasReputation: false,
			standing: "",
			progress: "",
			current: 0,
			maximum: 0,
		},
		{ hasReputation: true, standing: "Neutral", progress: "0 / 3000" },
		{ hasReputation: true, standing: "Neutral", progress: "0 / 3000" },
	]);
});

it("displays friendship, renown and pending paragon progress", () => {
	const factions = [1, 2, 3].map((id) => ({
		factionID: id,
		name: `Faction ${id}`,
		reaction: 8,
		currentStanding: 42000,
		currentReactionThreshold: 42000,
		nextReactionThreshold: 42000,
	}));
	vi.stubGlobal("C_Reputation", {
		GetNumFactions: () => 3,
		GetFactionDataByIndex: (index: number) => factions.at(index - 1),
		IsMajorFaction: (id: number) => id === 2,
		IsFactionParagonForCurrentPlayer: (id: number) => id === 3,
		GetFactionParagonInfo: () => [12500, 10000, 42, true],
	});
	vi.stubGlobal("C_GossipInfo", {
		GetFriendshipReputation: (id: number) =>
			id === 1
				? {
						friendshipFactionID: 1,
						standing: 600,
						reaction: "Buddy",
						reactionThreshold: 500,
						nextThreshold: 1000,
					}
				: undefined,
	});
	vi.stubGlobal("C_MajorFactions", {
		HasMaximumRenown: () => false,
		GetMajorFactionData: () => ({
			renownLevel: 12,
			renownReputationEarned: 300,
			renownLevelThreshold: 2500,
		}),
	});
	const rows = new ReputationClient().getReputations();
	expect(
		rows.map(({ current, maximum, maxed }) => ({ current, maximum, maxed })),
	).toEqual([
		{ current: 100, maximum: 500, maxed: false },
		{ current: 300, maximum: 2500, maxed: false },
		{ current: 2500, maximum: 10000, maxed: true },
	]);
	expect(
		rows.map(({ standing, progress }) => ({ standing, progress })),
	).toEqual([
		{ standing: "Buddy", progress: "100 / 500" },
		{ standing: "Renown 12", progress: "300 / 2500" },
		{ standing: "Paragon — Reward available", progress: "2500 / 10000" },
	]);
});

it("recognizes capped ordinary, friendship and renown reputations", () => {
	vi.stubGlobal("C_Reputation", {
		GetNumFactions: () => 3,
		GetFactionDataByIndex: (index: number) => ({
			factionID: index,
			name: "Faction",
			reaction: index === 1 ? 8 : 5,
			currentStanding: 42000,
			currentReactionThreshold: 42000,
			nextReactionThreshold: 42999,
		}),
		IsMajorFaction: (id: number) => id === 3,
		IsFactionParagonForCurrentPlayer: () => false,
	});
	vi.stubGlobal("C_GossipInfo", {
		GetFriendshipReputation: (id: number) =>
			id === 2
				? {
						friendshipFactionID: 2,
						standing: 1000,
						reaction: "Best Friend",
						reactionThreshold: 1000,
					}
				: undefined,
	});
	vi.stubGlobal("C_MajorFactions", {
		GetMajorFactionData: () => ({
			renownLevel: 30,
			renownReputationEarned: 0,
			renownLevelThreshold: 2500,
		}),
		HasMaximumRenown: () => true,
	});
	expect(
		new ReputationClient().getReputations().map((row) => row.maxed),
	).toEqual([true, true, true]);
});
it("converts faction progress and routes header expansion and watched reputation safely", () => {
	const data = [
		{
			factionID: 0,
			name: "Expansion",
			isHeader: true,
			isCollapsed: true,
			isChild: false,
		},
		{
			factionID: 42,
			name: "Faction",
			reaction: 5,
			currentStanding: 4500,
			currentReactionThreshold: 3000,
			nextReactionThreshold: 9000,
			isWatched: true,
			isChild: true,
		},
	];
	const api = {
		GetNumFactions: () => 2,
		GetFactionDataByIndex: (index: number) => data.at(index - 1),
		IsMajorFaction: () => false,
		IsFactionParagonForCurrentPlayer: () => false,
		ExpandFactionHeader: vi.fn(),
		CollapseFactionHeader: vi.fn(),
		SetWatchedFactionByID: vi.fn(),
	};
	vi.stubGlobal("C_Reputation", api);
	vi.stubGlobal("C_GossipInfo", { GetFriendshipReputation: () => undefined });
	const client = new ReputationClient();
	const rows = client.getReputations();
	expect(rows.at(1)).toMatchObject({
		name: "Faction",
		standing: "Friendly",
		progress: "1500 / 6000",
		watched: true,
		child: true,
	});
	const header = rows.at(0),
		faction = rows.at(1);
	if (!header || !faction) throw new Error("Missing factions");
	client.activate(header);
	client.activate(faction);
	expect(api.ExpandFactionHeader).toHaveBeenCalledWith(1);
	expect(api.SetWatchedFactionByID).toHaveBeenCalledWith(0);
	const changedFaction = data.at(1);
	if (!changedFaction) throw new Error("Missing faction");
	changedFaction.factionID = 99;
	client.activate(faction);
	expect(api.SetWatchedFactionByID).toHaveBeenCalledOnce();
});
