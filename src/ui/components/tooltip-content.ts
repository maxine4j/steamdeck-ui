/** Plain links/IDs include equipped comparisons; wrapped items show details only. */
export type TooltipContent =
	| string
	| number
	| { readonly toy: number }
	| { readonly mountSpell: number }
	| { readonly item: string | number };

export interface TooltipDataFrame {
	SetHyperlink(link: string): void;
	SetToyByItemID(id: number): boolean;
	SetMountBySpellID(spell: number): void;
}

export function setTooltipContent(
	frame: TooltipDataFrame,
	content: TooltipContent,
): void {
	if (typeof content === "object" && "toy" in content) {
		frame.SetToyByItemID(content.toy);
		return;
	}
	if (typeof content === "object" && "mountSpell" in content) {
		frame.SetMountBySpellID(content.mountSpell);
		return;
	}
	const item = typeof content === "object" ? content.item : content;
	frame.SetHyperlink(typeof item === "number" ? `item:${item}` : item);
}
