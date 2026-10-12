// Verified against Blizzard_AchievementUI/Mainline/Blizzard_AchievementUI.lua.
// Kept client-owned: generated wow.d.ts is deliberately unchanged.
type NativeAchievement = [
	number,
	string,
	number,
	boolean,
	number | undefined,
	number | undefined,
	number | undefined,
	string,
	number,
	number,
	string,
	boolean,
	boolean,
	string,
];
declare function GetCategoryList(this: void): number[];
declare function GetCategoryInfo(
	this: void,
	id: number,
): LuaMultiReturn<[string, number, number]>;
declare function GetCategoryNumAchievements(
	this: void,
	id: number,
	all?: boolean,
): LuaMultiReturn<[number, number, number]>;
declare function GetAchievementInfo(
	this: void,
	id: number,
	index?: number,
): LuaMultiReturn<NativeAchievement>;
declare function GetAchievementCategory(this: void, id: number): number;
declare function GetTotalAchievementPoints(this: void): number;
declare function GetNumCompletedAchievements(
	this: void,
): LuaMultiReturn<[number, number]>;
declare function GetLatestCompletedAchievements(
	this: void,
): LuaMultiReturn<number[]>;
declare function GetAchievementNumCriteria(this: void, id: number): number;
declare function GetAchievementCriteriaInfo(
	this: void,
	id: number,
	index: number,
): LuaMultiReturn<
	[string, number, boolean, number, number, string, number, number, string]
>;
declare function GetPreviousAchievement(
	this: void,
	id: number,
): number | undefined;
declare function GetNextAchievement(
	this: void,
	id: number,
): LuaMultiReturn<[number | undefined, boolean]>;
declare const EVALUATION_TREE_FLAG_PROGRESS_BAR: number;
