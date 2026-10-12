export type DungeonSection = "special" | "heroic" | "normal";
export type DungeonRole = "tank" | "healer" | "damage" | "leader";
export type DungeonListId = "follower" | "specific";
export interface DungeonList {
	readonly id: DungeonListId;
	readonly label: string;
}
export interface DungeonChoice {
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
export interface IDungeonFinderClient {
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

export class DungeonFinderClient implements IDungeonFinderClient {
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
			const [name] = GetLFGDungeonInfo(id);
			choices.push({ id, name, available, checked: checked[id] === true });
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
		return (
			mode === "queued" ||
			mode === "rolecheck" ||
			mode === "proposal" ||
			mode === "suspended"
		);
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
