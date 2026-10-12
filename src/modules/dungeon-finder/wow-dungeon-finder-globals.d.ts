import type { WowFrame } from "../../types";

type FinderFrame = WowFrame & {
	IsShown(): boolean;
	GetParent(): WowFrame | undefined;
	HookScript(script: "OnShow" | "OnHide", callback: (this: void) => void): void;
};

declare global {
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
	function LFDQueueFrame_SetType(this: void, id: number): void;
	function LFDQueueFrame_Join(this: void): void;
	function LFDQueueFrame_UpdateRoleButtons(this: void): void;
	function LFG_UpdateAllRoleCheckboxes(this: void): void;
}
