import type { WowFrame } from "../../types";

/** Legacy merchant and FrameXML APIs absent from the generated game API surface. */
declare global {
	const MerchantFrame: WowFrame & {
		GetParent(): WowFrame | undefined;
		IsShown(): boolean;
	};
	function GetMerchantNumItems(this: void): number;
	function GetMerchantItemLink(this: void, index: number): string | undefined;
	function GetMerchantItemCostInfo(this: void, index: number): number;
	function GetMerchantItemCostItem(
		this: void,
		index: number,
		cost: number,
	): LuaMultiReturn<
		[number | undefined, number, string | undefined, string | undefined]
	>;
	function CanAffordMerchantItem(this: void, index: number): boolean;
	function BuyMerchantItem(this: void, index: number): void;
	function GetNumBuybackItems(this: void): number;
	function GetBuybackItemInfo(
		this: void,
		index: number,
	): LuaMultiReturn<[string | undefined, number, number, number]>;
	function GetBuybackItemLink(this: void, index: number): string | undefined;
	function BuybackItem(this: void, index: number): void;
	function CanMerchantRepair(this: void): boolean;
	function GetRepairAllCost(this: void): LuaMultiReturn<[number, boolean]>;
	function CanGuildBankRepair(this: void): boolean;
	function GetGuildBankWithdrawMoney(this: void): number;
	function GetGuildBankMoney(this: void): number;
	function RepairAllItems(this: void, guild: boolean): void;
	function CloseMerchant(this: void): void;
	function OpenAllBags(this: void): void;
}
