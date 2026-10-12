export type DungeonSection = "special" | "heroic" | "normal";
export type DungeonRole = "tank" | "healer" | "damage" | "leader";
export interface RandomDungeon {
	readonly id: number;
	readonly name: string;
	readonly section: DungeonSection;
	readonly available: boolean;
}
export interface IDungeonFinderClient {
	getDungeons(): RandomDungeon[];
	getSelected(): number | undefined;
	getRoles(): Record<DungeonRole, boolean>;
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
	getSelected(): number | undefined {
		return typeof LFDQueueFrame.type === "number"
			? LFDQueueFrame.type
			: undefined;
	}
	getRoles(): Record<DungeonRole, boolean> {
		const [leader, tank, healer, damage] = GetLFGRoles();
		return { leader, tank, healer, damage };
	}
	toggleRole(role: DungeonRole): void {
		if (this.isQueued()) return;
		const [leader, tank, healer, damage] = GetLFGRoles();
		if (role !== "leader") {
			const [canTank, canHeal, canDamage] = C_LFGList.GetAvailableRoles();
			if (
				!(role === "tank" ? canTank : role === "healer" ? canHeal : canDamage)
			)
				return;
		}
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
		if (
			!this.getDungeons().some(
				(dungeon) => dungeon.id === selected && dungeon.available,
			)
		)
			return;
		LFDQueueFrame_Join();
	}
	leave(): void {
		LeaveLFG(1);
	}
}
