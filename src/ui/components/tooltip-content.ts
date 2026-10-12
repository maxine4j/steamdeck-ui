/** Native tooltip data sources; numeric values retain ordinary item semantics. */
export type TooltipContent = string | number | { readonly toy: number };

export interface TooltipDataFrame {
	SetHyperlink(link: string): void;
	SetToyByItemID(id: number): boolean;
}

export function setTooltipContent(
	frame: TooltipDataFrame,
	content: TooltipContent,
): void {
	if (typeof content === "object") frame.SetToyByItemID(content.toy);
	else
		frame.SetHyperlink(
			typeof content === "number" ? `item:${content}` : content,
		);
}
