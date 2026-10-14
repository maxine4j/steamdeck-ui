export type DungeonSection = "special" | "heroic" | "normal";
export type DungeonRole = "tank" | "healer" | "damage" | "leader";
export type DungeonListId = "follower" | "specific";
export interface DungeonList {
	readonly id: DungeonListId;
	readonly label: string;
}
export interface DungeonChoice {
	readonly difficulty: "normal" | "heroic";
	readonly id: number;
	readonly name: string;
	readonly available: boolean;
	readonly checked: boolean;
}
export interface RandomDungeon {
	readonly id: number;
	readonly name: string;
	readonly section: DungeonSection;
	readonly available: boolean;
}
export interface RaidWing {
	readonly id: number;
	readonly name: string;
	readonly available: boolean;
	readonly queued: boolean;
	readonly bosses: readonly { name: string; killed: boolean }[];
}
export interface FinderRaid {
	readonly id: number;
	readonly name: string;
	readonly wings: RaidWing[];
	readonly background?: string | number;
}
export interface IDungeonFinderClient {
	getRaids(): FinderRaid[];
	canQueueRaid(): boolean;
	joinRaid(id: number): void;
	leaveRaid(id: number): void;
	getDungeons(): RandomDungeon[];
	getSelected(): number | DungeonListId | undefined;
	getDungeonLists(): readonly DungeonList[];
	getDungeonChoices(list: DungeonListId): DungeonChoice[];
	selectList(list: DungeonListId): void;
	toggleDungeon(list: DungeonListId, id: number): void;
	getRoles(): Record<DungeonRole, boolean>;
	getAvailableRoles(): Record<DungeonRole, boolean>;
	toggleRole(role: DungeonRole): void;
	isQueued(): boolean;
	select(id: number): void;
	join(): void;
	leave(): void;
}
const sectionOrder: Record<DungeonSection, number> = {
	special: 0,
	heroic: 1,
	normal: 2,
};
const raidCategory = 3;
// Reported Retail limit; Blizzard exposes no queue-capacity API.
const raidQueueLimit = 7;

function activeQueue(mode: string | undefined): boolean {
	return (
		mode === "queued" ||
		mode === "rolecheck" ||
		mode === "proposal" ||
		mode === "suspended"
	);
}

export class DungeonFinderClient implements IDungeonFinderClient {
	getRaids(): FinderRaid[] {
		const currentExpansion = GetServerExpansionLevel();
		const raids: (FinderRaid & { expansion: number; newestWing: number })[] =
			[];
		for (let index = 1; index <= GetNumRFDungeons(); index++) {
			const [
				id,
				name,
				,
				,
				,
				,
				,
				,
				,
				expansion,
				,
				,
				,
				,
				,
				,
				,
				,
				,
				raidName,
				,
				,
				mapId,
			] = GetRFDungeonInfo(index);
			if (expansion !== currentExpansion) continue;
			const [available, playerAvailable, hide] = IsLFGDungeonJoinable(id);
			const [mode] = GetLFGMode(raidCategory, id);
			const queued = activeQueue(mode);
			if (!queued && !available && !playerAvailable && hide) continue;
			let raid = raids.find((entry) => entry.id === mapId);
			if (!raid) {
				const [, , , , , , , , , , background] = GetLFGDungeonInfo(id);
				raid = {
					id: mapId,
					name: raidName,
					wings: [],
					background,
					expansion,
					newestWing: id,
				};
				raids.push(raid);
			}
			raid.newestWing = Math.max(raid.newestWing, id);
			const bosses: { name: string; killed: boolean }[] = [];
			const encounters = GetLFGDungeonNumEncounters(id);
			for (let encounter = 1; encounter <= encounters; encounter++) {
				const [bossName, , killed] = GetLFGDungeonEncounterInfo(id, encounter);
				bosses.push({ name: bossName, killed });
			}
			raid.wings.push({ id, name, available, queued, bosses });
		}
		raids.sort(
			(a, b) => b.expansion - a.expansion || b.newestWing - a.newestWing,
		);
		return raids.map(({ id, name, wings, background }) => ({
			id,
			name,
			wings,
			background,
		}));
	}
	canQueueRaid(): boolean {
		const active = new Set<number>();
		for (const id of Object.keys(GetLFGQueuedList(raidCategory))) {
			const [mode] = GetLFGMode(raidCategory, Number(id));
			if (activeQueue(mode)) active.add(Number(id));
		}
		// Blizzard's queued list omits pending role checks and proposals.
		for (const raid of this.getRaids()) {
			for (const wing of raid.wings) {
				if (wing.queued) active.add(wing.id);
			}
		}
		return active.size < raidQueueLimit;
	}
	joinRaid(id: number): void {
		if (
			!this.canQueueRaid() ||
			!this.getRaids().some((raid) =>
				raid.wings.some(
					(wing) => wing.id === id && wing.available && !wing.queued,
				),
			)
		)
			return;
		RaidFinderQueueFrame_SetRaid(id);
		if (RaidFinderFrameFindRaidButton.IsEnabled()) RaidFinderQueueFrame_Join();
	}
	leaveRaid(id: number): void {
		const [mode] = GetLFGMode(raidCategory, id);
		if (mode !== "queued" && mode !== "rolecheck" && mode !== "suspended")
			return;
		RaidFinderQueueFrame_SetRaid(id);
		if (RaidFinderFrameFindRaidButton.IsEnabled())
			LeaveSingleLFG(raidCategory, id);
	}
	getDungeons(): RandomDungeon[] {
		const dungeons: RandomDungeon[] = [];
		for (let index = 1; index <= GetNumRandomDungeons(); index++) {
			const [id, name] = GetLFGRandomDungeonInfo(index);
			const [available, playerAvailable, hide] = IsLFGDungeonJoinable(id);
			if ((!playerAvailable && hide) || C_LFGInfo.IsLFGFollowerDungeon(id))
				continue;
			const [
				,
				,
				subtype,
				,
				,
				,
				,
				,
				,
				,
				,
				difficulty,
				,
				,
				holiday,
				,
				,
				timewalking,
			] = GetLFGDungeonInfo(id);
			dungeons.push({
				id,
				name,
				available,
				section:
					holiday || timewalking
						? "special"
						: subtype === 2 || difficulty === 2
							? "heroic"
							: "normal",
			});
		}
		dungeons.sort(
			(a, b) =>
				sectionOrder[a.section] - sectionOrder[b.section] || a.id - b.id,
		);
		return dungeons;
	}
	getSelected(): number | DungeonListId | undefined {
		const selected = LFDQueueFrame.type;
		return typeof selected === "number" ||
			selected === "specific" ||
			selected === "follower"
			? selected
			: undefined;
	}
	getDungeonLists(): readonly DungeonList[] {
		return [
			{ id: "follower", label: "Follower Dungeon" },
			{ id: "specific", label: "Specific Dungeons" },
		];
	}
	getDungeonChoices(list: DungeonListId): DungeonChoice[] {
		const checked =
			typeof LFGEnabledList !== "undefined" && LFGEnabledList
				? LFGEnabledList
				: GetLFDChoiceEnabledState();
		const choices: DungeonChoice[] = [];
		for (const id of GetLFDChoiceOrder()) {
			if (id <= 0 || LFGLockList?.[id]?.hideEntry || !LFD_CURRENT_FILTER(id))
				continue;
			if (C_LFGInfo.IsLFGFollowerDungeon(id) !== (list === "follower"))
				continue;
			const [available, playerAvailable, hide] = IsLFGDungeonJoinable(id);
			if (!playerAvailable && hide) continue;
			const [name, , subtype, , , , , , , , , difficulty] =
				GetLFGDungeonInfo(id);
			choices.push({
				id,
				name,
				available,
				checked: checked[id] === true,
				difficulty: subtype === 2 || difficulty === 2 ? "heroic" : "normal",
			});
		}
		return choices;
	}
	selectList(list: DungeonListId): void {
		if (this.isQueued()) return;
		LFDQueueFrame_SetType(list);
		LFDQueueFrame_Update();
	}
	toggleDungeon(list: DungeonListId, id: number): void {
		if (this.isQueued()) return;
		const dungeon = this.getDungeonChoices(list).find(
			(choice) => choice.id === id,
		);
		if (!dungeon?.available) return;
		if (this.getSelected() !== list) this.selectList(list);
		LFGDungeonList_SetDungeonEnabled(id, !dungeon.checked);
		LFDQueueFrame_Update();
		LFDQueueFrame_UpdateRoleButtons();
	}
	getRoles(): Record<DungeonRole, boolean> {
		const [leader, tank, healer, damage] = GetLFGRoles();
		return { leader, tank, healer, damage };
	}
	getAvailableRoles(): Record<DungeonRole, boolean> {
		const [tank, healer, damage] = C_LFGList.GetAvailableRoles();
		return { leader: true, tank, healer, damage };
	}
	toggleRole(role: DungeonRole): void {
		if (this.isQueued()) return;
		const [leader, tank, healer, damage] = GetLFGRoles();
		if (role !== "leader" && !this.getAvailableRoles()[role]) return;
		SetLFGRoles(
			role === "leader" ? !leader : leader,
			role === "tank" ? !tank : tank,
			role === "healer" ? !healer : healer,
			role === "damage" ? !damage : damage,
		);
		LFG_UpdateAllRoleCheckboxes();
		LFDQueueFrame_UpdateRoleButtons();
	}
	isQueued(): boolean {
		const [mode] = GetLFGMode(1);
		return activeQueue(mode);
	}
	select(id: number): void {
		if (
			this.isQueued() ||
			!this.getDungeons().some(
				(dungeon) => dungeon.id === id && dungeon.available,
			)
		)
			return;
		LFDQueueFrame_SetType(id);
	}
	join(): void {
		if (this.isQueued() || !LFDQueueFrameFindGroupButton.IsEnabled()) return;
		const selected = this.getSelected();
		const valid =
			typeof selected === "string"
				? this.getDungeonChoices(selected).some(
						(dungeon) => dungeon.checked && dungeon.available,
					)
				: this.getDungeons().some(
						(dungeon) => dungeon.id === selected && dungeon.available,
					);
		if (!valid) return;
		LFDQueueFrame_Join();
	}
	leave(): void {
		LeaveLFG(1);
	}
}
