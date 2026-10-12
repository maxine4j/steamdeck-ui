import type { WowFrame } from "../../types";

type FinderFrame = WowFrame & {
	IsShown(): boolean;
	GetParent(): WowFrame | undefined;
	HookScript(script: "OnShow" | "OnHide", callback: (this: void) => void): void;
};

declare global {
	const LFGEnabledList:
		| Record<number, boolean | number | undefined>
		| undefined;
	// Legacy finder APIs are absent from the generated Blizzard documentation.
	function GetLFDChoiceOrder(this: void): number[];
	function GetLFDChoiceEnabledState(
		this: void,
	): Record<number, boolean | number | undefined>;
	namespace C_LFGList {
		function GetAvailableRoles(
			this: void,
		): LuaMultiReturn<[boolean, boolean, boolean]>;
	}
	const PVEFrame: FinderFrame;
	const LFDParentFrame: FinderFrame;
	const LFDQueueFrame: { type?: number | string };
	const LFDQueueFrameFindGroupButton: { IsEnabled(): boolean };
	function PVEFrame_ShowFrame(
		this: void,
		frame: string,
		parent: FinderFrame,
	): void;
	function GetNumRandomDungeons(this: void): number;
	function GetLFGRandomDungeonInfo(
		this: void,
		index: number,
	): LuaMultiReturn<[number, string]>;
	function GetLFGDungeonInfo(
		this: void,
		id: number,
	): LuaMultiReturn<
		[
			string,
			number,
			number,
			number,
			number,
			number,
			number,
			number,
			number,
			number,
			number | string,
			number,
			number,
			string,
			boolean,
			boolean,
			boolean,
			boolean,
		]
	>;
	function IsLFGDungeonJoinable(
		this: void,
		id: number,
	): LuaMultiReturn<[boolean, boolean, boolean]>;
	function GetLFGRoles(
		this: void,
	): LuaMultiReturn<[boolean, boolean, boolean, boolean]>;
	function SetLFGRoles(
		this: void,
		leader: boolean,
		tank: boolean,
		healer: boolean,
		damage: boolean,
	): void;
	function GetLFGMode(
		this: void,
		category: number,
	): LuaMultiReturn<[string | undefined, string | undefined]>;
	function LeaveLFG(this: void, category: number): void;
	function LFDQueueFrame_SetType(
		this: void,
		id: number | "specific" | "follower",
	): void;
	function LFDQueueFrame_Update(this: void): void;
	function LFGDungeonList_SetDungeonEnabled(
		this: void,
		id: number,
		enabled: boolean,
	): void;
	const LFGLockList:
		| Record<number, { hideEntry?: boolean } | undefined>
		| undefined;
	function LFD_CURRENT_FILTER(this: void, id: number): boolean;
	function LFDQueueFrame_Join(this: void): void;
	function LFDQueueFrame_UpdateRoleButtons(this: void): void;
	function LFG_UpdateAllRoleCheckboxes(this: void): void;
}
