import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReputationClient } from "./reputation-client";

afterEach(() => vi.unstubAllGlobals());
it("exposes and safely toggles war and inactive status using current faction permissions", () => {
	const data = {
		factionID: 42,
		name: "Faction",
		reaction: 5,
		canToggleAtWar: true,
		canSetInactive: true,
		atWarWith: true,
	};
	const api = {
		GetNumFactions: () => 1,
		GetFactionDataByIndex: () => data,
		IsFactionActive: vi.fn(() => false),
		IsMajorFaction: () => false,
		IsFactionParagonForCurrentPlayer: () => false,
		ToggleFactionAtWar: vi.fn(),
		SetFactionActive: vi.fn(),
	};
	vi.stubGlobal("C_Reputation", api);
	vi.stubGlobal("C_GossipInfo", { GetFriendshipReputation: () => undefined });
	const client = new ReputationClient();
	const row = client.getReputations().at(0);
	if (!row) throw new Error("Missing faction");
	expect(row).toMatchObject({
		atWar: true,
		canToggleAtWar: true,
		inactive: true,
		canSetInactive: true,
	});
	client.toggleAtWar(row);
	client.toggleInactive(row);
	expect(api.ToggleFactionAtWar).toHaveBeenCalledExactlyOnceWith(1);
	expect(api.SetFactionActive).toHaveBeenCalledExactlyOnceWith(1, true);
	data.canToggleAtWar = false;
	data.canSetInactive = false;
	client.toggleAtWar(row);
	client.toggleInactive(row);
	data.canToggleAtWar = true;
	data.canSetInactive = true;
	data.factionID = 99;
	client.toggleAtWar(row);
	client.toggleInactive(row);
	client.toggleAtWar({ ...row, seasonal: true });
	client.toggleInactive({ ...row, seasonal: true });
	expect(api.ToggleFactionAtWar).toHaveBeenCalledOnce();
	expect(api.SetFactionActive).toHaveBeenCalledOnce();
});
beforeEach(() => {
	vi.stubGlobal("GetExpansionLevel", () => 11);
	vi.stubGlobal("C_MajorFactions", { GetMajorFactionIDs: () => [] });
});

it("adds current seasonal journeys once, excluding hidden journeys and ordinary renown", () => {
	const major = {
		GetMajorFactionIDs: vi.fn(() => [10, 20, 30, 40]),
		ShouldDisplayMajorFactionAsJourney: (id: number) => id !== 30,
		IsMajorFactionHiddenFromExpansionPage: (id: number) => id === 40,
		GetMajorFactionData: (id: number) => ({
			name: id === 10 ? "Prey" : "Delves",
			description: "Seasonal journey",
			isUnlocked: id === 10,
			renownLevel: 5,
			maxLevel: 10,
			renownReputationEarned: 400,
			renownLevelThreshold: 1000,
		}),
		HasMaximumRenown: () => false,
	};
	vi.stubGlobal("C_MajorFactions", major);
	const api = {
		GetNumFactions: () => 1,
		GetFactionDataByIndex: () => ({
			factionID: 10,
			name: "Prey",
			reaction: 5,
			currentStanding: 400,
			currentReactionThreshold: 0,
			nextReactionThreshold: 1000,
		}),
		IsMajorFaction: () => true,
		IsFactionParagonForCurrentPlayer: () => false,
		GetWatchedFactionData: () => ({ factionID: 10 }),
		SetWatchedFactionByID: vi.fn(),
	};
	vi.stubGlobal("C_Reputation", api);
	vi.stubGlobal("C_GossipInfo", { GetFriendshipReputation: () => undefined });
	const client = new ReputationClient();
	const rows = client.getReputations();
	expect(major.GetMajorFactionIDs).toHaveBeenCalledWith(11);
	expect(rows).toMatchObject([
		{
			id: 10,
			name: "Prey",
			seasonal: true,
			standing: "Level 5 / 10",
			current: 400,
			maximum: 1000,
			watched: true,
		},
		{
			id: 20,
			name: "Delves",
			seasonal: true,
			standing: "Locked",
			current: 0,
			maximum: 0,
			locked: true,
		},
	]);
	const prey = rows.at(0);
	const delves = rows.at(1);
	if (!prey || !delves) throw new Error("Missing seasonal journeys");
	client.activate(prey);
	expect(api.SetWatchedFactionByID).toHaveBeenCalledWith(0);
	client.activate(delves);
	expect(api.SetWatchedFactionByID).toHaveBeenCalledOnce();
});

it("keeps capped seasonal journeys full and retains their paragon progress", () => {
	vi.stubGlobal("C_MajorFactions", {
		GetMajorFactionIDs: () => [10, 20],
		ShouldDisplayMajorFactionAsJourney: () => true,
		IsMajorFactionHiddenFromExpansionPage: () => false,
		GetMajorFactionData: () => ({
			name: "Journey",
			description: "",
			isUnlocked: true,
			renownLevel: 10,
			maxLevel: 10,
			renownReputationEarned: 0,
			renownLevelThreshold: 1000,
		}),
		HasMaximumRenown: () => true,
	});
	vi.stubGlobal("C_Reputation", {
		GetNumFactions: () => 0,
		GetWatchedFactionData: () => undefined,
		IsFactionParagonForCurrentPlayer: (id: number) => id === 20,
		GetFactionParagonInfo: () => [1250, 1000, 1, true],
	});
	expect(new ReputationClient().getReputations()).toMatchObject([
		{ id: 10, maxed: true, standing: "Level 10 / 10" },
		{
			id: 20,
			maxed: true,
			standing: "Paragon — Reward available",
			current: 250,
			maximum: 1000,
		},
	]);
});
it("reads every collapsed group including newly revealed child groups", () => {
	const expansion = {
		factionID: 0,
		name: "Midnight",
		isHeader: true,
		isCollapsed: true,
	};
	const parent = {
		factionID: 1,
		name: "Silvermoon Court",
		isHeader: true,
		isHeaderWithRep: true,
		isChild: true,
		isCollapsed: true,
	};
	const child = {
		factionID: 2,
		name: "Magisters",
		isHeader: false,
		isChild: true,
	};
	const visible = () =>
		expansion.isCollapsed
			? [expansion]
			: parent.isCollapsed
				? [expansion, parent]
				: [expansion, parent, child];
	const expand = vi.fn((index: number) => {
		const row = visible().at(index - 1);
		if (row && "isCollapsed" in row) row.isCollapsed = false;
	});
	vi.stubGlobal("C_Reputation", {
		GetNumFactions: () => visible().length,
		GetFactionDataByIndex: (index: number) => visible().at(index - 1),
		ExpandFactionHeader: expand,
		IsMajorFaction: () => false,
		IsFactionParagonForCurrentPlayer: () => false,
	});
	vi.stubGlobal("C_GossipInfo", { GetFriendshipReputation: () => undefined });
	expect(
		new ReputationClient().getReputations().map((row) => row.name),
	).toEqual(["Midnight", "Silvermoon Court", "Magisters"]);
	expect(expand.mock.calls).toEqual([[1], [2]]);
});

it("watches reputation-bearing parents without collapsing their children", () => {
	const row = {
		factionID: 42,
		name: "Silvermoon Court",
		isHeader: true,
		isHeaderWithRep: true,
		isWatched: false,
	};
	const api = {
		GetNumFactions: () => 1,
		GetFactionDataByIndex: () => row,
		IsMajorFaction: () => false,
		IsFactionParagonForCurrentPlayer: () => false,
		SetWatchedFactionByID: vi.fn(),
		CollapseFactionHeader: vi.fn(),
	};
	vi.stubGlobal("C_Reputation", api);
	vi.stubGlobal("C_GossipInfo", { GetFriendshipReputation: () => undefined });
	const client = new ReputationClient();
	const reputation = client.getReputations().at(0);
	if (!reputation) throw new Error("Missing parent");
	client.activate(reputation);
	expect(api.SetWatchedFactionByID).toHaveBeenCalledWith(42);
	expect(api.CollapseFactionHeader).not.toHaveBeenCalled();
	row.isWatched = true;
	client.activate(reputation);
	expect(api.SetWatchedFactionByID).toHaveBeenLastCalledWith(0);
});
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
		GetMajorFactionIDs: () => [],
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
		GetMajorFactionIDs: () => [],
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
			isCollapsed: false,
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
	expect(api.ExpandFactionHeader).not.toHaveBeenCalled();
	expect(api.SetWatchedFactionByID).toHaveBeenCalledWith(0);
	const changedFaction = data.at(1);
	if (!changedFaction) throw new Error("Missing faction");
	changedFaction.factionID = 99;
	client.activate(faction);
	expect(api.SetWatchedFactionByID).toHaveBeenCalledOnce();
});
