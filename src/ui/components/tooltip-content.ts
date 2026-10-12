/** Plain links/IDs include equipped comparisons; wrapped items show details only. */
export type TooltipContent =
	| string
	| number
	| { readonly toy: number }
	| { readonly item: string | number };

export interface TooltipDataFrame {
	SetHyperlink(link: string): void;
	SetToyByItemID(id: number): boolean;
}

export function setTooltipContent(
	frame: TooltipDataFrame,
	content: TooltipContent,
): void {
	if (typeof content === "object" && "toy" in content) {
		frame.SetToyByItemID(content.toy);
		return;
	}
	const item = typeof content === "object" ? content.item : content;
	frame.SetHyperlink(typeof item === "number" ? `item:${item}` : item);
}
